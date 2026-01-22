const express = require('express');
const cors = require('cors');
const db = require('./src/config/db');
const authRoutes = require('./src/modules/auth/authRoutes');

const app = express();

app.use(express.json());
app.use(cors());

app.use('/auth', authRoutes);

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000, localhost:3000');
});