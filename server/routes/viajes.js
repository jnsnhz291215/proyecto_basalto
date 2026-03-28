const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { obtenerPeriodoPorFecha, obtenerFechasSugeridas, checkLogisticaCompleta } = require('../helpers/periodHelper.js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');

function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

function normalizarTipoTramo(valor) {
  const raw = String(valor || '').trim().toUpperCase();
  if (raw === 'IDA') return 'IDA';
  if (raw === 'VUELTA') return 'VUELTA';
  if (raw === 'CONEXION' || raw === 'CONEXIÓN') return 'CONEXION';
  return 'IDA';
}

function fechaSQLHoy() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================
// MÓDULO DE TICKETS PDF – Rutas y helpers
// ============================================================
const TEMP_DIR       = path.join(__dirname, '..', '..', 'uploads', 'temp');
const TICKETS_DIR    = '/home/basalto/apps/basalto/storage/tickets-activos';
const SOFTDELETE_DIR = '/home/basalto/apps/basalto/storage/viajes-softdelete';

// Crear directorios si no existen
[TEMP_DIR, TICKETS_DIR, SOFTDELETE_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Multer – almacenamiento en carpeta temporal
const ticketStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename:    (_req, _file, cb) => cb(null, `tmp_ticket_${Date.now()}.pdf`)
});
const uploadTicket = multer({
  storage:    ticketStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Solo se permiten archivos PDF'));
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Comprimir PDF con Ghostscript 10.05.1
function comprimirConGS(origen, destino) {
  return new Promise((resolve, reject) => {
    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${destino}" "${origen}"`;
    exec(cmd, { timeout: 60000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// Mover ticket a carpeta de softdelete (solo filesystem, sin tocar DB)
function moverTicketASoftdelete(urlTicket) {
  if (!urlTicket) return;
  try {
    const filename = path.basename(urlTicket);
    const origen   = path.join(TICKETS_DIR, filename);
    const destino  = path.join(SOFTDELETE_DIR, filename);
    if (fs.existsSync(origen)) fs.renameSync(origen, destino);
  } catch (e) {
    console.error('[TICKET] Error moviendo ticket a softdelete:', e.message);
  }
}

// Validar que el solicitante sea admin activo; devuelve { ok, esSuperAdmin }
async function validarAdminParaTicket(req) {
  const rutSolicitante = limpiarRUT(
    req.body?.rut_solicitante || req.query?.rut_solicitante || req.headers['rut_solicitante'] || ''
  );
  if (!rutSolicitante) return { ok: false, status: 401, message: 'Se requiere rut_solicitante' };

  const [rows] = await pool.execute(
    'SELECT es_super_admin, activo FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut,".",""),"-","")," ","") = ? LIMIT 1',
    [rutSolicitante]
  );
  if (!rows.length) return { ok: false, status: 401, message: 'Administrador no encontrado' };
  if (Number(rows[0].activo) === 0) return { ok: false, status: 403, message: 'Cuenta inactiva' };
  return { ok: true, esSuperAdmin: Number(rows[0].es_super_admin) === 1 };
}

async function validarPeriodoVigente(connection, idPeriodoKey, idGrupo, fechaRef) {
  const [rows] = await connection.execute(
    `SELECT MAX(fecha) AS fecha_fin
     FROM instancias_trabajo
     WHERE id_periodo_key = ?
       AND id_grupo = ?
       AND UPPER(tipo_jornada) = 'TRABAJO'`,
    [idPeriodoKey, idGrupo]
  );

  if (!rows.length || !rows[0].fecha_fin) return false;
  const fechaFin = String(rows[0].fecha_fin).slice(0, 10);
  return fechaFin >= fechaRef;
}

async function validarHardDeleteSuperAdmin(req) {
  const rutSolicitante = req.body?.rut_solicitante || req.query?.rut_solicitante || req.headers['rut_solicitante'];
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
  if (Number(rows[0].es_super_admin) !== 1) return { ok: false, status: 403, message: 'Solo un Superadministrador puede realizar eliminación física' };

  return { ok: true };
}

/**
 * GET /api/viajes/calendario
 * Obtener todos los viajes para renderizar en el calendario
 * Retorna: nombre, apellidos, cargo, ciudad origen/destino, hora_salida
 * Solo viajes no cancelados
 */
router.get('/viajes/calendario', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [viajes] = await connection.execute(
      `SELECT 
        vt.id_tramo,
        v.id_viaje,
        v.rut_trabajador,
        v.estado,
        t.nombres,
        CONCAT(t.apellido_paterno, ' ', IFNULL(t.apellido_materno, '')) as apellidos,
        c.nombre_cargo AS cargo,
        vt.fecha_salida,
        vt.hora_salida,
        c_origen.nombre_ciudad AS ciudad_origen,
        c_destino.nombre_ciudad AS ciudad_destino,
        vt.codigo_pasaje,
        vt.empresa_transporte
      FROM viajes v
      INNER JOIN viajes_tramos vt ON v.id_viaje = vt.id_viaje
      INNER JOIN trabajadores t ON v.rut_trabajador = t.RUT
      LEFT JOIN cargos c ON t.id_cargo = c.id_cargo
      LEFT JOIN ciudades c_origen ON vt.id_ciudad_origen = c_origen.id_ciudad
      LEFT JOIN ciudades c_destino ON vt.id_ciudad_destino = c_destino.id_ciudad
      WHERE v.estado != 'Cancelado'
      ORDER BY vt.fecha_salida ASC, vt.hora_salida ASC`
    );

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener calendario de viajes:', error);
    res.status(500).json({ error: 'Error al obtener el calendario de viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/mis-viajes?rut=xxxxx&ver_pasados=true|false
 * Obtener viajes del trabajador actual
 * por_defecto: mostrar viajes vigentes (desde ayer hasta futuro)
 * ver_pasados=true: mostrar solo viajes anteriores a ayer
 */
router.get('/viajes/mis-viajes', async (req, res) => {
  let connection;
  try {
    const { rut, ver_pasados = 'false' } = req.query;

    if (!rut) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    connection = await pool.getConnection();

    let query = `
      SELECT
        v.id_viaje,
        v.rut_trabajador,
        v.estado,
        v.fecha_registro,
        v.url_ticket,
        vt.id_tramo,
        vt.codigo_pasaje,
        vt.fecha_salida,
        vt.hora_salida,
        c_origen.nombre_ciudad AS ciudad_origen,
        c_destino.nombre_ciudad AS ciudad_destino,
        vt.empresa_transporte
      FROM viajes v
      INNER JOIN viajes_tramos vt ON v.id_viaje = vt.id_viaje
      LEFT JOIN ciudades c_origen ON vt.id_ciudad_origen = c_origen.id_ciudad
      LEFT JOIN ciudades c_destino ON vt.id_ciudad_destino = c_destino.id_ciudad
      WHERE v.rut_trabajador = ?
    `;

    let params = [rut];

    // Lógica de visibilidad
    if (ver_pasados === 'true' || ver_pasados === true) {
      // Mostrar viajes cuya fecha_salida sea anterior a ayer
      query += ` AND vt.fecha_salida < DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
    } else {
      // Por defecto: mostrar viajes vigentes (desde ayer hasta futuro)
      query += ` AND vt.fecha_salida >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
    }

    query += ` ORDER BY vt.fecha_salida ASC, vt.hora_salida ASC`;

    const [viajes] = await connection.execute(query, params);

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener mis viajes:', error);
    res.status(500).json({ error: 'Error al obtener tus viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * POST /api/viajes
 * Crear un viaje con múltiples tramos usando transacción SQL
 */
router.post('/viajes', async (req, res) => {
  let connection;
  try {
    const { rut_trabajador, tramos, id_periodo_vinculo: selectedPeriodo } = req.body;

    // Validaciones
    if (!rut_trabajador) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    if (!tramos || !Array.isArray(tramos) || tramos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un tramo' });
    }

    // Validar cada tramo
    for (let i = 0; i < tramos.length; i++) {
      const tramo = tramos[i];
      if (!tramo.tipo_transporte || !tramo.fecha || !tramo.hora || !tramo.id_ciudad_origen || !tramo.id_ciudad_destino || !tramo.empresa_transporte) {
        return res.status(400).json({ 
          error: `Tramo ${i + 1}: Todos los campos son requeridos (tipo_transporte, fecha, hora, origen, destino, empresa_transporte)` 
        });
      }
    }

    // Calcular fecha de salida (fecha del primer tramo ordenado cronológicamente)
    const tramosOrdenados = [...tramos].sort((a, b) => {
      const fechaA = new Date(`${a.fecha}T${a.hora}`);
      const fechaB = new Date(`${b.fecha}T${b.hora}`);
      return fechaA - fechaB;
    });

    connection = await pool.getConnection();

    // Obtener id_grupo del trabajador para vincular periodos logísticos
    const [workerGrupoRows] = await connection.execute(
      `SELECT id_grupo FROM trabajadores
       WHERE REPLACE(REPLACE(REPLACE(RUT,'.',''),'-',''),' ','') = ? LIMIT 1`,
      [limpiarRUT(rut_trabajador)]
    );
    const id_grupo_trabajador = workerGrupoRows[0]?.id_grupo || null;

    if (selectedPeriodo && id_grupo_trabajador) {
      const fechaRef = String(tramos[0]?.fecha || fechaSQLHoy()).slice(0, 10);
      const periodoValido = await validarPeriodoVigente(connection, String(selectedPeriodo), id_grupo_trabajador, fechaRef);
      if (!periodoValido) {
        return res.status(400).json({ error: 'La instancia seleccionada no es válida para el grupo o ya terminó' });
      }
    }

    await connection.beginTransaction();

    // 1. Insertar el viaje principal
    const [resultViaje] = await connection.execute(
      `INSERT INTO viajes (rut_trabajador, fecha_registro, estado) VALUES (?, NOW(), 'Programado')`,
      [rut_trabajador]
    );

    const id_viaje = resultViaje.insertId;

    // 2. Insertar cada tramo con id_periodo_vinculo autocompletado
    for (const tramo of tramos) {
      let id_periodo_vinculo = null;
      const tipoTramo = normalizarTipoTramo(tramo.tipo_movimiento || tramo.tipo_tramo);
      if (selectedPeriodo) {
        id_periodo_vinculo = String(selectedPeriodo).trim();
      } else if (id_grupo_trabajador && tramo.fecha) {
        id_periodo_vinculo = await obtenerPeriodoPorFecha(tramo.fecha, id_grupo_trabajador, connection);
      }

      await connection.execute(
        `INSERT INTO viajes_tramos
         (id_viaje, tipo_transporte, codigo_pasaje, fecha_salida, hora_salida,
          id_ciudad_origen, id_ciudad_destino, empresa_transporte, id_periodo_vinculo, tipo_tramo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_viaje,
          tramo.tipo_transporte,
          tramo.codigo_transporte || null,
          tramo.fecha,
          tramo.hora,
          tramo.id_ciudad_origen,
          tramo.id_ciudad_destino,
          tramo.empresa_transporte,
          id_periodo_vinculo,
          tipoTramo
        ]
      );

      if (id_periodo_vinculo) {
        console.log(`[LOGISTICS] Tramo vinculado a jornada ${id_periodo_vinculo}.`);
      }
    }

    await connection.commit();

    res.status(201).json({
      message: 'Viaje creado exitosamente',
      id_viaje,
      total_tramos: tramos.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al crear viaje:', error);
    res.status(500).json({ error: 'Error al crear el viaje', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes
 * Obtener viajes con filtros por tipo, mes y trabajador
 * Query params:
 *   - tipo: 'proximos' (default) | 'historial'
 *   - mes: '01' a '12' (opcional)
 *   - rut_trabajador: RUT del trabajador (opcional)
 */
router.get('/viajes', async (req, res) => {
  let connection;
  try {
    const { tipo = 'proximos', mes, rut_trabajador, id_grupo, busqueda } = req.query;
    
    connection = await pool.getConnection();

    // Construir WHERE clause según filtros
    let whereConditions = [];
    let params = [];
    
    // Filtro por RUT de trabajador (si se proporciona)
    if (rut_trabajador) {
      whereConditions.push('v.rut_trabajador = ?');
      params.push(rut_trabajador);
    }

    // Filtro por grupo del trabajador
    if (id_grupo && /^\d+$/.test(String(id_grupo))) {
      whereConditions.push('t.id_grupo = ?');
      params.push(parseInt(id_grupo, 10));
    }

    // Búsqueda por RUT o nombre/apellidos
    if (busqueda && String(busqueda).trim()) {
      const qRaw = String(busqueda).trim();
      const qRut = `%${limpiarRUT(qRaw)}%`;
      const qNombre = `%${qRaw.toLowerCase()}%`;
      whereConditions.push(`(
        REPLACE(REPLACE(REPLACE(t.RUT,'.',''),'-',''),' ','') LIKE ?
        OR LOWER(CONCAT_WS(' ', t.nombres, t.apellido_paterno, IFNULL(t.apellido_materno, ''))) LIKE ?
      )`);
      params.push(qRut, qNombre);
    }
    
    if (tipo === 'proximos') {
      // Viajes programados o en curso
      whereConditions.push("v.estado IN ('Programado', 'En curso')");
      // Agregar condición de fecha futura usando MIN de fecha_salida de tramos
      whereConditions.push('(SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) >= CURDATE()');
    } else if (tipo === 'historial') {
      // Viajes finalizados, cancelados o con fecha pasada
      whereConditions.push("(v.estado IN ('Finalizado', 'Cancelado') OR (SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) < CURDATE())");
    }
    
    // Filtro por mes (basado en fecha_salida del primer tramo)
    if (mes && mes.match(/^(0[1-9]|1[0-2])$/)) {
      whereConditions.push('MONTH((SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje)) = ?');
      params.push(parseInt(mes));
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Obtener viajes con datos del trabajador y fecha de salida calculada
    const [viajes] = await connection.execute(
      `SELECT
        v.id_viaje,
        v.rut_trabajador,
        v.fecha_registro,
        v.estado,
        v.url_ticket,
        (SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) as fecha_salida,
        t.nombres,
        CONCAT(t.apellido_paterno, ' ', t.apellido_materno) as apellidos,
        t.id_grupo,
        c.nombre_cargo AS cargo
      FROM viajes v
      INNER JOIN trabajadores t ON v.rut_trabajador = t.RUT
      LEFT JOIN cargos c ON t.id_cargo = c.id_cargo
      ${whereClause}
      ORDER BY fecha_salida ASC, v.fecha_registro DESC`,
      params
    );

    // Para cada viaje, obtener sus tramos
    for (let viaje of viajes) {
      const [tramos] = await connection.execute(
        `SELECT 
          tr.id_tramo,
          tr.tipo_transporte,
          tr.tipo_tramo,
          LOWER(tr.tipo_tramo) AS tipo_movimiento,
          tr.codigo_pasaje as codigo_transporte,
          tr.fecha_salida as fecha,
          tr.hora_salida as hora,
          tr.id_ciudad_origen,
          tr.id_ciudad_destino,
          c_origen.nombre_ciudad AS origen,
          c_destino.nombre_ciudad AS destino,
          tr.empresa_transporte
        FROM viajes_tramos tr
        LEFT JOIN ciudades c_origen ON tr.id_ciudad_origen = c_origen.id_ciudad
        LEFT JOIN ciudades c_destino ON tr.id_ciudad_destino = c_destino.id_ciudad
        WHERE tr.id_viaje = ?
        ORDER BY tr.fecha_salida, tr.hora_salida`,
        [viaje.id_viaje]
      );

      viaje.tramos = tramos;
    }

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener viajes:', error);
    res.status(500).json({ error: 'Error al obtener los viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/sugerir-fechas
 * Retorna la id_periodo_key actual y las fechas sugeridas de IDA y VUELTA
 * para un grupo dado, útil para que el modal pre-rellene fechas.
 *
 * Query params:
 *   - id_grupo: INT requerido
 *   - fecha:    YYYY-MM-DD opcional (default: hoy)
 */
router.get('/viajes/sugerir-fechas', async (req, res) => {
  try {
    const { id_grupo, fecha } = req.query;
    if (!id_grupo) {
      return res.status(400).json({ error: 'Se requiere id_grupo' });
    }
    const sugerido = await obtenerFechasSugeridas(parseInt(id_grupo, 10), pool, fecha || null);
    if (!sugerido) {
      return res.status(404).json({ error: 'No se encontró configuración de turno para este grupo' });
    }
    res.json(sugerido);
  } catch (error) {
    console.error('[ERROR] Error al obtener periodo sugerido:', error);
    res.status(500).json({ error: 'Error al obtener el periodo sugerido' });
  }
});

/**
 * GET /api/viajes/instancias-disponibles
 * Lista instancias vigentes de TRABAJO para un grupo dado en una fecha.
 * Se excluyen instancias ya terminadas.
 */
router.get('/viajes/instancias-disponibles', async (req, res) => {
  let connection;
  try {
    const idGrupo = parseInt(req.query.id_grupo, 10);
    const fechaRef = String(req.query.fecha || fechaSQLHoy()).trim();

    if (!Number.isInteger(idGrupo) || idGrupo <= 0) {
      return res.status(400).json({ error: 'id_grupo inválido' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) {
      return res.status(400).json({ error: 'fecha inválida. Use YYYY-MM-DD' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT
         it.id_periodo_key,
         g.nombre_grupo,
         DATE_FORMAT(MIN(it.fecha), '%Y-%m-%d') AS fecha_inicio,
         DATE_FORMAT(MAX(it.fecha), '%Y-%m-%d') AS fecha_fin,
         SUBSTRING_INDEX(
           GROUP_CONCAT(UPPER(it.turno_asignado) ORDER BY it.fecha ASC SEPARATOR ','),
           ',',
           1
         ) AS turno_inicio
       FROM instancias_trabajo it
       INNER JOIN grupos g ON g.id_grupo = it.id_grupo
       WHERE it.id_grupo = ?
         AND UPPER(it.tipo_jornada) = 'TRABAJO'
       GROUP BY it.id_periodo_key, g.nombre_grupo
       HAVING MAX(it.fecha) >= ?
       ORDER BY MIN(it.fecha) ASC`,
      [idGrupo, fechaRef]
    );

    res.json({
      id_grupo: idGrupo,
      fecha_referencia: fechaRef,
      total: rows.length,
      instancias: rows
    });
  } catch (error) {
    console.error('[ERROR] Error al obtener instancias disponibles:', error);
    res.status(500).json({ error: 'Error al obtener instancias disponibles' });
  } finally {
    if (connection) connection.release();
  }
});

// Compatibilidad con implementación previa
router.get('/viajes/periodo-sugerido', async (req, res) => {
  try {
    const { id_grupo, fecha } = req.query;
    if (!id_grupo) {
      return res.status(400).json({ error: 'Se requiere id_grupo' });
    }
    const sugerido = await obtenerFechasSugeridas(parseInt(id_grupo, 10), pool, fecha || null);
    if (!sugerido) {
      return res.status(404).json({ error: 'No se encontró configuración de turno para este grupo' });
    }
    res.json(sugerido);
  } catch (error) {
    console.error('[ERROR] Error al obtener periodo sugerido:', error);
    res.status(500).json({ error: 'Error al obtener el periodo sugerido' });
  }
});

/**
 * GET /api/viajes/check-logistica
 * Semáforo de logística: devuelve { ida_completa, vuelta_completa } para un periodo.
 *
 * Query params:
 *   - id_periodo_key: Ej: "1-20260321"
 */
router.get('/viajes/check-logistica', async (req, res) => {
  try {
    const { id_periodo_key } = req.query;
    if (!id_periodo_key) {
      return res.status(400).json({ error: 'Se requiere id_periodo_key' });
    }
    const resultado = await checkLogisticaCompleta(id_periodo_key, pool);
    res.json(resultado);
  } catch (error) {
    console.error('[ERROR] Error al verificar logística:', error);
    res.status(500).json({ error: 'Error al verificar la logística del periodo' });
  }
});

// ============================================================
// TICKETS PDF – Upload / Download / Delete
// ============================================================

/**
 * POST /api/viajes/:id/upload-ticket
 * Sube un archivo PDF, lo comprime con Ghostscript y lo almacena.
 * Requiere multipart/form-data con campo "ticket".
 */
router.post('/viajes/:id/upload-ticket', uploadTicket.single('ticket'), async (req, res) => {
  let connection;
  const tempPath = req.file?.path;
  try {
    const idViaje = parseInt(req.params.id, 10);
    if (!req.file) return res.status(400).json({ error: 'No se adjuntó ningún archivo PDF' });

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT rut_trabajador, url_ticket FROM viajes WHERE id_viaje = ? LIMIT 1',
      [idViaje]
    );
    if (!rows.length) return res.status(404).json({ error: 'Viaje no encontrado' });

    // Si ya tenía ticket, mover el anterior a softdelete antes de reemplazarlo
    if (rows[0].url_ticket) moverTicketASoftdelete(rows[0].url_ticket);

    const rutLimpio  = limpiarRUT(rows[0].rut_trabajador);
    const timestamp  = Date.now();
    const nombreFinal = `TICKET_${rutLimpio}_${idViaje}_${timestamp}.pdf`;
    const destinoFinal = path.join(TICKETS_DIR, nombreFinal);

    await comprimirConGS(tempPath, destinoFinal);
    fs.unlinkSync(tempPath);   // borrar tmp original

    await connection.execute(
      'UPDATE viajes SET url_ticket = ? WHERE id_viaje = ?',
      [destinoFinal, idViaje]
    );

    res.json({ message: 'Ticket subido y comprimido exitosamente', nombre: nombreFinal });
  } catch (error) {
    if (tempPath && fs.existsSync(tempPath)) { try { fs.unlinkSync(tempPath); } catch (_) {} }
    console.error('[TICKET] Error al subir ticket:', error);
    res.status(500).json({ error: 'Error al procesar el ticket PDF', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/download-ticket/:id_viaje
 * Descarga protegida del ticket.
 * Seguridad: solo el propio trabajador (por RUT en ?rut=) o un admin activo puede descargar.
 */
router.get('/viajes/download-ticket/:id_viaje', async (req, res) => {
  let connection;
  try {
    const idViaje      = parseInt(req.params.id_viaje, 10);
    const rutSolicitante = limpiarRUT(req.query.rut || req.headers['rut_solicitante'] || '');

    if (!rutSolicitante) {
      return res.status(401).json({ error: 'Se requiere autenticación (parámetro ?rut=)' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT rut_trabajador, url_ticket FROM viajes WHERE id_viaje = ? LIMIT 1',
      [idViaje]
    );
    if (!rows.length) return res.status(404).json({ error: 'Viaje no encontrado' });

    const { rut_trabajador, url_ticket } = rows[0];
    if (!url_ticket) return res.status(404).json({ error: 'Este viaje no tiene ticket adjunto' });

    // Autorización: es el propio trabajador O es admin activo
    const esElTrabajador = rutSolicitante === limpiarRUT(rut_trabajador);
    if (!esElTrabajador) {
      const [adminRows] = await connection.execute(
        'SELECT activo FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut,".",""),"-","")," ","") = ? LIMIT 1',
        [rutSolicitante]
      );
      if (!adminRows.length || Number(adminRows[0].activo) !== 1) {
        return res.status(403).json({ error: 'No tiene autorización para descargar este ticket' });
      }
    }

    const filePath = path.join(TICKETS_DIR, path.basename(url_ticket));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo de ticket no encontrado en el servidor' });
    }

    const filename = path.basename(url_ticket);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[TICKET] Error al descargar ticket:', error);
    res.status(500).json({ error: 'Error al descargar el ticket' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * DELETE /api/viajes/:id/ticket
 * Elimina el ticket adjunto a un viaje.
 * SuperAdmin → harddelete (borra el archivo del servidor).
 * Admin con viajes_soft_delete → softdelete (mueve a carpeta archivada).
 */
router.delete('/viajes/:id/ticket', async (req, res) => {
  let connection;
  try {
    const idViaje    = parseInt(req.params.id, 10);
    const validacion = await validarAdminParaTicket(req);
    if (!validacion.ok) return res.status(validacion.status).json({ error: validacion.message });

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT url_ticket FROM viajes WHERE id_viaje = ? LIMIT 1',
      [idViaje]
    );
    if (!rows.length) return res.status(404).json({ error: 'Viaje no encontrado' });

    const { url_ticket } = rows[0];
    if (!url_ticket) return res.status(404).json({ error: 'Este viaje no tiene ticket adjunto' });

    if (validacion.esSuperAdmin) {
      // Harddelete: borrar el archivo del disco
      const filePath = path.join(TICKETS_DIR, path.basename(url_ticket));
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (_) {} }
    } else {
      // Softdelete: mover a carpeta de archivado
      moverTicketASoftdelete(url_ticket);
    }

    await connection.execute('UPDATE viajes SET url_ticket = NULL WHERE id_viaje = ?', [idViaje]);

    res.json({
      message: validacion.esSuperAdmin
        ? 'Ticket eliminado permanentemente'
        : 'Ticket archivado correctamente'
    });
  } catch (error) {
    console.error('[TICKET] Error al borrar ticket:', error);
    res.status(500).json({ error: 'Error al eliminar el ticket', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/:id
 * Obtener un viaje por id con sus tramos
 */
router.get('/viajes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [viajes] = await connection.execute(
      `SELECT
        v.id_viaje,
        v.rut_trabajador,
        v.fecha_registro,
        v.estado,
        v.url_ticket,
        t.nombres,
        CONCAT(t.apellido_paterno, ' ', IFNULL(t.apellido_materno, '')) as apellidos,
        t.id_grupo,
        c.nombre_cargo AS cargo
      FROM viajes v
      INNER JOIN trabajadores t ON v.rut_trabajador = t.RUT
      LEFT JOIN cargos c ON t.id_cargo = c.id_cargo
      WHERE v.id_viaje = ?
      LIMIT 1`,
      [id]
    );

    if (!viajes.length) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    const viaje = viajes[0];

    const [tramos] = await connection.execute(
      `SELECT 
        tr.id_tramo,
        tr.tipo_transporte,
        tr.tipo_tramo,
        tr.id_periodo_vinculo,
        LOWER(tr.tipo_tramo) AS tipo_movimiento,
        tr.codigo_pasaje as codigo_transporte,
        tr.fecha_salida as fecha,
        tr.hora_salida as hora,
        tr.id_ciudad_origen,
        tr.id_ciudad_destino,
        c_origen.nombre_ciudad AS origen,
        c_destino.nombre_ciudad AS destino,
        tr.empresa_transporte
      FROM viajes_tramos tr
      LEFT JOIN ciudades c_origen ON tr.id_ciudad_origen = c_origen.id_ciudad
      LEFT JOIN ciudades c_destino ON tr.id_ciudad_destino = c_destino.id_ciudad
      WHERE tr.id_viaje = ?
      ORDER BY tr.fecha_salida, tr.hora_salida`,
      [id]
    );

    viaje.tramos = tramos;
    res.json(viaje);
  } catch (error) {
    console.error('[ERROR] Error al obtener viaje:', error);
    res.status(500).json({ error: 'Error al obtener el viaje' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/viajes/:id/estado
 * Cambiar estado de un viaje (Programado, En curso, Finalizado, Cancelado)
 */
router.put('/viajes/:id/estado', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { activo } = req.body;

    // Convertir el boolean activo a estado enum
    const nuevoEstado = activo ? 'Programado' : 'Cancelado';

    connection = await pool.getConnection();

    const [result] = await connection.execute(
      'UPDATE viajes SET estado = ? WHERE id_viaje = ?',
      [nuevoEstado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    res.json({ 
      message: activo ? 'Viaje reactivado exitosamente' : 'Viaje cancelado exitosamente'
    });

  } catch (error) {
    console.error('[ERROR] Error al cambiar estado del viaje:', error);
    res.status(500).json({ error: 'Error al cambiar el estado del viaje' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/viajes/:id
 * Editar un viaje y sus tramos
 */
router.put('/viajes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { rut_trabajador, tramos, id_periodo_vinculo: selectedPeriodo } = req.body;

    // Validaciones
    if (!rut_trabajador) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    if (!tramos || !Array.isArray(tramos) || tramos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un tramo' });
    }

    // Validar cada tramo
    for (let i = 0; i < tramos.length; i++) {
      const tramo = tramos[i];
      if (!tramo.tipo_transporte || !tramo.fecha || !tramo.hora || !tramo.id_ciudad_origen || !tramo.id_ciudad_destino || !tramo.empresa_transporte) {
        return res.status(400).json({ 
          error: `Tramo ${i + 1}: Todos los campos son requeridos (tipo_transporte, fecha, hora, origen, destino, empresa_transporte)` 
        });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Actualizar viaje principal (solo RUT, los tramos determinan las fechas)
    const [resultViaje] = await connection.execute(
      'UPDATE viajes SET rut_trabajador = ? WHERE id_viaje = ?',
      [rut_trabajador, id]
    );

    if (resultViaje.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    // 2. Eliminar tramos antiguos
    await connection.execute(
      'DELETE FROM viajes_tramos WHERE id_viaje = ?',
      [id]
    );

    // Obtener id_grupo del trabajador para recalcular periodo logístico
    const [workerGrupoRows] = await connection.execute(
      `SELECT id_grupo FROM trabajadores
       WHERE REPLACE(REPLACE(REPLACE(RUT,'.',''),'-',''),' ','') = ? LIMIT 1`,
      [limpiarRUT(rut_trabajador)]
    );
    const id_grupo_trabajador = workerGrupoRows[0]?.id_grupo || null;

    if (selectedPeriodo && id_grupo_trabajador) {
      const fechaRef = String(tramos[0]?.fecha || fechaSQLHoy()).slice(0, 10);
      const periodoValido = await validarPeriodoVigente(connection, String(selectedPeriodo), id_grupo_trabajador, fechaRef);
      if (!periodoValido) {
        await connection.rollback();
        return res.status(400).json({ error: 'La instancia seleccionada no es válida para el grupo o ya terminó' });
      }
    }

    // 3. Insertar nuevos tramos
    for (const tramo of tramos) {
      let id_periodo_vinculo = null;
      const tipoTramo = normalizarTipoTramo(tramo.tipo_movimiento || tramo.tipo_tramo);
      if (selectedPeriodo) {
        id_periodo_vinculo = String(selectedPeriodo).trim();
      } else if (id_grupo_trabajador && tramo.fecha) {
        id_periodo_vinculo = await obtenerPeriodoPorFecha(tramo.fecha, id_grupo_trabajador, connection);
      }

      await connection.execute(
        `INSERT INTO viajes_tramos 
        (id_viaje, tipo_transporte, codigo_pasaje, fecha_salida, hora_salida, id_ciudad_origen, id_ciudad_destino, empresa_transporte, id_periodo_vinculo, tipo_tramo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tramo.tipo_transporte,
          tramo.codigo_transporte || null,
          tramo.fecha,
          tramo.hora,
          tramo.id_ciudad_origen,
          tramo.id_ciudad_destino,
          tramo.empresa_transporte,
          id_periodo_vinculo,
          tipoTramo
        ]
      );

      if (id_periodo_vinculo) {
        console.log(`[LOGISTICS] Tramo vinculado a jornada ${id_periodo_vinculo}.`);
      }
    }

    await connection.commit();

    res.json({ 
      message: 'Viaje actualizado exitosamente',
      total_tramos: tramos.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al editar viaje:', error);
    res.status(500).json({ error: 'Error al editar el viaje', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * DELETE /api/viajes/:id
 * Eliminar un viaje y todos sus tramos (cascada)
 */
router.delete('/viajes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const validacion = await validarHardDeleteSuperAdmin(req);
    if (!validacion.ok) {
      return res.status(validacion.status).json({ error: validacion.message });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Si el viaje tiene ticket, archivarlo antes del DELETE CASCADE
    const [ticketRows] = await connection.execute(
      'SELECT url_ticket FROM viajes WHERE id_viaje = ? LIMIT 1',
      [id]
    );
    if (ticketRows.length && ticketRows[0].url_ticket) {
      moverTicketASoftdelete(ticketRows[0].url_ticket);
    }

    // Eliminar viaje (la DB se encarga del cascade en viajes_tramos)
    const [result] = await connection.execute(
      'DELETE FROM viajes WHERE id_viaje = ?',
      [id]
    );

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    res.json({ message: 'Viaje eliminado exitosamente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al eliminar viaje:', error);
    res.status(500).json({ error: 'Error al eliminar el viaje' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/ruts-por-mes?mes=YYYY-MM
 * Retorna los RUTs de trabajadores con al menos un viaje (no cancelado) en el mes indicado.
 */
router.get('/viajes/ruts-por-mes', async (req, res) => {
  let connection;
  try {
    const { mes } = req.query;
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: 'Parámetro mes inválido. Formato requerido: YYYY-MM' });
    }

    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT DISTINCT v.rut_trabajador
       FROM viajes v
       INNER JOIN viajes_tramos vt ON v.id_viaje = vt.id_viaje
       WHERE v.estado != 'Cancelado'
         AND DATE_FORMAT(vt.fecha_salida, '%Y-%m') = ?`,
      [mes]
    );

    res.json({ ruts: rows.map(r => r.rut_trabajador) });
  } catch (error) {
    console.error('[ERROR] Error al obtener RUTs por mes:', error);
    res.status(500).json({ error: 'Error al obtener datos de viajes por mes' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
