const db = require('../../config/db');

exports.getActPlaces = async (req, res) => {
    try{
        const sql = 'SELECT * FROM lugaracto';
        const [rows] = await db.query(sql);
        res.json(rows);
    }catch (error){
        console.error('Error fetching Act Places:', error);
        res.status(500).json({ error: 'Internal Server Error' })
    }
}

exports.addActPlace = async (req, res) => {
    const { TxLugar, Capacidad, MaTipoLugar, Activo, CodUser } = req.body;

    if(!TxLugar || !Capacidad){
        return res.status(400).json({
            message: 'Missing required fields: TxLugar and Capacidad are mandatory'
        });
    }

    try{
        const sql = 'INSERT INTO lugaracto (TxLugar, Capacidad, MaTipoLugar, Activo, Coduser) VALUES (?, ?, ?, ?, ?)';
        const [rows] = await db.query(sql, [TxLugar, Capacidad, MaTipoLugar, Activo, CodUser]);

        res.status(201).json({
            message: 'Act Place added successfully',
            ActId: rows.insertId
        })
    }catch (error){
        console.error('Error adding act place: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateActPlace = async (req, res) => {
    
}