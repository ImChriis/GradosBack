const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.downloadBackup = async (req, res) => {
    // Configuración de la base de datos (puedes usar tus variables de entorno)
    const dbName = process.env.DB_NAME || 'tu_base_de_datos';
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASS || 'tu_password';
    const dbHost = process.env.DB_HOST || 'localhost';

    const fileName = `backup-${dbName}-${new Date().getTime()}.sql`;
    const filePath = path.join(__dirname, '..', 'backups', fileName);

    // Comando mysqldump
    // Nota: Si no tienes password, quita la parte de -p${dbPass}
    const cmd = `mysqldump -h ${dbHost} -u ${dbUser} -p${dbPass} ${dbName} > "${filePath}"`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error ejecutando mysqldump: ${error.message}`);
            return res.status(500).json({ error: "Error al generar el respaldo" });
        }

        // Una vez creado el archivo, lo enviamos al cliente
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error("Error al enviar el archivo:", err);
            }
            // Opcional: Borrar el archivo del servidor después de enviarlo para no ocupar espacio
            fs.unlinkSync(filePath);
        });
    });
};