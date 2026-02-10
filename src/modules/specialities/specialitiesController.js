const db = require('../../config/db');

exports.getSpecialities = async (req, res) => {
    try{
        const sql = 'SELECT * FROM especialidad';
        const [ rows ] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching specialities:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.addSpeciality = async (req, res) => {
    const { Titulo, Especialidad, CodUser } = req.body;

    if(!Titulo || !Especialidad){
        return res.status(400).json({
            error: 'Missing required fields: Titulo and Especialidad are mandatory'
        })
    }

    try{
        const sql = "INSERT INTO especialidad (Titulo, Especialidad, CodUser) VALUES (?, ?, ?)";
        const [rows] = await db.query(sql, [Titulo, Especialidad, CodUser]);

        res.status(201).json({
            message: 'Speciality added successfully',
            specialityId: rows.insertId
        });
    }catch (error){
        console.error('Error adding speciality: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

exports.updateSpeciality = async (req, res) => {
    const { CodigoEsp } = req.params;
    const { Titulo, Especialidad, CodUser } = req.body || {};

    if(!CodigoEsp){
        return res.status(400).json({ error: 'Speciality ID is required' });
    }

    if(!Titulo || !Especialidad){
        return res.status(400).json({
            error: 'Nucedula and TxNombre are mandatory fields'
        });
    }

    try{
        const sql = "UPDATE especialidad SET Titulo = ?, Especialidad = ?, CodUser = ? WHERE CodigoEsp = ?";
        const [rows] = await db.query(sql, [Titulo, Especialidad, CodUser, CodigoEsp]);

        if(rows.affectedRows === 0){
            return res.status(404).json({ error: 'Speciality not found or no changes made' });
        }

        res.json({ message: 'Speciality updated successfully' });

    }catch(error){
        console.error('Error updating speciality: ', error);

        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'The new ID card number is already in use' });
        }

        res.status(500).json({ error: 'Internal Server Error' });
    }
}

