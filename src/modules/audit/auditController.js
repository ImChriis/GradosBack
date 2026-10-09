const db = require('../../config/db');

// Acciones permitidas (mismo ENUM que la tabla auditoria_general)
const ACCIONES_VALIDAS = ['INSERT', 'UPDATE', 'DELETE'];

// Convierte los detalles JSON (INSERT/DELETE) a objeto, dejando el texto de los UPDATE igual
const parseDetalles = (row) => {
    if (row && typeof row.detalles === 'string' && row.detalles.trim().startsWith('{')) {
        try {
            return { ...row, detalles_obj: JSON.parse(row.detalles) };
        } catch (e) {
            return { ...row, detalles_obj: null };
        }
    }
    return { ...row, detalles_obj: null };
};

// GET /audit?page=1&limit=20&tabla=clientes&accion=UPDATE&desde=2026-01-01&hasta=2026-12-31&q=texto
exports.getAudit = async (req, res) => {
    try {
        const where = [];
        const params = [];

        const { tabla, accion, desde, hasta, q } = req.query;

        if (tabla) {
            where.push('tabla_afectada = ?');
            params.push(tabla);
        }

        const codUserParam = req.query.CodUser !== undefined && req.query.CodUser !== ''
            ? req.query.CodUser
            : req.query.codUser;

        if (codUserParam !== undefined && codUserParam !== '') {
            const codUser = parseInt(codUserParam, 10);
            if (!Number.isInteger(codUser)) {
                return res.status(400).json({ status: 'error', message: 'CodUser debe ser numérico' });
            }
            where.push('CodUser = ?');
            params.push(codUser);
        }

        if (accion) {
            const acc = String(accion).toUpperCase();
            if (!ACCIONES_VALIDAS.includes(acc)) {
                return res.status(400).json({
                    status: 'error',
                    message: `Acción inválida. Use: ${ACCIONES_VALIDAS.join(', ')}`
                });
            }
            where.push('accion = ?');
            params.push(acc);
        }

        if (desde) {
            where.push('fecha_hora >= ?');
            params.push(`${desde} 00:00:00`);
        }

        if (hasta) {
            where.push('fecha_hora <= ?');
            params.push(`${hasta} 23:59:59`);
        }

        if (q) {
            where.push(`(detalles LIKE ? OR tabla_afectada LIKE ? OR usuario_bd LIKE ?
                        OR CONCAT(usuarios.Nombre, ' ', usuarios.Apellido) LIKE ?)`);
            const like = `%${q}%`;
            params.push(like, like, like, like);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // Paginación
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        // El JOIN es obligatorio acá: whereSql puede referenciar usuarios.Nombre
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM auditoria_general
             LEFT JOIN usuarios ON usuarios.CodUsuario = auditoria_general.CodUser
             ${whereSql}`,
            params
        );

        const [rows] = await db.query(
            `SELECT id_auditoria, tabla_afectada, accion, id_registro, CodUser, detalles, usuario_bd, fecha_hora,
                    CONCAT(usuarios.Nombre, ' ', usuarios.Apellido) AS usuario_nombre
             FROM auditoria_general
             LEFT JOIN usuarios ON usuarios.CodUsuario = auditoria_general.CodUser
             ${whereSql}
             ORDER BY fecha_hora DESC, id_auditoria DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            status: 'success',
            data: rows.map(parseDetalles),
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            limit
        });
    } catch (error) {
        console.error('Error fetching audit:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// GET /audit/tables  → tablas monitoreadas con su cantidad de movimientos
exports.getAuditTables = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT tabla_afectada, COUNT(*) AS total, MAX(fecha_hora) AS ultima_actividad
             FROM auditoria_general
             GROUP BY tabla_afectada
             ORDER BY tabla_afectada`
        );
        return res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error fetching audit tables:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// GET /audit/stats  → resumen para el tablero de la interfaz
exports.getAuditStats = async (req, res) => {
    try {
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM auditoria_general');

        const [porAccion] = await db.query(
            'SELECT accion, COUNT(*) AS total FROM auditoria_general GROUP BY accion'
        );

        const [porTabla] = await db.query(
            `SELECT tabla_afectada,
                    COUNT(*) AS total,
                    SUM(accion = 'INSERT') AS inserts,
                    SUM(accion = 'UPDATE') AS updates,
                    SUM(accion = 'DELETE') AS deletes,
                    MAX(fecha_hora) AS ultima_actividad
             FROM auditoria_general
             GROUP BY tabla_afectada
             ORDER BY total DESC`
        );

        const [recientes] = await db.query(
            `SELECT id_auditoria, tabla_afectada, accion, id_registro, CodUser, detalles, usuario_bd, fecha_hora,
                    CONCAT(usuarios.Nombre, ' ', usuarios.Apellido) AS usuario_nombre
             FROM auditoria_general
             LEFT JOIN usuarios ON usuarios.CodUsuario = auditoria_general.CodUser
             ORDER BY fecha_hora DESC, id_auditoria DESC
             LIMIT 10`
        );

        return res.json({
            status: 'success',
            total,
            porAccion,
            porTabla,
            recientes: recientes.map(parseDetalles)
        });
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// GET /audit/record/:tabla/:idRegistro  → historial completo de un registro
exports.getRecordHistory = async (req, res) => {
    try {
        const { tabla, idRegistro } = req.params;
        const id = parseInt(idRegistro, 10);

        if (!Number.isInteger(id)) {
            return res.status(400).json({ status: 'error', message: 'El id del registro debe ser numérico' });
        }

        const [rows] = await db.query(
            `SELECT id_auditoria, tabla_afectada, accion, id_registro, CodUser, detalles, usuario_bd, fecha_hora,
                    CONCAT(usuarios.Nombre, ' ', usuarios.Apellido) AS usuario_nombre
             FROM auditoria_general
             LEFT JOIN usuarios ON usuarios.CodUsuario = auditoria_general.CodUser
             WHERE tabla_afectada = ? AND id_registro = ?
             ORDER BY fecha_hora DESC, id_auditoria DESC
             LIMIT 200`,
            [tabla, id]
        );

        return res.json({ status: 'success', data: rows.map(parseDetalles), total: rows.length });
    } catch (error) {
        console.error('Error fetching record history:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};

// GET /audit/:id  → detalle de una auditoría
exports.getAuditById = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ status: 'error', message: 'El id debe ser numérico' });
        }

        const [rows] = await db.query(
            `SELECT auditoria_general.*, CONCAT(usuarios.Nombre, ' ', usuarios.Apellido) AS usuario_nombre
             FROM auditoria_general
             LEFT JOIN usuarios ON usuarios.CodUsuario = auditoria_general.CodUser
             WHERE id_auditoria = ?`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Registro de auditoría no encontrado' });
        }

        return res.json({ status: 'success', data: parseDetalles(rows[0]) });
    } catch (error) {
        console.error('Error fetching audit by id:', error);
        return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};
