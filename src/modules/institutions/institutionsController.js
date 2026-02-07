const db = require('../../config/db');

exports.getInstitutions = async (req, res) => {
    try{
        const sql = 'Select * FROM instituciones'
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error){
        console.error('Error fetching institutions:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

exports.addInstitution = async (req, res) => {
    const { siglas, nbinstitucion, tpinstitucion, CodUser } = req.body;

    if(!nbinstitucion || !tpinstitucion){
        return res.status(400).json({
            error: 'Missing required fields: nbinstitucion and tpinstitucion are mandatory'
        })
    }

    try{
        const sql = "INSERT INTO instituciones (siglas, nbinstitucion, tpinstitucion, CodUser) VALUES (?, ?, ?, ?)";
        const [rows] = await db.query(sql, [siglas, nbinstitucion, tpinstitucion, CodUser]);

        res.status(201).json({
            message: 'Institution added successfully',
            InsitutionId: rows.insertId
        })
    } catch (error){
        console.error('Error adding institution: ', error);
        res.status(500).json({ error: 'Server error' });
    }
}

exports.updateInstitution = async (req, res) => {
    const { CodigoInst } = req.params;
    const { siglas, nbinstitucion, tpinstitucion, CodUser } = req.body || {};

    if(!CodigoInst){
        return res.status(400).json({ error: 'Insitution ID is required' });
    }

    if(!nbinstitucion || !tpinstitucion){
        return res.status(400).json({
            error: 'Missing required fields: nbinstitucion and tpinstitucion are mandatory'
        })
    }

    try{
        const sql = 'UPDATE instituciones SET siglas = ?, nbinstitucion = ?, tpinstitucion = ?, CodUser = ? WHERE CodigoInst = ?';
        const [rows] = await db.query(sql, [siglas, nbinstitucion, tpinstitucion, CodUser, CodigoInst]);

        if(rows.affectedRows === 0){
            return res.status(404).json({ error: 'Institution not found or no changes made' });
        }

        res.json({ message: 'Institution updated sucessfully' });
    }catch (error){
        console.error('Error updating institucion: ', error);

        if(error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'The new ID card number is already in use' })
        }

        res.status(500).json({ error: 'Server error' });
    }
}

