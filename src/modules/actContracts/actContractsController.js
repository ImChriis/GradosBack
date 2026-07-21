const PDFDocument = require('pdfkit');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('../../config/db');

exports.getActs = async (req, res) => {
    try{
       const sql = `
            SELECT 
                ag.CodigoActo, ag.CoLugar, ag.Fecha, ag.Hora, ag.siglas, ag.especialidad, 
                ag.titulo, ag.MnCosto, la.TxLugar, i.CodigoInst, i.nbInstitucion 
            FROM actosgrados AS ag 
            LEFT JOIN lugaracto AS la ON ag.CoLugar = la.CoLugar 
            LEFT JOIN instituciones AS i ON ag.CodigoInst = i.CodigoInst 
            WHERE ag.Culminada = 0 
            ORDER BY ag.CodigoActo DESC`;   
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching acts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
 
exports.getActsUsersByCodigoActo = async (req, res) => {
    const { CodigoActo } = req.params;
    try{
        const sql = `SELECT 
    d.NoContrato, 
    d.Nombre, 
    d.NuCedula, 
    c.txemail AS email,
    d.MnPagado, 
    d.MnSaldo, 
    d.MnContrato, 
    d.MnDescuento, 
    d.MnInicial
FROM deactosgrados d
INNER JOIN clientes c ON c.NuCedula = d.NuCedula
WHERE d.CodigoActo = ?
ORDER BY d.Nombre ASC;`;
        const [rows] = await db.query(sql, [CodigoActo]);
        res.json(rows);
    }catch (error){
        console.error('Error fetching acts users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.createAct = async(req, res) => {
    const { CodigoActo, Fecha, Hora, siglas, Titulo, CoLugar, MnCosto, Especialidad, CodUser, Culminada, CodigoInst } = req.body;

    try{
        // console.log(req.body);
        const sql = `INSERT INTO ActosGrados (CodigoActo, Fecha, Hora, siglas, Titulo, CoLugar, MnCosto, Especialidad, CodUser, Culminada, CodigoInst) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [CodigoActo, Fecha, Hora, siglas, Titulo, CoLugar, MnCosto, Especialidad, CodUser, Culminada, CodigoInst]);

        const sql2 = 'UPDATE configuracion SET NoActo = ?';
        await db.execute(sql2, [CodigoActo]);
        
        res.status(201).json({ message: "Acto creado exitosamente" });
    } catch (error) {
        console.error('Error creating act:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateAct = async (req, res) => {
    const { codigoActo } = req.params;
    const { CodigoActo, Fecha, Hora, siglas, Titulo, CoLugar, Especialidad, CodUser, Culminada, CodigoInst } = req.body;

    try{
        const sql = `UPDATE ActosGrados SET CodigoActo = ?, Fecha = ?, Hora = ?, siglas = ?, Titulo = ?, CoLugar = ?, Especialidad = ?, CodUser = ?, Culminada = ?, CodigoInst = ? WHERE CodigoActo = ?`;
        await db.query(sql, [CodigoActo, Fecha, Hora, siglas, Titulo, CoLugar, Especialidad, CodUser, Culminada, CodigoInst, codigoActo]);
        res.status(201).json({ message: "Acto actualizado exitosamente" });
    } catch (error) {
        console.error('Error updating act:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.getActTotal = async (req, res) => {
    const { CodigoActo } = req.params;
    try{
        const sql = 'SELECT SUM(MnContrato) AS MontoTotal FROM deactosgrados WHERE CodigoActo = ?';
        const [rows] = await db.query(sql, [CodigoActo]);

        const total = rows[0].MontoTotal || 0;

        res.json({
            MontoTotal: total
        });
    }catch (error){
        console.error('Error fetching act total:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.recalculateActTotal = async (req, res) => {
   const { codigoActo, nuevoMonto } = req.body;

    if (!codigoActo || nuevoMonto === undefined) {
        return res.status(400).json({ message: "Datos incompletos para el recalculo" });
    }

    // Iniciamos la conexión desde el pool
    const connection = await db.getConnection();

    try {
        // 1. Iniciar Transacción
        await connection.beginTransaction();

        // 2. Actualizar tabla maestra de Actos
        await connection.execute(
            "UPDATE ActosGrados SET MnCosto = ? WHERE CodigoActo = ?",
            [nuevoMonto, codigoActo]
        );

        // 3. Actualizar detalle de graduandos (Ajustando saldos según lo pagado)
        // Lógica: NuevoSaldo = NuevoMonto - LoYaPagado
        await connection.execute(
            `UPDATE DeActosGrados 
             SET MnContrato = ?, 
                 MnSaldo = ? - MnPagado 
             WHERE CodigoActo = ?`,
            [nuevoMonto, nuevoMonto, codigoActo]
        );

        // 4. Actualizar saldos en recibos de pago
        await connection.execute(
            `UPDATE ReciboPago 
             SET MnSaldoRec = ? - MnRecibo 
             WHERE CodigoActo = ?`,
            [nuevoMonto, codigoActo]
        );

        // 5. Si todo salió bien, confirmar cambios
        await connection.commit();

        res.json({ message: "Proceso de recalculo finalizado con éxito" });

    } catch (error) {
        // Si algo falla, revertimos todos los cambios para no dejar data inconsistente
        await connection.rollback();
        console.error("Error en recalculo:", error);
        res.status(500).json({ message: "Error al recalcular montos" });
    } finally {
        // Liberar la conexión al pool
        connection.release();
    }
}

exports.totalPaid = async (req, res) => {
    const { CodigoActo } = req.params;
    try{
        const sql = 'SELECT SUM(MnPagado) AS TotalPagado FROM deactosgrados WHERE CodigoActo = ?';
        const [rows] = await db.query(sql, [CodigoActo]);

        const total = rows[0].TotalPagado || 0;
        res.json({
            TotalPagado: total
        })
    }catch (error){
        console.error('Error fetching total paid:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.saldo = async (req, res) => {
    const { CodigoActo } = req.params;
    try{
        const sql = `
            SELECT 
                COALESCE(SUM(MnContrato), 0) AS total, 
                COALESCE(SUM(MnPagado), 0) AS pagado, 
                COALESCE(SUM(MnSaldo), 0) AS saldo 
            FROM DeActosGrados 
            WHERE CodigoActo = ?
        `;
        const [rows] = await db.query(sql, [CodigoActo]);
        res.json(rows[0]);
    }catch (error){
        console.error('Error fetching saldo:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.getActUsersAmount = async (req, res) => {
    const { CodigoActo } = req.params;
    try{
        const sql = `
            SELECT 
                COUNT(NoContrato) AS cantidadEstudiantes,
                CAST(COALESCE(SUM(MnContrato), 0) AS DECIMAL(10,2)) AS montoTotal,
                CAST(COALESCE(SUM(MnPagado), 0) AS DECIMAL(10,2)) AS montoPagado,
                CAST(COALESCE(SUM(MnSaldo), 0) AS DECIMAL(10,2)) AS montoSaldo
            FROM DeActosGrados 
            WHERE CodigoActo = ?
        `;

        const [rows] = await db.execute(sql, [CodigoActo]);
        
        // Enviamos el primer (y único) objeto del array
        res.json(rows[0]);
    }catch(error){
        console.error('Error fetching act users amount:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.addUserToAct = async (req, res) => {
    const { 
        CodigoActo, NoContrato, NuCedula, Nombre, Txcontacto, 
        MnContrato, MnPagado, MnSaldo, MnInicial, Chemise, 
        MnDescuento, CodSucursal, CodUser 
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // --- PASO 1: Evitar duplicidad de PERSONA en el mismo acto ---
        const [resPersona] = await connection.execute(
            "SELECT COUNT(*) as yaRegistrado FROM DeActosGrados WHERE CodigoActo = ? AND NuCedula = ?", 
            [CodigoActo, NuCedula]
        );

        if (resPersona[0].yaRegistrado > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                status: 'error', 
                message: `La persona con cédula ${NuCedula} ya se encuentra inscrita en este acto.` 
            });
        }

        // --- PASO 2: Verificar rango de contrato (Validación de Configuración) ---
        const [resConfig] = await connection.execute("SELECT NoContrato FROM Configuracion LIMIT 1");
        const contratoLimite = parseInt(resConfig[0]?.NoContrato || 0);
        
        if (parseInt(NoContrato) > contratoLimite) {
            await connection.rollback();
            return res.status(400).json({ 
                status: 'error', 
                message: `El No. de Contrato es inválido. Máximo autorizado: ${contratoLimite}.` 
            });
        }

        const [CodUser] = await db.execute(
            'SELECT CodUser FROM clientes WHERE NuCedula = ?',
            [NuCedula]
        )

        const nextCodUser = CodUser[0]?.CodUser || null;

        // --- PASO 3: Inserción en DeActosGrados ---
        const sqlInsert = `INSERT INTO DeActosGrados 
            (CodigoActo, Nocontrato, NuCedula, Nombre, Txcontacto, MnContrato, MnPagado, MnSaldo, MnInicial, MaEdoCont, CodUser, Chemise, MnDescuento, Fecha, CodSucursal) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?, ?, NOW(), ?)`;

        const params = [
            CodigoActo ?? null, NoContrato ?? null, NuCedula ?? null, Nombre ?? null,
            Txcontacto ?? null, MnContrato ?? 0, MnPagado ?? 0, MnSaldo ?? 0,
            MnInicial ?? 0, nextCodUser ?? null, Chemise ?? null, MnDescuento ?? 0, CodSucursal ?? null
        ];

        await connection.execute(sqlInsert, params);

        // --- PASO 4: Actualizar contador en Configuración ---
        const sqlUpdateConfig = "UPDATE Configuracion SET NoContrato = NoContrato + 1";
        await connection.execute(sqlUpdateConfig);

        await connection.commit();

        res.json({ 
            status: 'success', 
            message: "Registro exitoso y correlativo actualizado.",
            proximoContrato: parseInt(NoContrato) + 1 
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error en registro:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    } finally {
        if (connection) connection.release();
    }
};

exports.getPaymentDataByContract = async (req, res) => {
    const { NoContrato, CodigoActo, NuCedula } = req.params;

    if(!NoContrato || !CodigoActo || !NuCedula) {
        return res.status(400).json({ 
            status: 'error',
            message: "Faltan parámetros requeridos: NoContrato, CodigoActo, NuCedula"
        });
    }

    try{
        const sql = `SELECT * FROM deactosgrados WHERE NoContrato = ? AND CodigoActo = ? AND NuCedula = ?`;
        const [rows] = await db.execute(sql, [NoContrato, CodigoActo, NuCedula]);
        res.json({ status: 'success', data: rows });
    } catch (error){
        console.error("Error fetching payment data:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
}

exports.getRecibosByUserContract = async (req, res) => {
    const { NoContrato } = req.params;

    if(!NoContrato){
        return res.status(400).json({
            stats: 'error',
            message: "Falta el parámetro NoContrato"
        })
    }

    try{
        const sql = `SELECT NoRecibo, ferecibo, mnrecibo, TxConcepRec FROM ReciboPago WHERE NoContrato = ? ORDER BY NoRecibo`;
        const [rows] = await db.execute(sql, [NoContrato]);

        if(rows.length === 0){
            return res.status(404).json({
                message: 'No se encontraron recibos para este contrato'
            })
        }

        res.json(rows);
    } catch (error){
        console.error("Error fetching recibos:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
}

exports.getAbonosByUserContract = async (req, res) => {
    const { NoContrato, NuCedula, NoRecibo } = req.params;


    try {
        // Limpiamos cualquier espacio invisible que venga de la URL
        const contrato = String(NoContrato).trim();
        const cedula = String(NuCedula).trim();

        // console.log(`Ejecutando para: Contrato [${contrato}], Cedula [${cedula}]`);

        // Usamos .query en lugar de .execute para ser más flexibles como phpMyAdmin
        const sql = `SELECT Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito 
                     FROM Depositos 
                     WHERE NoContrato = ? AND NuCedula = ? AND NoRecibo = ?`;
        
        const [rows] = await db.query(sql, [contrato, cedula, NoRecibo]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: `No se encontraron abonos para Contrato: ${contrato} y Cédula: ${cedula}`
            });
        }

        res.json({ status: 'success2', data: rows });

    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

exports.createReciboPago = async (req, res) => {
    // Extraemos los datos del body (vienen desde tu formulario en Angular)
    const { 
        NoRecibo, ferecibo, NuCedula, CodSucursal, NoContrato, 
        tprecibo, mnrecibo, mnsaldorec, TxConcepRec, CodUser, 
        Anulado, Tipo, CodigoActo, MaFormPag, TxBanco, NuRefDocBan
    } = req.body;

    try {
        // Limpiamos strings por seguridad (como en tu ejemplo anterior)
        const reciboId = String(NoRecibo).trim();
        const contratoId = String(NoContrato).trim();
        const cedulaId = String(NuCedula).trim();

        const sql = `INSERT INTO ReciboPago (
                        NoRecibo, ferecibo, NuCedula, CodSucursal, NoContrato, 
                        tprecibo, mnrecibo, mnsaldorec, TxConcepRec, CodUser, 
                        Anulado, Tipo, CodigoActo, MaFormPag, TxBanco, NuRefDocBan
                    ) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        // Pasamos los valores en el orden exacto de los '?'
        const [result] = await db.query(sql, [
            NoRecibo, 
            ferecibo, // La fecha que viene del frontend
            cedulaId, 
            CodSucursal, 
            contratoId, 
            tprecibo, 
            mnrecibo, 
            mnsaldorec, 
            TxConcepRec, 
            CodUser, 
            Anulado ? 1 : 0, // Convertimos boolean a 1/0 para la DB
            Tipo, 
            CodigoActo,
            MaFormPag,
            TxBanco,
            NuRefDocBan
        ]);

        const sql2 = 'UPDATE configuracion SET NoRecibo = ?';
        await db.execute(sql2, [reciboId]);

        // Si se insertó correctamente, devolvemos el éxito
        res.status(201).json({ 
            status: 'success', 
            message: 'Recibo creado correctamente',
            affectedRows: result.affectedRows 
        });

    } catch (error) {
        console.error("Error al insertar el recibo:", error);
        res.status(500).json({ 
            status: 'error',
            message: "Error interno al intentar guardar el recibo",
            details: error.message 
        });
    }
};

exports.createDeposito = async (req, res) => {
    const { NoContrato, NuCedula, NoRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, CodUser, CodSucursal } = req.body;

    try {
        const sql = `
            INSERT INTO Depositos (
                NoContrato, 
                NuCedula, 
                NoRecibo, 
                Fecha, 
                TipoOperacion, 
                TxBanco, 
                NuDeposito, 
                MnDeposito, 
                CodUser, 
                CodSucursal
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [rows] = await db.query(sql, [
            NoContrato, 
            NuCedula, 
            NoRecibo, 
            Fecha, 
            TipoOperacion, 
            TxBanco, 
            NuDeposito, 
            MnDeposito, 
            CodUser, 
            CodSucursal
        ]);
        res.status(201).json({ 
            status: 'success', 
            message: 'Depósito registrado correctamente',
            affectedRows: rows.affectedRows 
        });
    } catch (error) {
        console.error("Error al registrar el depósito:", error);
        res.status(500).json({ 
            status: 'error',
            message: "Internal Server Error",
            details: error.message 
        });
    }
}

exports.updateTotals = async (req, res) => {
    const { CodigoActo, NuCedula } = req.params;
    const { MnContrato, MnDescuento, MnPagado, MnSaldo, MnInicial } = req.body;

    if(!CodigoActo || !NuCedula){
        return res.status(400).json({
            status: 'error',
            message: "Faltan parámetros requeridos: CodigoActo y NuCedula"
        });
    }

    try{
        const sql = `UPDATE deactosgrados SET MnContrato = ?, MnDescuento = ?, MnPagado = ?, MnSaldo = ?, MnInicial = ? WHERE CodigoActo = ? AND NuCedula = ?`;
        const [rows] = await db.query(sql, [MnContrato, MnDescuento, MnPagado, MnSaldo, MnInicial, CodigoActo, NuCedula]);
        res.json({ status: 'success', message: 'Totales actualizados correctamente', affectedRows: rows.affectedRows, data: { MnContrato, MnDescuento, MnPagado, MnSaldo, MnInicial } });
    } catch (error){
        console.error("Error al actualizar los totales:", error);
        res.status(500).json({ status: 'error', message: "Error interno al intentar actualizar los totales", details: error.message });

    }
}

exports.printReciboPdf = async (req, res) => {
    const { NoRecibo, usuarioReporte } = req.params;

    if (!NoRecibo) {
        return res.status(400).json({
            status: 'error',
            message: 'Falta el parámetro NoRecibo'
        });
    }

    const doc = new PDFDocument({
        size: [612, 396],
        margins: { top: 25, bottom: 20, left: 28, right: 28 },
        bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=recibo-${NoRecibo}.pdf`);
    doc.pipe(res);

    const pageWidth = 612;
    const contentWidth = pageWidth - 56;
    const logoPath = path.join(__dirname, 'logo.png');

    const formatMoney = (value) => {
        return new Intl.NumberFormat('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(value || 0));
    };

    const formatDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        return date.toLocaleDateString('es-VE');
    };

    const getTextHeight = (text, width, fontSize = 10, font = 'Helvetica') => {
        doc.fontSize(fontSize).font(font);
        return doc.heightOfString(String(text ?? ''), { width });
    };

    const addHeader = (title) => {
        try {
            doc.image(logoPath, 28, 22, { width: 48 });
        } catch (error) {
            console.log('Error logo');
        }

        doc.fontSize(8).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 90, 24)
            .font('Helvetica').text("J-30591547-4", 90, 35);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        doc.fontSize(7.5).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 420, 22, { align: 'right', width: 164 })
            .text(`Hora: ${horaActual}`, 420, 32, { align: 'right', width: 164 })
            .text(`Usuario: ${usuarioReporte || ''}`, 420, 42, { align: 'right', width: 164 });

        doc.moveTo(28, 60).lineTo(584, 60).lineWidth(0.5).stroke();
        doc.fontSize(11).font('Helvetica-Bold').text(title, 28, 68, { align: 'center', width: 556 });
        doc.moveTo(28, 86).lineTo(584, 86).lineWidth(0.5).stroke();
    };

    const addFooter = () => {
        const footerBaseY = 340;
        doc.moveTo(28, footerBaseY).lineTo(584, footerBaseY).lineWidth(0.5).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor('#000000');
        doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 28, footerBaseY + 8, {
            align: 'center',
            width: 556
        });
        doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 28, footerBaseY + 18, {
            align: 'center',
            width: 556
        });
    };

    try {
        const [reciboRows] = await db.query(`
            SELECT
                r.NoRecibo,
                r.FeRecibo,
                r.NuCedula,
                c.txnombre AS nombreCliente,
                r.txconceprec AS Motivo,
                r.mnrecibo AS MnPagado,
                r.mnsaldorec AS MnSaldo,
                r.NoContrato
            FROM ReciboPago r
            LEFT JOIN clientes c ON c.NuCedula = r.NuCedula
            WHERE r.NoRecibo = ?
            LIMIT 1
        `, [NoRecibo]);

        if (reciboRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No se encontró el recibo'
            });
        }

        const recibo = reciboRows[0];

        const [depositosRows] = await db.query(`
            SELECT Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito
            FROM Depositos
            WHERE NoRecibo = ? AND NoContrato = ? AND NuCedula = ?
            ORDER BY Fecha ASC
        `, [recibo.NoRecibo, recibo.NoContrato, recibo.NuCedula]);

        const buildFormaPago = (pago) => {
            const tipo = String(pago.TipoOperacion || '').trim().toUpperCase();
            const banco = String(pago.TxBanco || '').trim();
            const referencia = String(pago.NuDeposito || '').trim();
            const monto = formatMoney(pago.MnDeposito || 0);

            if (tipo.includes('EFECTIVO')) {
                return `EFECTIVO | ${monto}`;
            }

            if (tipo.includes('T.DEBITO') || tipo.includes('T DEBITO') || tipo.includes('DEBITO')) {
                return `T.DEBITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            }

            if (tipo.includes('T.CREDITO') || tipo.includes('T CREDITO') || tipo.includes('CREDITO')) {
                return `T.CREDITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            }

            if (tipo.includes('DEPOSITO')) {
                return `DEPOSITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            }

            if (tipo.includes('CHEQUE')) {
                return `CHEQUE ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            }

            return `${tipo || 'OTRO'}${banco ? ` ${banco}` : ''}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
        };

        const drawReceipt = (title) => {
            addHeader(title);

            let y = 100;
            const leftX = 28;
            const rightX = 340;
            const labelW = 95;
            const rowGap = 15;
            const bodyWidth = contentWidth;

            const drawRow = (label, value, width = 260) => {
                doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                doc.font('Helvetica').text(value ?? '', leftX + labelW, y, { width: width - labelW });
                y += rowGap;
            };

            const drawWrappedRow = (label, value, width = 260) => {
                doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                doc.font('Helvetica');

                const textHeight = getTextHeight(value, width - labelW, 8.5, 'Helvetica');
                doc.text(value ?? '', leftX + labelW, y, { width: width - labelW });

                y += Math.max(rowGap, textHeight + 3);
            };

            drawRow('No. Recibo:', recibo.NoRecibo, 260);
            drawRow('No. Cédula:', recibo.NuCedula, 260);
            drawWrappedRow('Nombre del Cliente:', recibo.nombreCliente, 260);
            drawWrappedRow('Motivo:', recibo.Motivo, 260);
            drawRow('Monto Pagado:', formatMoney(recibo.MnPagado), 260);

            if (depositosRows.length === 0) {
                doc.fontSize(8.5).font('Helvetica').text('Sin formas de pago registradas.', leftX, y);
                y += 14;
            } else {
                depositosRows.forEach((pago) => {
                    const detalle = buildFormaPago(pago);
                    const detalleHeight = getTextHeight(detalle, 556 - 170, 8.5, 'Helvetica');

                    if (y + detalleHeight > 320) {
                        doc.addPage();
                        addHeader(title);
                        y = 100;
                    }

                    doc.fontSize(8.5).font('Helvetica-Bold').text('Forma de Pago:', leftX, y);
                    doc.font('Helvetica').text(detalle, leftX + 82, y, { width: 556 - 82 });
                    y += Math.max(14, detalleHeight + 2);
                });
            }

            drawRow('Saldo:', formatMoney(recibo.MnSaldo), 260);

            doc.fontSize(8.5).font('Helvetica-Bold').text('No. Contrato:', rightX, 100);
            doc.font('Helvetica').text(String(recibo.NoContrato || ''), rightX + 78, 100, { width: 120 });

            doc.fontSize(8.5).font('Helvetica-Bold').text('Fecha:', rightX, 116);
            doc.font('Helvetica').text(formatDate(recibo.FeRecibo), rightX + 78, 116, { width: 120 });
        };

        drawReceipt('RECIBO');
        doc.addPage();
        drawReceipt('RECIBO (COPIA CLIENTE)');

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < (range.start + range.count); i++) {
            doc.switchToPage(i);
            addFooter();
        }
    } catch (error) {
        console.error('Error generando recibo PDF:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error al generar el PDF'
        });
    }

    doc.end();
}

exports.sendReciboEmail = async (req, res) => {
    const { NoRecibo, usuarioReporte } = req.params;
    const { emailCliente } = req.body; // Correo enviado en el body

    // 1. Validaciones de entrada
    if (!NoRecibo) {
        return res.status(400).json({
            status: 'error',
            message: 'Falta el parámetro NoRecibo'
        });
    }

    if (!emailCliente) {
        return res.status(400).json({
            status: 'error',
            message: 'Falta el parámetro emailCliente en el cuerpo de la solicitud'
        });
    }

    try {
        // 2. Consulta de datos
        const [reciboRows] = await db.query(`
            SELECT
                r.NoRecibo,
                r.FeRecibo,
                r.NuCedula,
                c.txnombre AS nombreCliente,
                r.txconceprec AS Motivo,
                r.mnrecibo AS MnPagado,
                r.mnsaldorec AS MnSaldo,
                r.NoContrato
            FROM ReciboPago r
            LEFT JOIN clientes c ON c.NuCedula = r.NuCedula
            WHERE r.NoRecibo = ?
            LIMIT 1
        `, [NoRecibo]);

        if (reciboRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No se encontró el recibo'
            });
        }

        const recibo = reciboRows[0];

        const [depositosRows] = await db.query(`
            SELECT Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito
            FROM Depositos
            WHERE NoRecibo = ? AND NoContrato = ? AND NuCedula = ?
            ORDER BY Fecha ASC
        `, [recibo.NoRecibo, recibo.NoContrato, recibo.NuCedula]);

        // 3. Promesa para generar el PDF en un Buffer de memoria
        const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: [612, 396],
                margins: { top: 25, bottom: 20, left: 28, right: 28 },
                bufferPages: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 612;
            const contentWidth = pageWidth - 56;
            const logoPath = path.join(__dirname, 'logo.png');

            const formatMoney = (value) => {
                return new Intl.NumberFormat('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(Number(value || 0));
            };

            const formatDate = (value) => {
                if (!value) return '';
                const date = new Date(value);
                return date.toLocaleDateString('es-VE');
            };

            const getTextHeight = (text, width, fontSize = 10, font = 'Helvetica') => {
                doc.fontSize(fontSize).font(font);
                return doc.heightOfString(String(text ?? ''), { width });
            };

            const addHeader = (title) => {
                try {
                    doc.image(logoPath, 28, 22, { width: 48 });
                } catch (error) {
                    console.log('Error logo');
                }

                doc.fontSize(8).font('Helvetica-Bold')
                    .text("Grado`s de Venezuela, C.A.", 90, 24)
                    .font('Helvetica').text("J-30591547-4", 90, 35);

                const fechaActual = new Date().toLocaleDateString('es-VE');
                const horaActual = new Date().toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                doc.fontSize(7.5).font('Helvetica')
                    .text(`Fecha: ${fechaActual}`, 420, 22, { align: 'right', width: 164 })
                    .text(`Hora: ${horaActual}`, 420, 32, { align: 'right', width: 164 })
                    .text(`Usuario: ${usuarioReporte || ''}`, 420, 42, { align: 'right', width: 164 });

                doc.moveTo(28, 60).lineTo(584, 60).lineWidth(0.5).stroke();
                doc.fontSize(11).font('Helvetica-Bold').text(title, 28, 68, { align: 'center', width: 556 });
                doc.moveTo(28, 86).lineTo(584, 86).lineWidth(0.5).stroke();
            };

            const addFooter = () => {
                const footerBaseY = 340;
                doc.moveTo(28, footerBaseY).lineTo(584, footerBaseY).lineWidth(0.5).stroke();
                doc.fontSize(7.5).font('Helvetica').fillColor('#000000');
                doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 28, footerBaseY + 8, {
                    align: 'center',
                    width: 556
                });
                doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 28, footerBaseY + 18, {
                    align: 'center',
                    width: 556
                });
            };

            const buildFormaPago = (pago) => {
                const tipo = String(pago.TipoOperacion || '').trim().toUpperCase();
                const banco = String(pago.TxBanco || '').trim();
                const referencia = String(pago.NuDeposito || '').trim();
                const monto = formatMoney(pago.MnDeposito || 0);

                if (tipo.includes('EFECTIVO')) {
                    return `EFECTIVO | ${monto}`;
                }

                if (tipo.includes('T.DEBITO') || tipo.includes('T DEBITO') || tipo.includes('DEBITO')) {
                    return `T.DEBITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                }

                if (tipo.includes('T.CREDITO') || tipo.includes('T CREDITO') || tipo.includes('CREDITO')) {
                    return `T.CREDITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                }

                if (tipo.includes('DEPOSITO')) {
                    return `DEPOSITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                }

                if (tipo.includes('CHEQUE')) {
                    return `CHEQUE ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                }

                return `${tipo || 'OTRO'}${banco ? ` ${banco}` : ''}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            };

            const drawReceipt = (title) => {
                addHeader(title);

                let y = 100;
                const leftX = 28;
                const rightX = 340;
                const labelW = 95;
                const rowGap = 15;

                const drawRow = (label, value, width = 260) => {
                    doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica').text(value ?? '', leftX + labelW, y, { width: width - labelW });
                    y += rowGap;
                };

                const drawWrappedRow = (label, value, width = 260) => {
                    doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica');

                    const textHeight = getTextHeight(value, width - labelW, 8.5, 'Helvetica');
                    doc.text(value ?? '', leftX + labelW, y, { width: width - labelW });

                    y += Math.max(rowGap, textHeight + 3);
                };

                drawRow('No. Recibo:', recibo.NoRecibo, 260);
                drawRow('No. Cédula:', recibo.NuCedula, 260);
                drawWrappedRow('Nombre del Cliente:', recibo.nombreCliente, 260);
                drawWrappedRow('Motivo:', recibo.Motivo, 260);
                drawRow('Monto Pagado:', formatMoney(recibo.MnPagado), 260);

                if (depositosRows.length === 0) {
                    doc.fontSize(8.5).font('Helvetica').text('Sin formas de pago registradas.', leftX, y);
                    y += 14;
                } else {
                    depositosRows.forEach((pago) => {
                        const detalle = buildFormaPago(pago);
                        const detalleHeight = getTextHeight(detalle, 556 - 170, 8.5, 'Helvetica');

                        if (y + detalleHeight > 320) {
                            doc.addPage();
                            addHeader(title);
                            y = 100;
                        }

                        doc.fontSize(8.5).font('Helvetica-Bold').text('Forma de Pago:', leftX, y);
                        doc.font('Helvetica').text(detalle, leftX + 82, y, { width: 556 - 82 });
                        y += Math.max(14, detalleHeight + 2);
                    });
                }

                drawRow('Saldo:', formatMoney(recibo.MnSaldo), 260);

                doc.fontSize(8.5).font('Helvetica-Bold').text('No. Contrato:', rightX, 100);
                doc.font('Helvetica').text(String(recibo.NoContrato || ''), rightX + 78, 100, { width: 120 });

                doc.fontSize(8.5).font('Helvetica-Bold').text('Fecha:', rightX, 116);
                doc.font('Helvetica').text(formatDate(recibo.FeRecibo), rightX + 78, 116, { width: 120 });
            };

            // DIBUJAR SOLAMENTE LA COPIA DEL CLIENTE
            drawReceipt('RECIBO');

            const range = doc.bufferedPageRange();
            for (let i = range.start; i < (range.start + range.count); i++) {
                doc.switchToPage(i);
                addFooter();
            }

            doc.end();
        });

        // 4. Configurar el servicio de envío de correos (Nodemailer)
        // Reemplaza los datos de auth con tus credenciales de correo (Gmail, SMTP, etc.)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'vitalsense2025@gmail.com',
                pass: process.env.EMAIL_PASS || 'ecub jsrn xyct dcne'
            }
        });

        // 5. Opciones del correo electrónico
        const mailOptions = {
            from: '"Grado\'s de Venezuela" <info.gradosdevzla@gmail.com>',
            to: emailCliente,
            subject: `Comprobante de Pago - Recibo N° ${recibo.NoRecibo}`,
            text: `Estimado(a) ${recibo.nombreCliente || 'Cliente'},\n\nAdjunto a este correo encontrará su recibo de pago N° ${recibo.NoRecibo}.\n\nAtentamente,\nGrado's de Venezuela, C.A.`,
            attachments: [
                {
                    filename: `recibo-${recibo.NoRecibo}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // 6. Enviar el correo
        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            status: 'success',
            message: `Recibo enviado exitosamente a ${emailCliente}`
        });

    } catch (error) {
        console.error('Error enviando correo del recibo PDF:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error al procesar el envío del correo'
        });
    }
};