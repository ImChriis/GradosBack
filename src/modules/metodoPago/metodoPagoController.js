const db = require('../../config/db');

exports.getMetodoPagos = async (req, res) => {
    try {
        const sql = 'SELECT * FROM metodopago';
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}