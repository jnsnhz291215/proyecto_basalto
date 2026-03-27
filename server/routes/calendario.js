const express = require('express');
const router = express.Router();
const { pool } = require('../database.js');
const { checkLogisticaCompleta } = require('../helpers/periodHelper.js');
const { obtenerGruposDelDia } = require('../helpers/shiftValidation.js');

function toISODate(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveExpectedTurno(fechaISO, nombreGrupo) {
  const grupo = String(nombreGrupo || '').toUpperCase().trim();
  if (!grupo) return null;

  const grupos = obtenerGruposDelDia(new Date(`${fechaISO}T00:00:00`));
  const isDia = Boolean(
    grupos?.pista1?.manana === grupo
    || grupos?.pista1?.doble === grupo
    || grupos?.pista2?.manana === grupo
    || grupos?.pista2?.doble === grupo
    || (Array.isArray(grupos?.semanales) && grupos.semanales.includes(grupo))
  );
  if (isDia) return 'DIA';

  const isNoche = Boolean(
    grupos?.pista1?.tarde === grupo
    || grupos?.pista2?.tarde === grupo
  );
  if (isNoche) return 'NOCHE';

  return null;
}

function getCandidateScore(row, expectedTurno) {
  const turno = String(row.turno_asignado || '').toUpperCase().trim();
  let score = 0;
  if (expectedTurno && turno === expectedTurno) score += 10;
  if (Number.isFinite(Number(row.id_instancia))) score += Number(row.id_instancia) / 1000000;
  return score;
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
         it.id_instancia,
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

    const activeRowsRaw = rows.filter((r) => String(r.tipo_jornada || '').toUpperCase() === 'TRABAJO');

    // Defensa contra duplicados en BD: un solo registro por fecha+grupo+turno.
    const seen = new Set();
    const activeRows = [];
    for (const r of activeRowsRaw) {
      const fechaKey = toISODate(r.fecha);
      const turnoKey = String(r.turno_asignado || '').toUpperCase().trim();
      const uniqueKey = `${fechaKey}|${r.id_grupo}|${turnoKey}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      activeRows.push(r);
    }

    // Resolver conflictos históricos (mismo grupo/fecha con turnos distintos)
    // quedándonos con una sola fila canónica por fecha+nombre_grupo.
    const canonicalByDateGroup = new Map();
    for (const row of activeRows) {
      const fechaISO = toISODate(row.fecha);
      const groupName = String(row.nombre_grupo || '').toUpperCase().trim();
      const mapKey = `${fechaISO}|${groupName}`;
      const expectedTurno = resolveExpectedTurno(fechaISO, groupName);
      const score = getCandidateScore(row, expectedTurno);

      const existing = canonicalByDateGroup.get(mapKey);
      if (!existing || score > existing.score) {
        canonicalByDateGroup.set(mapKey, { row, score });
      }
    }

    const canonicalRows = Array.from(canonicalByDateGroup.values()).map((entry) => entry.row);

    const periodKeys = [...new Set(canonicalRows.map((r) => r.id_periodo_key).filter(Boolean))];
    const semaforoByPeriodo = new Map();

    for (const key of periodKeys) {
      const semaforo = await checkLogisticaCompleta(key, connection);
      semaforoByPeriodo.set(key, semaforo);
    }

    const fechasMap = new Map();

    for (const row of canonicalRows) {
      const fecha = toISODate(row.fecha);
      if (!fechasMap.has(fecha)) {
        fechasMap.set(fecha, {
          fecha,
          dia: [],
          noche: []
        });
      }

      const semaforo = semaforoByPeriodo.get(row.id_periodo_key) || {};
      const esDiaIda = fecha === semaforo.fecha_ida;
      const esDiaVuelta = fecha === semaforo.fecha_vuelta;
      let iconos = '';

      if (esDiaIda) {
        iconos += semaforo.ida_completa ? '🛫' : '🔴';
      }
      if (esDiaVuelta) {
        iconos += semaforo.vuelta_completa ? '🛬' : '🔴';
      }

      const item = {
        id_grupo: row.id_grupo,
        grupo: row.nombre_grupo,
        turno: row.turno_asignado,
        id_periodo_key: row.id_periodo_key,
        avion_estado: iconos,
        ida_completa: Boolean(semaforo.ida_completa),
        vuelta_completa: Boolean(semaforo.vuelta_completa),
        total_trabajadores: Number(semaforo.total_trabajadores || 0),
        ida_count: Number(semaforo.ida_count || 0),
        vuelta_count: Number(semaforo.vuelta_count || 0),
        fecha_ida: semaforo.fecha_ida || null,
        fecha_vuelta: semaforo.fecha_vuelta || null
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
      total_instancias_activas: canonicalRows.length,
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
         t.RUT,
         t.nombres,
         t.apellido_paterno,
         c.nombre_cargo,
         i.turno_asignado,
         g.nombre_grupo
       FROM trabajadores t
       INNER JOIN cargos c ON t.id_cargo = c.id_cargo
       INNER JOIN instancias_trabajo i ON t.id_grupo = i.id_grupo
       INNER JOIN grupos g ON g.id_grupo = t.id_grupo
       WHERE i.fecha = ? AND i.tipo_jornada = 'TRABAJO'`,
      [fecha]
    );

    if (rows.length === 0) {
      console.log(`[DEBUG] No se encontró personal para la fecha ${fecha} y grupos activos`);
    }

    const dia = [];
    const noche = [];
    const seen = new Set();

    for (const row of rows) {
      const nombreCompleto = `${row.nombres || ''} ${row.apellido_paterno || ''}`
        .replace(/\s+/g, ' ')
        .trim();

      const turno = String(row.turno_asignado || '').toUpperCase();
      const groupName = String(row.nombre_grupo || '').toUpperCase().trim();
      const dedupeKey = `${String(row.RUT || '').toUpperCase()}|${turno}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let pista = 'OTROS';
      if (['A', 'B', 'C', 'D', 'AB', 'CD'].includes(groupName)) pista = 'P1';
      else if (['E', 'F', 'G', 'H', 'EF', 'GH'].includes(groupName)) pista = 'P2';
      else if (['J', 'K'].includes(groupName)) pista = 'SEM';

      const item = {
        nombre_completo: nombreCompleto,
        cargo: row.nombre_cargo || 'Sin cargo',
        turno_asignado: turno,
        grupo: groupName,
        pista
      };

      if (turno === 'DIA') {
        dia.push(item);
      } else if (turno === 'NOCHE') {
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
