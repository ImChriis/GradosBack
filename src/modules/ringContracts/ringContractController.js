const db = require('../../config/db');
const audit = require('../audit/auditService');

// =================================================================
//  CONTRATOS DE ANILLOS (ringContracts)
//  Tabla: contratos  |  Llave: id
//  Guiado del módulo actContracts, pero cada fila ES un contrato
//  (no un acto con muchos contratos).
//
//  Pestañas del front:
//    Detalles  -> PUT /update/:id
//    Regalías  -> PUT /update/:id
//    Estado    -> PUT /updateEstado/:id
//    Saldo     -> PUT /updateTotals/:id  y  POST /pay/:id
// =================================================================

// ----------------------------------------------------------------
//  Utilidades
// ----------------------------------------------------------------

// Los montos se guardan como texto en formato venezolano: "1.400,00"
const parseMonto = (valor) => {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return valor;
    const limpio = String(valor).trim().replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
    const n = parseFloat(limpio);
    return isNaN(n) ? 0 : n;
};

const formatMonto = (numero) =>
    new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Math.max(0, Number(numero) || 0)
    );

// Fechas: acepta 'YYYY-MM-DD', ISO completo o 'DD/MM/YYYY'.
// Vacío o inválido -> '1900-01-01' (el mismo "vacío" que usa el sistema antiguo)
const aFechaSQL = (valor) => {
    if (valor === null || valor === undefined || valor === '' || valor === 'Invalid Date') return '1900-01-01';
    const s = String(valor).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '1900-01-01';
};

// Checkbox -> '1' / '0' (el formato que usa la tabla)
const aFlag = (valor) => (valor === true || valor === 1 || valor === '1' || valor === 'S' || valor === 'true' ? '1' : '0');

// Columnas que se pueden escribir y cómo transformar cada una
const COLUMNAS = [
    // --- Detalles ---
    { col: 'titulo', tipo: 'texto' },
    { col: 'especialidad', tipo: 'texto' },
    { col: 'siglas', tipo: 'texto' },
    { col: 'modelo', tipo: 'texto' },
    { col: 'kilate', tipo: 'texto' },
    { col: 'medida', tipo: 'texto' },
    { col: 'peso', tipo: 'texto' },
    { col: 'cazirc', tipo: 'texto' },
    { col: 'tpzirc', tipo: 'texto' },
    { col: 'MnCostoAnillo', tipo: 'monto' },
    { col: 'TxObservacion', tipo: 'texto' },
    { col: 'txconcepto', tipo: 'texto' },
    { col: 'MaTpCont', tipo: 'texto' },
    { col: 'feinicio', tipo: 'fecha' },
    { col: 'InActivo', tipo: 'flag' },
    { col: 'Anulado', tipo: 'flag' },
    { col: 'Exonerado', tipo: 'flag' },
    // --- Regalías ---
    { col: 'inmedalla', tipo: 'flag' },
    { col: 'inestuche', tipo: 'flag' },
    { col: 'incinta', tipo: 'flag' },
    { col: 'inbotoninst', tipo: 'flag' },
    { col: 'inbotesp', tipo: 'flag' },
    { col: 'indiploma', tipo: 'flag' },
    { col: 'inportadip', tipo: 'flag' },
    { col: 'inalbumesp', tipo: 'flag' },
    { col: 'inalbumsenc', tipo: 'flag' },
    { col: 'inllavero', tipo: 'flag' },
    { col: 'inportanombre', tipo: 'flag' },
    { col: 'infotografia', tipo: 'flag' },
    { col: 'intoga', tipo: 'flag' },
    { col: 'invideo', tipo: 'flag' },
    { col: 'indescuento', tipo: 'flag' },
    { col: 'Inotroreg', tipo: 'flag' },
    { col: 'inplaca', tipo: 'flag' },
    { col: 'cafotografia', tipo: 'texto' },
    { col: 'TxOtroReg', tipo: 'texto' },
    { col: 'TxPlaca', tipo: 'texto' },
    { col: 'TxDiploma', tipo: 'texto' },
    // --- Estado ---
    { col: 'MaEstado', tipo: 'texto' },
    { col: 'FeSolici', tipo: 'fecha' },
    { col: 'FeFin', tipo: 'fecha' },
    { col: 'Feinifab', tipo: 'fecha' },
    { col: 'FeFinFab', tipo: 'fecha' },
    { col: 'FeIniEng', tipo: 'fecha' },
    { col: 'FeFinEng', tipo: 'fecha' },
    { col: 'nuordenfab', tipo: 'texto' },
    // --- Saldos ---
    { col: 'mncontrato', tipo: 'monto' },
    { col: 'mndescuento', tipo: 'monto' },
    { col: 'mninicial', tipo: 'monto' }
];

