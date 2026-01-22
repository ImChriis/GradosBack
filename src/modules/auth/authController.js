const db = require('../../config/db');

exports.login = async (req, res) => {
    const { Usuario, Clave } = req.body;

    try{
        const sql = 'SELECT * FROM usuarios WHERE Usuario =? AND Clave = ?';
        const [rows] = await db.query(sql, [Usuario, Clave]);
    
        if(rows.length === 0){
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }

        res.json({ message: 'Login exitoso', user: {
            id: rows[0].id,
            usuario: rows[0].Usuario,
            maTipoUsr: rows[0].MaTipoUsr
        } });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
}