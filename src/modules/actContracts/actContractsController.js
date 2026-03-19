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
        const sql = 'SELECT NoContrato, Nombre, NuCedula, MnPagado, MnSaldo from deactosgrados where CodigoActo = ? ORDER BY Nombre ASC';
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
        const sql = 'SELECT SUM(MnTotal) AS MontoTotal FROM deactosgrados WHERE CodigoActo = ?';
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
            "UPDATE DeActosGrados SET MnTotal = ?, MnSaldo = ? - MnPagado WHERE CodigoActo = ?",
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
                COALESCE(SUM(MnTotal), 0) AS total, 
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
                CAST(COALESCE(SUM(MnTotal), 0) AS DECIMAL(10,2)) AS montoTotal,
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
        MnTotal, MnPagado, MnSaldo, MnInicial, Chemise, 
        MnDescuento, CodSucursal, CodUser 
    } = req.body;

    try {
        // --- PASO 1: Evitar duplicidad de PERSONA en el mismo ACTO ---
        // Esto detiene que registres a "Juan" dos veces en el "Acto A"
        const sqlCheckPersona = "SELECT COUNT(*) as yaRegistrado FROM DeActosGrados WHERE CodigoActo = ? AND NuCedula = ?";
        const [resPersona] = await db.execute(sqlCheckPersona, [CodigoActo, NuCedula]);

        if (resPersona[0].yaRegistrado > 0) {
            return res.status(400).json({ 
                status: 'error',
                message: `La persona con cédula ${NuCedula} ya se encuentra inscrita en este acto de grado.` 
            });
        }

        // --- PASO 2: Verificar si el cliente existe en el sistema general ---
        const sqlCliente = "SELECT COUNT(*) as existe FROM Clientes WHERE NuCedula = ?";
        const [resCliente] = await db.execute(sqlCliente, [NuCedula]);

        if (resCliente[0].existe === 0) {
            return res.status(404).json({ 
                status: 'error',
                message: "La persona no existe en el sistema. Debe crearla primero." 
            });
        }

        // --- PASO 3: Verificar rango de NoContrato en Configuración ---
        const sqlConfig = "SELECT NoContrato FROM Configuracion LIMIT 1";
        const [resConfig] = await db.execute(sqlConfig);
        
        const contratoLimite = parseInt(resConfig[0]?.NoContrato || 0);
        const contratoIngresado = parseInt(NoContrato);

        if (contratoIngresado > contratoLimite) {
            return res.status(400).json({ 
                status: 'error',
                message: `El No. de Contrato ${NoContrato} es inválido. El máximo autorizado es ${contratoLimite}.` 
            });
        }

        // --- PASO 4: Verificar si el NoContrato ya fue usado (en cualquier acto) ---
        const sqlCheckContrato = "SELECT COUNT(*) as contratoUsado FROM DeActosGrados WHERE NoContrato = ?";
        const [resContrato] = await db.execute(sqlCheckContrato, [NoContrato]);

        if (resContrato[0].contratoUsado > 0) {
            return res.status(400).json({ 
                status: 'error',
                message: `El No. de Contrato ${NoContrato} ya ha sido asignado a otra persona.` 
            });
        }

        // --- PASO 5: Inserción ---
        const sqlInsert = `INSERT INTO DeActosGrados 
            (CodigoActo, Nocontrato, NuCedula, Nombre, Txcontacto, MnTotal, MnPagado, MnSaldo, MnInicial, MaEdoCont, CodUser, Chemise, MnDescuento, Fecha, CodSucursal) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1', ?, ?, ?, NOW(), ?)`;

        const params = [
            CodigoActo ?? null,
            NoContrato ?? null,
            NuCedula ?? null,
            Nombre ?? null,
            Txcontacto ?? null,
            MnTotal ?? 0,
            MnPagado ?? 0,
            MnSaldo ?? 0,
            MnInicial ?? 0,
            CodUser ?? null,
            Chemise ?? null,
            MnDescuento ?? 0,
            CodSucursal ?? null
        ];

        await db.execute(sqlInsert, params);

        res.json({ 
            status: 'success',
            message: "Estudiante registrado exitosamente en el acto." 
        });

    } catch (error) {
        console.error("Error en validaciones complejas:", error);
        res.status(500).json({ error: "Error interno del servidor" });
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
        const sql = `SELECT NoRecibo, ferecibo, mnrecibo FROM ReciboPago WHERE NoContrato = ? ORDER BY NoRecibo`;
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
    const { NoContrato, NuCedula } = req.params;


    try {
        // Limpiamos cualquier espacio invisible que venga de la URL
        const contrato = String(NoContrato).trim();
        const cedula = String(NuCedula).trim();

        console.log(`Ejecutando para: Contrato [${contrato}], Cedula [${cedula}]`);

        // Usamos .query en lugar de .execute para ser más flexibles como phpMyAdmin
        const sql = `SELECT Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito 
                     FROM Depositos 
                     WHERE NoContrato = ? AND NuCedula = ?`;
        
        const [rows] = await db.query(sql, [contrato, cedula]);

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