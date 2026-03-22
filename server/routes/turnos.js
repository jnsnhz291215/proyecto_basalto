const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion');
const {
  isWorkerOnShiftToday,
  isGrupoOnShift,
  obtenerGruposDelDia
} = require('../helpers/shiftValidation');

function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

// ============================================
// ENDPOINT: CHECK SI EL TRABAJADOR TIENE TURNO HOY
// ============================================
router.get('/check-hoy/:rut', async (req, res) => {
  try {
    const { rut } = req.params;
    
    if (!rut) {
      return res.status(400).json({ error: 'Falta parametro RUT', onShift: false });
    }

    // Usar la función helper
    const onShift = await isWorkerOnShiftToday(rut);
    
    res.json({
      success: true,
      rut: rut,
      onShift: onShift
    });

  } catch (error) {
    console.error('[API] Error verificando turno:', error);
    res.status(500).json({ error: 'Error interno verificando el turno', onShift: false });
  }
});

// ============================================
// ENDPOINT DIAGNOSTICO: SALUD DE MODULO TURNOS
// ============================================
router.get('/turnos/health', async (_req, res) => {
  try {
    const now = new Date();
    const gruposDelDia = obtenerGruposDelDia(now);
    const gruposReferencia = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
    const onShift = gruposReferencia.filter((g) => isGrupoOnShift(g, now));

    let db_ok = false;
    try {
      await pool.execute('SELECT 1 AS ok');
      db_ok = true;
    } catch (_dbError) {
      db_ok = false;
    }

    return res.json({
      success: true,
      service: 'turnos',
      status: db_ok ? 'ok' : 'degraded',
      server_time_iso: now.toISOString(),
      db_ok,
      grupos_del_dia: gruposDelDia,
      grupos_en_turno_ahora: onShift,
      endpoints: {
        check_hoy: '/api/check-hoy/:rut',
        estado_turno: '/api/estado-turno/:rut',
        grupos_activos: '/api/turnos/grupos-activos?fecha=YYYY-MM-DD',
        health: '/api/turnos/health'
      }
    });
  } catch (error) {
    console.error('[API] Error en turnos/health:', error.message);
    return res.status(500).json({
      success: false,
      service: 'turnos',
      status: 'error',
      message: 'No se pudo generar diagnostico de turnos'
    });
  }
});

// ============================================
// ENDPOINT COMPAT: ESTADO DE TURNO POR RUT
// Usado por informe.js y datos.js
// ============================================
router.get('/estado-turno/:rut', async (req, res) => {
  try {
    const rut = limpiarRUT(req.params.rut);
    if (!rut) {
      return res.status(400).json({
        success: false,
        estado: 'sin_datos',
        grupo: null,
        mensaje: 'RUT inválido'
      });
    }

    const sql = `
      SELECT t.id_grupo, g.nombre_grupo
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE UPPER(REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', '')) = UPPER(?)
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [rut]);
    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        estado: 'sin_datos',
        grupo: null,
        mensaje: 'Trabajador no encontrado'
      });
    }

    const row = rows[0];
    if (!row.id_grupo) {
      return res.json({
        success: true,
        estado: 'sin_grupo',
        grupo: null,
        mensaje: 'Sin grupo asignado'
      });
    }

    const grupo = String(row.nombre_grupo || row.id_grupo).trim().toUpperCase();
    const onShift = isGrupoOnShift(grupo, new Date());

    return res.json({
      success: true,
      grupo,
      estado: onShift ? 'en_turno' : 'en_descanso',
      mensaje: onShift ? `Turno activo - Grupo ${grupo}` : `Fuera de turno - Grupo ${grupo}`,
      turno_tipo: ['J', 'K'].includes(grupo) ? 'semanal' : 'rotativo',
      dias_restantes: onShift ? 1 : null,
      proxima_jornada: null,
      horario: onShift ? '20:00 a 08:00 / 08:00 a 20:00' : null
    });
  } catch (error) {
    console.error('[API] Error consultando estado-turno:', error.message);
    return res.status(500).json({
      success: false,
      estado: 'sin_datos',
      grupo: null,
      mensaje: 'Error interno consultando estado de turno'
    });
  }
});

// ============================================
// ENDPOINT COMPAT: GRUPOS ACTIVOS POR FECHA
// Usado por informe.js para poblar selector de turno
// ============================================
router.get('/turnos/grupos-activos', async (req, res) => {
  try {
    const fechaRaw = String(req.query.fecha || '').trim();
    if (!fechaRaw) {
      return res.status(400).json({ success: false, error: 'Se requiere fecha (YYYY-MM-DD)' });
    }

    const fecha = new Date(`${fechaRaw}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) {
      return res.status(400).json({ success: false, error: 'Fecha inválida' });
    }

    const gruposDelDia = obtenerGruposDelDia(fecha);
    const grupos = [];

    if (gruposDelDia.pista1) {
      if (gruposDelDia.pista1.manana) grupos.push(gruposDelDia.pista1.manana);
      if (gruposDelDia.pista1.tarde) grupos.push(gruposDelDia.pista1.tarde);
    }

    if (gruposDelDia.pista2) {
      if (gruposDelDia.pista2.manana) grupos.push(gruposDelDia.pista2.manana);
      if (gruposDelDia.pista2.tarde) grupos.push(gruposDelDia.pista2.tarde);
    }

    (gruposDelDia.semanales || []).forEach((g) => grupos.push(g));

    return res.json({
      success: true,
      fecha: fechaRaw,
      grupos: [...new Set(grupos.filter(Boolean))]
    });
  } catch (error) {
    console.error('[API] Error consultando grupos-activos:', error.message);
    return res.status(500).json({ success: false, error: 'Error interno consultando grupos activos' });
  }
});

module.exports = router;
