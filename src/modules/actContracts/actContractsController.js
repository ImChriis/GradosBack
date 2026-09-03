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
    d.MnInicial,
    d.Txcontacto,
    d.Chemise
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

exports.updateActUser = async (req, res) => {
    const { CodigoActo, NuCedula } = req.params;
    const { NoContrato, Chemise } = req.body;

    // Validar parámetros requeridos para identificar el registro
    if (!CodigoActo || !NuCedula) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'CodigoActo y NuCedula son requeridos para identificar el registro.' 
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // --- PASO 1: Verificar que el registro exista y obtener el NoContrato actual ---
        const [existente] = await connection.execute(
            "SELECT NoContrato FROM DeActosGrados WHERE CodigoActo = ? AND NuCedula = ?", 
            [CodigoActo, NuCedula]
        );

        if (existente.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                status: 'error', 
                message: 'El usuario no está registrado en este acto.' 
            });
        }

        const contratoAnterior = existente[0].NoContrato;
        const contratoNuevo = NoContrato ? parseInt(NoContrato) : null;
        const requiereCambioContrato = contratoNuevo && contratoNuevo !== contratoAnterior;

        // --- PASO 2: Si cambia NoContrato, validar contra límite de Configuración ---
        if (requiereCambioContrato) {
            const [resConfig] = await connection.execute("SELECT NoContrato FROM Configuracion LIMIT 1");
            const contratoLimite = parseInt(resConfig[0]?.NoContrato || 0);

            if (contratoNuevo > contratoLimite) {
                await connection.rollback();
                return res.status(400).json({ 
                    status: 'error', 
                    message: `El No. de Contrato es inválido. Máximo autorizado: ${contratoLimite}.` 
                });
            }
        }

        // --- PASO 3: Actualizar el registro principal (DeActosGrados) ---
        const sqlUpdateMain = `
            UPDATE DeActosGrados 
            SET 
                Chemise = COALESCE(?, Chemise),
                NoContrato = COALESCE(?, NoContrato)
            WHERE CodigoActo = ? AND NuCedula = ?
        `;

        await connection.execute(sqlUpdateMain, [
            Chemise ?? null,
            NoContrato ?? null,
            CodigoActo,
            NuCedula
        ]);

        // --- PASO 4: Si cambió el NoContrato, actualizar en ReciboPago y Depositos ---
        if (requiereCambioContrato) {
            // Actualizar en ReciboPago
            const sqlUpdateRecibos = `
                UPDATE ReciboPago 
                SET NoContrato = ? 
                WHERE NuCedula = ? AND NoContrato = ?
            `;
            await connection.execute(sqlUpdateRecibos, [contratoNuevo, NuCedula, contratoAnterior]);

            // Actualizar en Depositos
            const sqlUpdateDepositos = `
                UPDATE Depositos 
                SET NoContrato = ? 
                WHERE NuCedula = ? AND NoContrato = ?
            `;
            await connection.execute(sqlUpdateDepositos, [contratoNuevo, NuCedula, contratoAnterior]);
        }

        await connection.commit();

        res.json({ 
            status: 'success', 
            message: "Registro y tablas asociadas actualizados correctamente." 
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error en actualización:", error);
        res.status(500).json({ error: "Error interno del servidor al actualizar." });
    } finally {
        if (connection) connection.release();
    }
};

