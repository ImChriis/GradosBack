const db = require('../../config/db');

exports.getClients = async (req, res) => {
    try{
        const sql = 'SELECT * From clientes';
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Server error'})
    }
}

exports.addClient = async (req, res) => {
    const [nucedula, txnombre, txdireccion, txcelular, txemail] = req.body;

     Array.isArray(req.body)
            ? {
                nucedula: req.body[0],
                txnombre: req.body[1],
                txdireccion: req.body[2],
                txcelular: req.body[3],
                txemail: req.body[4],
            }
            : (req.body || {});

    try{
        const sql = "INSERT INTO clientes (NuCedula, TxNombre, TxDireccion, TxCelular, TxEmail) VALUES (?, ?, ?, ?, ?)";
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail]);

        if(rows.affectedRows === 0){
            return res.status(400).json({ error: 'Failed to add client' });
        }

        res.status(201).json({ message: 'Client added successfully' });
    } catch (error){
        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

exports.updateClient = async (req, res) => {
    const id = req.params.id;
    const {nucedula, txnombre, txdireccion, txcelular, txemail} = req.body || {};

    if (!id || [nucedula, txnombre, txdireccion, txcelular, txemail].some(v => v == null || v === '')) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try{
        const sql = 'UPDATE clientes SET NuCedula = ?, TxNombre = ?, TxDireccion = ?, TxCelular = ?, TxEmail = ? WHERE id = ?'; 
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail, id]);

        if(rows.lengt === 0){
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({ message: 'Client updated successfully' });
    }catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Server error' });
    }
}