const db = require('../../config/db');

exports.downloadBackup = async (req, res) => {
    try {
        const dbName = process.env.DB_NAME || 'grados';
        let dump = `-- RESPALDO SISTEMA DE GRADOS\n`;
        dump += `-- Generado: ${new Date().toLocaleString()}\n`;
        dump += `SET FOREIGN_KEY_CHECKS = 0;\n`;
        dump += `SET NAMES utf8mb4;\n\n`;

        // 1. Obtener lista de todas las tablas de la base de datos
        const [tables] = await db.query(`SHOW FULL TABLES FROM \`${dbName}\` WHERE Table_type = 'BASE TABLE'`);

        for (let tableObj of tables) {
            const tableName = Object.values(tableObj)[0];
            
            // 2. Generar estructura (CREATE TABLE)
            const [createRes] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
            dump += `-- ------------------------------------------------------\n`;
            dump += `-- Estructura de la tabla: ${tableName}\n`;
            dump += `-- ------------------------------------------------------\n`;
            dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            dump += `${createRes[0]['Create Table']};\n\n`;

            // 3. Obtener y procesar los DATOS
            const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
            
            if (rows.length > 0) {
                dump += `-- Volcado de datos: ${tableName}\n`;
                
                // Mapeamos cada fila a un formato (valor1, valor2, ...)
                const valuesArray = rows.map(row => {
                    const vals = Object.values(row).map(v => {
                        // Caso 1: Nulos
                        if (v === null) return 'NULL';
                        
                        // Caso 2: Números
                        if (typeof v === 'number') return v;
                        
                        // Caso 3: Booleanos
                        if (typeof v === 'boolean') return v ? 1 : 0;
                        
                        // Caso 4: Fechas (Validación para evitar RangeError)
                        if (v instanceof Date) {
                            if (isNaN(v.getTime())) return 'NULL'; 
                            return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        }

                        // Caso 5: Strings (Rutas de Windows y Escapes)
                        // IMPORTANTE: Primero escapamos las barras \ y luego las comillas '
                        let str = v.toString()
                            .replace(/\\/g, "\\\\") 
                            .replace(/'/g, "''");
                            
                        return `'${str}'`;
                    });
                    return `(${vals.join(',')})`;
                });

                // Dividimos en bloques de 500 filas para que el SQL sea manejable
                for (let i = 0; i < valuesArray.length; i += 500) {
                    const chunk = valuesArray.slice(i, i + 500);
                    dump += `INSERT INTO \`${tableName}\` VALUES \n${chunk.join(',\n')};\n`;
                }
                dump += `\n`;
            }
        }

        // 4. Restaurar restricciones
        dump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

        // 5. Configurar headers y enviar el flujo de datos
        const fileName = `BACKUP_GRADOS_${new Date().toISOString().split('T')[0]}.sql`;
        res.setHeader('Content-Type', 'text/sql');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        return res.send(dump);

    } catch (error) {
        console.error("Error en respaldo manual:", error);
        // Enviamos el mensaje de error para debuguear en el front si falla algo más
        return res.status(500).send("Error generando el SQL: " + error.message);
    }
};

exports.uploadBackup = async (req, res) => {
    const connection = await db.getConnection(); // Obtener conexión del pool
    try {
        await connection.beginTransaction(); // <-- INICIO DE TRANSACCIÓN

        const sqlContent = req.file.buffer.toString('utf8');
        const queries = sqlContent.split(/;\s*[\r\n]+/gm).filter(q => q.trim().length > 0);

        for (let query of queries) {
            await connection.query(query.trim() + ';');
        }

        await connection.commit(); // <-- SI LLEGA AQUÍ, TODO SE GUARDA
        res.status(200).json({ message: "Restauración exitosa" });

    } catch (error) {
        await connection.rollback(); // <-- SI ALGO FALLA, NO SE GUARDA NADA
        res.status(500).json({ message: "Error: " + error.message });
    } finally {
        connection.release();
    }
};