const transformar = (tipo, valor) => {
    if (tipo === 'flag') return aFlag(valor);
    if (tipo === 'fecha') return aFechaSQL(valor);
    if (tipo === 'monto') return valor === null || valor === undefined || valor === '' ? '0,00' : formatMonto(parseMonto(valor));
    return valor === null || valor === undefined ? '' : String(valor);
};

// Recorre el body y devuelve las columnas a escribir (solo las enviadas)
const prepararCampos = (body, camposPermitidos) => {
    const sets = [];
    const params = [];
    const despues = {};
    const permitidos = new Set(camposPermitidos.map((c) => c.toLowerCase()));

    for (const [clave, valor] of Object.entries(body || {})) {
        const def = COLUMNAS.find((c) => c.col.toLowerCase() === clave.toLowerCase());
        if (!def || !permitidos.has(def.col.toLowerCase())) continue;
        const valorFinal = transformar(def.tipo, valor);
        sets.push(`\`${def.col}\` = ?`);
        params.push(valorFinal);
        despues[def.col] = valorFinal;
    }
    return { sets, params, despues };
};

const ESTADOS_VALIDOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const TP_RECIBO_VALIDOS = ['I', 'A', 'C'];

// ----------------------------------------------------------------
//  LECTURA
// ----------------------------------------------------------------

