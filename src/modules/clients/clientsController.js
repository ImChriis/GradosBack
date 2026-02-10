const db = require('../../config/db');

exports.getClients = async (req, res) => {
    try{
        const sql = 'SELECT * From clientes';
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Internal Server Error'})
    }
}

exports.addClient = async (req, res) => {
    const {nucedula, txnombre, txdireccion, txcelular, txemail} = req.body;

    if(!nucedula || !txnombre){
        return res.status(400).json({
            error: 'Missing required fields: nucedula and txnombre are mandatory.'
        })
    } 

    try{
        const sql = "INSERT INTO clientes (NuCedula, TxNombre, TxDireccion, TxCelular, TxEmail) VALUES (?, ?, ?, ?, ?)";
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail]);

        res.status(201).json({ 
            message: 'Client added successfully',
            clientId: rows.insertId
         });
    } catch (error){
        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateClient = async (req, res) => {
    const { id } = req.params;
    const { nucedula, txnombre, txdireccion, txcelular, txemail } = req.body || {};

    if(!id){
        return res.status(400).json({ error: 'Client ID is required' });
    }

    if(!nucedula || !txnombre){
        return res.status(400).json({
            error: 'Nucedula and TxNombre are mandatory fields'
        })
    }

    try{
        const sql = 'UPDATE clientes SET NuCedula = ?, TxNombre = ?, TxDireccion = ?, TxCelular = ?, TxEmail = ? WHERE id = ?'; 
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail, id]);

        if(rows.affectedRows === 0){
            return res.status(404).json({ error: 'Client not found or no changes made' });
        }

        res.json({ message: 'Client updated successfully' });

    }catch (error) {
        console.error('Error updating client:', error);

        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'The new ID card number is already in use' })
        }

        res.status(500).json({ error: 'Internal Server Error' });
    }
}