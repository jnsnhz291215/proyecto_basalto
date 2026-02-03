const mysql = require('mysql2/promise');

// Pool de conexión a MariaDB
const pool = mysql.createPool({
  host: 'mariadb',
  user: 'turnos_app',
  password: 'Basalto1974',
  database: 'basalto',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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

// Función para agregar trabajador
async function agregarTrabajador(nombres, apellidos, rut, email, telefono, grupo) {
  const connection = await pool.getConnection();
  try {
    const result = await connection.query(
      'INSERT INTO trabajadoresTest (nombres, apellidos, RUT, email, telefono, grupo) VALUES (?, ?, ?, ?, ?, ?)',
      [nombres, apellidos, rut, email, telefono, grupo]
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
