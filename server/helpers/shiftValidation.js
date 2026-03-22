const path = require('path');
const { pool } = require(path.join(__dirname, '../../ejemploconexion.js'));

// ============================================
// ALGORITMO MAESTRO DE TURNOS (Fórmula Compartida Backend)
// ============================================
const INICIO_CD = new Date(2026, 1, 21); // 21 de febrero 2026 (Pista 1: C-D)
INICIO_CD.setHours(0, 0, 0, 0);

const INICIO_EFGH = new Date(2026, 1, 14); // 14 de febrero 2026 (Pista 2: G-H, 7 días antes)
INICIO_EFGH.setHours(0, 0, 0, 0);

const MS_PER_DAY = 86400000;
const DIAS_POR_BLOQUE = 14;
const CICLO_COMPLETO = DIAS_POR_BLOQUE * 4;
const HORA_INICIO_DIA = 8 * 60;
const HORA_FIN_DIA = 20 * 60;
const HORA_INICIO_NOCHE = 20 * 60;
const HORA_FIN_NOCHE = 8 * 60;
const VENTANA_PREVIA_DIA = 2 * 60;
const VENTANA_PREVIA_NOCHE = 60;
const VENTANA_GRACIA_MINUTOS = 30;

function minutosDelDia(fecha) {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function sumarMinutos(fecha, minutos) {
  return new Date(fecha.getTime() + (minutos * 60 * 1000));
}

function inicioDelDia(fecha) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function segundosRestantes(hasta, ahora) {
  return Math.max(0, Math.ceil((hasta.getTime() - ahora.getTime()) / 1000));
}

function isGrupoEnTurnoDiurno(grupo, gruposDelDia) {
  if (!grupo || !gruposDelDia) return false;
  return Boolean(
    (gruposDelDia.pista1 && (gruposDelDia.pista1.manana === grupo || gruposDelDia.pista1.doble === grupo))
    || (gruposDelDia.pista2 && (gruposDelDia.pista2.manana === grupo || gruposDelDia.pista2.doble === grupo))
    || (Array.isArray(gruposDelDia.semanales) && gruposDelDia.semanales.includes(grupo))
  );
}

function isGrupoEnTurnoNocturno(grupo, gruposDelDia) {
  if (!grupo || !gruposDelDia) return false;
  return Boolean(
    (gruposDelDia.pista1 && gruposDelDia.pista1.tarde === grupo)
    || (gruposDelDia.pista2 && gruposDelDia.pista2.tarde === grupo)
  );
}

// Devuelve { pista1: {manana, tarde, doble}, pista2: {manana, tarde, doble}, semanales }
function obtenerGruposDelDia(fecha) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  // ===== PISTA 1: A-B-C-D + grupos dobles AB, CD =====
  const diasCD = Math.floor((fechaCopy - INICIO_CD) / MS_PER_DAY);
  const cicloCD = ((diasCD % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let pista1 = null;
  
  if (cicloCD >= 0 && cicloCD < 14) {
    pista1 = { manana: 'C', tarde: 'D', doble: 'CD' };
  } else if (cicloCD >= 14 && cicloCD < 28) {
    pista1 = { manana: 'A', tarde: 'B', doble: 'AB' };
  } else if (cicloCD >= 28 && cicloCD < 42) {
    pista1 = { manana: 'D', tarde: 'C', doble: 'CD' };
  } else if (cicloCD >= 42 && cicloCD < 56) {
    pista1 = { manana: 'B', tarde: 'A', doble: 'AB' };
  }
  
  // ===== PISTA 2: E-F-G-H + grupos dobles EF, GH =====
  const diasEFGH = Math.floor((fechaCopy - INICIO_EFGH) / MS_PER_DAY);
  const cicloEFGH = ((diasEFGH % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let pista2 = null;
  
  if (cicloEFGH >= 0 && cicloEFGH < 14) {
    pista2 = { manana: 'G', tarde: 'H', doble: 'GH' };
  } else if (cicloEFGH >= 14 && cicloEFGH < 28) {
    pista2 = { manana: 'E', tarde: 'F', doble: 'EF' };
  } else if (cicloEFGH >= 28 && cicloEFGH < 42) {
    pista2 = { manana: 'H', tarde: 'G', doble: 'GH' };
  } else if (cicloEFGH >= 42 && cicloEFGH < 56) {
    pista2 = { manana: 'F', tarde: 'E', doble: 'EF' };
  }
  
  // ===== GRUPOS SEMANALES J, K =====
  const semanales = [];
  const dia = fechaCopy.getDay(); // 0=Dom, 1=Lun...
  if ([1, 2, 3, 4].includes(dia)) semanales.push('J');
  if ([2, 3, 4, 5].includes(dia)) semanales.push('K');
  
  return { pista1, pista2, semanales };
}

// Comprueba si un grupo está de turno, contemplando ventanas de horas (gracia)
function isGrupoOnShift(idGrupo, fechaParam) {
   const estado = getGrupoShiftStatus(idGrupo, fechaParam);
   return estado.exactActive || estado.inGrace || estado.estado === 'proximo_turno';
}

function getGrupoShiftStatus(idGrupo, fechaParam) {
  const grupo = String(idGrupo || '').toUpperCase().trim();
  const now = fechaParam ? new Date(fechaParam) : new Date();

  if (!grupo) {
    return {
      grupo: null,
      estado: 'sin_grupo',
      exactActive: false,
      inGrace: false,
      secondsRemaining: 0,
      shiftEndsAt: null,
      graceEndsAt: null,
      mensaje: 'Sin grupo asignado'
    };
  }

  const hoy = inicioDelDia(now);
  const ayer = sumarMinutos(hoy, -1440);
  const gruposHoy = obtenerGruposDelDia(now);
  const gruposAyer = obtenerGruposDelDia(ayer);
  const minutosAhora = minutosDelDia(now);
  const esDiurnoHoy = isGrupoEnTurnoDiurno(grupo, gruposHoy);
  const esNocturnoHoy = isGrupoEnTurnoNocturno(grupo, gruposHoy);
  const esNocturnoAyer = isGrupoEnTurnoNocturno(grupo, gruposAyer);
  const finTurnoDia = sumarMinutos(hoy, HORA_FIN_DIA);
  const finGraciaDia = sumarMinutos(finTurnoDia, VENTANA_GRACIA_MINUTOS);
  const inicioTurnoNocheHoy = sumarMinutos(hoy, HORA_INICIO_NOCHE);
  const inicioPreviaNocheHoy = sumarMinutos(inicioTurnoNocheHoy, -VENTANA_PREVIA_NOCHE);
  const finTurnoNoche = sumarMinutos(hoy, HORA_FIN_NOCHE);
  const finGraciaNoche = sumarMinutos(finTurnoNoche, VENTANA_GRACIA_MINUTOS);

  if (esDiurnoHoy && minutosAhora >= HORA_INICIO_DIA && minutosAhora < HORA_FIN_DIA) {
    return {
      grupo,
      estado: 'en_turno',
      exactActive: true,
      inGrace: false,
      secondsRemaining: segundosRestantes(finTurnoDia, now),
      shiftEndsAt: finTurnoDia.toISOString(),
      graceEndsAt: finGraciaDia.toISOString(),
      mensaje: `Turno activo - Grupo ${grupo}`
    };
  }

  if (esDiurnoHoy && minutosAhora >= HORA_FIN_DIA && minutosAhora < (HORA_FIN_DIA + VENTANA_GRACIA_MINUTOS)) {
    return {
      grupo,
      estado: 'en_gracia',
      exactActive: false,
      inGrace: true,
      secondsRemaining: segundosRestantes(finGraciaDia, now),
      shiftEndsAt: finTurnoDia.toISOString(),
      graceEndsAt: finGraciaDia.toISOString(),
      mensaje: `Ventana de gracia - Grupo ${grupo}`
    };
  }

  if (esNocturnoHoy && minutosAhora >= HORA_INICIO_NOCHE) {
    const finTurnoNocheManana = sumarMinutos(finTurnoNoche, 1440);
    const finGraciaNocheManana = sumarMinutos(finGraciaNoche, 1440);
    return {
      grupo,
      estado: 'en_turno',
      exactActive: true,
      inGrace: false,
      secondsRemaining: segundosRestantes(finTurnoNocheManana, now),
      shiftEndsAt: finTurnoNocheManana.toISOString(),
      graceEndsAt: finGraciaNocheManana.toISOString(),
      mensaje: `Turno activo - Grupo ${grupo}`
    };
  }

  if (esNocturnoAyer && minutosAhora < HORA_FIN_NOCHE) {
    return {
      grupo,
      estado: 'en_turno',
      exactActive: true,
      inGrace: false,
      secondsRemaining: segundosRestantes(finTurnoNoche, now),
      shiftEndsAt: finTurnoNoche.toISOString(),
      graceEndsAt: finGraciaNoche.toISOString(),
      mensaje: `Turno activo - Grupo ${grupo}`
    };
  }

  if (esNocturnoAyer && minutosAhora >= HORA_FIN_NOCHE && minutosAhora < (HORA_FIN_NOCHE + VENTANA_GRACIA_MINUTOS)) {
    return {
      grupo,
      estado: 'en_gracia',
      exactActive: false,
      inGrace: true,
      secondsRemaining: segundosRestantes(finGraciaNoche, now),
      shiftEndsAt: finTurnoNoche.toISOString(),
      graceEndsAt: finGraciaNoche.toISOString(),
      mensaje: `Ventana de gracia - Grupo ${grupo}`
    };
  }

  if (esDiurnoHoy && minutosAhora >= (HORA_INICIO_DIA - VENTANA_PREVIA_DIA) && minutosAhora < HORA_INICIO_DIA) {
    return {
      grupo,
      estado: 'proximo_turno',
      exactActive: false,
      inGrace: false,
      secondsRemaining: segundosRestantes(sumarMinutos(hoy, HORA_INICIO_DIA), now),
      shiftEndsAt: finTurnoDia.toISOString(),
      graceEndsAt: finGraciaDia.toISOString(),
      mensaje: `Próximo a turno - Grupo ${grupo}`
    };
  }

  if (esNocturnoHoy && now >= inicioPreviaNocheHoy && now < inicioTurnoNocheHoy) {
    const finTurnoNocheManana = sumarMinutos(finTurnoNoche, 1440);
    const finGraciaNocheManana = sumarMinutos(finGraciaNoche, 1440);
    return {
      grupo,
      estado: 'proximo_turno',
      exactActive: false,
      inGrace: false,
      secondsRemaining: segundosRestantes(inicioTurnoNocheHoy, now),
      shiftEndsAt: finTurnoNocheManana.toISOString(),
      graceEndsAt: finGraciaNocheManana.toISOString(),
      mensaje: `Próximo a turno - Grupo ${grupo}`
    };
  }

  return {
    grupo,
    estado: 'en_descanso',
    exactActive: false,
    inGrace: false,
    secondsRemaining: 0,
    shiftEndsAt: null,
    graceEndsAt: null,
    mensaje: `Fuera de turno - Grupo ${grupo}`
  };
}

async function getWorkerShiftStatus(worker_rut, fechaParam) {
  try {
    const [workerRows] = await pool.execute(
      `SELECT t.id_grupo, g.nombre_grupo
       FROM trabajadores t
       LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
       WHERE UPPER(REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE(?, '.', ''), '-', ''), ' ', ''))
       LIMIT 1`,
      [worker_rut]
    );

    if (!workerRows || workerRows.length === 0) {
      return {
        grupo: null,
        estado: 'sin_datos',
        exactActive: false,
        inGrace: false,
        secondsRemaining: 0,
        shiftEndsAt: null,
        graceEndsAt: null,
        mensaje: 'Trabajador no encontrado'
      };
    }

    const idGrupo = workerRows[0].id_grupo;
    if (!idGrupo) {
      return {
        grupo: null,
        estado: 'sin_grupo',
        exactActive: false,
        inGrace: false,
        secondsRemaining: 0,
        shiftEndsAt: null,
        graceEndsAt: null,
        mensaje: 'Sin grupo asignado'
      };
    }

    const nombreGrupo = workerRows[0].nombre_grupo || String(idGrupo);
    return getGrupoShiftStatus(nombreGrupo, fechaParam);
  } catch (error) {
    console.error('[SHIFT VALIDATION] Error checking worker shift status:', error);
    return {
      grupo: null,
      estado: 'sin_datos',
      exactActive: false,
      inGrace: false,
      secondsRemaining: 0,
      shiftEndsAt: null,
      graceEndsAt: null,
      mensaje: 'Error interno verificando el turno'
    };
  }
}

/**
 * Checks if a worker is assigned a shift on the current date, algorithmically.
 * 
 * @param {string} worker_rut The exact RUT of the worker
 * @returns {Promise<boolean>} True if worker is on shift today, false otherwise
 */
async function isWorkerOnShiftToday(worker_rut) {
  try {
    const status = await getWorkerShiftStatus(worker_rut, new Date());
    return status.exactActive || status.inGrace || status.estado === 'proximo_turno';
  } catch (error) {
    console.error('[SHIFT VALIDATION] Error checking shift:', error);
    return false; // Fail-safe: securely deny access on DB error
  }
}

module.exports = {
  getGrupoShiftStatus,
  getWorkerShiftStatus,
  isWorkerOnShiftToday,
  isGrupoOnShift,
  obtenerGruposDelDia
};
