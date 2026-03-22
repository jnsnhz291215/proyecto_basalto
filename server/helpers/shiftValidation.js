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
   const g = String(idGrupo || '').toUpperCase().trim();
   if (!g) return false;

   const now = fechaParam ? new Date(fechaParam) : new Date();
   const h = now.getHours();
   const m = now.getMinutes();
   const timeValue = h + (m / 60); // Decimal (ej: 8.5 = 08:30)
   
   const gruposHoy = obtenerGruposDelDia(now);
   let isDiaHoy = false;
   let isNocheHoy = false;

   if (gruposHoy.pista1) {
     if (gruposHoy.pista1.manana === g || gruposHoy.pista1.doble === g) isDiaHoy = true;
     if (gruposHoy.pista1.tarde === g) isNocheHoy = true;
   }
   if (gruposHoy.pista2) {
     if (gruposHoy.pista2.manana === g || gruposHoy.pista2.doble === g) isDiaHoy = true;
     if (gruposHoy.pista2.tarde === g) isNocheHoy = true;
   }
   if (gruposHoy.semanales && gruposHoy.semanales.includes(g)) isDiaHoy = true;

   // Escenario Día: Permitir reportes durante luz (ej. desde 07:00 am hasta las 20:30 pm)
   if (isDiaHoy) {
     if (timeValue >= 6.0 && timeValue <= 20.5) return true; 
   }

   // Escenario Noche HOY (inicia típicamente a las 20:00)
   if (isNocheHoy) {
     // Escenario A: Día calendario de su turno, desde 19:00 hrs
     if (timeValue >= 19.0) return true; 
   }

   // Chequear turnos de la NOCHE DE AYER (Escenario traslape madrugada)
   const ayer = new Date(now);
   ayer.setDate(ayer.getDate() - 1);
   const gruposAyer = obtenerGruposDelDia(ayer);
   
   let isNocheAyer = false;
   if (gruposAyer.pista1 && gruposAyer.pista1.tarde === g) isNocheAyer = true;
   if (gruposAyer.pista2 && gruposAyer.pista2.tarde === g) isNocheAyer = true;

   if (isNocheAyer) {
     // Escenario B: Día siguiente a su turno, menos de las 08:30 AM
     if (timeValue <= 8.5) return true;
   }

   return false;
}

/**
 * Checks if a worker is assigned a shift on the current date, algorithmically.
 * 
 * @param {string} worker_rut The exact RUT of the worker
 * @returns {Promise<boolean>} True if worker is on shift today, false otherwise
 */
async function isWorkerOnShiftToday(worker_rut) {
  try {
    // 1. Get the worker's group ID from the database
    const [workerRows] = await pool.execute(
      'SELECT id_grupo FROM trabajadores WHERE RUT = ? LIMIT 1',
      [worker_rut]
    );

    if (!workerRows || workerRows.length === 0) {
      console.warn(`[SHIFT VALIDATION] Worker ${worker_rut} not found.`);
      return false; 
    }

    const idGrupo = workerRows[0].id_grupo;
    if (!idGrupo) {
      console.warn(`[SHIFT VALIDATION] Worker ${worker_rut} has no group assigned.`);
      return false;
    }

    // 2. Check if the group is scheduled for today mathematically
    return isGrupoOnShift(idGrupo, new Date());
  } catch (error) {
    console.error('[SHIFT VALIDATION] Error checking shift:', error);
    return false; // Fail-safe: securely deny access on DB error
  }
}

module.exports = { isWorkerOnShiftToday };
