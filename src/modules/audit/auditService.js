const db = require('../../config/db');

// =================================================================
//  SERVICIO DE AUDITORIA (escritura en auditoria_general)
//
//  IMPORTANTE: TiDB Cloud NO soporta triggers, por eso la auditoria
//  se escribe desde la aplicacion y no desde la base de datos.
//  Tabla e interfaces: ver auditoria.sql
//
//  Como usarlo en un controller:
//
//      const audit = require('../audit/auditService');
//
//      // INSERT
//      const [rows] = await db.query(sql, params);
//      audit.auditarInsert({ tabla: 'bancos', idRegistro: rows.insertId, datos: { bancos, codigo, status } });
//
//      // UPDATE (si no cambió nada, no se registra nada)
//      const antes = await audit.antesDe('SELECT * FROM bancos WHERE id = ?', [id]);
//      const [rows] = await db.query(sql, params);
//      audit.auditarUpdate({ tabla: 'bancos', idRegistro: id, antes, despues: { bancos, codigo, status } });
//
//      // DELETE
//      const antes = await audit.antesDe('SELECT * FROM bancos WHERE id = ?', [id]);
//      await db.query(sql, params);
//      audit.auditarDelete({ tabla: 'bancos', idRegistro: id, datos: antes });
//
//      // Dentro de una transacción: pasarle la conexión para que
//      // la auditoría se confirme (o revierta) junto con la operación:
//      audit.auditarInsert({ ..., conn: connection });
//
//  Ninguna función de este servicio lanza excepciones: si falla el
//  registro de auditoría se imprime en consola y la operación
//  principal continúa normal.
// =================================================================

// Campos que NUNCA se guardan en claro en la bitácora
const CAMPOS_OCULTOS = ['clave', 'clave2', 'txclaveadm', 'password'];

// Llave principal de cada tabla monitoreada
const LLAVES = {
    actosgrados: 'id',
    deactosgrados: 'id',
    recibopago: 'id',
    depositos: 'id',
    clientes: 'id',
    bancos: 'id',
    contratos: 'id',
    configuracion: 'Id',
    especialidad: 'CodigoEsp',
    instituciones: 'CodigoInst',
    lugaracto: 'CoLugar',
    metodopago: 'idMetodoPago',
    usuarios: 'CodUsuario'
};

const esCampoOculto = (campo) => CAMPOS_OCULTOS.includes(String(campo).toLowerCase());

// ---------------------------------------------------------------------------
//  Utilidades de comparación
// ---------------------------------------------------------------------------
const esFechaLike = (v) =>
    v instanceof Date || (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v));

// Compara dos valores ignorando diferencias de tipo (1 vs '1') y
// comparando fechas por su instante real (Date vs '2026-10-09T...')
const valIgual = (a, b) => {
    if (a === undefined) a = null;
    if (b === undefined) b = null;
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    if (esFechaLike(a) || esFechaLike(b)) {
        const ta = new Date(a).getTime();
        const tb = new Date(b).getTime();
        if (!isNaN(ta) && !isNaN(tb)) return ta === tb;
    }
    return String(a) === String(b);
};

// Devuelve el CodUser de una fila (la columna puede venir con otra capitalización)
const codUserDe = (fila) => {
    if (!fila || typeof fila !== 'object') return null;
    const key = Object.keys(fila).find((k) => k.toLowerCase() === 'coduser');
    if (!key) return null;
    const valor = fila[key];
    return valor === undefined || valor === null ? null : Number(valor) || null;
};

// Devuelve el id de la llave principal de la tabla
const obtenerId = (tabla, fila) => {
    if (!fila || typeof fila !== 'object') return null;
    const llave = LLAVES[String(tabla).toLowerCase()];
    if (!llave) return null;
    const key = Object.keys(fila).find((k) => k.toLowerCase() === llave.toLowerCase());
    const valor = key ? fila[key] : null;
    return valor === undefined || valor === null ? null : valor;
};

// JSON con el snapshot de la fila, con los campos sensibles enmascarados
const snapshot = (fila) => {
    if (!fila || typeof fila !== 'object') return null;
    const salida = {};
    for (const [k, v] of Object.entries(fila)) {
        salida[k] = esCampoOculto(k) ? '***' : v;
    }
    return JSON.stringify(salida);
};

// Índice de una fila por nombre de columna en minúsculas
// (algunas tablas devuelven los campos con otra capitalización:
//  clientes -> txnombre, pero el body llega como TxNombre)
const indexar = (fila) => {
    const mapa = new Map();
    if (fila && typeof fila === 'object') {
        for (const k of Object.keys(fila)) mapa.set(k.toLowerCase(), fila[k]);
    }
    return mapa;
};

