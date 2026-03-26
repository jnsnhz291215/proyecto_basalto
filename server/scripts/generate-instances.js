/**
 * generate-instances.js
 * Script de generación de instancias de trabajo para todo 2026.
 *
 * Ejecución: node server/scripts/generate-instances.js
 * (desde la raíz del proyecto proyecto_basalto/)
 *
 * Lee config_turnos_grupos y puebla instancias_trabajo con una fila por día
 * por grupo, identificando si es TRABAJO (días 1-14) o BAJADA (días 15-28),
 * el turno asignado (DIA/NOCHE/N/A) y la clave de periodo único.
 *
 * Formato id_periodo_key: "{id_grupo}-{YYYYMMDD_del_Sabado_de_Inicio}"
 * El ciclo es estrictamente de Sábado a Viernes.
 */

'use strict';

require('dotenv').config();
const { pool } = require('../database.js');
const { obtenerGruposDelDia } = require('../helpers/shiftValidation.js');
const { calcularSabadoInicio, formatPeriodKey } = require('../helpers/periodHelper.js');

const MS_PER_DAY = 86400000;
const RANGE_START = '2026-01-01';
const RANGE_END = '2026-12-31';
const DERIVED_SEED_OFFSETS_FROM_A = {
  A: 0,
  B: 0,
  AB: 0,
  C: -14,
  D: -14,
  CD: -14,
  E: -7,
  F: -7,
  EF: -7,
  G: -21,
  H: -21,
  GH: -21
};

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

