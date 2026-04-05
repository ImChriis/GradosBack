const db = require('../../config/db');

exports.getActs = async (req, res) => {
    try{
        const sql = 'SELECT ag.CodigoActo, ag.Fecha, ag.Hora, ag.siglas, ag.especialidad, ag.titulo, la.TxLugar, i.CodigoInst, i.nbInstitucion FROM actosgrados AS ag INNER JOIN lugaracto AS la On ag.CoLugar = la.CoLugar INNER JOIN instituciones as i ON ag.CodigoInst = i.CodigoInst WHERE ag.Culminada = "0" ORDER BY ag.CodigoActo DESC';
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
        const sql = 'SELECT NoContrato, Nombre, NuCedula, MnPagado, MnSaldo, MnContrato, MnDescuento, MnInicial from deactosgrados where CodigoActo = ? ORDER BY Nombre ASC';
        const [rows] = await db.query(sql, [CodigoActo]);
        res.json(rows);
    }catch (error){
        console.error('Error fetching acts users:', error);
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
    const { nuevoMonto, codigoActo } = req.body;
    const connection = await db.getConnection(); // Obtener conexión del pool

    try {
        await connection.beginTransaction(); // Iniciamos transacción

        // 1. Actualizar costo base en ActosGrados
        await connection.query(
            "UPDATE ActosGrados SET MnCosto = ? WHERE CodigoActo = ?",
            [nuevoMonto, codigoActo]
        );

        // 2. Actualizar totales y saldos de los estudiantes
        // Nota: En MariaDB/MySQL no hace falta poner [dbo]
        await connection.query(
            "UPDATE DeActosGrados SET MnContrato = ?, MnSaldo = ? - MnPagado WHERE CodigoActo = ?",
            [nuevoMonto, nuevoMonto, codigoActo]
        );

        // 3. Actualizar saldos en recibos
        await connection.query(
            "UPDATE ReciboPago SET MnSaldoRec = ? - MnRecibo WHERE CodigoActo = ?",
            [nuevoMonto, codigoActo]
        );

        await connection.commit(); // Si todo salió bien, guardamos cambios
        res.json({ message: "Proceso Finalizado con éxito" });

    } catch (error) {
        await connection.rollback(); // Si algo falló, deshacemos todo
        console.error("Error al recalcular:", error);
        res.status(500).send("Error al procesar el recálculo");
    } finally {
        connection.release(); // Liberamos la conexión
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

        // --- PASO 3: Inserción en DeActosGrados ---
        const sqlInsert = `INSERT INTO DeActosGrados 
            (CodigoActo, Nocontrato, NuCedula, Nombre, Txcontacto, MnContrato, MnPagado, MnSaldo, MnInicial, MaEdoCont, CodUser, Chemise, MnDescuento, Fecha, CodSucursal) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?, ?, NOW(), ?)`;

        const params = [
            CodigoActo ?? null, NoContrato ?? null, NuCedula ?? null, Nombre ?? null,
            Txcontacto ?? null, MnContrato ?? 0, MnPagado ?? 0, MnSaldo ?? 0,
            MnInicial ?? 0, CodUser ?? null, Chemise ?? null, MnDescuento ?? 0, CodSucursal ?? null
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

        res.json({ status: 'success', data: rows });
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
            reciboId, 
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