const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

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
    'SELECT es_super_admin, activo FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1',
    [rutLimpio]
  );

  if (!rows || rows.length === 0) return { ok: false, status: 401, message: 'Administrador solicitante no encontrado' };
  if (Number(rows[0].activo) === 0) return { ok: false, status: 403, message: 'Cuenta solicitante inactiva' };
  if (Number(rows[0].es_super_admin) !== 1) return { ok: false, status: 403, message: 'Solo un Superadministrador puede realizar esta accion' };

  return { ok: true, rutLimpio };
}

async function validarHardDeleteSuperAdmin(req) {
  const rutSolicitante = req.body?.rut_solicitante || req.query?.rut_solicitante || req.headers['rut_solicitante'];
  const validacion = await validarSuperAdminPorRut(rutSolicitante);
  if (!validacion.ok) return validacion;
  return { ok: true };
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
    const { fecha, grupo } = req.query;
    if (!fecha || !grupo) {
      return res.status(400).json({ error: 'Se requieren los parámetros fecha y grupo' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id_informe, estado FROM informes_turno WHERE fecha = ? AND turno = ? ORDER BY creado_el DESC LIMIT 1',
      [fecha, grupo]
    );

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

    connection = await pool.getConnection();
    await connection.beginTransaction();

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
        operador_rut, ayudante_1, ayudante_2, pozo_numero, sector, diametro,
        inclinacion, profundidad_inicial, profundidad_final, mts_perforados,
        pull_down, rpm, horometro_inicial, horometro_final, horometro_hrs,
        insumo_petroleo, insumo_lubricantes, observaciones, estado, creado_el
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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

      if (isAuditEdit) {
        const validacionAudit = await validarSuperAdminPorRut(adminRutSolicitante);
        if (!validacionAudit.ok) {
          return res.status(validacionAudit.status).json({ error: validacionAudit.message });
        }
        auditAdminRut = validacionAudit.rutLimpio;
      }

      const { datosGenerales, actividades = [], herramientas = [], perforaciones = [] } = datosActualizados;
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

      await connection.execute('DELETE FROM actividades_turno WHERE id_informe = ?', [id]);
      await connection.execute('DELETE FROM herramientas_turno WHERE id_informe = ?', [id]);
      await connection.execute('DELETE FROM perforaciones_turno WHERE id_informe = ?', [id]);

      for (const act of actividades) {
        await connection.execute(
          'INSERT INTO actividades_turno (id_informe, hora_desde, hora_hasta, detalle, hrs_bd, hrs_cliente) VALUES (?, ?, ?, ?, ?, ?)',
          [id, act.hora_desde || null, act.hora_hasta || null, act.detalle || null, act.hrs_bd || null, act.hrs_cliente || null]
        );
      }

      for (const herr of herramientas) {
        await connection.execute(
          'INSERT INTO herramientas_turno (id_informe, tipo_elemento, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, herr.tipo_elemento || null, herr.diametro || null, herr.numero_serie || null, herr.desde_mts || null, herr.hasta_mts || null, herr.detalle_extra || null]
        );
      }

      for (const perf of perforaciones) {
        await connection.execute(
          'INSERT INTO perforaciones_turno (id_informe, desde_mts, hasta_mts, mts_perforados, recuperacion, tipo_roca, dureza) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, perf.desde || null, perf.hasta || null, perf.metros_perforados || null, perf.recuperacion || null, perf.tipo_roca || null, perf.dureza || null]
        );
      }

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
      'equipo', 'operador_rut', 'ayudante_1', 'ayudante_2', 'pozo_numero',
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

    // Eliminar tablas relacionadas primero (para evitar errores de foreign key)
    await connection.execute(
      `DELETE FROM actividades_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.execute(
      `DELETE FROM herramientas_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.execute(
      `DELETE FROM perforaciones_turno WHERE id_informe = ?`,
      [id]
    );

    // Eliminar informe principal
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

module.exports = router;