// GET /ringContracts?q=&estado=&todos=1&page=&limit=
exports.getContracts = async (req, res) => {
    try {
        const { q, estado, todos } = req.query;
        const where = [];
        const params = [];

        if (todos !== '1') {
            where.push("Co.InActivo = '0'");
        }
        if (estado) {
            if (!ESTADOS_VALIDOS.includes(String(estado))) {
                return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS_VALIDOS.join(', ')}` });
            }
            where.push('Co.MaEstado = ?');
            params.push(String(estado));
        }
        if (q) {
            where.push('(Co.NoContrato LIKE ? OR Co.nucedula LIKE ? OR Cl.txnombre LIKE ? OR Co.titulo LIKE ? OR Co.especialidad LIKE ?)');
            const like = `%${q}%`;
            params.push(like, like, like, like, like);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const sqlBase = `SELECT Co.id, Co.NoContrato, Co.nucedula, Cl.txnombre, Co.titulo, Co.especialidad, Co.siglas,
                    Co.MaTpCont, Co.MaEstado, Co.InActivo, Co.Anulado, Co.Exonerado,
                    Co.feinicio, Co.mncontrato, Co.mndescuento, Co.mninicial, Co.mnpagado, Co.mnsaldo,
                    Co.CodUser, Co.CodSucursal
             FROM contratos Co
             LEFT JOIN clientes Cl ON Cl.nucedula = Co.nucedula
             ${whereSql}
             ORDER BY Co.NoContrato DESC`;

        // ¿Piden paginación de servidor? (?page= / ?limit=)
        const paginado = req.query.page !== undefined || req.query.limit !== undefined;

        if (!paginado) {
            // Sin paginación: array plano (compatibilidad con el front actual)
            const [rows] = await db.query(sqlBase, params);
            return res.json(rows);
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM contratos Co
             LEFT JOIN clientes Cl ON Cl.nucedula = Co.nucedula
             ${whereSql}`,
            params
        );

        const [rows] = await db.query(`${sqlBase} LIMIT ? OFFSET ?`, [...params, limit, offset]);

        res.json({ status: 'success', data: rows, total, page, pages: Math.ceil(total / limit) || 1, limit });
    } catch (error) {
        console.error('Error fetching ring contracts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /ringContracts/cliente/:nucedula
exports.getContractsByClient = async (req, res) => {
    try {
        const { nucedula } = req.params;
        const [rows] = await db.query(
            `SELECT * FROM contratos WHERE nucedula = ? ORDER BY NoContrato DESC`,
            [nucedula]
        );
        res.json({ status: 'success', data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetching contracts by client:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /ringContracts/:id/saldo
exports.getSaldo = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            'SELECT mncontrato, mndescuento, mninicial, mnpagado, mnsaldo FROM contratos WHERE id = ?',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Contrato no encontrado' });
        }
        const c = rows[0];
        const total = parseMonto(c.mncontrato) - parseMonto(c.mndescuento);
        const pagado = parseMonto(c.mnpagado);
        res.json({
            status: 'success',
            data: {
                ...c,
                total: formatMonto(total),
                pagado: formatMonto(pagado),
                saldo: formatMonto(total - pagado)
            }
        });
    } catch (error) {
        console.error('Error fetching contract balance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /ringContracts/:id/recibos
exports.getRecibos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT r.id, r.NoRecibo, r.FeRecibo, r.ferecibo, r.MnRecibo, r.mnsaldorec, r.TpRecibo,
                    r.TxBanco, r.NuRefDocBan, r.TxConcepRec, r.CodSucursal, r.CodUser, r.NoCierre
             FROM recibopago r
             INNER JOIN contratos c ON c.NoContrato = r.NoContrato AND c.nucedula = r.NuCedula
             WHERE c.id = ? AND (r.CodigoActo IS NULL OR r.CodigoActo = 0)
             ORDER BY r.NoRecibo`,
            [id]
        );
        res.json({ status: 'success', data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetching contract receipts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /ringContracts/:id/abonos/:noRecibo
exports.getAbonos = async (req, res) => {
    try {
        const { id, noRecibo } = req.params;
        const [rows] = await db.query(
            `SELECT d.id, d.Fecha, d.TipoOperacion, d.TxBanco, d.NuDeposito, d.MnDeposito, d.CodSucursal
             FROM depositos d
             INNER JOIN contratos c ON c.NoContrato = d.NoContrato AND c.nucedula = d.NuCedula
             WHERE c.id = ? AND d.NoRecibo = ?
             ORDER BY d.id`,
            [id, noRecibo]
        );
        res.json({ status: 'success', data: rows, total: rows.length });
    } catch (error) {
        console.error('Error fetching receipt deposits:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// GET /ringContracts/:id
exports.getContractById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT c.*, Cl.txnombre, Cl.txdireccion, Cl.txcelular, Cl.txemail
             FROM contratos c
             LEFT JOIN clientes Cl ON Cl.nucedula = c.nucedula
             WHERE c.id = ?`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ status: 'error', message: 'Contrato no encontrado' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error fetching contract:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ----------------------------------------------------------------
//  ESCRITURA
// ----------------------------------------------------------------

// POST /ringContracts/create
exports.createContract = async (req, res) => {
    const body = req.body || {};
    const { NoContrato, nucedula } = body;

    if (!NoContrato || !nucedula) {
        return res.status(400).json({ error: 'Los campos NoContrato y nucedula son obligatorios' });
    }

    try {
        // El NoContrato lo digita el usuario: se valida que no exista
        const [existe] = await db.query('SELECT id FROM contratos WHERE NoContrato = ?', [NoContrato]);
        if (existe.length > 0) {
            return res.status(409).json({ error: `El contrato N° ${NoContrato} ya existe` });
        }

        // El cliente debe existir
        const [cliente] = await db.query('SELECT nucedula, txnombre FROM clientes WHERE nucedula = ?', [nucedula]);
        if (!cliente.length) {
            return res.status(404).json({ error: `No existe un cliente con la cédula ${nucedula}` });
        }

        // Valores por defecto iguales a los contratos existentes
        const valores = {
            InActivo: '0',
            Anulado: '0',
            Exonerado: '0',
            MaEstado: '1',
            MaTpCont: body.MaTpCont ?? body.tipo ?? null,
            feinicio: aFechaSQL(body.feinicio),
            FeSolici: aFechaSQL(body.FeSolici),
            Feinifab: aFechaSQL(body.Feinifab),
            FeFinFab: aFechaSQL(body.FeFinFab),
            FeIniEng: aFechaSQL(body.FeIniEng),
            FeFinEng: aFechaSQL(body.FeFinEng),
            FeFin: aFechaSQL(body.FeFin),
            mncontrato: transformar('monto', body.mncontrato),
            mndescuento: transformar('monto', body.mndescuento),
            mninicial: transformar('monto', body.mninicial),
            mnpagado: '0,00',
            mnsaldo: formatMonto(parseMonto(body.mncontrato) - parseMonto(body.mndescuento)),
            CodUser: body.CodUser ?? null,
            CodSucursal: body.CodSucursal ?? null
        };

        // Regalías, detalles y textos: los que vengan en el body
        // (sin repetir las columnas fijas de arriba)
        const camposFijos = Object.keys(valores);
        const columnasLibres = COLUMNAS.map((c) => c.col).filter((c) => !camposFijos.includes(c));
        const { sets, params, despues } = prepararCampos(body, columnasLibres);

        // Se arma el INSERT de forma explícita para no equivocarse con los placeholders
        const columnasFinales = [
            ...camposFijos,
            ...sets.map((s) => s.split(' = ')[0])
        ];
        const totalColumnas = 2 + columnasFinales.length; // NoContrato + nucedula + extras
        const sqlFinal = `INSERT INTO contratos (NoContrato, nucedula, ${columnasFinales.join(', ')})
                          VALUES (${Array(totalColumnas).fill('?').join(', ')})`;

        const [rows] = await db.query(sqlFinal, [NoContrato, nucedula, ...camposFijos.map((c) => valores[c]), ...params]);

        audit.auditarInsert({
            tabla: 'contratos',
            idRegistro: rows.insertId,
            datos: { id: rows.insertId, NoContrato, nucedula, ...valores, ...despues }
        });

        res.status(201).json({
            status: 'success',
            message: 'Contrato creado correctamente',
            id: rows.insertId,
            NoContrato,
            cliente: cliente[0].txnombre
        });
    } catch (error) {
        console.error('Error creating ring contract:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El número de contrato ya está en uso' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// PUT /ringContracts/update/:id  → pestañas Detalles + Regalías
exports.updateContract = async (req, res) => {
    const { id } = req.params;
    const camposDetallesRegalias = COLUMNAS.filter((c) =>
        ['MaTpCont', 'TxObservacion', 'txconcepto', 'MnCostoAnillo'].includes(c.col) ||
        c.col.startsWith('in') || c.col.startsWith('In') ||
        ['titulo', 'especialidad', 'siglas', 'modelo', 'kilate', 'medida', 'peso', 'cazirc', 'tpzirc', 'feinicio'].includes(c.col) ||
        ['cafotografia', 'TxOtroReg', 'TxPlaca', 'TxDiploma'].includes(c.col)
    );

    try {
        const { sets, params, despues } = prepararCampos(req.body, camposDetallesRegalias.map((c) => c.col));

        if (!sets.length) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        }

        const antes = await audit.antesDe('SELECT * FROM contratos WHERE id = ?', [id]);
        if (!antes) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        const [result] = await db.query(`UPDATE contratos SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        audit.auditarUpdate({ tabla: 'contratos', idRegistro: id, antes, despues });

        res.json({ status: 'success', message: 'Contrato actualizado correctamente' });
    } catch (error) {
        console.error('Error updating ring contract:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// PUT /ringContracts/updateEstado/:id  → pestaña Estado
exports.updateEstado = async (req, res) => {
    const { id } = req.params;
    const camposEstado = COLUMNAS.filter((c) =>
        ['MaEstado', 'FeSolici', 'FeFin', 'Feinifab', 'FeFinFab', 'FeIniEng', 'FeFinEng', 'nuordenfab', 'feinicio', 'txconcepto'].includes(c.col)
    );

    try {
        if (req.body.MaEstado !== undefined && !ESTADOS_VALIDOS.includes(String(req.body.MaEstado))) {
            return res.status(400).json({ error: `Estado inválido. Use: ${ESTADOS_VALIDOS.join(', ')}` });
        }

        const { sets, params, despues } = prepararCampos(req.body, camposEstado.map((c) => c.col));

        if (!sets.length) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        }

        const antes = await audit.antesDe('SELECT * FROM contratos WHERE id = ?', [id]);
        if (!antes) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        const [result] = await db.query(`UPDATE contratos SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        audit.auditarUpdate({ tabla: 'contratos', idRegistro: id, antes, despues });

        res.json({ status: 'success', message: 'Estado actualizado correctamente' });
    } catch (error) {
        console.error('Error updating contract status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// PUT /ringContracts/updateTotals/:id  → pestaña Saldo (montos base)
exports.updateTotals = async (req, res) => {
    const { id } = req.params;
    const { mncontrato, mndescuento, mninicial } = req.body || {};

    try {
        const antes = await audit.antesDe('SELECT * FROM contratos WHERE id = ?', [id]);
        if (!antes) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        const mContrato = mncontrato !== undefined ? parseMonto(mncontrato) : parseMonto(antes.mncontrato);
        const mDescuento = mndescuento !== undefined ? parseMonto(mndescuento) : parseMonto(antes.mndescuento);
        const mPagado = parseMonto(antes.mnpagado);
        const mSaldo = Math.max(0, mContrato - mDescuento - mPagado);

        const sets = [];
        const params = [];
        const despues = {};

        if (mncontrato !== undefined) { sets.push('mncontrato = ?'); params.push(formatMonto(mContrato)); despues.mncontrato = formatMonto(mContrato); }
        if (mndescuento !== undefined) { sets.push('mndescuento = ?'); params.push(formatMonto(mDescuento)); despues.mndescuento = formatMonto(mDescuento); }
        if (mninicial !== undefined) { sets.push('mninicial = ?'); params.push(transformar('monto', mninicial)); despues.mninicial = transformar('monto', mninicial); }

        if (!sets.length) {
            return res.status(400).json({ error: 'No se enviaron montos para actualizar' });
        }

        // El saldo se recalcula siempre con los montos vigentes
        sets.push('mnsaldo = ?');
        params.push(formatMonto(mSaldo));
        despues.mnsaldo = formatMonto(mSaldo);

        const [result] = await db.query(`UPDATE contratos SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }

        audit.auditarUpdate({ tabla: 'contratos', idRegistro: id, antes, despues });

        res.json({
            status: 'success',
            message: 'Montos actualizados correctamente',
            data: { mncontrato: despues.mncontrato ?? antes.mncontrato, mndescuento: despues.mndescuento ?? antes.mndescuento, mninicial: despues.mninicial ?? antes.mninicial, mnsaldo: despues.mnsaldo, mnpagado: antes.mnpagado }
        });
    } catch (error) {
        console.error('Error updating contract amounts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// POST /ringContracts/pay/:id  → botón "Efectuar Pago"
// Crea ReciboPago (CodigoActo = NULL, como ya lo tiene tu data) + Depositos
// y actualiza mnpagado / mnsaldo / mninicial del contrato.
exports.payContract = async (req, res) => {
    const { id } = req.params;
    const { monto, TpRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, TxConcepRec, MaFormPag, NuRefDocBan, CodUser, CodSucursal } = req.body || {};

    if (monto === undefined || monto === null || monto === '') {
        return res.status(400).json({ status: 'error', message: 'El monto es obligatorio' });
    }
    if (TpRecibo && !TP_RECIBO_VALIDOS.includes(String(TpRecibo).toUpperCase())) {
        return res.status(400).json({ status: 'error', message: `Tipo de recibo inválido. Use: ${TP_RECIBO_VALIDOS.join(', ')} (Inicial, Abono, Contado)` });
    }

    const montoPagado = parseMonto(monto);
    if (montoPagado <= 0) {
        return res.status(400).json({ status: 'error', message: 'El monto debe ser mayor a cero' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Contrato bloqueado
        const [contratos] = await connection.query('SELECT * FROM contratos WHERE id = ? FOR UPDATE', [id]);
        if (!contratos.length) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ status: 'error', message: 'Contrato no encontrado' });
        }
        const contrato = contratos[0];

        if (String(contrato.Anulado) === '1') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ status: 'error', message: `El contrato N° ${contrato.NoContrato} está anulado y no admite pagos` });
        }

        // 2. Correlativo de recibo (mismo criterio que actContracts)
        const [configRows] = await connection.query('SELECT NoRecibo FROM configuracion FOR UPDATE');
        if (!configRows.length) {
            await connection.rollback();
            connection.release();
            return res.status(500).json({ status: 'error', message: 'No se encontró el registro de configuración' });
        }
        const correlativoConfig = Number(configRows[0].NoRecibo);
        let reciboIdFinal = Number(req.body.NoRecibo) || correlativoConfig;

        const [existeRecibo] = await connection.query('SELECT NoRecibo FROM recibopago WHERE NoRecibo = ?', [reciboIdFinal]);
        if (existeRecibo.length > 0) {
            const [maxRows] = await connection.query('SELECT MAX(NoRecibo) AS maxRecibo FROM recibopago FOR UPDATE');
            const maxActual = maxRows[0].maxRecibo ? Number(maxRows[0].maxRecibo) : correlativoConfig;
            reciboIdFinal = Math.max(correlativoConfig, maxActual + 1);
        }

        // 3. Nuevos montos del contrato
        const mContrato = parseMonto(contrato.mncontrato);
        const mDescuento = parseMonto(contrato.mndescuento);
        const mPagado = parseMonto(contrato.mnpagado);
        const nuevoPagado = mPagado + montoPagado;
        const nuevoSaldo = Math.max(0, mContrato - mDescuento - nuevoPagado);
        const nuevaInicial = parseMonto(contrato.mninicial) === 0 ? montoPagado : parseMonto(contrato.mninicial);

        // Primer pago sin inicial registrada -> se considera Inicial
        const tipoRecibo = TpRecibo ? String(TpRecibo).toUpperCase() : parseMonto(contrato.mninicial) === 0 ? 'I' : 'A';
        const ferecibo = aFechaSQL(Fecha) === '1900-01-01' ? new Date().toISOString().slice(0, 10) : aFechaSQL(Fecha);

        // 4. Recibo de pago (los anillos van con CodigoActo NULL)
        await connection.query(
            `INSERT INTO recibopago
                (NoRecibo, ferecibo, NuCedula, CodSucursal, NoContrato, TpRecibo, MnRecibo, mnsaldorec,
                 TxConcepRec, CodUser, Anulado, Tipo, CodigoActo, MaFormPag, TxBanco, NuRefDocBan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`,
            [
                reciboIdFinal, ferecibo, contrato.nucedula, CodSucursal ?? contrato.CodSucursal,
                contrato.NoContrato, tipoRecibo, montoPagado, nuevoSaldo,
                TxConcepRec ?? null, CodUser ?? contrato.CodUser, MaFormPag ?? null, TxBanco ?? null, NuRefDocBan ?? null
            ]
        );

        // 5. Depósito / abono (si vienen los datos bancarios)
        if (TxBanco || NuDeposito) {
            await connection.query(
                `INSERT INTO depositos
                    (NoContrato, NuCedula, NoRecibo, Fecha, TipoOperacion, TxBanco, NuDeposito, MnDeposito, CodUser, CodSucursal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    contrato.NoContrato, contrato.nucedula, reciboIdFinal, ferecibo,
                    TipoOperacion ?? null, TxBanco ?? null, NuDeposito ?? null,
                    MnDeposito !== undefined && MnDeposito !== null && MnDeposito !== '' ? parseMonto(MnDeposito) : montoPagado,
                    CodUser ?? contrato.CodUser, CodSucursal ?? contrato.CodSucursal
                ]
            );
        }

        // 6. Actualizar los montos del contrato
        await connection.query(
            'UPDATE contratos SET mnpagado = ?, mnsaldo = ?, mninicial = ? WHERE id = ?',
            [formatMonto(nuevoPagado), formatMonto(nuevoSaldo), formatMonto(nuevaInicial), id]
        );

        // 7. Correlativo siguiente
        const proximoCorrelativo = reciboIdFinal + 1;
        await connection.query('UPDATE configuracion SET NoRecibo = ?', [proximoCorrelativo]);

        // 8. Auditoría (misma transacción)
        audit.auditarInsert({
            tabla: 'recibopago',
            datos: {
                NoRecibo: reciboIdFinal, ferecibo, NuCedula: contrato.nucedula,
                NoContrato: contrato.NoContrato, TpRecibo: tipoRecibo, MnRecibo: montoPagado,
                mnsaldorec: nuevoSaldo, TxConcepRec: TxConcepRec ?? null,
                CodUser: CodUser ?? contrato.CodUser, CodigoActo: null
            },
            conn: connection
        });
        if (TxBanco || NuDeposito) {
            audit.auditarInsert({
                tabla: 'depositos',
                datos: {
                    NoContrato: contrato.NoContrato, NuCedula: contrato.nucedula, NoRecibo: reciboIdFinal,
                    Fecha: ferecibo, TipoOperacion: TipoOperacion ?? null, TxBanco: TxBanco ?? null,
                    NuDeposito: NuDeposito ?? null, MnDeposito: MnDeposito ? parseMonto(MnDeposito) : montoPagado,
                    CodUser: CodUser ?? contrato.CodUser
                },
                conn: connection
            });
        }
        audit.auditarUpdate({
            tabla: 'contratos',
            idRegistro: id,
            antes: contrato,
            despues: { mnpagado: formatMonto(nuevoPagado), mnsaldo: formatMonto(nuevoSaldo), mninicial: formatMonto(nuevaInicial) },
            CodUser: CodUser !== undefined && CodUser !== null ? Number(CodUser) || null : undefined,
            conn: connection
        });
        audit.auditarMovimiento({
            tabla: 'configuracion',
            mensaje: `Correlativo de recibo actualizado: NoRecibo -> ${proximoCorrelativo} (recibo N° ${reciboIdFinal} del contrato de anillo N° ${contrato.NoContrato})`,
            conn: connection
        });

        await connection.commit();
        connection.release();

        res.status(201).json({
            status: 'success',
            message: 'Pago registrado correctamente',
            noRecibo: reciboIdFinal,
            proximoCorrelativo,
            data: {
                mnpagado: formatMonto(nuevoPagado),
                mnsaldo: formatMonto(nuevoSaldo),
                mninicial: formatMonto(nuevaInicial)
            }
        });
    } catch (error) {
        await connection.rollback();
        connection.release();

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'error',
                code: 'RECIBO_DUPLICADO',
                message: 'El número de recibo ya se encuentra registrado. Intenta nuevamente.'
            });
        }

        console.error('Error paying ring contract:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar el pago' });
    }
};
