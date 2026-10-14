const db = require('../../config/db');
const audit = require('../audit/auditService');

const getFechaHoraVenezuela = () => {
    const ahora = new Date();
    const fechaActual = ahora.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
    const horaActual = ahora.toLocaleTimeString('es-VE', { 
        timeZone: 'America/Caracas', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });
    
    // Retorna el string directo "16/9/2026 12:47 PM"
    return `${fechaActual} ${horaActual}`;
};

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
    const { nucedula, txnombre, txdireccion, txcelular, txemail, CodUser } = req.body;

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

        
       const feingreso =  getFechaHoraVenezuela(); 

        const sql = "INSERT INTO clientes (NuCedula, TxNombre, TxDireccion, TxCelular, TxEmail, feingreso, CodUser) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const [rows] = await db.query(sql, [nucedula, txnombre, txdireccion, txcelular, txemail, feingreso, CodUser]);

        audit.auditarInsert({
            tabla: 'clientes',
            idRegistro: rows.insertId,
            datos: { nucedula, txnombre, txdireccion, txcelular, txemail, feingreso, CodUser }
        });

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
    const { nucedula, txnombre, txdireccion, txcelular, txemail, CodUser } = req.body || {};

    if (!id) {
        return res.status(400).json({ error: 'Client ID is required' });
    }

    if (!nucedula || !txnombre) {
        return res.status(400).json({
            error: 'Nucedula and TxNombre are mandatory fields'
        });
    }

    try {
        // Validar si la cédula ya pertenece a otro cliente
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

        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Datos anteriores para la auditoría (cliente + actos relacionados)
        const antesCliente = await audit.antesDe('SELECT * FROM clientes WHERE id = ?', [id]);
        const [antesActos] = await db.query('SELECT * FROM deactosgrados WHERE NuCedula = ?', [nucedula]);

        // 1. Actualizar tabla clientes
        const sqlClient = 'UPDATE clientes SET NuCedula = ?, TxNombre = ?, TxDireccion = ?, TxCelular = ?, TxEmail = ?, CodUser = ? WHERE id = ?'; 
        await db.query(sqlClient, [nucedula, txnombre, txdireccion, txcelular, txemail, CodUser, id]);

        // 2. Actualizar Nombre y TxContacto en deactosgrados para la misma cédula
        const sqlActos = 'UPDATE deactosgrados SET Nombre = ?, TxContacto = ? WHERE NuCedula = ?';
        const [resActos] = await db.query(sqlActos, [txnombre, txcelular, nucedula]);

        // Confirmar transacción
        await db.query('COMMIT');

        // Auditoría (una fila por acto afectado, como lo haría un trigger)
        audit.auditarUpdate({
            tabla: 'clientes',
            idRegistro: id,
            antes: antesCliente,
            despues: { NuCedula: nucedula, TxNombre: txnombre, TxDireccion: txdireccion, TxCelular: txcelular, TxEmail: txemail, CodUser }
        });

        if (resActos.affectedRows > 0) {
            for (const acto of antesActos) {
                audit.auditarUpdate({
                    tabla: 'deactosgrados',
                    idRegistro: acto.id,
                    antes: acto,
                    despues: { Nombre: txnombre, Txcontacto: txcelular },
                    CodUser
                });
            }
        }

        return res.json({ message: 'Client and related records updated successfully' });

    } catch (error) {
        // Revertir en caso de error
        await db.query('ROLLBACK');

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

exports.deleteClient = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Client ID is required' });
    }

    // Obtener conexión del pool para manejar la transacción
    const connection = await db.getConnection();

    try {
        // 1. Obtener id y NuCedula del cliente
        const [existingClient] = await connection.execute(
            'SELECT id, NuCedula FROM clientes WHERE id = ?',
            [id]
        );

        if (existingClient.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = existingClient[0];

        // Datos anteriores para la auditoría (se registran dentro de la transacción)
        const [antesActos] = await connection.query('SELECT * FROM deactosgrados WHERE NuCedula = ?', [client.NuCedula]);
        const [antesDepositos] = await connection.query('SELECT * FROM depositos WHERE NuCedula = ?', [client.NuCedula]);
        const [antesRecibos] = await connection.query('SELECT * FROM recibopago WHERE NuCedula = ?', [client.NuCedula]);
        const [antesCliente] = await connection.query('SELECT * FROM clientes WHERE id = ?', [client.id]);

        // 2. Iniciar la Transacción
        await connection.beginTransaction();

        // 3. Eliminar de las tablas dependientes usando el campo NuCedula
        await connection.query('DELETE FROM deactosgrados WHERE NuCedula = ?', [client.NuCedula]);
        await connection.query('DELETE FROM depositos WHERE NuCedula = ?', [client.NuCedula]);
        await connection.query('DELETE FROM recibopago WHERE NuCedula = ?', [client.NuCedula]);

        // 4. Eliminar el registro en la tabla principal de clientes usando su id
        await connection.query('DELETE FROM clientes WHERE id = ?', [client.id]);

        // Auditoría: una fila por registro eliminado (va en la misma transacción)
        for (const fila of antesActos) {
            audit.auditarDelete({ tabla: 'deactosgrados', idRegistro: fila.id, datos: fila, conn: connection });
        }
        for (const fila of antesDepositos) {
            audit.auditarDelete({ tabla: 'depositos', idRegistro: fila.id, datos: fila, conn: connection });
        }
        for (const fila of antesRecibos) {
            audit.auditarDelete({ tabla: 'recibopago', idRegistro: fila.id, datos: fila, conn: connection });
        }
        for (const fila of antesCliente) {
            audit.auditarDelete({ tabla: 'clientes', idRegistro: fila.id, datos: fila, conn: connection });
        }

        // 5. Confirmar transacción y liberar la conexión
        await connection.commit();
        connection.release();

        return res.json({ message: 'Client and all related records deleted successfully' });

    } catch (error) {
        // En caso de fallo, revertir la transacción y liberar la conexión
        await connection.rollback();
        connection.release();

        console.error('Error deleting client in cascade:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};