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
async function obtenerTrabajadores(incluirInactivos = false) {
  const connection = await pool.getConnection();
  try {
    let query = `
      SELECT 
        t.RUT, t.nombres, t.apellido_paterno, t.apellido_materno, t.email, t.telefono,
        t.id_grupo, g.nombre_grupo, t.cargo, c.id_cargo, t.activo, t.fecha_nacimiento, t.ciudad
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      LEFT JOIN cargos c ON t.cargo = c.nombre_cargo
    `;
    if (!incluirInactivos) {
      query += ' WHERE t.activo = 1';
    }
    const [rows] = await connection.execute(query);
    return rows.map(r => {
      const grupoNormalizado = r.nombre_grupo ? String(r.nombre_grupo).trim() : (r.id_grupo ? String(r.id_grupo).trim() : '');

      return {
      RUT: r.RUT,
      nombres: r.nombres,
      apellido_paterno: r.apellido_paterno,
      apellido_materno: r.apellido_materno,
      apellidos: ((r.apellido_paterno || '') + ' ' + (r.apellido_materno || '')).trim(),
      email: r.email,
      telefono: r.telefono,
      id_grupo: r.id_grupo || null,
      grupo: grupoNormalizado,
      cargo: r.cargo,
      id_cargo: r.id_cargo || null,
      activo: r.activo === 1 || r.activo === true,
      fecha_nacimiento: r.fecha_nacimiento || null,
      ciudad: r.ciudad || null
    };
    });
  } finally {
    connection.release();
  }
}

// Función para agregar trabajador (incluye cargo)
async function agregarTrabajador(nombres, apellido_paterno, apellido_materno, rut, email, telefono, id_grupo, cargo = null, ciudad = null, fecha_nacimiento = null) {
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
    const ciudadNorm = ciudad ? titleCase(ciudad) : null;

    const [result] = await connection.execute(
      'INSERT INTO trabajadores (nombres, apellido_paterno, apellido_materno, RUT, email, telefono, id_grupo, cargo, ciudad, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, rut, email, telefono, id_grupo, cargoNorm, ciudadNorm, fecha_nacimiento]
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
    const [rows] = await connection.execute('SELECT COUNT(*) AS c FROM trabajadores WHERE RUT = ?', [rut]);
    const count = rows && rows[0] && (rows[0].c || rows[0].C || rows[0]['COUNT(*)']) ? (rows[0].c || rows[0].C || rows[0]['COUNT(*)']) : 0;
    if (parseInt(count, 10) === 0) {
      const err = new Error('RUT not found');
      err.code = 'RUT_NOT_FOUND';
      throw err;
    }

    const [result] = await connection.execute(
      'DELETE FROM trabajadores WHERE RUT = ?',
      [rut]
    );
    return result;
  } finally {
    connection.release();
  }
}

// Función para editar trabajador
async function editarTrabajador(rut, nombres, apellido_paterno, apellido_materno, email, telefono, id_grupo, cargo = null, ciudad = null, fecha_nacimiento = null) {
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
    const ciudadNorm = ciudad ? titleCase(ciudad) : null;

    // Verificar existencia
    const [checkRows] = await connection.execute('SELECT COUNT(*) AS c FROM trabajadores WHERE RUT = ?', [rut]);
    const count = checkRows && checkRows[0] && (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) ? (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) : 0;
    if (parseInt(count, 10) === 0) {
      const err = new Error('RUT not found');
      err.code = 'RUT_NOT_FOUND';
      throw err;
    }

    const [result] = await connection.execute(
      'UPDATE trabajadores SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, telefono = ?, id_grupo = ?, cargo = ?, ciudad = ?, fecha_nacimiento = ? WHERE RUT = ?',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, email, telefono, id_grupo, cargoNorm, ciudadNorm, fecha_nacimiento, rut]
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
