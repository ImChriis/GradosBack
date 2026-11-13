const db = require('../../config/db');

// 'YYYY-MM-DD' en hora de Venezuela (el servidor puede estar en UTC)
const hoyVenezuela = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

const aDMY = (fecha) => fecha.split('-').reverse().join('/');

// 'YYYY-MM-DD' -> 'jueves 12/11/2026' (mediodía UTC para que el día no se corra)
const fechaLarga = (fecha) =>
    `${new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-VE', { weekday: 'long', timeZone: 'UTC' })} ${aDMY(fecha)}`;

// Último día con movimientos (recibos o depósitos) antes de hoy que quedó sin
// Cierre Z ('YYYY-MM-DD'), o null. Los días sin trabajo (domingos, feriados)
// no tienen movimientos y se saltan solos. Solo mira ese último día: los días
// viejos sin cerrar son datos históricos y no deben bloquear. BD nueva sin
// movimientos: fecha queda NULL y no pide nada.
const fechaPendienteZ = async (hoy) => {
    const [pendiente] = await db.query(
        `SELECT DATE_FORMAT(u.fecha, '%Y-%m-%d') AS fecha
         FROM (SELECT GREATEST(COALESCE(r.f, d.f), COALESCE(d.f, r.f)) AS fecha
               FROM (SELECT MAX(FeRecibo) AS f FROM recibopago WHERE FeRecibo < ?) r,
                    (SELECT MAX(Fecha) AS f FROM depositos WHERE Fecha < ?) d) u
         WHERE EXISTS (SELECT 1 FROM recibopago WHERE FeRecibo = u.fecha AND (NoCierreZ IS NULL OR NoCierreZ = 0))
            OR EXISTS (SELECT 1 FROM depositos WHERE Fecha = u.fecha AND (NoCierreZ IS NULL OR NoCierreZ = 0))`,
        [hoy, hoy]
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
                message: `No se ha hecho el Cierre Z del ${fechaLarga(pendiente)}. Debe generarlo antes de continuar.`
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

module.exports = { exigirCierreZ, fechaPendienteZ, hoyVenezuela, aDMY, fechaLarga };
