const express = require('express');
const cors = require('cors');
const db = require('./src/config/db');
const authRoutes = require('./src/modules/auth/authRoutes');
const clientsRoutes = require('./src/modules/clients/clientsRoutes');

const app = express();

app.use(express.json());
app.use(cors());

function normalizeClientBody(req, res, next) {
  if (!Array.isArray(req.body)) {
    const b = req.body || {};
    req.body = [b.nucedula, b.txnombre, b.txdireccion, b.txcelular, b.txemail];
  }
  next();
}

app.use(normalizeClientBody)

app.use('/auth', authRoutes);
app.use('/clients', clientsRoutes)

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000, localhost:3000');
});