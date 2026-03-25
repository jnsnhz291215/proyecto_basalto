require('dotenv').config();
const mysql = require('mysql2/promise');

function readEnvValue(name) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return '';
  // Permite valores copiados como [valor] en .env
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

// Pool de conexión a MariaDB (sin credenciales hardcodeadas)
const DB_HOST = readEnvValue('DB_HOST');
const DB_USER = readEnvValue('DB_USER');
const DB_PASSWORD = readEnvValue('DB_PASS') || readEnvValue('DB_PASSWORD');
const DB_NAME = readEnvValue('DB_NAME');
const DB_PORT = Number.parseInt(readEnvValue('DB_PORT') || '3306', 10);

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.warn('[DB] Faltan variables requeridas en .env (DB_HOST, DB_USER, DB_NAME).');
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: Number.isFinite(DB_PORT) ? DB_PORT : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log(`[DB] Pool de conexión creado para host=${DB_HOST || 'N/D'} db=${DB_NAME || 'N/D'} port=${Number.isFinite(DB_PORT) ? DB_PORT : 3306}`);

(async () => {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('DB OK:', rows);
  } catch (e) {
    console.error('DB FAIL:', e);
  }
})();

function titleCase(value) {
  if (!value && value !== '') return value;
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeCargoName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function resolveCiudadId(connection, ciudadInput) {
  const rawValue = String(ciudadInput || '').trim();
  if (!rawValue) return 1;

  const numericId = Number.parseInt(rawValue, 10);
  if (Number.isInteger(numericId)) {
    const [rows] = await connection.execute(
      'SELECT id_ciudad FROM ciudades WHERE id_ciudad = ? LIMIT 1',
      [numericId]
    );
    return rows && rows[0] ? Number(rows[0].id_ciudad) : null;
  }

  const [rows] = await connection.execute(
    'SELECT id_ciudad, nombre_ciudad FROM ciudades ORDER BY nombre_ciudad ASC'
  );
  const normalizedInput = String(rawValue).trim().toLowerCase();
  const ciudadMatch = (rows || []).find((row) => String(row.nombre_ciudad || '').trim().toLowerCase() === normalizedInput);
  return ciudadMatch ? Number(ciudadMatch.id_ciudad) : null;
}

async function resolveCargoId(connection, cargoInput) {
  const rawValue = String(cargoInput || '').trim();
  if (!rawValue) return null;

  const numericId = Number.parseInt(rawValue, 10);
  if (Number.isInteger(numericId)) {
    const [rows] = await connection.execute(
      'SELECT id_cargo FROM cargos WHERE id_cargo = ? LIMIT 1',
      [numericId]
    );
    return rows && rows[0] ? Number(rows[0].id_cargo) : null;
  }

  const [rows] = await connection.execute(
    'SELECT id_cargo, nombre_cargo FROM cargos ORDER BY nombre_cargo ASC'
  );
  const normalizedInput = normalizeCargoName(rawValue);
  const cargoMatch = (rows || []).find((row) => normalizeCargoName(row.nombre_cargo) === normalizedInput);
  return cargoMatch ? Number(cargoMatch.id_cargo) : null;
}

// Función para obtener todos los trabajadores
async function obtenerTrabajadores(incluirInactivos = false) {
  const connection = await pool.getConnection();
  try {
    let query = `
      SELECT 
        t.RUT, t.nombres, t.apellido_paterno, t.apellido_materno, t.email, t.telefono,
        t.id_grupo, g.nombre_grupo, t.id_cargo, c.nombre_cargo AS cargo, t.activo, t.fecha_nacimiento,
        t.id_ciudad, ci.nombre_ciudad AS ciudad
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      LEFT JOIN cargos c ON t.id_cargo = c.id_cargo
      LEFT JOIN ciudades ci ON t.id_ciudad = ci.id_ciudad
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
      id_ciudad: r.id_ciudad || null,
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
    const nombresNorm = titleCase(nombres);
    const apellidoPaternoNorm = titleCase(apellido_paterno);
    const apellidoMaternoNorm = titleCase(apellido_materno);
    const cargoId = await resolveCargoId(connection, cargo);
    const ciudadId = await resolveCiudadId(connection, ciudad);

    if (cargo && !cargoId) {
      const err = new Error('INVALID_CARGO');
      err.code = 'INVALID_CARGO';
      throw err;
    }

    if (ciudad && !ciudadId) {
      const err = new Error('INVALID_CITY');
      err.code = 'INVALID_CITY';
      throw err;
    }

    const [result] = await connection.execute(
      'INSERT INTO trabajadores (nombres, apellido_paterno, apellido_materno, RUT, email, telefono, id_grupo, id_cargo, id_ciudad, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, rut, email, telefono, id_grupo, cargoId, ciudadId || 1, fecha_nacimiento]
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
    const nombresNorm = titleCase(nombres);
    const apellidoPaternoNorm = titleCase(apellido_paterno);
    const apellidoMaternoNorm = titleCase(apellido_materno);
    const cargoId = await resolveCargoId(connection, cargo);
    const ciudadId = await resolveCiudadId(connection, ciudad);

    if (cargo && !cargoId) {
      const err = new Error('INVALID_CARGO');
      err.code = 'INVALID_CARGO';
      throw err;
    }

    if (ciudad && !ciudadId) {
      const err = new Error('INVALID_CITY');
      err.code = 'INVALID_CITY';
      throw err;
    }

    // Verificar existencia
    const [checkRows] = await connection.execute('SELECT COUNT(*) AS c FROM trabajadores WHERE RUT = ?', [rut]);
    const count = checkRows && checkRows[0] && (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) ? (checkRows[0].c || checkRows[0].C || checkRows[0]['COUNT(*)']) : 0;
    if (parseInt(count, 10) === 0) {
      const err = new Error('RUT not found');
      err.code = 'RUT_NOT_FOUND';
      throw err;
    }

    const [result] = await connection.execute(
      'UPDATE trabajadores SET nombres = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, telefono = ?, id_grupo = ?, id_cargo = ?, id_ciudad = ?, fecha_nacimiento = ? WHERE RUT = ?',
      [nombresNorm, apellidoPaternoNorm, apellidoMaternoNorm, email, telefono, id_grupo, cargoId, ciudadId || 1, fecha_nacimiento, rut]
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
  editarTrabajador,
  resolveCargoId,
  resolveCiudadId
};
