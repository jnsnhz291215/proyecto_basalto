/**
 * periodHelper.js
 * Motor de cálculo de periodos 14x14 basado en config_turnos_grupos.
 *
 * Formato de id_periodo_key: "{id_grupo}-{YYYYMMDD_del_Sabado_de_Inicio}"
 * Ej: "1-20260321" → Grupo id=1, periodo que inicia el Sábado 21-Mar-2026.
 *
 * Ciclo: siempre de Sábado a Viernes (14 días por bloque).
 * Días 1-14 del ciclo de 28 = TRABAJO
 * Días 15-28 del ciclo de 28 = BAJADA
 */

'use strict';

const MS_PER_DAY = 86400000;

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

function toMidnight(input) {
  const d = input instanceof Date ? new Date(input) : new Date(`${input}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toSQLDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatPeriodKey(id_grupo, sabadoInicio) {
  const y = sabadoInicio.getFullYear();
  const m = String(sabadoInicio.getMonth() + 1).padStart(2, '0');
  const d = String(sabadoInicio.getDate()).padStart(2, '0');
  return `${id_grupo}-${y}${m}${d}`;
}

/**
 * Calcula el Sábado de inicio del bloque de 14 días al que pertenece la fecha,
 * tomando como referencia la fecha semilla de la configuración.
 *
 * @param {string|Date} fechaTarget   - Fecha a evaluar
 * @param {string|Date} fechaSemilla  - fecha_semilla_inicio de config_turnos_grupos
 * @returns {Date|null} El Sábado de inicio del periodo, o null si es anterior a la semilla.
 */
function calcularSabadoInicio(fechaTarget, fechaSemilla) {
  const target = toMidnight(fechaTarget);
  const seed   = toMidnight(fechaSemilla);

  const diasDesdeSemilla = Math.floor((target - seed) / MS_PER_DAY);
  const bloque14 = Math.floor(diasDesdeSemilla / 14);
  return new Date(seed.getTime() + bloque14 * 14 * MS_PER_DAY);
}

/**
 * Carga la configuración vigente para un grupo en una fecha dada.
 * Acepta tanto pool como connection (ambos exponen .execute()).
 */
async function loadConfig(db, id_grupo, fechaStr) {
  const [rows] = await db.execute(
    `SELECT id_config, id_grupo, fecha_semilla_inicio, ciclo_dias
     FROM config_turnos_grupos
     WHERE id_grupo = ?
       AND valido_desde <= ?
       AND (valido_hasta IS NULL OR valido_hasta >= ?)
     ORDER BY valido_desde DESC
     LIMIT 1`,
    [id_grupo, fechaStr, fechaStr]
  );
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado cualquier fecha e id_grupo (int), retorna la id_periodo_key a la que
 * pertenece esa fecha, basándose en el Sábado de inicio del bloque de 14 días.
 *
 * @param {string}      fecha     - Fecha en formato "YYYY-MM-DD"
 * @param {number}      id_grupo  - PK del grupo en config_turnos_grupos
 * @param {object}      db        - Pool o Connection de mysql2/promise
 * @returns {Promise<string|null>}
 */
async function obtenerPeriodoPorFecha(fecha, id_grupo, db) {
  const config = await loadConfig(db, id_grupo, fecha);
  if (!config) return null;

  const sabado = calcularSabadoInicio(fecha, config.fecha_semilla_inicio);
  if (!sabado) return null;

  return formatPeriodKey(id_grupo, sabado);
}

/**
 * Retorna las fechas sugeridas de IDA y VUELTA para un grupo dado,
 * tomando como referencia la fecha actual o una fecha explícita.
 *
 * IDA     → Sábado de inicio del periodo actual
 * VUELTA  → Viernes de término (Sábado + 13 días)
 *
 * @param {number} id_grupo
 * @param {object} db
 * @param {string|null} fechaRef  - Fecha de referencia "YYYY-MM-DD" (default: hoy)
 * @returns {Promise<{id_periodo_key, fecha_ida_sugerida, fecha_vuelta_sugerida}|null>}
 */
async function obtenerFechasSugeridas(id_grupo, db, fechaRef = null) {
  const ref = fechaRef || toSQLDate(new Date());
  const config = await loadConfig(db, id_grupo, ref);
  if (!config) return null;

  const sabado = calcularSabadoInicio(ref, config.fecha_semilla_inicio);
  if (!sabado) return null;

  const viernes = new Date(sabado.getTime() + 13 * MS_PER_DAY);
  const key     = formatPeriodKey(id_grupo, sabado);

  return {
    id_periodo_key:       key,
    fecha_ida_sugerida:   toSQLDate(sabado),
    fecha_vuelta_sugerida: toSQLDate(viernes)
  };
}

/**
 * Semáforo de logística: indica si el periodo tiene tramos de IDA y VUELTA
 * completos para todos los trabajadores activos del grupo.
 *
 * Criterio:
 *   - IDA    = tramos con fecha_salida == Sábado de inicio del periodo
 *   - VUELTA = tramos con fecha_salida == Viernes de término del periodo
 *   - "Completo" = cantidad de trabajadores únicos con tramo >= total activos del grupo
 *
 * @param {string} id_periodo_key  - Ej: "1-20260321"
 * @param {object} db              - Pool o Connection
 * @returns {Promise<{ida_completa, vuelta_completa, total_trabajadores, ida_count, vuelta_count, fecha_ida, fecha_vuelta}>}
 */
async function checkLogisticaCompleta(id_periodo_key, db) {
  const dashIdx = id_periodo_key.indexOf('-');
  if (dashIdx < 0) {
    return { ida_completa: false, vuelta_completa: false, error: 'Clave de periodo inválida' };
  }

  const idGrupoStr = id_periodo_key.slice(0, dashIdx);
  const fechaStr   = id_periodo_key.slice(dashIdx + 1); // YYYYMMDD
  const id_grupo   = parseInt(idGrupoStr, 10);

  if (isNaN(id_grupo) || fechaStr.length !== 8) {
    return { ida_completa: false, vuelta_completa: false, error: 'Formato de clave inválido' };
  }

  const sabadoStr = `${fechaStr.slice(0, 4)}-${fechaStr.slice(4, 6)}-${fechaStr.slice(6, 8)}`;
  const sabado    = toMidnight(sabadoStr);
  const viernes   = new Date(sabado.getTime() + 13 * MS_PER_DAY);
  const viernesStr = toSQLDate(viernes);

  // Total de trabajadores activos en el grupo
  const [workersRow] = await db.execute(
    `SELECT COUNT(DISTINCT RUT) AS total
     FROM trabajadores
     WHERE id_grupo = ? AND activo = 1`,
    [id_grupo]
  );
  const totalWorkers = Number(workersRow[0]?.total || 0);

  if (totalWorkers === 0) {
    return {
      ida_completa: false,
      vuelta_completa: false,
      total_trabajadores: 0,
      ida_count: 0,
      vuelta_count: 0,
      fecha_ida: sabadoStr,
      fecha_vuelta: viernesStr,
      id_periodo_key
    };
  }

  // Trabajadores únicos con tramo de IDA (viajan el Sábado de inicio)
  const [idaRow] = await db.execute(
    `SELECT COUNT(DISTINCT v.rut_trabajador) AS total
     FROM viajes_tramos vt
     INNER JOIN viajes v ON vt.id_viaje = v.id_viaje
     WHERE vt.id_periodo_vinculo = ? AND vt.fecha_salida = ?`,
    [id_periodo_key, sabadoStr]
  );

  // Trabajadores únicos con tramo de VUELTA (viajan el Viernes de término)
  const [vueltaRow] = await db.execute(
    `SELECT COUNT(DISTINCT v.rut_trabajador) AS total
     FROM viajes_tramos vt
     INNER JOIN viajes v ON vt.id_viaje = v.id_viaje
     WHERE vt.id_periodo_vinculo = ? AND vt.fecha_salida = ?`,
    [id_periodo_key, viernesStr]
  );

  const idaCount    = Number(idaRow[0]?.total || 0);
  const vueltaCount = Number(vueltaRow[0]?.total || 0);

  return {
    ida_completa:       idaCount    >= totalWorkers,
    vuelta_completa:    vueltaCount >= totalWorkers,
    total_trabajadores: totalWorkers,
    ida_count:          idaCount,
    vuelta_count:       vueltaCount,
    fecha_ida:          sabadoStr,
    fecha_vuelta:       viernesStr,
    id_periodo_key
  };
}

module.exports = {
  obtenerPeriodoPorFecha,
  obtenerFechasSugeridas,
  checkLogisticaCompleta,
  // Exportada también para uso en generate-instances.js
  calcularSabadoInicio,
  formatPeriodKey
};
