const db = require('../../config/db');

exports.getBanks = async (req, res) => {
    try{
        const sql = 'SELECT * FROM bancos';
        const [rows] = await db.query(sql);
        res.json(rows);
    }catch (error){
        console.error('Error fetching banks:', error);
        res.status(500).json({ error: 'Internal Server Error' })
    }
}

exports.addBank = async (req, res) => {
    const { Bancos } = req.body;

    if(!Bancos){
        return res.status(400).json({ error: 'Missing required field: Bancos is mandatory' });
    }

    try{
        const sql = 'INSERT INTO bancos (Bancos) VALUES (?)';
        const [rows] = await db.query(sql, [Bancos]);

        res.status(201).json({
            message: 'Bank added successfully',
            bankId: rows.insertId
        })
    }catch(error){
        console.error('Error adding bank: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateBank = async (req, res) => {
    const { id } = req.params;
    const { Bancos } = req.body || {};

    if(!id || !Bancos){
        return res.status(400).json({ error: 'Missing required fields: id and Bancos are mandatory' });
    }

    try{
        const sql = 'UPDATE bancos SET Bancos = ? WHERE id = ?';
        const [rows] = await db.query(sql, [Bancos, id]);
        
        if(rows.affectedRows === 0){
            return res.status(404).json({ error: 'Bank not found or no changes made' });
        }

        res.json({ message: 'Bank updated successfully' });
    }catch (error){
        console.error('Error updating bank: ', error);
        
        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'The new bank name is already in use' })
        }
        
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
