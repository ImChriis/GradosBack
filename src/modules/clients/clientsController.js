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
    const { nucedula, txnombre, txdireccion, txcelular, txemail } = req.body;

    if (!nucedula || !txnombre) {
        return res.status(400).json({
            error: 'Missing required fields: nucedula and txnombre are mandatory.'
        });
    }

    try {
        // Seleccionamos también TxNombre para incluirlo en la respuesta de error
        const [existingClient] = await db.query('SELECT TxNombre FROM clientes WHERE NuCedula = ?', [nucedula]);

        if (existingClient.length > 0) {
            const clienteExistente = existingClient[0].TxNombre;
            return res.status(409).json({ 
                error: `La cédula ya pertenece al cliente: ${clienteExistente}` 
            });
        }

        const [result] = await db.execute(
            'SELECT COALESCE(MAX(CodUser), 0) + 1 AS nextCodUser FROM clientes'
        );
        const nextCodUser = result[0].nextCodUser;

        const sql = "INSERT INTO clientes (NuCedula, TxNombre, TxDireccion, TxCelular, TxEmail, CodUser) VALUES (?, ?, ?, ?, ?, ?)";
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail, nextCodUser]);

        res.status(201).json({ 
            message: 'Client added successfully',
            clientId: rows.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                error: 'El cliente con esta cédula ya se encuentra registrado.'
            });
        }

        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.updateClient = async (req, res) => {
    const { id } = req.params;
    const { nucedula, txnombre, txdireccion, txcelular, txemail } = req.body || {};

    if (!id) {
        return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!nucedula || !txnombre) {
        return res.status(400).json({
            error: 'Nucedula and TxNombre are mandatory fields'
        });
    }

    try {
        // Cambiamos SELECT id por SELECT TxNombre para obtener la persona en uso
        const [existingClient] = await db.execute(
            'SELECT TxNombre FROM clientes WHERE NuCedula = ? AND id <> ?',
            [nucedula, id]
        );

        if (existingClient.length > 0) {
            const clienteExistente = existingClient[0].TxNombre;
            return res.status(409).json({
                error: `La cédula ingresada ya pertenece al cliente: ${clienteExistente}`
            });
        }

        const [clientToUpdate] = await db.execute(
            'SELECT id FROM clientes WHERE id = ?',
            [id]
        );

        if (clientToUpdate.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const sql = 'UPDATE clientes SET NuCedula = ?, TxNombre = ?, TxDireccion = ?, TxCelular = ?, TxEmail = ? WHERE id = ?'; 
        await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail, id]);

        return res.json({ message: 'Client updated successfully' });

    } catch (error) {
        console.error('Error updating client:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'The new ID card number is already in use' });
        }

        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getClientsByCedula = async (req, res) => {
    const { nucedula } = req.params;

    try{
        const sql = 'SELECT * FROM clientes WHERE nucedula = ?';
        const [rows] = await db.query(sql, [nucedula]);
        res.json(rows[0]);
    }catch (error) {
        console.error('Error fetching client by cedula:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}