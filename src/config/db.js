require('dotenv').config();
const mysql = require('mysql2/promise');

//Creamos la conexion a la bd 
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true // TiDB es seguro por defecto
    }
});

//Conexion a la base de datos
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        // console.log(' Database connected successfully with Promise Pool.');
        connection.release(); // Liberamos la conexión de vuelta al pool
    } catch (error) {
        console.error(' Error connecting to the database:', error.message);
    }
}

testConnection();

module.exports = pool;


