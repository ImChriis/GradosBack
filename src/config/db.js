const mysql = require('mysql2/promise');

//Creamos la conexion a la bd
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'grados',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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


