const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { checkLogisticaCompleta } = require('../helpers/periodHelper.js');

function toISODate(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get('/calendario/mes/:anio/:mes', async (req, res) => {
  let connection;
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);

    if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'Parámetros inválidos. Use /api/calendario/mes/:anio/:mes (mes 1-12).' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT
         it.fecha,
         it.id_grupo,
         g.nombre_grupo,
         it.turno_asignado,
         it.tipo_jornada,
         it.id_periodo_key
       FROM instancias_trabajo it
       INNER JOIN grupos g ON g.id_grupo = it.id_grupo
       WHERE YEAR(it.fecha) = ?
         AND MONTH(it.fecha) = ?
       ORDER BY it.fecha ASC, g.nombre_grupo ASC`,
      [anio, mes]
    );

    const activeRows = rows.filter((r) => String(r.tipo_jornada || '').toUpperCase() === 'TRABAJO');

    const periodKeys = [...new Set(activeRows.map((r) => r.id_periodo_key).filter(Boolean))];
    const semaforoByPeriodo = new Map();

    for (const key of periodKeys) {
      const semaforo = await checkLogisticaCompleta(key, connection);
      semaforoByPeriodo.set(key, semaforo);
    }

    const fechasMap = new Map();

    for (const row of activeRows) {
      const fecha = toISODate(row.fecha);
      if (!fechasMap.has(fecha)) {
        fechasMap.set(fecha, {
          fecha,
          dia: [],
          noche: []
        });
      }

      const semaforo = semaforoByPeriodo.get(row.id_periodo_key) || {};
      const iconos = `${semaforo.ida_completa ? '🛫' : ''}${semaforo.vuelta_completa ? '🛬' : ''}`;
      const item = {
        id_grupo: row.id_grupo,
        grupo: row.nombre_grupo,
        turno: row.turno_asignado,
        id_periodo_key: row.id_periodo_key,
        avion_estado: iconos,
        ida_completa: Boolean(semaforo.ida_completa),
        vuelta_completa: Boolean(semaforo.vuelta_completa)
      };

      if (String(row.turno_asignado || '').toUpperCase() === 'DIA') {
        fechasMap.get(fecha).dia.push(item);
      } else if (String(row.turno_asignado || '').toUpperCase() === 'NOCHE') {
        fechasMap.get(fecha).noche.push(item);
      }
    }

    const fechas = Array.from(fechasMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

    res.json({
      anio,
      mes,
      total_instancias_activas: activeRows.length,
      total_fechas: fechas.length,
      fechas
    });
  } catch (error) {
    console.error('[CALENDAR] Error al construir calendario mensual:', error);
    res.status(500).json({ error: 'Error al obtener calendario mensual' });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/calendario/detalle/:fecha', async (req, res) => {
  let connection;
  try {
    const fecha = String(req.params.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida. Use YYYY-MM-DD.' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT
         t.nombres,
         t.apellido_paterno,
         c.nombre_cargo,
         i.turno_asignado
       FROM trabajadores t
       INNER JOIN cargos c ON t.id_cargo = c.id_cargo
       INNER JOIN instancias_trabajo i ON t.id_grupo = i.id_grupo
       WHERE i.fecha = ? AND i.tipo_jornada = 'TRABAJO'`,
      [fecha]
    );

    if (rows.length === 0) {
      console.log(`[DEBUG] No se encontró personal para la fecha ${fecha} y grupos activos`);
    }

    const dia = [];
    const noche = [];

    for (const row of rows) {
      const nombreCompleto = `${row.nombres || ''} ${row.apellido_paterno || ''}`
        .replace(/\s+/g, ' ')
        .trim();

      const item = {
        nombre_completo: nombreCompleto,
        cargo: row.nombre_cargo || 'Sin cargo',
        turno_asignado: row.turno_asignado
      };

      if (String(row.turno_asignado || '').toUpperCase() === 'DIA') {
        dia.push(item);
      } else if (String(row.turno_asignado || '').toUpperCase() === 'NOCHE') {
        noche.push(item);
      }
    }

    return res.json({
      fecha,
      dia,
      noche,
      total: rows.length
    });
  } catch (error) {
    console.error('[CALENDAR] Error al obtener detalle diario:', error);
    return res.status(500).json({ error: 'Error al obtener detalle diario' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
