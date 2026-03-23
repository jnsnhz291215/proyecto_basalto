const express = require('express');
const { pool, obtenerTrabajadores } = require('../../ejemploconexion.js');

const router = express.Router();

// GET /api/grupos - Lista de grupos disponibles
router.get('/grupos', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_grupo, nombre_grupo, tipo_grupo FROM grupos ORDER BY id_grupo ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    res.status(500).json({ error: 'Error al obtener grupos' });
  }
});

// GET /api/trabajadores - Lista de trabajadores (con grupos)
router.get('/trabajadores', async (req, res) => {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    const trabajadores = await obtenerTrabajadores(incluirInactivos);

    const sqlQuery = `
      SELECT 
        c.id_cargo,
        c.nombre_cargo,
        p.id_permiso,
        p.descripcion AS nombre_permiso
      FROM cargos c
      LEFT JOIN cargo_permisos cp ON cp.id_cargo = c.id_cargo
      LEFT JOIN permisos p ON p.id_permiso = cp.id_permiso
      ORDER BY c.nombre_cargo ASC, p.descripcion ASC
    `;

    console.log('[DEBUG_SQL] Query ejecutada para responsables:', sqlQuery);
    console.warn('[DEBUG_SQL] Advertencia: No se detectaron filtros de turno en la consulta.');
    console.warn('[DEBUG_SQL] Advertencia: No se detectaron filtros por cargo de operador en la consulta SQL base.');

    const [relacionesCargoPermisos] = await pool.execute(sqlQuery);

    const permisosPorCargo = new Map();
    relacionesCargoPermisos.forEach((row) => {
      const nombreCargo = String(row.nombre_cargo || '').trim().toLowerCase();
      if (!nombreCargo) return;

      if (!permisosPorCargo.has(nombreCargo)) {
        permisosPorCargo.set(nombreCargo, {
          id_cargo: row.id_cargo || null,
          permisos: []
        });
      }

      if (row.id_permiso) {
        permisosPorCargo.get(nombreCargo).permisos.push({
          id_permiso: row.id_permiso,
          nombre_permiso: row.nombre_permiso
        });
      }
    });

    const trabajadoresConPermisosCargo = trabajadores.map((trabajador) => {
      const cargoNombre = String(trabajador.cargo || '').trim().toLowerCase();
      const cargoData = cargoNombre ? permisosPorCargo.get(cargoNombre) : null;

      return {
        ...trabajador,
        id_cargo: trabajador.id_cargo || cargoData?.id_cargo || null,
        permisos_cargo: cargoData?.permisos || []
      };
    });

    res.json(trabajadoresConPermisosCargo);
  } catch (error) {
    console.error('Error al obtener trabajadores:', error);
    res.status(500).json({ error: 'Error al obtener trabajadores' });
  }
});

// GET /api/trabajadores/responsables - Responsables de turno por grupo activo
router.get('/trabajadores/responsables', async (req, res) => {
  try {
    const grupoRaw = String(req.query.grupo || req.query.id_grupo || '').trim();
    if (!grupoRaw) {
      return res.status(400).json({ error: 'Se requiere grupo o id_grupo' });
    }

    const grupoNormalizado = grupoRaw.toUpperCase();
    const sqlQuery = `
      SELECT DISTINCT
        t.RUT,
        t.nombres,
        t.apellido_paterno,
        t.apellido_materno,
        t.email,
        t.telefono,
        t.id_grupo,
        g.nombre_grupo,
        t.cargo,
        c.id_cargo,
        t.activo
      FROM trabajadores t
      INNER JOIN grupos g ON t.id_grupo = g.id_grupo
      INNER JOIN cargos c ON LOWER(TRIM(c.nombre_cargo)) = LOWER(TRIM(t.cargo))
      INNER JOIN cargo_permisos cp ON cp.id_cargo = c.id_cargo
      INNER JOIN permisos p ON p.id_permiso = cp.id_permiso
      WHERE p.clave_permiso = ?
        AND t.activo = 1
        AND (
          UPPER(TRIM(g.nombre_grupo)) = ?
          OR CAST(t.id_grupo AS CHAR) = ?
        )
      ORDER BY t.nombres ASC, t.apellido_paterno ASC, t.apellido_materno ASC
    `;
    const params = ['responsable_turno', grupoNormalizado, grupoRaw];

    console.log('[DEBUG_SQL] Query ejecutada para responsables:', sqlQuery);
    console.log('[DEBUG_SQL] Parámetros recibidos para responsables:', params);

    const [rows] = await pool.execute(sqlQuery, params);

    res.json(rows.map((row) => ({
      RUT: row.RUT,
      nombres: row.nombres,
      apellido_paterno: row.apellido_paterno,
      apellido_materno: row.apellido_materno,
      apellidos: `${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim(),
      email: row.email,
      telefono: row.telefono,
      id_grupo: row.id_grupo || null,
      grupo: row.nombre_grupo ? String(row.nombre_grupo).trim() : (row.id_grupo ? String(row.id_grupo) : ''),
      nombre_grupo: row.nombre_grupo || null,
      cargo: row.cargo,
      id_cargo: row.id_cargo || null,
      activo: row.activo === 1 || row.activo === true
    })));
  } catch (error) {
    console.error('Error al obtener responsables de turno:', error);
    res.status(500).json({ error: 'Error al obtener responsables de turno' });
  }
});

module.exports = router;
