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

exports.createMetodoPago = async (req, res) => {
    const { nombreMetodoPago, status } = req.body;

    if (!nombreMetodoPago || !status) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    try{
        const sql = `INSERT INTO MetodoPago (NombreMetodoPago, Status) VALUES (?, ?)`;
        await db.query(sql, [nombreMetodoPago, status]);
        res.status(201).json({ message: "Registro Guardado Satisfactoriamente!!!" });
    } catch (error) {
        console.error('Error creating payment method:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateMetodoPago = async (req, res) => {
    const { idMetodoPago } = req.params;
    const { nombreMetodoPago, status } = req.body;
    
    if(!idMetodoPago){
        return res.status(400).json({ message: "ID del método de pago es obligatorio" });
    }

    try{
        const sql = `UPDATE MetodoPago SET NombreMetodoPago = ?, Status = ? WHERE idMetodoPago = ?`;
        const [result] = await db.query(sql, [nombreMetodoPago, status, idMetodoPago]);
        if(result.affectedRows === 0){
            return res.status(404).json({ message: "Método de pago no encontrado para actualizar" });
        }
        res.json({ message: "Registro Actualizado Satisfactoriamente!!!" });
    } catch (error) {
        console.error('Error updating payment method:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}