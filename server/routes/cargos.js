const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion');

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dedupeNumberArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(v => parseInt(v, 10)).filter(Number.isInteger))];
}

function clasificarPermiso(clavePermiso) {
  const slug = toSlug(clavePermiso);
  const gestionKeywords = [
    'admin', 'trabajador', 'trabajadores', 'viaje', 'viajes', 'informe', 'informes',
    'gestion', 'gestionar', 'crear', 'editar', 'borrar', 'eliminar', 'estado', 'cargo', 'cargos'
  ];

  return gestionKeywords.some(key => slug.includes(key)) ? 'gestion' : 'operacion';
}

async function obtenerPermisosPorCargo(connection, idCargo) {
  const sql = `
    SELECT p.id_permiso, p.clave_permiso, p.descripcion
    FROM cargo_permisos cp
    INNER JOIN permisos p ON p.id_permiso = cp.id_permiso
    WHERE cp.id_cargo = ?
    ORDER BY p.clave_permiso ASC
  `;

  const [rows] = await connection.execute(sql, [idCargo]);
  return rows.map((permiso) => ({
    id_permiso: permiso.id_permiso,
    clave_permiso: permiso.clave_permiso,
    descripcion: permiso.descripcion || null,
    slug: toSlug(permiso.clave_permiso),
    categoria: clasificarPermiso(permiso.clave_permiso)
  }));
}

// ============================================
// GET /api/cargos - Lista de cargos con permisos asociados
// ============================================
router.get('/cargos', async (_req, res) => {
  try {
    const [cargosRows] = await pool.execute(
      'SELECT id_cargo, nombre_cargo FROM cargos ORDER BY nombre_cargo ASC'
    );

    const [relacionesRows] = await pool.execute(`
      SELECT c.id_cargo, p.id_permiso, p.clave_permiso, p.descripcion
      FROM cargos c
      LEFT JOIN cargo_permisos cp ON cp.id_cargo = c.id_cargo
      LEFT JOIN permisos p ON p.id_permiso = cp.id_permiso
      ORDER BY c.nombre_cargo ASC, p.clave_permiso ASC
    `);

    const permisosPorCargo = new Map();
    relacionesRows.forEach((row) => {
      if (!row || !row.id_cargo) return;

      if (!permisosPorCargo.has(row.id_cargo)) {
        permisosPorCargo.set(row.id_cargo, []);
      }

      if (row.id_permiso) {
        permisosPorCargo.get(row.id_cargo).push({
          id_permiso: row.id_permiso,
          clave_permiso: row.clave_permiso,
          descripcion: row.descripcion || null,
          slug: toSlug(row.clave_permiso),
          categoria: clasificarPermiso(row.clave_permiso)
        });
      }
    });

    const data = cargosRows.map((cargo) => ({
      id_cargo: cargo.id_cargo,
      nombre_cargo: cargo.nombre_cargo,
      permisos: permisosPorCargo.get(cargo.id_cargo) || [],
      id_permisos: (permisosPorCargo.get(cargo.id_cargo) || []).map((p) => p.id_permiso)
    }));

    res.json(data);
  } catch (error) {
    console.error('[CARGOS] Error en GET /api/cargos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener cargos' });
  }
});

// ============================================
// POST /api/cargos - Crear/actualizar cargo y sus permisos
// ============================================
router.post('/cargos', async (req, res) => {
  let connection;

  try {
    const { id_cargo, nombre_cargo, id_permisos = [] } = req.body || {};
    const nombreNormalizado = String(nombre_cargo || '').trim();
    const permisosNormalizados = dedupeNumberArray(id_permisos);

    if (!nombreNormalizado) {
      return res.status(400).json({ success: false, message: 'El nombre del cargo es requerido' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let targetCargoId = null;

    if (id_cargo) {
      const [cargoRows] = await connection.execute(
        'SELECT id_cargo FROM cargos WHERE id_cargo = ? LIMIT 1',
        [id_cargo]
      );

      if (!cargoRows || cargoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Cargo no encontrado' });
      }

      targetCargoId = cargoRows[0].id_cargo;

      await connection.execute(
        'UPDATE cargos SET nombre_cargo = ? WHERE id_cargo = ?',
        [nombreNormalizado, targetCargoId]
      );
    } else {
      const [insertResult] = await connection.execute(
        'INSERT INTO cargos (nombre_cargo) VALUES (?)',
        [nombreNormalizado]
      );
      targetCargoId = insertResult.insertId;
    }

    await connection.execute('DELETE FROM cargo_permisos WHERE id_cargo = ?', [targetCargoId]);

    for (const idPermiso of permisosNormalizados) {
      await connection.execute(
        'INSERT INTO cargo_permisos (id_cargo, id_permiso) VALUES (?, ?)',
        [targetCargoId, idPermiso]
      );
    }

    await connection.commit();

    const permisosActualizados = await obtenerPermisosPorCargo(connection, targetCargoId);

    res.json({
      success: true,
      id_cargo: targetCargoId,
      nombre_cargo: nombreNormalizado,
      id_permisos: permisosActualizados.map((p) => p.id_permiso),
      permisos: permisosActualizados
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (_rollbackError) {}
    }

    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Este cargo ya existe' });
    }

    console.error('[CARGOS] Error en POST /api/cargos:', error);
    res.status(500).json({ success: false, message: 'Error al guardar cargo' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
