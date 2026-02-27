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