const mysql = require('mysql2/promise');

// Pool de conexión a MariaDB (configurable mediante variables de entorno)
const DB_HOST = process.env.DB_HOST || '100.100.40.80';
const DB_USER = process.env.DB_USER || 'turnos_app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Basalto1974';
const DB_NAME = process.env.DB_NAME || 'basalto';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log(`DB pool: host=${DB_HOST} user=${DB_USER} database=${DB_NAME} port=${DB_PORT}`);

(async () => {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('DB OK:', rows);
  } catch (e) {
    console.error('DB FAIL:', e);
  }
})();

// Función para obtener todos los trabajadores
async function obtenerTrabajadores() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute('SELECT RUT, nombres, apellido_paterno, apellido_materno, email, telefono, id_grupo, cargo FROM trabajadoresTest2');
    const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];
    return rows.map(r => ({
      RUT: r.RUT,
      nombres: r.nombres,
      apellido_paterno: r.apellido_paterno,
      apellido_materno: r.apellido_materno,
      apellidos: ((r.apellido_paterno || '') + ' ' + (r.apellido_materno || '')).trim(),
      email: r.email,
      telefono: r.telefono,
      grupo: (typeof r.id_grupo === 'number' && r.id_grupo >= 1 && r.id_grupo <= GRUPOS.length) ? GRUPOS[r.id_grupo - 1] : (r.id_grupo ? String(r.id_grupo) : ''),
      cargo: r.cargo
    }));
  } finally {
    connection.release();
  }
}

// Función para agregar trabajador (incluye cargo)
async function agregarTrabajador(nombres, apellido_paterno, apellido_materno, rut, email, telefono, id_grupo, cargo = null) {
  const connection = await pool.getConnection();
  try {
    // Normalizar capitalización: primera letra en mayúscula por palabra
    const titleCase = s => {
      if (!s && s !== '') return s;
      return String(s || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const nombresNorm = titleCase(nombres);
    const apellidoPaternoNorm = titleCase(apellido_paterno);
    const apellidoMaternoNorm = titleCase(apellido_materno);
    const cargoNorm = cargo ? titleCase(cargo) : null;

    const [result] = await connection.execute(
      'INSERT INTO trabajadoresTest2 (nombres, apellido_paterno, apellido_materno, RUT, email, telefono, id_grupo, cargo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, rut, email, telefono, id_grupo, cargoNorm]
    );
    return result;
  } finally {
    connection.release();
  }
}

// Función para eliminar trabajador por RUT
async function eliminarTrabajador(rut) {
  const connection = await pool.getConnection();
  try {
    // Verificar existencia
    const [rows] = await connection.execute('SELECT COUNT(*) AS c FROM trabajadoresTest2 WHERE RUT = ?', [rut]);
    const count = rows && rows[0] && (rows[0].c || rows[0].C || rows[0]['COUNT(*)']) ? (rows[0].c || rows[0].C || rows[0]['COUNT(*)']) : 0;
    if (parseInt(count, 10) === 0) {
      const err = new Error('RUT not found');
      err.code = 'RUT_NOT_FOUND';
      throw err;
    }

    const [result] = await connection.execute(
      'DELETE FROM trabajadoresTest2 WHERE RUT = ?',
      [rut]
    );
    return result;
  } finally {
    connection.release();
  }
}

// Función para editar trabajador
async function editarTrabajador(rut, nombres, apellido_paterno, apellido_materno, email, telefono, id_grupo, cargo = null) {
  const connection = await pool.getConnection();
  try {
    // Normalizar capitalización
    const titleCase = s => {
      if (!s && s !== '') return s;
      return String(s || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const nombresNorm = titleCase(nombres);
    const apellidoPaternoNorm = titleCase(apellido_paterno);
    const apellidoMaternoNorm = titleCase(apellido_materno);
    const cargoNorm = cargo ? titleCase(cargo) : null;

    // Verificar existencia
    const [checkRows] = await connection.execute('SELECT COUNT(*) AS c FROM trabajadoresTest2 WHERE RUT = ?', [rut]);
    const count = checkRows && checkRows[0] && (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) ? (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) : 0;
    if (parseInt(count, 10) === 0) {
      const err = new Error('RUT not found');
      err.code = 'RUT_NOT_FOUND';
      throw err;
    }

    const [result] = await connection.execute(
      'UPDATE trabajadoresTest2 SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, telefono = ?, id_grupo = ?, cargo = ? WHERE RUT = ?',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, email, telefono, id_grupo, cargoNorm, rut]
    );
    return result;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  obtenerTrabajadores,
  agregarTrabajador,
  eliminarTrabajador,
  editarTrabajador
};
