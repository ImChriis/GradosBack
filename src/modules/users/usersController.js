const db = require('../../config/db');

exports.getUsers = async (req, res) => {
    try {
        const sql = "Select CodUsuario, Cedula, Nombre, Apellido, Usuario, MaTipoUsr, FechaReg From Usuarios";
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener usuarios", error });
    }
};

exports.createUser = async (req, res) => {
    const { Cedula, Nombre, Apellido, Usuario, Clave, Clave2, MaTipoUsr, FechaReg } = req.body;

    if(!Cedula || !Nombre || !Apellido || !Usuario || !Clave || !Clave2 || !MaTipoUsr) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    try {
        const sql = `Insert into Usuarios(Cedula, Nombre, Apellido, Usuario, Clave, MaTipoUsr, FechaReg) 
                     values (?, ?, ?, ?, ?, ?, ?)`;
        
        await db.query(sql, [Cedula, Nombre, Apellido, Usuario, Clave, MaTipoUsr, FechaReg || new Date()]);
        
        res.status(201).json({ message: "Registro Guardado Satisfactoriamente!!!" });
    } catch (error) {
        res.status(500).json({ message: "Error al guardar", error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    const { CodUsuario } = req.params; // CodUsuario
    const { Cedula, Nombre, Apellido, Usuario, Clave, MaTipoUsr, FechaReg } = req.body;

    try {
        const sql = `Update Usuarios set Cedula=?, Nombre=?, Apellido=?, Usuario=?, Clave=?, MaTipoUsr=?, FechaReg=? 
                     Where CodUsuario=?`;
        
        const [result] = await db.query(sql, [Cedula, Nombre, Apellido, Usuario, Clave, MaTipoUsr, FechaReg, CodUsuario]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Usuario no encontrado para actualizar" });
        }

        res.json({ message: "Registro Actualizado Satisfactoriamente!!!" });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar", error: error.message });
    }
};