function shiftDate(input, days) {
  const d = toMidnight(input);
  return new Date(d.getTime() + (days * MS_PER_DAY));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function fallbackTurnoTrabajo(diasDesdeSemilla) {
  // Cada ciclo de 28 días tiene 1 bloque de TRABAJO. Alternamos DIA/NOCHE por ciclo.
  const cicloTrabajo = Math.floor(diasDesdeSemilla / 28);
  return positiveModulo(cicloTrabajo, 2) === 0 ? 'DIA' : 'NOCHE';
}

function isSemanalWorkday(nombreGrupo, fecha) {
  const grupo = String(nombreGrupo || '').toUpperCase().trim();
  const dow = fecha.getDay(); // 0=Dom, 1=Lun ... 6=Sab

  if (grupo === 'J') return [1, 2, 3, 4].includes(dow);
  if (grupo === 'K') return [2, 3, 4, 5].includes(dow);
  return dow >= 1 && dow <= 5;
}

/**
 * Determina el turno asignado (DIA / NOCHE / N/A) para un grupo en una fecha.
 * Usa el algoritmo de rotación pista existente para grupos rotativos,
 * y reglas fijas para grupos fijo_dia y semanal.
 */
function getTurnoAsignado(nombreGrupo, tipoGrupo, fecha) {
  const grupo = String(nombreGrupo || '').toUpperCase().trim();

  if (tipoGrupo === 'fijo_dia' || tipoGrupo === 'semanal') return 'DIA';

  // Rotativo: consultar algoritmo de pistas
  const gruposDelDia = obtenerGruposDelDia(fecha);

  const esDia =
    gruposDelDia?.pista1?.manana === grupo ||
    gruposDelDia?.pista1?.doble  === grupo ||
    gruposDelDia?.pista2?.manana === grupo ||
    gruposDelDia?.pista2?.doble  === grupo ||
    (Array.isArray(gruposDelDia?.semanales) && gruposDelDia.semanales.includes(grupo));

  const esNoche =
    gruposDelDia?.pista1?.tarde === grupo ||
    gruposDelDia?.pista2?.tarde === grupo;

  if (esDia)   return 'DIA';
  if (esNoche) return 'NOCHE';
  return 'N/A';
}

async function generateInstances(options = {}) {
  const shouldClosePool = options.closePool === true;
  const forceRebuild = options.forceRebuild === true;
  let connection;

  try {
    connection = await pool.getConnection();

    const startDate = toMidnight(RANGE_START);
    const endDate = toMidnight(RANGE_END);

    const [allGroups] = await connection.execute(
      `SELECT id_grupo, nombre_grupo, tipo_grupo
       FROM grupos
       ORDER BY id_grupo ASC`
    );

    // Cargar configuraciones que se cruzan con el rango 2026
    const [configs] = await connection.execute(
      `SELECT ctg.id_config, ctg.id_grupo, ctg.fecha_semilla_inicio,
              ctg.valido_desde, ctg.valido_hasta, ctg.ciclo_dias,
              g.nombre_grupo, g.tipo_grupo
       FROM config_turnos_grupos ctg
       INNER JOIN grupos g ON ctg.id_grupo = g.id_grupo
       WHERE ctg.valido_desde <= ?
         AND (ctg.valido_hasta IS NULL OR ctg.valido_hasta >= ?)
       ORDER BY ctg.id_grupo ASC, ctg.valido_desde ASC`,
      [toSQLDate(endDate), toSQLDate(startDate)]
    );

    if (!configs.length) {
      console.log('[GENERATOR] No hay configuraciones activas. Sin instancias que generar.');
      return;
    }

    const groupsByName = new Map(
      (allGroups || []).map((g) => [String(g.nombre_grupo || '').toUpperCase().trim(), g])
    );

    const groupsMap = new Map();
    for (const cfg of configs) {
      if (!groupsMap.has(cfg.id_grupo)) groupsMap.set(cfg.id_grupo, []);
      groupsMap.get(cfg.id_grupo).push(cfg);
    }

    // Derivar automáticamente grupos rotativos/fijo_dia desde la semilla de A.
    // J/K (tipo semanal) no se derivan: se manejan por lógica semanal independiente.
    const anchorAConfigs = configs.filter(
      (cfg) => String(cfg.nombre_grupo || '').toUpperCase().trim() === 'A'
    );

    if (anchorAConfigs.length) {
      for (const [targetName, offsetDays] of Object.entries(DERIVED_SEED_OFFSETS_FROM_A)) {
        if (targetName === 'A') continue;
        const targetGroup = groupsByName.get(targetName);
        if (!targetGroup) continue;
        if (String(targetGroup.tipo_grupo || '').toLowerCase() === 'semanal') continue;
        if (groupsMap.has(targetGroup.id_grupo)) continue;

        const derivedConfigs = anchorAConfigs.map((cfgA) => ({
          ...cfgA,
          id_grupo: targetGroup.id_grupo,
          nombre_grupo: targetGroup.nombre_grupo,
          tipo_grupo: targetGroup.tipo_grupo,
          fecha_semilla_inicio: shiftDate(cfgA.fecha_semilla_inicio, offsetDays)
        }));

        groupsMap.set(targetGroup.id_grupo, derivedConfigs);
        console.log(
          `[GENERATOR] Config derivada desde A para grupo ${targetGroup.nombre_grupo} (offset ${offsetDays} días).`
        );
      }
    }

    let totalGeneradas = 0;
    let totalActualizadas = 0;

    for (const [id_grupo, groupConfigs] of groupsMap.entries()) {
      const nombre_grupo = groupConfigs[0].nombre_grupo;
      const tipo_grupo = groupConfigs[0].tipo_grupo;

      let diasProcesados = 0;
      let diasGenerados = 0;
      let diasActualizados = 0;
      let current = new Date(startDate);

      while (current <= endDate) {
        const fechaStr = toSQLDate(current);
        diasProcesados++;

        // Resolver la configuración vigente para el día actual
        const cfg = groupConfigs.find((candidate) => {
          const desde = toMidnight(candidate.valido_desde);
          const hasta = candidate.valido_hasta ? toMidnight(candidate.valido_hasta) : null;
          return current >= desde && (!hasta || current <= hasta);
        });

        if (!cfg) {
          current = new Date(current.getTime() + MS_PER_DAY);
          continue;
        }

        const seed = toMidnight(cfg.fecha_semilla_inicio);
        const diasDesdeSemilla = Math.floor((current - seed) / MS_PER_DAY);
        const ciclo28 = positiveModulo(diasDesdeSemilla, 28);
        const dia_n = ciclo28 + 1;
        const diaEnBloque = positiveModulo(diasDesdeSemilla, 14) + 1;

        // Regla base 14x14. Para semanales se sobreescribe por días de semana.
        let tipo_jornada = dia_n <= 14 ? 'TRABAJO' : 'BAJADA';

        // id_periodo_key basado en el Sábado de inicio del bloque de 14 días
        const sabadoInicio   = calcularSabadoInicio(current, seed);
        const id_periodo_key = formatPeriodKey(id_grupo, sabadoInicio);

        let turnoFinal = 'N/A';
        if (String(tipo_grupo || '').toLowerCase() === 'semanal') {
          const workday = isSemanalWorkday(nombre_grupo, current);
          tipo_jornada = workday ? 'TRABAJO' : 'BAJADA';
          turnoFinal = workday ? 'DIA' : 'N/A';
        } else {
          // Turno asignado: se calcula UNA VEZ por periodo usando el primer día del bloque
          // (sabadoInicio), NO el día actual. Esto garantiza que los 14 días de TRABAJO
          // del mismo periodo siempre reciben el mismo turno incluso si el ciclo de pistas
          // de 56 días cambia a mitad del bloque.
          const turno_asignado =
            tipo_jornada === 'BAJADA'
              ? 'N/A'
              : getTurnoAsignado(nombre_grupo, tipo_grupo, sabadoInicio);

          turnoFinal = turno_asignado;
          if (tipo_jornada === 'TRABAJO' && turnoFinal === 'N/A') {
            turnoFinal = fallbackTurnoTrabajo(diasDesdeSemilla);
            console.warn(
              `[GENERATOR] Turno N/A detectado en TRABAJO (${nombre_grupo} ${fechaStr}). ` +
              `Aplicando fallback=${turnoFinal}. Revise fecha_semilla_inicio en config_turnos_grupos.`
            );
          }
        }

        // Log diagnóstico al primer día de cada periodo de TRABAJO
        if (tipo_jornada === 'TRABAJO' && diaEnBloque === 1 && String(tipo_grupo || '').toLowerCase() !== 'semanal') {
          console.log(
            `[GENERATOR] Grupo ${nombre_grupo} | Periodo ${id_periodo_key} | Turno: ${turnoFinal}`
          );
        }

        // Insertar o reconciliar la instancia para (fecha, id_grupo)
        const [existing] = await connection.execute(
          `SELECT id_instancia, id_config, id_periodo_key, tipo_jornada, turno_asignado, dia_n
           FROM instancias_trabajo
           WHERE fecha = ? AND id_grupo = ? LIMIT 1`,
          [fechaStr, id_grupo]
        );

        if (!existing.length) {
          await connection.execute(
            `INSERT INTO instancias_trabajo
               (fecha, id_grupo, id_config, id_periodo_key, tipo_jornada, turno_asignado, dia_n)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fechaStr, id_grupo, cfg.id_config, id_periodo_key, tipo_jornada, turnoFinal, dia_n]
          );
          diasGenerados++;
        } else {
          const currentRow = existing[0];
          const changed =
            Number(currentRow.id_config) !== Number(cfg.id_config)
            || String(currentRow.id_periodo_key || '') !== String(id_periodo_key)
            || String(currentRow.tipo_jornada || '') !== String(tipo_jornada)
            || String(currentRow.turno_asignado || '') !== String(turnoFinal)
            || Number(currentRow.dia_n) !== Number(dia_n);

          if (forceRebuild || changed) {
            await connection.execute(
              `UPDATE instancias_trabajo
               SET id_config = ?, id_periodo_key = ?, tipo_jornada = ?, turno_asignado = ?, dia_n = ?
               WHERE id_instancia = ?`,
              [cfg.id_config, id_periodo_key, tipo_jornada, turnoFinal, dia_n, currentRow.id_instancia]
            );
            diasActualizados++;
          }
        }

        current = new Date(current.getTime() + MS_PER_DAY);
      }

      console.log(
        `[GENERATOR] ${diasProcesados} días generados para el Grupo ${id_grupo}. ` +
        `(insertados: ${diasGenerados}, actualizados: ${diasActualizados})`
      );
      totalGeneradas += diasGenerados;
      totalActualizadas += diasActualizados;
    }

    console.log(
      `[GENERATOR] Proceso completado. Total nuevas: ${totalGeneradas}. ` +
      `Total actualizadas: ${totalActualizadas}.`
    );
    console.log('[SUCCESS] 2026 poblado y calendario alineado');

  } catch (err) {
    console.error('[GENERATOR] Error durante la generación de instancias:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    if (shouldClosePool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  generateInstances({ closePool: true });
}

module.exports = {
  generateInstances
};
