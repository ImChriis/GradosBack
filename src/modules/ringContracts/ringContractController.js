const db = require('../../config/db');

exports.getContracts = async (req, res) => {
    try {
        const sql = `SELECT 
        Co.id, 
        Co.NoContrato, 
        Cl.NuCedula, 
        Cl.txnombre
    FROM Clientes Cl
    INNER JOIN Contratos Co ON Cl.NuCedula = Co.NuCedula
    WHERE Co.InActivo = '0'
    ORDER BY Co.NoContrato`;
        const [rows] = await db.execute(sql); 
        res.json(rows);
    } catch (error) {
        console.error('Error fetching ring contracts users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}