exports.removeUserFromAct = async (req, res) => {
    const { CodigoActo, NuCedula } = req.params;

    if (!CodigoActo || !NuCedula) {
        return res.status(400).json({
            status: 'error',
            message: "Los campos CodigoActo y NuCedula son obligatorios."
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // --- PASO 1: Verificar existencia del registro y consultar estado financiero/cierre ---
        const [resPersona] = await connection.execute(
            `SELECT Nocontrato, MnPagado, NoCierre 
             FROM DeActosGrados 
             WHERE CodigoActo = ? AND NuCedula = ?`, 
            [CodigoActo, NuCedula]
        );

        if (resPersona.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                status: 'error', 
                message: `No se encontró la persona con cédula ${NuCedula} inscrita en el acto ${CodigoActo}.` 
            });
        }

        const registro = resPersona[0];

        // --- PASO 2: Validar si el registro ya forma parte de un Cierre Diario ---
        if (registro.NoCierre && registro.NoCierre !== '' && registro.NoCierre !== 0) {
            await connection.rollback();
            return res.status(400).json({
                status: 'error',
                message: `No se puede eliminar: El contrato N° ${registro.Nocontrato} ya fue auditado en el Cierre N° ${registro.NoCierre}.`
            });
        }

        // --- PASO 3: Validar pagos en la tabla principal (MnPagado) ---
        if (Number(registro.MnPagado) > 0) {
            await connection.rollback();
            return res.status(400).json({
                status: 'error',
                message: `No se puede eliminar: El usuario registra un monto pagado de ${registro.MnPagado}. Debe anular los pagos primero.`
            });
        }

        // --- PASO 4: Validar existencia de recibos de pago en 'recibopago' ---
        const [resRecibos] = await connection.execute(
            `SELECT COUNT(*) AS totalRecibos 
             FROM recibopago 
             WHERE CodigoActo = ? AND NuCedula = ?`,
            [CodigoActo, NuCedula]
        );

        if (resRecibos[0].totalRecibos > 0) {
            await connection.rollback();
            return res.status(400).json({
                status: 'error',
                message: `No se puede eliminar: La persona tiene ${resRecibos[0].totalRecibos} recibo(s) de pago registrado(s) en la base de datos.`
            });
        }

        // --- PASO 5: Proceder con la eliminación ---
        const sqlDelete = "DELETE FROM DeActosGrados WHERE CodigoActo = ? AND NuCedula = ?";
        await connection.execute(sqlDelete, [CodigoActo, NuCedula]);

        await connection.commit();

        res.json({ 
            status: 'success', 
            message: `El usuario con cédula ${NuCedula} fue eliminado exitosamente del acto ${CodigoActo}.`,
            contratoEliminado: registro.Nocontrato
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error al eliminar usuario del acto:", error);
        res.status(500).json({ error: "Error interno del servidor al intentar eliminar la inscripción." });
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
    const { NoContrato, NuCedula } = req.params;

    if(!NoContrato){
        return res.status(400).json({
            stats: 'error',
            message: "Falta el parámetro NoContrato"
        })
    }

    if(!NuCedula){
        return res.status(400).json({
            status: 'error',
            message: "Falta el parámetro NuCedula"
        })
    }
    
    try{
        const sql = `SELECT NoRecibo, ferecibo, mnrecibo, TxConcepRec FROM ReciboPago WHERE NoContrato = ? AND NuCedula = ? ORDER BY NoRecibo`;
        const [rows] = await db.execute(sql, [NoContrato, NuCedula]);

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
    const { 
        NoRecibo, ferecibo, NuCedula, CodSucursal, NoContrato, 
        tprecibo, mnrecibo, mnsaldorec, TxConcepRec, CodUser, 
        Anulado, Tipo, CodigoActo, MaFormPag, TxBanco, NuRefDocBan
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Bloquear y obtener el consecutivo actual de 'configuracion' (Garantiza acceso atómico)
        const [configRows] = await connection.query(
            'SELECT NoRecibo FROM configuracion FOR UPDATE'
        );

        if (configRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(500).json({ status: 'error', message: 'No se encontró el registro de configuración.' });
        }

        const correlativoConfig = Number(configRows[0].NoRecibo);
        let reciboIdFinal = Number(NoRecibo) || correlativoConfig;

        // 2. Verificar si el NoRecibo deseado ya existe en ReciboPago
        const [existing] = await connection.query(
            'SELECT NoRecibo FROM ReciboPago WHERE NoRecibo = ?',
            [reciboIdFinal]
        );

        // Si ya existe, calculamos automáticamente el máximo número real guardado en la tabla de Recibos
        if (existing.length > 0) {
            const [maxRows] = await connection.query(
                'SELECT MAX(NoRecibo) AS maxRecibo FROM ReciboPago FOR UPDATE'
            );
            const maxActual = maxRows[0].maxRecibo ? Number(maxRows[0].maxRecibo) : correlativoConfig;
            
            // Asignamos el mayor entre el consecutivo de configuracion y el maximo de la BD + 1
            reciboIdFinal = Math.max(correlativoConfig, maxActual + 1);
        }

        // 3. Insertar el recibo con el NoRecibo asignado
        const sqlInsert = `INSERT INTO ReciboPago (
                            NoRecibo, ferecibo, NuCedula, CodSucursal, NoContrato, 
                            tprecibo, mnrecibo, mnsaldorec, TxConcepRec, CodUser, 
                            Anulado, Tipo, CodigoActo, MaFormPag, TxBanco, NuRefDocBan
                        ) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await connection.query(sqlInsert, [
            reciboIdFinal, 
            ferecibo, 
            String(NuCedula).trim(), 
            CodSucursal, 
            String(NoContrato).trim(), 
            tprecibo, 
            mnrecibo, 
            mnsaldorec, 
            TxConcepRec, 
            CodUser, 
            Anulado ? 1 : 0, 
            Tipo, 
            CodigoActo,
            MaFormPag,
            TxBanco,
            NuRefDocBan
        ]);

        // 4. Actualizar SIEMPRE 'configuracion' con el nuevo correlativo disponible (+1)
        const proximoCorrelativo = reciboIdFinal + 1;
        await connection.execute('UPDATE configuracion SET NoRecibo = ?', [proximoCorrelativo]);

        await connection.commit();
        connection.release();

        return res.status(201).json({ 
            status: 'success', 
            message: 'Recibo creado correctamente',
            noRecibo: reciboIdFinal,
            proximoCorrelativo: proximoCorrelativo
        });

    } catch (error) {
        await connection.rollback();
        connection.release();

        // Control de respaldo por si ocurre una colisión inesperada de Unique Key
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'error',
                code: 'RECIBO_DUPLICADO',
                message: `El número de recibo ya se encuentra registrado. Intenta nuevamente.`,
                sugerido: Number(NoRecibo) + 1
            });
        }

        console.error("Error al insertar el recibo:", error);
        return res.status(500).json({ 
            status: 'error',
            message: "Error interno al intentar guardar el recibo"
        });
    }
};

exports.createDeposito = async (req, res) => {
    const { NoContrato, NuCedula, NoRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, CodUser, CodSucursal } = req.body;

    try {
        // 1. Insertar el depósito
        const sqlInsert = `
            INSERT INTO Depositos (
                NoContrato, NuCedula, NoRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, CodUser, CodSucursal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [rows] = await db.query(sqlInsert, [
            NoContrato, NuCedula, NoRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, CodUser, CodSucursal
        ]);

        // 2. Asignar MnInicial al contrato ÚNICAMENTE si aún es NULL o 0 (primer depósito)
        const sqlUpdateContrato = `
            UPDATE deactosgrados 
            SET MnInicial = ? 
            WHERE NoContrato = ? 
              AND (MnInicial IS NULL OR MnInicial = 0)
        `;
        await db.query(sqlUpdateContrato, [MnDeposito, NoContrato]);

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
};

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

    // DIMENSIONES VERTICALES (Half Letter Portrait: Ancho 396 pt, Alto 612 pt)
    const doc = new PDFDocument({
        size: [396, 612],
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
        bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=recibo-${NoRecibo}.pdf`);
    doc.pipe(res);

    const pageWidth = 396;
    const marginLeft = 20;
    const marginRight = 376;
    const contentWidth = pageWidth - 40; // 356 pt útiles
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

    const getTextHeight = (text, width, fontSize = 8.5, font = 'Helvetica') => {
        doc.fontSize(fontSize).font(font);
        return doc.heightOfString(String(text ?? ''), { width });
    };

    const addHeader = (title) => {
        try {
            doc.image(logoPath, marginLeft, 18, { width: 42 });
        } catch (error) {
            console.log('Error cargando logo');
        }

        doc.fontSize(8).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 68, 20)
            .font('Helvetica').text("J-30591547-4", 68, 30);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        doc.fontSize(7).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 220, 18, { align: 'right', width: 156, lineBreak: false })
            .text(`Hora: ${horaActual}`, 220, 27, { align: 'right', width: 156, lineBreak: false })
            .text(`Usuario: ${usuarioReporte || ''}`, 220, 36, { align: 'right', width: 156, lineBreak: false });

        doc.moveTo(marginLeft, 52).lineTo(marginRight, 52).lineWidth(0.5).stroke();
        doc.fontSize(10).font('Helvetica-Bold').text(title, marginLeft, 58, { align: 'center', width: contentWidth, lineBreak: false });
        doc.moveTo(marginLeft, 74).lineTo(marginRight, 74).lineWidth(0.5).stroke();
    };

    const addFooter = () => {
        const footerBaseY = 565; // Ajustado a la parte inferior de la hoja vertical (alto total 612)
        doc.moveTo(marginLeft, footerBaseY).lineTo(marginRight, footerBaseY).lineWidth(0.5).stroke('#000000');
        doc.fontSize(7).font('Helvetica').fillColor('#000000');
        doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", marginLeft, footerBaseY + 6, {
            align: 'center',
            width: contentWidth,
            lineBreak: false
        });
        doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", marginLeft, footerBaseY + 15, {
            align: 'center',
            width: contentWidth,
            lineBreak: false
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

            let y = 84;
            const labelW = 90;
            const valW = contentWidth - labelW; // 266 pt
            const rowGap = 14;

            // Datos principales (No. Recibo, Contrato, Fecha)
            doc.fontSize(8.5).font('Helvetica-Bold').text('No. Recibo:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(String(recibo.NoRecibo || ''), marginLeft + labelW, y, { width: 100, lineBreak: false });

            doc.font('Helvetica-Bold').text('Fecha:', marginLeft + 210, y, { width: 45 });
            doc.font('Helvetica').text(formatDate(recibo.FeRecibo), marginLeft + 255, y, { width: 100, lineBreak: false });
            y += rowGap;

            doc.fontSize(8.5).font('Helvetica-Bold').text('No. Cédula:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(String(recibo.NuCedula || ''), marginLeft + labelW, y, { width: 100, lineBreak: false });

            doc.font('Helvetica-Bold').text('No. Contrato:', marginLeft + 210, y, { width: 65 });
            doc.font('Helvetica').text(String(recibo.NoContrato || ''), marginLeft + 275, y, { width: 80, lineBreak: false });
            y += rowGap;

            // Nombre Cliente
            const hNombre = getTextHeight(recibo.nombreCliente, valW);
            doc.fontSize(8.5).font('Helvetica-Bold').text('Nombre Cliente:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(recibo.nombreCliente ?? '', marginLeft + labelW, y, { width: valW });
            y += Math.max(rowGap, hNombre + 2);

            // Motivo / Concepto
            const hMotivo = getTextHeight(recibo.Motivo, valW);
            doc.fontSize(8.5).font('Helvetica-Bold').text('Motivo:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(recibo.Motivo ?? '', marginLeft + labelW, y, { width: valW });
            y += Math.max(rowGap, hMotivo + 2);

            // Monto Pagado
            doc.fontSize(8.5).font('Helvetica-Bold').text('Monto Pagado:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(formatMoney(recibo.MnPagado), marginLeft + labelW, y, { width: valW, lineBreak: false });
            y += rowGap;

            // Formas de Pago
            if (depositosRows.length === 0) {
                doc.fontSize(8.5).font('Helvetica').text('Sin formas de pago registradas.', marginLeft, y, { width: contentWidth });
                y += rowGap;
            } else {
                depositosRows.forEach((pago) => {
                    const detalle = buildFormaPago(pago);
                    const detalleW = contentWidth - 85;
                    const detalleHeight = getTextHeight(detalle, detalleW);

                    // Límite vertical antes de pie de página para prevenir auto-salto accidental
                    if (y + detalleHeight > 540) {
                        doc.addPage();
                        addHeader(title);
                        y = 84;
                    }

                    doc.fontSize(8.5).font('Helvetica-Bold').text('Forma de Pago:', marginLeft, y, { width: 85 });
                    doc.font('Helvetica').text(detalle, marginLeft + 85, y, { width: detalleW });
                    y += Math.max(14, detalleHeight + 2);
                });
            }

            // Saldo
            doc.fontSize(8.5).font('Helvetica-Bold').text('Saldo:', marginLeft, y, { width: labelW });
            doc.font('Helvetica').text(formatMoney(recibo.MnSaldo), marginLeft + labelW, y, { width: valW, lineBreak: false });
        };

        drawReceipt('RECIBO');
        
        // Segunda página para la copia del cliente
        doc.addPage();
        drawReceipt('RECIBO (COPIA CLIENTE)');

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < (range.start + range.count); i++) {
            doc.switchToPage(i);
            addFooter();
        }
    } catch (error) {
        console.error('Error generando recibo PDF:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                status: 'error',
                message: 'Error al generar el PDF'
            });
        }
    }

    doc.end();
};

exports.printReciboPdfOnePage = async (req, res) => {
    const { NoRecibo, usuarioReporte } = req.params;

    if (!NoRecibo) {
        return res.status(400).json({
            status: 'error',
            message: 'Falta el parámetro NoRecibo'
        });
    }

    // Tamaña Carta Estándar (612 x 792 pt)
    // Se deshabilita autoPageBreak para evitar que el renderizado inferior genere una 2da página
    const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 20, bottom: 20, left: 28, right: 28 },
        autoPageBreak: false
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=recibo-${NoRecibo}.pdf`);
    doc.pipe(res);

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

    const getTextHeight = (text, width, fontSize = 8.5, font = 'Helvetica') => {
        doc.fontSize(fontSize).font(font);
        return doc.heightOfString(String(text ?? ''), { width });
    };

    const addHeader = (title, startY) => {
        try {
            doc.image(logoPath, 28, startY + 18, { width: 44 });
        } catch (error) {
            console.log('Error cargando logo');
        }

        doc.fontSize(8).font('Helvetica-Bold')
            .text("Grado`s de Venezuela, C.A.", 85, startY + 20)
            .font('Helvetica').text("J-30591547-4", 85, startY + 31);

        const fechaActual = new Date().toLocaleDateString('es-VE');
        const horaActual = new Date().toLocaleTimeString('es-VE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        doc.fontSize(7.5).font('Helvetica')
            .text(`Fecha: ${fechaActual}`, 420, startY + 18, { align: 'right', width: 164, lineBreak: false })
            .text(`Hora: ${horaActual}`, 420, startY + 28, { align: 'right', width: 164, lineBreak: false })
            .text(`Usuario: ${usuarioReporte || ''}`, 420, startY + 38, { align: 'right', width: 164, lineBreak: false });

        doc.moveTo(28, startY + 54).lineTo(584, startY + 54).lineWidth(0.5).stroke();
        doc.fontSize(10).font('Helvetica-Bold').text(title, 28, startY + 60, { align: 'center', width: 556, lineBreak: false });
        doc.moveTo(28, startY + 76).lineTo(584, startY + 76).lineWidth(0.5).stroke();
    };

    const addFooter = (startY) => {
        const footerBaseY = startY + 338;
        doc.moveTo(28, footerBaseY).lineTo(584, footerBaseY).lineWidth(0.5).stroke('#000000');
        doc.fontSize(7.5).font('Helvetica').fillColor('#000000');
        doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 28, footerBaseY + 5, {
            align: 'center',
            width: 556,
            lineBreak: false
        });
        doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 28, footerBaseY + 15, {
            align: 'center',
            width: 556,
            lineBreak: false
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

            if (tipo.includes('EFECTIVO')) return `EFECTIVO | ${monto}`;
            if (tipo.includes('T.DEBITO') || tipo.includes('T DEBITO') || tipo.includes('DEBITO')) return `T.DEBITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            if (tipo.includes('T.CREDITO') || tipo.includes('T CREDITO') || tipo.includes('CREDITO')) return `T.CREDITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            if (tipo.includes('DEPOSITO')) return `DEPOSITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            if (tipo.includes('CHEQUE')) return `CHEQUE ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;

            return `${tipo || 'OTRO'}${banco ? ` ${banco}` : ''}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
        };

        const drawReceipt = (title, startY) => {
            addHeader(title, startY);

            let y = startY + 88;
            const leftX = 28;
            const rightX = 340;
            const labelW = 95;
            const rowGap = 13;

            const drawRow = (label, value, width = 260) => {
                doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                doc.font('Helvetica').text(value ?? '', leftX + labelW, y, { width: width - labelW, lineBreak: false });
                y += rowGap;
            };

            const drawWrappedRow = (label, value, width = 260) => {
                doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                doc.font('Helvetica');

                const textHeight = getTextHeight(value, width - labelW, 8.5, 'Helvetica');
                doc.text(value ?? '', leftX + labelW, y, { width: width - labelW });

                y += Math.max(rowGap, textHeight + 2);
            };

            drawRow('No. Recibo:', recibo.NoRecibo, 260);
            drawRow('No. Cédula:', recibo.NuCedula, 260);
            drawWrappedRow('Nombre del Cliente:', recibo.nombreCliente, 260);
            drawWrappedRow('Motivo:', recibo.Motivo, 260);
            drawRow('Monto Pagado:', formatMoney(recibo.MnPagado), 260);

            if (depositosRows.length === 0) {
                doc.fontSize(8.5).font('Helvetica').text('Sin formas de pago registradas.', leftX, y, { width: 260, lineBreak: false });
                y += rowGap;
            } else {
                depositosRows.forEach((pago) => {
                    const detalle = buildFormaPago(pago);
                    const detalleW = 556 - 82;
                    const detalleHeight = getTextHeight(detalle, detalleW, 8.5, 'Helvetica');

                    doc.fontSize(8.5).font('Helvetica-Bold').text('Forma de Pago:', leftX, y, { width: 82 });
                    doc.font('Helvetica').text(detalle, leftX + 82, y, { width: detalleW });
                    y += Math.max(13, detalleHeight + 1);
                });
            }

            drawRow('Saldo:', formatMoney(recibo.MnSaldo), 260);

            // Bloque lateral derecho (Contrato y Fecha)
            doc.fontSize(8.5).font('Helvetica-Bold').text('No. Contrato:', rightX, startY + 88);
            doc.font('Helvetica').text(String(recibo.NoContrato || ''), rightX + 78, startY + 88, { width: 120, lineBreak: false });

            doc.fontSize(8.5).font('Helvetica-Bold').text('Fecha:', rightX, startY + 101);
            doc.font('Helvetica').text(formatDate(recibo.FeRecibo), rightX + 78, startY + 101, { width: 120, lineBreak: false });

            addFooter(startY);
        };

        // 1. Dibujar Recibo Original (Mitad Superior)
        drawReceipt('RECIBO', 0);

        // 2. Línea Punteada de División / Corte en el centro exacto (792 / 2 = 396pt)
        const middleY = 396;
        doc.save()
           .dash(4, { space: 3 })
           .moveTo(28, middleY)
           .lineTo(584, middleY)
           .lineWidth(0.5)
           .stroke()
           .undash()
           .restore();

        // 3. Dibujar Copia Cliente (Mitad Inferior)
        drawReceipt('RECIBO (COPIA CLIENTE)', 390);

    } catch (error) {
        console.error('Error generando recibo PDF:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                status: 'error',
                message: 'Error al generar el PDF'
            });
        }
    }

    doc.end();
};

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

        // 3. Promesa para generar el PDF en un Buffer de memoria (HOJA VERTICAL)
        const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: [396, 612], // Formato vertical (Portrait)
                margins: { top: 25, bottom: 20, left: 28, right: 28 },
                bufferPages: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 396;
            const contentWidth = pageWidth - 56; // 340px de ancho utilizable
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
                    doc.image(logoPath, 28, 22, { width: 44 });
                } catch (error) {
                    console.log('Error logo');
                }

                doc.fontSize(8).font('Helvetica-Bold')
                    .text("Grado`s de Venezuela, C.A.", 80, 24)
                    .font('Helvetica').text("J-30591547-4", 80, 35);

                const fechaActual = new Date().toLocaleDateString('es-VE');
                const horaActual = new Date().toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                doc.fontSize(7.5).font('Helvetica')
                    .text(`Fecha: ${fechaActual}`, 230, 22, { align: 'right', width: 138 })
                    .text(`Hora: ${horaActual}`, 230, 32, { align: 'right', width: 138 })
                    .text(`Usuario: ${usuarioReporte || ''}`, 230, 42, { align: 'right', width: 138 });

                doc.moveTo(28, 58).lineTo(368, 58).lineWidth(0.5).stroke();
                doc.fontSize(11).font('Helvetica-Bold').text(title, 28, 65, { align: 'center', width: 340 });
                doc.moveTo(28, 82).lineTo(368, 82).lineWidth(0.5).stroke();
            };

            const addFooter = () => {
                const footerBaseY = 560; // Ajustado para el alto vertical (612)
                doc.moveTo(28, footerBaseY).lineTo(368, footerBaseY).lineWidth(0.5).stroke();
                doc.fontSize(7.5).font('Helvetica').fillColor('#000000');
                doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 28, footerBaseY + 8, {
                    align: 'center',
                    width: 340
                });
                doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 28, footerBaseY + 18, {
                    align: 'center',
                    width: 340
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

                let y = 92;
                const leftX = 28;
                const labelW = 100;
                const valueW = contentWidth - labelW;
                const rowGap = 15;

                const drawRow = (label, value) => {
                    doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica').text(value ?? '', leftX + labelW, y, { width: valueW });
                    y += rowGap;
                };

                const drawWrappedRow = (label, value) => {
                    doc.fontSize(8.5).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica');

                    const textHeight = getTextHeight(value, valueW, 8.5, 'Helvetica');
                    doc.text(value ?? '', leftX + labelW, y, { width: valueW });

                    y += Math.max(rowGap, textHeight + 3);
                };

                drawRow('No. Recibo:', recibo.NoRecibo);
                drawRow('No. Contrato:', String(recibo.NoContrato || ''));
                drawRow('Fecha Recibo:', formatDate(recibo.FeRecibo));
                drawRow('No. Cédula:', recibo.NuCedula);
                drawWrappedRow('Nombre Cliente:', recibo.nombreCliente);
                drawWrappedRow('Motivo:', recibo.Motivo);
                drawRow('Monto Pagado:', formatMoney(recibo.MnPagado));

                if (depositosRows.length === 0) {
                    doc.fontSize(8.5).font('Helvetica').text('Sin formas de pago registradas.', leftX, y);
                    y += 14;
                } else {
                    depositosRows.forEach((pago) => {
                        const detalle = buildFormaPago(pago);
                        const detalleHeight = getTextHeight(detalle, contentWidth - 85, 8.5, 'Helvetica');

                        if (y + detalleHeight > 540) {
                            doc.addPage();
                            addHeader(title);
                            y = 92;
                        }

                        doc.fontSize(8.5).font('Helvetica-Bold').text('Forma de Pago:', leftX, y);
                        doc.font('Helvetica').text(detalle, leftX + 85, y, { width: contentWidth - 85 });
                        y += Math.max(14, detalleHeight + 2);
                    });
                }

                drawRow('Saldo:', formatMoney(recibo.MnSaldo));
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

exports.sendReciboEmailOnePage = async (req, res) => {
    const { NoRecibo, usuarioReporte } = req.params;
    const { emailCliente } = req.body;

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

        // Promesa para generar el PDF completo en 1 página Carta Vertical
        const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'LETTER', // 612 x 792 (Vertical por defecto)
                margins: { top: 20, bottom: 20, left: 28, right: 28 },
                bufferPages: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

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

            const getTextHeight = (text, width, fontSize = 8, font = 'Helvetica') => {
                doc.fontSize(fontSize).font(font);
                return doc.heightOfString(String(text ?? ''), { width });
            };

            // Dibujar encabezado dinamizando la coordenada 'startY'
            const addHeader = (title, startY) => {
                try {
                    doc.image(logoPath, 28, startY + 2, { width: 42 });
                } catch (error) {
                    console.log('Error logo');
                }

                doc.fontSize(8).font('Helvetica-Bold')
                    .text("Grado`s de Venezuela, C.A.", 80, startY + 4)
                    .font('Helvetica').text("J-30591547-4", 80, startY + 15);

                const fechaActual = new Date().toLocaleDateString('es-VE');
                const horaActual = new Date().toLocaleTimeString('es-VE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                doc.fontSize(7).font('Helvetica')
                    .text(`Fecha: ${fechaActual}`, 420, startY + 2, { align: 'right', width: 164 })
                    .text(`Hora: ${horaActual}`, 420, startY + 12, { align: 'right', width: 164 })
                    .text(`Usuario: ${usuarioReporte || ''}`, 420, startY + 22, { align: 'right', width: 164 });

                doc.moveTo(28, startY + 36).lineTo(584, startY + 36).lineWidth(0.5).stroke();
                doc.fontSize(10).font('Helvetica-Bold').text(title, 28, startY + 42, { align: 'center', width: 556 });
                doc.moveTo(28, startY + 58).lineTo(584, startY + 58).lineWidth(0.5).stroke();
            };

            // Dibujar pie de página relativo a 'startY'
            const addFooter = (startY) => {
                const footerY = startY + 310;
                doc.moveTo(28, footerY).lineTo(584, footerY).lineWidth(0.5).stroke();
                doc.fontSize(7).font('Helvetica').fillColor('#000000');
                doc.text("Para Mayor Información Visite nuestro instagram @gradosdevzla", 28, footerY + 5, {
                    align: 'center',
                    width: 556
                });
                doc.text("o escribanos a los correos info.gradosdevzla@gmail.com", 28, footerY + 14, {
                    align: 'center',
                    width: 556
                });
            };

            const buildFormaPago = (pago) => {
                const tipo = String(pago.TipoOperacion || '').trim().toUpperCase();
                const banco = String(pago.TxBanco || '').trim();
                const referencia = String(pago.NuDeposito || '').trim();
                const monto = formatMoney(pago.MnDeposito || 0);

                if (tipo.includes('EFECTIVO')) return `EFECTIVO | ${monto}`;
                if (tipo.includes('T.DEBITO') || tipo.includes('T DEBITO') || tipo.includes('DEBITO')) return `T.DEBITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                if (tipo.includes('T.CREDITO') || tipo.includes('T CREDITO') || tipo.includes('CREDITO')) return `T.CREDITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                if (tipo.includes('DEPOSITO')) return `DEPOSITO ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
                if (tipo.includes('CHEQUE')) return `CHEQUE ${banco}${referencia ? ` | ${referencia}` : ''} | ${monto}`;

                return `${tipo || 'OTRO'}${banco ? ` ${banco}` : ''}${referencia ? ` | ${referencia}` : ''} | ${monto}`;
            };

            // Función central para construir un bloque completo de recibo
            const drawSingleReceipt = (title, startY) => {
                addHeader(title, startY);

                let y = startY + 68;
                const leftX = 28;
                const rightX = 340;
                const labelW = 95;
                const rowGap = 13;

                const drawRow = (label, value, width = 260) => {
                    doc.fontSize(8).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica').text(value ?? '', leftX + labelW, y, { width: width - labelW });
                    y += rowGap;
                };

                const drawWrappedRow = (label, value, width = 260) => {
                    doc.fontSize(8).font('Helvetica-Bold').text(label, leftX, y, { width: labelW });
                    doc.font('Helvetica');
                    const textHeight = getTextHeight(value, width - labelW, 8, 'Helvetica');
                    doc.text(value ?? '', leftX + labelW, y, { width: width - labelW });
                    y += Math.max(rowGap, textHeight + 2);
                };

                drawRow('No. Recibo:', recibo.NoRecibo, 260);
                drawRow('No. Cédula:', recibo.NuCedula, 260);
                drawWrappedRow('Nombre del Cliente:', recibo.nombreCliente, 260);
                drawWrappedRow('Motivo:', recibo.Motivo, 260);
                drawRow('Monto Pagado:', formatMoney(recibo.MnPagado), 260);

                if (depositosRows.length === 0) {
                    doc.fontSize(8).font('Helvetica').text('Sin formas de pago registradas.', leftX, y);
                    y += 12;
                } else {
                    depositosRows.forEach((pago) => {
                        const detalle = buildFormaPago(pago);
                        const detalleHeight = getTextHeight(detalle, 556 - 82, 8, 'Helvetica');
                        doc.fontSize(8).font('Helvetica-Bold').text('Forma de Pago:', leftX, y);
                        doc.font('Helvetica').text(detalle, leftX + 82, y, { width: 556 - 82 });
                        y += Math.max(12, detalleHeight + 2);
                    });
                }

                drawRow('Saldo:', formatMoney(recibo.MnSaldo), 260);

                // Columna derecha
                const rightY = startY + 68;
                doc.fontSize(8).font('Helvetica-Bold').text('No. Contrato:', rightX, rightY);
                doc.font('Helvetica').text(String(recibo.NoContrato || ''), rightX + 78, rightY, { width: 120 });

                doc.fontSize(8).font('Helvetica-Bold').text('Fecha:', rightX, rightY + 14);
                doc.font('Helvetica').text(formatDate(recibo.FeRecibo), rightX + 78, rightY + 14, { width: 120 });

                addFooter(startY);
            };

            // Dibujar recibo superior (Copia Cliente)
            drawSingleReceipt('RECIBO - COPIA CLIENTE', 15);

            // Línea de corte punteada intermedia ajustada a la mitad de la página vertical (792px / 2 = 396px)
            const lineY = 385;
            doc.save()
               .moveTo(28, lineY)
               .lineTo(584, lineY)
               .lineWidth(0.8)
               .dash(4, { space: 3 })
               .strokeColor('#666666')
               .stroke()
               .restore();

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#666666')
               .text('- - - - - - - - - - - - - - - - - - - - - - - - CORTAR AQUÍ - - - - - - - - - - - - - - - - - - - - - - - -', 28, lineY - 3, {
                   align: 'center',
                   width: 556
               });

            // Dibujar recibo inferior (Copia Empresa)
            drawSingleReceipt('RECIBO - COPIA EMPRESA', 405);

            doc.end();
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'vitalsense2025@gmail.com',
                pass: process.env.EMAIL_PASS || 'ecub jsrn xyct dcne'
            }
        });

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