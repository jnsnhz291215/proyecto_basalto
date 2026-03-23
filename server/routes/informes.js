const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getWorkerShiftStatus, isWorkerOnShiftToday } = require('../helpers/shiftValidation');

// Control de doble envío (Rate Limiting en memoria)
const recentRequests = new Map();

function isDuplicateRequest(req, informeId = 'new') {
  const rut = req.headers['rut_solicitante'] || req.headers['x-admin-rut'] || req.body?.rut_solicitante || 'unknown_user';
  const key = `${rut}_${informeId}`;
  
  if (recentRequests.has(key)) {
    return true; // Duplicate request found
  }
  
  recentRequests.set(key, true);
  setTimeout(() => recentRequests.delete(key), 2000); // Block for 2 seconds
  return false;
}

function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

const LOCKED_AUDIT_STATUSES = new Set(['cerrado', 'validado', 'finalizado']);

function normalizarEstado(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function estadoFueCerrado(valor) {
  return LOCKED_AUDIT_STATUSES.has(normalizarEstado(valor));
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'si';
}

async function validarSuperAdminPorRut(rutSolicitante) {
  const rutLimpio = limpiarRUT(rutSolicitante);

  if (!rutLimpio) {
    return { ok: false, status: 401, message: 'Se requiere rut_solicitante' };
  }

  const [rows] = await pool.execute(
    'SELECT es_super_admin, activo, nombres, apellido_paterno FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1',
    [rutLimpio]
  );

  if (!rows || rows.length === 0) return { ok: false, status: 401, message: 'Administrador solicitante no encontrado' };
  if (Number(rows[0].activo) === 0) return { ok: false, status: 403, message: 'Cuenta solicitante inactiva' };
  if (Number(rows[0].es_super_admin) !== 1) return { ok: false, status: 403, message: 'Solo un Superadministrador puede realizar esta accion' };

  const nombreCompleto = `${rows[0].nombres || ''} ${rows[0].apellido_paterno || ''}`.trim();

  return { ok: true, rutLimpio, nombreCompleto };
}

// Valida Super Admin y permite bypass de validación de turno
async function checkSuperAdminBypass(req) {
  const isSuperAdminFlag = parseBoolean(req.body?.isSuperAdmin) || parseBoolean(req.headers['issuperadmin']);
  const adminRutSolicitante = req.body?.admin_rut || req.headers['x-admin-rut'] || req.headers['rut_solicitante'];
  
  if (!isSuperAdminFlag || !adminRutSolicitante) {
    return { bypassActive: false };
  }

  try {
    const validacion = await validarSuperAdminPorRut(adminRutSolicitante);
    if (validacion.ok) {
      console.log(`[ADMIN_BYPASS] Permiso de escritura concedido para ${validacion.nombreCompleto}`);
      return { bypassActive: true, ...validacion };
    }
  } catch (error) {
    console.warn('[ADMIN_BYPASS_CHECK] Error validando Super Admin:', error.message);
  }

  return { bypassActive: false };
}

async function validarHardDeleteSuperAdmin(req) {
  const rutSolicitante = req.body?.rut_solicitante || req.query?.rut_solicitante || req.headers['rut_solicitante'];
  const validacion = await validarSuperAdminPorRut(rutSolicitante);
  if (!validacion.ok) return validacion;
  return { ok: true };
}

async function validarEscrituraTurno(operadorRut, options = {}) {
  const { allowGrace = false } = options;
  const shiftStatus = await getWorkerShiftStatus(operadorRut, new Date());

  if (shiftStatus.exactActive) {
    return { ok: true, shiftStatus };
  }

  if (allowGrace && shiftStatus.inGrace) {
    return { ok: true, shiftStatus };
  }

  return {
    ok: false,
    status: 403,
    shiftStatus,
    message: 'Tiempo de turno expirado. Los cambios no se guardaron.'
  };
}

async function buscarInformePorTriada(connection, rut, fecha, turno, options = {}) {
  const filtros = [
    'REPLACE(REPLACE(REPLACE(operador_rut, ".", ""), "-", ""), " ", "") = ?',
    'fecha = ?',
    'turno = ?'
  ];
  const params = [limpiarRUT(rut), fecha, turno];

  if (options.estado) {
    filtros.push('LOWER(estado) = LOWER(?)');
    params.push(options.estado);
  }

  const sql = `
    SELECT id_informe, estado
    FROM informes_turno
    WHERE ${filtros.join(' AND ')}
    ORDER BY creado_el DESC
    LIMIT 1
  `;

  const [rows] = await connection.execute(sql, params);
  return rows && rows[0] ? rows[0] : null;
}

async function reemplazarDetalleInforme(connection, idInforme, actividades = [], herramientas = [], perforaciones = []) {
  await connection.execute('DELETE FROM actividades_turno WHERE id_informe = ?', [idInforme]);
  await connection.execute('DELETE FROM herramientas_turno WHERE id_informe = ?', [idInforme]);
  await connection.execute('DELETE FROM perforaciones_turno WHERE id_informe = ?', [idInforme]);

  for (const act of actividades) {
    await connection.execute(
      'INSERT INTO actividades_turno (id_informe, hora_desde, hora_hasta, detalle, hrs_bd, hrs_cliente) VALUES (?, ?, ?, ?, ?, ?)',
      [idInforme, act.hora_desde || null, act.hora_hasta || null, act.detalle || null, act.hrs_bd || null, act.hrs_cliente || null]
    );
  }
  for (const herr of herramientas) {
    await connection.execute(
      'INSERT INTO herramientas_turno (id_informe, tipo_elemento, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [idInforme, herr.tipo_elemento || null, herr.diametro || null, herr.numero_serie || null, herr.desde_mts || null, herr.hasta_mts || null, herr.detalle_extra || null]
    );
  }
  for (const perf of perforaciones) {
    await connection.execute(
      'INSERT INTO perforaciones_turno (id_informe, desde_mts, hasta_mts, mts_perforados, recuperacion, tipo_roca, dureza) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [idInforme, perf.desde || null, perf.hasta || null, perf.metros_perforados || null, perf.recuperacion || null, perf.tipo_roca || null, perf.dureza || null]
    );
  }
}

/**
 * GET /api/informes
 * Obtener informes con filtros
 * Query params:
 *   - operador: nombre o RUT del operador (búsqueda parcial)
 *   - desde: fecha desde (YYYY-MM-DD)
 *   - hasta: fecha hasta (YYYY-MM-DD)
 *   - estado: 'activos' | 'inactivos'
 */
router.get('/informes', async (req, res) => {
  let connection;
  try {
    const { operador, desde, hasta, estado = 'activos' } = req.query;

    connection = await pool.getConnection();

    let query = `
      SELECT 
        i.id_informe,
        i.numero_informe,
        i.fecha,
        i.turno,
        i.horas_trabajadas,
        i.faena,
        i.lugar,
        i.equipo,
        i.operador_rut,
        i.estado,
        i.creado_el,
        t.nombres,
        t.apellido_paterno,
        t.apellido_materno
      FROM informes_turno i
      LEFT JOIN trabajadores t ON i.operador_rut = t.RUT
      WHERE 1=1
    `;

    const params = [];

    // Filtro por estado
    if (estado === 'activos') {
      query += ` AND (i.estado = 'activo' OR i.estado = 1)`;
    } else if (estado === 'inactivos') {
      query += ` AND (i.estado = 'inactivo' OR i.estado = 0)`;
    }

    // Filtro por operador (nombre o RUT)
    if (operador && operador.trim()) {
      query += ` AND (
        t.nombres LIKE ? OR 
        t.apellido_paterno LIKE ? OR 
        t.apellido_materno LIKE ? OR 
        i.operador_rut LIKE ?
      )`;
      const operadorLike = `%${operador.trim()}%`;
      params.push(operadorLike, operadorLike, operadorLike, operadorLike);
    }

    // Filtro por rango de fechas
    if (desde) {
      query += ` AND i.fecha >= ?`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND i.fecha <= ?`;
      params.push(hasta);
    }

    query += ` ORDER BY i.fecha DESC, i.creado_el DESC`;

    const [informes] = await connection.execute(query, params);

    res.json(informes);

  } catch (error) {
    console.error('[ERROR] Error al obtener informes:', error);
    res.status(500).json({ error: 'Error al obtener informes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/informes/por-turno
 * Buscar informe existente por fecha y grupo/turno.
 * DEBE declararse antes de /:id para evitar conflicto de rutas.
 * Query params:
 *   - fecha: YYYY-MM-DD
 *   - grupo: A | B | C | D | AB | etc.
 */
router.get('/informes/por-turno', async (req, res) => {
  let connection;
  try {
    const { fecha, grupo, rut, estado } = req.query;
    if (!fecha || !grupo) {
      return res.status(400).json({ error: 'Se requieren los parámetros fecha y grupo' });
    }

    connection = await pool.getConnection();
    let sql = 'SELECT id_informe, estado FROM informes_turno WHERE fecha = ? AND turno = ?';
    const params = [fecha, grupo];

    if (rut) {
      sql += ' AND REPLACE(REPLACE(REPLACE(operador_rut, ".", ""), "-", ""), " ", "") = ?';
      params.push(limpiarRUT(rut));
    }

    if (estado) {
      sql += ' AND LOWER(estado) = LOWER(?)';
      params.push(estado);
    }

    sql += ' ORDER BY creado_el DESC LIMIT 1';

    const [rows] = await connection.execute(sql, params);

    if (rows.length > 0) {
      return res.json({ existe: true, id_informe: rows[0].id_informe, estado: rows[0].estado });
    }

    res.json({ existe: false });
  } catch (error) {
    console.error('[ERROR] Error al buscar informe por turno:', error);
    res.status(500).json({ error: 'Error al buscar informe por turno' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * POST /api/informes
 * Crear un nuevo informe de turno
 */
router.post('/informes', async (req, res) => {
  if (isDuplicateRequest(req, 'new')) {
    return res.status(429).json({ error: 'Petición en proceso. Intente nuevamente en unos segundos.' });
  }

  let connection;
  try {
    const { datosGenerales, actividades = [], herramientas = [], perforaciones = [] } = req.body;
    if (!datosGenerales) {
      return res.status(400).json({ error: 'Se requieren datosGenerales' });
    }

    const operadorRut = datosGenerales.operador_rut;
    if (!operadorRut) {
      return res.status(400).json({ error: 'Se requiere el RUT del operador para crear el informe.' });
    }

    // BYPASS SUPER ADMIN: Saltarse validación de turno
    const bypassCheck = await checkSuperAdminBypass(req);
    if (!bypassCheck.bypassActive) {
      const validacionTurno = await validarEscrituraTurno(operadorRut, { allowGrace: false });
      if (!validacionTurno.ok) {
        if (validacionTurno.shiftStatus?.inGrace) {
          return res.status(403).json({ error: 'La ventana de gracia solo permite continuar borradores existentes. No es posible crear un informe nuevo.' });
        }
        return res.status(validacionTurno.status).json({ error: validacionTurno.message });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const informeExistente = await buscarInformePorTriada(
      connection,
      operadorRut,
      datosGenerales.fecha || null,
      datosGenerales.turno || null
    );

    if (informeExistente) {
      await connection.execute(
        `UPDATE informes_turno SET
          fecha = ?, turno = ?, horas_trabajadas = ?, faena = ?, lugar = ?, equipo = ?,
          operador_rut = ?, ayudante_1 = ?, ayudante_2 = ?, ayudante_3 = ?, ayudante_4 = ?, ayudante_5 = ?, pozo_numero = ?, sector = ?, diametro = ?,
          inclinacion = ?, profundidad_inicial = ?, profundidad_final = ?, mts_perforados = ?,
          pull_down = ?, rpm = ?, horometro_inicial = ?, horometro_final = ?, horometro_hrs = ?,
          insumo_petroleo = ?, insumo_lubricantes = ?, observaciones = ?, estado = ?
        WHERE id_informe = ?`,
        [
          datosGenerales.fecha || null,
          datosGenerales.turno || null,
          datosGenerales.horas_trabajadas || null,
          datosGenerales.faena || null,
          datosGenerales.lugar || null,
          datosGenerales.equipo || null,
          datosGenerales.operador_rut || null,
          datosGenerales.ayudante_1 || null,
          datosGenerales.ayudante_2 || null,
          datosGenerales.ayudante_3 || null,
          datosGenerales.ayudante_4 || null,
          datosGenerales.ayudante_5 || null,
          datosGenerales.pozo_numero || null,
          datosGenerales.sector || null,
          datosGenerales.diametro || null,
          datosGenerales.inclinacion || null,
          datosGenerales.profundidad_inicial || null,
          datosGenerales.profundidad_final || null,
          datosGenerales.mts_perforados || null,
          datosGenerales.pull_down || null,
          datosGenerales.rpm || null,
          datosGenerales.horometro_inicial || null,
          datosGenerales.horometro_final || null,
          datosGenerales.horometro_hrs || null,
          datosGenerales.insumo_petroleo || null,
          datosGenerales.insumo_lubricantes || null,
          datosGenerales.observaciones || null,
          datosGenerales.estado || 'Borrador',
          informeExistente.id_informe
        ]
      );

      await reemplazarDetalleInforme(connection, informeExistente.id_informe, actividades, herramientas, perforaciones);
      await connection.commit();

      return res.json({
        success: true,
        id_informe: informeExistente.id_informe,
        estado: datosGenerales.estado || 'Borrador',
        message: 'Informe actualizado correctamente'
      });
    }

    // Generar folio correlativo
    const [lastRow] = await connection.execute(
      'SELECT numero_informe FROM informes_turno ORDER BY id_informe DESC LIMIT 1'
    );
    let nextNum = 1;
    if (lastRow.length > 0 && lastRow[0].numero_informe) {
      const parsed = parseInt(String(lastRow[0].numero_informe).replace(/\D/g, ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const folio = `IT-${String(nextNum).padStart(5, '0')}`;

    const [result] = await connection.execute(
      `INSERT INTO informes_turno (
        numero_informe, fecha, turno, horas_trabajadas, faena, lugar, equipo,
        operador_rut, ayudante_1, ayudante_2, ayudante_3, ayudante_4, ayudante_5, pozo_numero, sector, diametro,
        inclinacion, profundidad_inicial, profundidad_final, mts_perforados,
        pull_down, rpm, horometro_inicial, horometro_final, horometro_hrs,
        insumo_petroleo, insumo_lubricantes, observaciones, estado, creado_el
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        folio,
        datosGenerales.fecha || null,
        datosGenerales.turno || null,
        datosGenerales.horas_trabajadas || null,
        datosGenerales.faena || null,
        datosGenerales.lugar || null,
        datosGenerales.equipo || null,
        datosGenerales.operador_rut || null,
        datosGenerales.ayudante_1 || null,
        datosGenerales.ayudante_2 || null,
        datosGenerales.ayudante_3 || null,
        datosGenerales.ayudante_4 || null,
        datosGenerales.ayudante_5 || null,
        datosGenerales.pozo_numero || null,
        datosGenerales.sector || null,
        datosGenerales.diametro || null,
        datosGenerales.inclinacion || null,
        datosGenerales.profundidad_inicial || null,
        datosGenerales.profundidad_final || null,
        datosGenerales.mts_perforados || null,
        datosGenerales.pull_down || null,
        datosGenerales.rpm || null,
        datosGenerales.horometro_inicial || null,
        datosGenerales.horometro_final || null,
        datosGenerales.horometro_hrs || null,
        datosGenerales.insumo_petroleo || null,
        datosGenerales.insumo_lubricantes || null,
        datosGenerales.observaciones || null,
        datosGenerales.estado || 'Borrador'
      ]
    );

    const idInforme = result.insertId;

    await reemplazarDetalleInforme(connection, idInforme, actividades, herramientas, perforaciones);

    await connection.commit();

    res.status(201).json({
      success: true,
      id_informe: idInforme,
      folio,
      estado: datosGenerales.estado || 'Borrador',
      message: 'Informe creado correctamente'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al crear informe:', error);
    res.status(500).json({ error: 'Error al crear el informe', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/informes/:id
 * Obtener un informe específico por ID
 */
router.get('/informes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();

    const [informes] = await connection.execute(
      `SELECT * FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    if (informes.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    res.json(informes[0]);

  } catch (error) {
    console.error('[ERROR] Error al obtener informe:', error);
    res.status(500).json({ error: 'Error al obtener el informe' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/informes/:id/detalles
 * Obtener informe con todas sus tablas relacionadas (actividades, herramientas, perforaciones)
 */
router.get('/informes/:id/detalles', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
// ============================================
// ENDPOINT DE EMERGENCIA: GUARDADO TEMPORAL
// ============================================
router.post('/informes/temporal', async (req, res) => {
  let connection;
  try {
    const { id_informe, datosGenerales, actividades = [], herramientas = [], perforaciones = [] } = req.body;
    if (!id_informe) return res.status(400).json({ error: 'Se requiere id_informe' });

    // BYPASS SUPER ADMIN: Saltarse validación de turno
    const bypassCheck = await checkSuperAdminBypass(req);
    if (!bypassCheck.bypassActive) {
      const validacionTurno = await validarEscrituraTurno(datosGenerales?.operador_rut, { allowGrace: true });
      if (!validacionTurno.ok) {
        return res.status(validacionTurno.status).json({ error: validacionTurno.message });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE informes_turno SET
        fecha = ?, turno = ?, horas_trabajadas = ?, faena = ?, lugar = ?, equipo = ?,
        operador_rut = ?, ayudante_1 = ?, ayudante_2 = ?, ayudante_3 = ?, ayudante_4 = ?, ayudante_5 = ?, pozo_numero = ?, sector = ?,
        diametro = ?, inclinacion = ?, profundidad_inicial = ?, profundidad_final = ?,
        mts_perforados = ?, pull_down = ?, rpm = ?, horometro_inicial = ?, horometro_final = ?,
        horometro_hrs = ?, insumo_petroleo = ?, insumo_lubricantes = ?, observaciones = ?, estado = ?
      WHERE id_informe = ?`,
      [
        datosGenerales.fecha || null, datosGenerales.turno || null, datosGenerales.horas_trabajadas || null,
        datosGenerales.faena || null, datosGenerales.lugar || null, datosGenerales.equipo || null,
        datosGenerales.operador_rut || null, datosGenerales.ayudante_1 || null, datosGenerales.ayudante_2 || null, datosGenerales.ayudante_3 || null, datosGenerales.ayudante_4 || null, datosGenerales.ayudante_5 || null,
        datosGenerales.pozo_numero || null, datosGenerales.sector || null, datosGenerales.diametro || null,
        datosGenerales.inclinacion || null, datosGenerales.profundidad_inicial || null, datosGenerales.profundidad_final || null,
        datosGenerales.mts_perforados || null, datosGenerales.pull_down || null, datosGenerales.rpm || null,
        datosGenerales.horometro_inicial || null, datosGenerales.horometro_final || null, datosGenerales.horometro_hrs || null,
        datosGenerales.insumo_petroleo || null, datosGenerales.insumo_lubricantes || null, datosGenerales.observaciones || null,
        'Borrador', id_informe
      ]
    );

    await reemplazarDetalleInforme(connection, id_informe, actividades, herramientas, perforaciones);

    await connection.commit();
    res.json({ success: true, message: 'Guardado temporal exitoso' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] /temporal:', error);
    res.status(500).json({ error: 'Error en guardado temporal' });
  } finally {
    if (connection) connection.release();
  }
});

// ============================================
// ENDPOINT DE EMERGENCIA: FINALIZAR TURNO
// ============================================
router.post('/informes/finalizar-auto', async (req, res) => {
  try {
    const { id_informe } = req.body;
    if (!id_informe) return res.status(400).json({ error: 'Se requiere id_informe' });
    await pool.execute("UPDATE informes_turno SET estado = 'Finalizado' WHERE id_informe = ?", [id_informe]);
    res.json({ success: true, message: 'Turno cerrado y bloqueado automáticamente por el sistema.' });
  } catch (error) {
    console.error('[ERROR] /finalizar-auto:', error);
    res.status(500).json({ error: 'Error al finalizar turno forzadamente' });
  }
});

// Endpoint /guardar eliminado (guardado en JSON ya no se usa)
    // Obtener informe principal
    const [informes] = await connection.execute(
      `SELECT * FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    if (informes.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const informe = informes[0];

    // Obtener actividades
    const [actividades] = await connection.execute(
      `SELECT * FROM actividades_turno WHERE id_informe = ? ORDER BY hora_desde ASC`,
      [id]
    );

    // Obtener herramientas
    const [herramientas] = await connection.execute(
      `SELECT * FROM herramientas_turno WHERE id_informe = ? ORDER BY desde_mts ASC`,
      [id]
    );

    // Obtener perforaciones
    const [perforaciones] = await connection.execute(
      `SELECT * FROM perforaciones_turno WHERE id_informe = ? ORDER BY desde_mts ASC`,
      [id]
    );

    res.json({
      informe,
      actividades,
      herramientas,
      perforaciones
    });

  } catch (error) {
    console.error('[ERROR] Error al obtener detalles del informe:', error);
    res.status(500).json({ error: 'Error al obtener los detalles del informe' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/informes/:id
 * Actualizar un informe (puede ser edición completa o cambio de estado)
 */
router.put('/informes/:id', async (req, res) => {
  const { id } = req.params;
  
  if (isDuplicateRequest(req, id)) {
    return res.status(429).json({ error: 'Petición en proceso. Intente nuevamente en unos segundos.' });
  }

  let connection;
  try {
    const datosActualizados = req.body;

    if (datosActualizados?.datosGenerales) {
      const isAuditEdit = parseBoolean(datosActualizados?.is_audit_edit);
      const adminRutSolicitante = datosActualizados?.admin_rut || req.headers['x-admin-rut'] || req.headers['rut_solicitante'];
      let auditAdminRut = null;

      // BYPASS SUPER ADMIN: Chequear primero si es bypass
      const bypassCheck = await checkSuperAdminBypass(req);

      if (isAuditEdit) {
        const validacionAudit = await validarSuperAdminPorRut(adminRutSolicitante);
        if (!validacionAudit.ok) {
          return res.status(validacionAudit.status).json({ error: validacionAudit.message });
        }
        auditAdminRut = validacionAudit.rutLimpio;
      }

      const { datosGenerales, actividades = [], herramientas = [], perforaciones = [] } = datosActualizados;
      
      // Si NO es audit edit Y NO tiene bypass activo, validar turno
      if (!isAuditEdit && !bypassCheck.bypassActive) {
        const validacionTurno = await validarEscrituraTurno(datosGenerales?.operador_rut, { allowGrace: true });
        if (!validacionTurno.ok) {
          return res.status(validacionTurno.status).json({ error: validacionTurno.message });
        }
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [informeActualRows] = await connection.execute(
        'SELECT estado FROM informes_turno WHERE id_informe = ? LIMIT 1',
        [id]
      );

      if (!informeActualRows || informeActualRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Informe no encontrado' });
      }

      const estadoPrevio = informeActualRows[0].estado || '';

      await connection.execute(
        `UPDATE informes_turno SET
          fecha = ?,
          turno = ?,
          horas_trabajadas = ?,
          faena = ?,
          lugar = ?,
          equipo = ?,
          operador_rut = ?,
          ayudante_1 = ?,
          ayudante_2 = ?,
          ayudante_3 = ?,
          ayudante_4 = ?,
          ayudante_5 = ?,
          pozo_numero = ?,
          sector = ?,
          diametro = ?,
          inclinacion = ?,
          profundidad_inicial = ?,
          profundidad_final = ?,
          mts_perforados = ?,
          pull_down = ?,
          rpm = ?,
          horometro_inicial = ?,
          horometro_final = ?,
          horometro_hrs = ?,
          insumo_petroleo = ?,
          insumo_lubricantes = ?,
          observaciones = ?,
          estado = ?
        WHERE id_informe = ?`,
        [
          datosGenerales.fecha || null,
          datosGenerales.turno || null,
          datosGenerales.horas_trabajadas || null,
          datosGenerales.faena || null,
          datosGenerales.lugar || null,
          datosGenerales.equipo || null,
          datosGenerales.operador_rut || null,
          datosGenerales.ayudante_1 || null,
          datosGenerales.ayudante_2 || null,
          datosGenerales.ayudante_3 || null,
          datosGenerales.ayudante_4 || null,
          datosGenerales.ayudante_5 || null,
          datosGenerales.pozo_numero || null,
          datosGenerales.sector || null,
          datosGenerales.diametro || null,
          datosGenerales.inclinacion || null,
          datosGenerales.profundidad_inicial || null,
          datosGenerales.profundidad_final || null,
          datosGenerales.mts_perforados || null,
          datosGenerales.pull_down || null,
          datosGenerales.rpm || null,
          datosGenerales.horometro_inicial || null,
          datosGenerales.horometro_final || null,
          datosGenerales.horometro_hrs || null,
          datosGenerales.insumo_petroleo || null,
          datosGenerales.insumo_lubricantes || null,
          datosGenerales.observaciones || null,
          datosGenerales.estado || 'Borrador',
          id
        ]
      );

      await reemplazarDetalleInforme(connection, id, actividades, herramientas, perforaciones);

      if (isAuditEdit && auditAdminRut) {
        const estadoNuevo = datosGenerales.estado || estadoPrevio || 'Borrador';
        const detalleBase = `Super Admin edito manualmente el informe ID_${id} en modo auditoria. Estado previo: ${estadoPrevio || 'N/A'}. Estado nuevo: ${estadoNuevo || 'N/A'}.`;
        const detalle = estadoFueCerrado(estadoPrevio)
          ? `${detalleBase} Edicion realizada despues de su cierre original.`
          : detalleBase;

        await connection.execute(
          'INSERT INTO admin_logs (admin_rut, accion, detalle, fecha) VALUES (?, ?, ?, NOW())',
          [auditAdminRut, 'AUDIT_EDIT_INFORME', detalle]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        id_informe: Number(id),
        estado: datosGenerales.estado || 'Borrador',
        message: 'Informe actualizado correctamente'
      });
    }

    // Si solo se está actualizando el estado (soft delete/restaurar)
    if (Object.keys(datosActualizados).length === 1 && datosActualizados.estado) {
      connection = await pool.getConnection();
      
      await connection.execute(
        `UPDATE informes_turno SET estado = ? WHERE id_informe = ?`,
        [datosActualizados.estado, id]
      );

      return res.json({ message: 'Estado actualizado correctamente' });
    }

    // Edición completa del informe
    connection = await pool.getConnection();

    const updateFields = [];
    const updateValues = [];

    // Mapear campos permitidos para actualización
    const camposPermitidos = [
      'numero_informe', 'fecha', 'turno', 'horas_trabajadas', 'faena', 'lugar',
      'equipo', 'operador_rut', 'ayudante_1', 'ayudante_2', 'ayudante_3', 'ayudante_4', 'ayudante_5', 'pozo_numero',
      'sector', 'diametro', 'inclinacion', 'profundidad_inicial', 'profundidad_final',
      'mts_perforados', 'pull_down', 'rpm', 'horometro_inicial', 'horometro_final',
      'horometro_hrs', 'insumo_petroleo', 'insumo_lubricantes', 'observaciones', 'estado'
    ];

    camposPermitidos.forEach(campo => {
      if (datosActualizados.hasOwnProperty(campo)) {
        updateFields.push(`${campo} = ?`);
        updateValues.push(datosActualizados[campo]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateValues.push(id);

    const query = `UPDATE informes_turno SET ${updateFields.join(', ')} WHERE id_informe = ?`;
    
    await connection.execute(query, updateValues);

    res.json({ message: 'Informe actualizado correctamente' });

  } catch (error) {
    console.error('[ERROR] Error al actualizar informe:', error);
    res.status(500).json({ error: 'Error al actualizar el informe', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * DELETE /api/informes/:id
 * Eliminar permanentemente un informe (hard delete)
 * NOTA: Esto eliminará también las tablas relacionadas si hay CASCADE configurado
 */
router.delete('/informes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const validacion = await validarHardDeleteSuperAdmin(req);
    if (!validacion.ok) {
      return res.status(validacion.status).json({ error: validacion.message });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Eliminar informe principal (la DB maneja actividades, herramientas y perforaciones por cascade)
    await connection.execute(
      `DELETE FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.commit();

    res.json({ message: 'Informe eliminado permanentemente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al eliminar informe:', error);
    res.status(500).json({ error: 'Error al eliminar el informe', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ============================================
// ENDPOINT: ENVIAR EMAIL DE INFORME
// ============================================
router.post('/informes/enviar-email', async (req, res) => {
  let tempPdfPath = null;
  try {
    const { id_informe, email } = req.body;
    if (!id_informe || !email) {
      return res.status(400).json({ error: 'Se requiere id_informe y email' });
    }

    // 1. Backend Check
    const [rows] = await pool.execute('SELECT estado, fecha, turno FROM informes_turno WHERE id_informe = ? LIMIT 1', [id_informe]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }
    
    const informe = rows[0];
    if (!estadoFueCerrado(informe.estado)) {
      return res.status(403).json({ error: 'No se puede exportar un informe que no esté cerrado' });
    }

    const fechaFormateada = informe.fecha ? new Date(informe.fecha).toISOString().split('T')[0] : 'S/F';
    const turnoGrupo = informe.turno || 'S/G';

    // 2. Motor de impresión
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Inyectar contexto local de sistema para bypassear auth
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('user_rut', 'system');
      localStorage.setItem('user_super_admin', '1');
    });

    const port = process.env.PORT || 3000;
    const internalUrl = `http://localhost:${port}/informe.html?id=${id_informe}`;
    
    await page.goto(internalUrl, { waitUntil: 'networkidle0' });

    tempPdfPath = path.join(os.tmpdir(), `informe_${id_informe}_${Date.now()}.pdf`);
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    await browser.close();

    fs.writeFileSync(tempPdfPath, pdfBuffer);

    // 3. Envío de Correo (Nodemailer)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const subject = `Informe de Turno - Basalto Drilling - ${fechaFormateada} - Grupo ${turnoGrupo}`;
    
    const mailOptions = {
      from: process.env.MAIL_FROM || '"Basalto Drilling" <no-reply@basalto.app>',
      to: email,
      subject: subject,
      text: `Estimado usuario,\n\nSe adjunta a este correo el reporte oficial del Informe de Turno correspondiente a la fecha ${fechaFormateada} para el Grupo ${turnoGrupo}.\n\nSaludos,\nSistema Basalto Drilling`,
      attachments: [
        {
          filename: `Informe_Turno_${fechaFormateada}_${turnoGrupo}.pdf`,
          path: tempPdfPath
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    // 4. Limpieza temporal
    fs.unlinkSync(tempPdfPath);
    tempPdfPath = null;

    res.json({ success: true, message: 'Correo enviado correctamente' });
  } catch (error) {
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try { fs.unlinkSync(tempPdfPath); } catch(e) {}
    }
    console.error('[ERROR] /enviar-email:', error);
    res.status(500).json({ error: error.message || 'Error al exportar y enviar el correo' });
  }
});

// ============================================
// ENDPOINT: ENVIAR PDF DIRECTO (EN MEMORIA)
// ============================================
router.post('/informes/enviar-pdf', async (req, res) => {
  let browser = null;
  try {
    const { id_informe, email_destino } = req.body;
    if (!id_informe || !email_destino) {
      return res.status(400).json({ error: 'Se requiere id_informe y email_destino' });
    }

    // 1. Validar informe y estado
    const [rows] = await pool.execute('SELECT numero_informe, estado, fecha FROM informes_turno WHERE id_informe = ? LIMIT 1', [id_informe]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }
    
    const informe = rows[0];
    if (informe.estado !== 'Finalizado') {
      return res.status(403).json({ error: 'No se puede exportar un informe que no esté Finalizado' });
    }

    const numeroInforme = informe.numero_informe || 'S/N';
    const fechaFormateada = informe.fecha ? new Date(informe.fecha).toISOString().split('T')[0] : 'S/F';

    // 2. Generar PDF con Puppeteer en Buffer
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Bypass auth to print view
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('user_rut', 'system');
      localStorage.setItem('user_super_admin', '1');
    });

    const port = process.env.PORT || 3000;
    const printUrl = `http://localhost:${port}/print/informe/${id_informe}`;
    
    await page.goto(printUrl, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    
    await browser.close();
    browser = null; // Mark as closed

    // 3. Enviar Correo con Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const subject = `Informe de Turno N° ${numeroInforme} - ${fechaFormateada}`;
    
    const mailOptions = {
      from: '"Reportes Basalto (No Responder)" <basaltodebian@basaltodrilling.cl>',
      replyTo: 'noreply@basaltodrilling.cl',
      to: email_destino,
      subject: subject,
      html: `
        <p>Estimado usuario,</p>
        <p>Se adjunta a este correo el reporte de perforación (<strong>Informe de Turno N&deg; ${numeroInforme}</strong>) correspondiente a la fecha <strong>${fechaFormateada}</strong>.</p>
        <p>Saludos cordiales,<br>Equipo Basalto Drilling</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Este es un mensaje generado automáticamente por el sistema de gestión de Basalto Drilling. Por favor, no responda a esta dirección de correo.</p>
      `,
      attachments: [
        {
          filename: `Informe_${numeroInforme}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Correo enviado correctamente' });
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch(e) {}
    }
    console.error('[ERROR] /enviar-pdf:', error);
    res.status(500).json({ error: error.message || 'Error al generar o enviar el PDF' });
  }
});

// ============================================
// ENDPOINT: ENVIAR INFORME (PDF DESDE FRONTEND)
// ============================================
router.post('/mail/enviar-informe', async (req, res) => {
  try {
    const { id_informe, rut_solicitante, email_adicional, pdf_base64, nombre_archivo } = req.body || {};
    const sessionIsSuperAdmin = Boolean(req.session?.isSuperAdmin);
    const sessionRut = req.session?.userRut || req.session?.rut || null;

    if (!id_informe || !pdf_base64 || (!rut_solicitante && !sessionRut)) {
      return res.status(400).json({ error: 'Se requiere id_informe, rut_solicitante y pdf_base64' });
    }

    const rutLimpio = limpiarRUT(sessionRut || rut_solicitante);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const [destRows] = await pool.execute(
      `SELECT email
       FROM trabajadores
       WHERE REPLACE(REPLACE(REPLACE(RUT, '.', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
      [rutLimpio]
    );

    if (!destRows || destRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró trabajador para el RUT de sesión' });
    }

    const emailDb = String(destRows[0].email || '').trim();
    if (!emailDb || !emailRegex.test(emailDb)) {
      return res.status(400).json({ error: 'El correo del usuario en DB es inválido o está vacío' });
    }

    const [adminRows] = await pool.execute(
      `SELECT es_super_admin, activo
       FROM admin_users
       WHERE REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
      [rutLimpio]
    );
    const isSuperAdminByDb = Boolean(adminRows && adminRows.length > 0 && Number(adminRows[0].activo) === 1 && Number(adminRows[0].es_super_admin) === 1);
    const isSuperAdmin = sessionIsSuperAdmin || isSuperAdminByDb;

    let destinatarioFinal = emailDb;
    const adicional = String(email_adicional || '').trim();
    if (sessionIsSuperAdmin) {
      destinatarioFinal = emailDb;
      console.log('[MAIL_SYSTEM] Bypass de validación activado para Super Admin.');
    } else if (!isSuperAdmin && adicional) {
      if (!emailRegex.test(adicional)) {
        return res.status(400).json({ error: 'Correo adicional inválido' });
      }
      destinatarioFinal = `${emailDb}, ${adicional}`;
    }

    console.log(`[MAIL_SYSTEM] Usando correo oficial de DB para envío: ${emailDb}.`);

    console.log(`[MAIL_SYSTEM] Intento de envío a: ${destinatarioFinal}`);

    const [rows] = await pool.execute(
      'SELECT estado, fecha, turno FROM informes_turno WHERE id_informe = ? LIMIT 1',
      [id_informe]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const informe = rows[0];
    if (!estadoFueCerrado(informe.estado)) {
      return res.status(403).json({ error: 'No se puede enviar por correo un informe no cerrado' });
    }

    const fechaFormateada = informe.fecha ? new Date(informe.fecha).toISOString().split('T')[0] : 'S/F';
    const grupo = informe.turno || 'S/G';

    const base64Limpio = String(pdf_base64).includes(',')
      ? String(pdf_base64).split(',')[1]
      : String(pdf_base64);

    const pdfBuffer = Buffer.from(base64Limpio, 'base64');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const asunto = `Informe de Turno - ${fechaFormateada} - Grupo ${grupo}`;
    await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Basalto Drilling" <no-reply@basalto.app>',
      to: destinatarioFinal,
      subject: asunto,
      text: `Se adjunta Informe de Turno (ID ${id_informe}) para fecha ${fechaFormateada}, grupo ${grupo}.`,
      attachments: [
        {
          filename: nombre_archivo || `Informe_Turno_${id_informe}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    return res.json({ success: true, message: 'Correo enviado correctamente' });
  } catch (error) {
    console.error('[ERROR] /mail/enviar-informe:', error?.message || error);
    if (error?.code || error?.command || error?.response || error?.responseCode) {
      console.error('[MAIL_SYSTEM][SMTP_DEBUG]', {
        code: error.code || null,
        command: error.command || null,
        responseCode: error.responseCode || null,
        response: error.response || null,
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER || null
      });
    }
    return res.status(500).json({ error: error.message || 'Error al enviar informe por correo' });
  }
});

module.exports = router;
