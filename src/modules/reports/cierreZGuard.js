const db = require('../../config/db');

// 'YYYY-MM-DD' en hora de Venezuela (el servidor puede estar en UTC)
const hoyVenezuela = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

const aDMY = (fecha) => fecha.split('-').reverse().join('/');

// Último día facturado antes de hoy que quedó sin Cierre Z ('YYYY-MM-DD'), o null.
// Solo mira el último día facturado: los días viejos sin cerrar son
// datos históricos y no deben bloquear.
const fechaPendienteZ = async (hoy) => {
    const [pendiente] = await db.query(
        `SELECT DATE_FORMAT(FeRecibo, '%Y-%m-%d') AS fecha
         FROM recibopago
         WHERE FeRecibo = (SELECT MAX(FeRecibo) FROM recibopago WHERE FeRecibo < ?)
           AND (NoCierreZ IS NULL OR NoCierreZ = 0)
         LIMIT 1`,
        [hoy]
    );
    return pendiente.length > 0 ? pendiente[0].fecha : null;
};

// Middleware para las rutas que facturan (recibos y depósitos).
// Bloquea si el último día facturado antes de hoy quedó sin Cierre Z,
// o si hoy ya se hizo el Cierre Z (solo hay uno por día).
const exigirCierreZ = async (req, res, next) => {
    try {
        const hoy = hoyVenezuela();

        const pendiente = await fechaPendienteZ(hoy);

        if (pendiente) {
            return res.status(409).json({
                status: 'error',
                code: 'CIERRE_Z_PENDIENTE',
                fecha: pendiente,
                message: `No se realizó el Cierre Z del ${aDMY(pendiente)}. Debe generarlo antes de facturar.`
            });
        }

        const [cerradoHoy] = await db.query(
            'SELECT NoCierreZ FROM recibopago WHERE FeRecibo = ? AND NoCierreZ > 0 LIMIT 1',
            [hoy]
        );

        if (cerradoHoy.length > 0) {
            return res.status(409).json({
                status: 'error',
                code: 'CIERRE_Z_REALIZADO',
                message: `Ya se realizó el Cierre Z N° ${cerradoHoy[0].NoCierreZ} de hoy. No se puede facturar hasta mañana.`
            });
        }

        next();
    } catch (error) {
        console.error('Error al verificar el Cierre Z:', error);
        res.status(500).json({ status: 'error', message: 'Error al verificar el Cierre Z.' });
    }
};

module.exports = { exigirCierreZ, fechaPendienteZ, hoyVenezuela, aDMY };
