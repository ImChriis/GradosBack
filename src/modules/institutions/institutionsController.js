const db = require('../../config/db');

exports.getInstitutions = async (req, res) => {
    try{
        const sql = 'Select * FROM instituciones'
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching institutions:', error);
        res.status(500).json({ error: 'Server error' });
    }
}