// Texto de los cambios: "campo: viejo -> nuevo; " (vacío si no cambió nada)
// Compara únicamente los campos presentes en `despues` (los que se escribieron)
const diff = (antes, despues) => {
    if (!despues || typeof despues !== 'object') return '';
    const mapaAntes = indexar(antes);
    const partes = [];
    for (const campo of Object.keys(despues)) {
        const a = mapaAntes.has(campo.toLowerCase()) ? mapaAntes.get(campo.toLowerCase()) : undefined;
        const d = despues[campo];
        if (!valIgual(a, d)) {
            const mostrar = (v) => (esCampoOculto(campo) ? '***' : v === undefined || v === null ? 'NULL' : v);
            partes.push(`${campo}: ${mostrar(a)} -> ${mostrar(d)}; `);
        }
    }
    return partes.join('');
};

// ---------------------------------------------------------------------------
//  Núcleo: registro en auditoria_general
// ---------------------------------------------------------------------------
const registrar = async ({ tabla, accion, idRegistro = null, CodUser = null, detalles = null, conn = null }) => {
    try {
        const sql = `INSERT INTO auditoria_general
                        (tabla_afectada, accion, id_registro, CodUser, detalles, usuario_bd)
                     VALUES (?, ?, ?, ?, ?, USER())`;
        const params = [tabla, accion, idRegistro, CodUser, detalles];
        if (conn) {
            await conn.query(sql, params);
        } else {
            await db.query(sql, params);
        }
    } catch (error) {
        // La auditoría nunca debe romper la operación principal
        console.error(`[AUDITORIA] No se pudo registrar ${accion} sobre ${tabla}:`, error.message);
    }
};

// ---------------------------------------------------------------------------
//  Lectura auxiliar: obtener el registro "antes" de un UPDATE/DELETE
// ---------------------------------------------------------------------------
const antesDe = async (sqlSelect, params = [], conn = null) => {
    try {
        const [rows] = conn ? await conn.query(sqlSelect, params) : await db.query(sqlSelect, params);
        return rows && rows.length ? rows[0] : null;
    } catch (error) {
        console.error('[AUDITORIA] No se pudo leer el registro anterior:', error.message);
        return null;
    }
};

// ---------------------------------------------------------------------------
//  Acciones de alto nivel
// ---------------------------------------------------------------------------

// INSERT → guarda el snapshot completo de lo insertado
const auditarInsert = ({ tabla, idRegistro = null, datos = null, CodUser, conn = null }) =>
    registrar({
        tabla,
        accion: 'INSERT',
        idRegistro: idRegistro !== undefined && idRegistro !== null ? idRegistro : obtenerId(tabla, datos),
        CodUser: CodUser !== undefined ? CodUser : codUserDe(datos),
        detalles: snapshot(datos),
        conn
    });

// UPDATE → guarda solo los campos que cambiaron; si no cambió nada no registra nada
const auditarUpdate = async ({ tabla, idRegistro = null, antes = null, despues = null, CodUser, conn = null }) => {
    const cambios = diff(antes, despues);
    if (!cambios) return;
    await registrar({
        tabla,
        accion: 'UPDATE',
        idRegistro:
            idRegistro !== undefined && idRegistro !== null
                ? idRegistro
                : obtenerId(tabla, despues) !== null
                    ? obtenerId(tabla, despues)
                    : obtenerId(tabla, antes),
        CodUser: CodUser !== undefined ? CodUser : codUserDe(despues) !== null ? codUserDe(despues) : codUserDe(antes),
        detalles: cambios,
        conn
    });
};

// DELETE → guarda el snapshot completo de lo que se borró
const auditarDelete = ({ tabla, idRegistro = null, datos = null, CodUser, conn = null }) =>
    registrar({
        tabla,
        accion: 'DELETE',
        idRegistro: idRegistro !== undefined && idRegistro !== null ? idRegistro : obtenerId(tabla, datos),
        CodUser: CodUser !== undefined ? CodUser : codUserDe(datos),
        detalles: snapshot(datos),
        conn
    });

// Movimiento masivo o compuesto (cascadas, cierres, contadores):
// un solo registro con una descripción legible
const auditarMovimiento = ({ tabla, mensaje, idRegistro = null, CodUser = null, conn = null }) =>
    registrar({
        tabla,
        accion: 'UPDATE',
        idRegistro,
        CodUser,
        detalles: mensaje,
        conn
    });

module.exports = {
    registrar,
    antesDe,
    auditarInsert,
    auditarUpdate,
    auditarDelete,
    auditarMovimiento,
    snapshot,
    diff
};
