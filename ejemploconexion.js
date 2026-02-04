const mysql = require('mysql2/promise');

// Pool de conexión a MariaDB (configurable mediante variables de entorno)
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
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
    const [rows] = await connection.query('SELECT * FROM trabajadoresTest');
    return rows;
  } finally {
    connection.release();
  }
}

// Función para agregar trabajador (incluye cargo)
async function agregarTrabajador(nombres, apellidos, rut, email, telefono, grupo, cargo = null) {
  const connection = await pool.getConnection();
  try {
    const result = await connection.query(
      'INSERT INTO trabajadoresTest (nombres, apellidos, RUT, email, telefono, grupo, cargo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombres, apellidos, rut, email, telefono, grupo, cargo]
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
    const result = await connection.query(
      'DELETE FROM trabajadoresTest WHERE RUT = ?',
      [rut]
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
  eliminarTrabajador
};
