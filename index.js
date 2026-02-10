const express = require('express');
const cors = require('cors');
const db = require('./src/config/db');
const authRoutes = require('./src/modules/auth/authRoutes');
const clientsRoutes = require('./src/modules/clients/clientsRoutes');
const specialitiesRoutes = require('./src/modules/specialities/specialitiesRoutes');
const institutionsRoutes = require('./src/modules/institutions/institutionRoutes');
const actPlacesRoutes = require('./src/modules/ActPlaces/actPlacesRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// function normalizeClientBody(req, res, next) {
//   if (req.method === 'POST' && !Array.isArray(req.body)) {
//     const b = req.body || {};
//     req.body = [b.nucedula, b.txnombre, b.txdireccion, b.txcelular, b.txemail];
//   }
//   next();
// }

app.use('/auth', authRoutes);
app.use('/clients', clientsRoutes);
app.use('/specialities', specialitiesRoutes);
app.use('/institutions', institutionsRoutes);
app.use('/actPlaces', actPlacesRoutes);

//Desarrollo
app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000, localhost:3000');
});

//Produccion
// const PORT = process.env.PORT || 8080;
// app.listen(PORT, "0.0.0.0", () => {
//     console.log(`Servidor escuchando en el puerto ${PORT}`);
// });