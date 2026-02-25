const db = require('../../config/db');

exports.getActs = async (req, res) => {
    try{
        const sql = 'SELECT a.CodigoActo, ag.Fecha, ag.Hora, ag.siglas, ag.especialidad, la.TxLugar FROM dbo.ActosGrados AS ag INNJER JOIN dbo.LugarActo AS la On ag.CoLugar = la.CoLugar INNER JOIN dbo.Instituciones as i ON ag.CodigoInst = i.CodigoInst WHERE ag.Culminada = "0" ORDER BY ag.CodigoActo DESC';
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching acts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}