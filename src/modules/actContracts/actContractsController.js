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
        const sql = 'SELECT NoContrato, Nombre, MnPagado, MnSaldo from deactosgrados where CodigoActo = ? ORDER BY Nombre ASC';
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