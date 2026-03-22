const path = require('path');
const { pool } = require(path.join(__dirname, '../../ejemploconexion.js'));

/**
 * Checks if a worker is assigned a shift on the current date.
 * Relies on the `calendario_turnos` table matching `CURRENT_DATE`.
 * 
 * @param {string} worker_rut The exact RUT of the worker
 * @returns {Promise<boolean>} True if worker is on shift today, false otherwise
 */
async function isWorkerOnShiftToday(worker_rut) {
  try {
    // 1. Get the worker's group ID
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

    // 2. Check if the group is scheduled for today
    const [shiftRows] = await pool.execute(
      'SELECT id_turno FROM calendario_turnos WHERE id_grupo = ? AND fecha = CURRENT_DATE LIMIT 1',
      [idGrupo]
    );

    return shiftRows && shiftRows.length > 0;
  } catch (error) {
    console.error('[SHIFT VALIDATION] Error checking shift:', error);
    return false; // Fail-safe: securely deny access on DB error
  }
}

module.exports = { isWorkerOnShiftToday };
