const db = require('../../config/db');

exports.getSpecialities = async (req, res) => {
    try{
        const sql = 'SELECT * FROM especialidad';
        const [ rows ] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching specialities:', error);
        res.status(500).json({ error: 'Server error' });
    }
}