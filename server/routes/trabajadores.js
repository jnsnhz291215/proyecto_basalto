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

    const [relacionesCargoPermisos] = await pool.execute(`
      SELECT 
        c.id_cargo,
        c.nombre_cargo,
        p.id_permiso,
        p.nombre_permiso
      FROM cargos c
      LEFT JOIN cargo_permisos cp ON cp.id_cargo = c.id_cargo
      LEFT JOIN permisos p ON p.id_permiso = cp.id_permiso
      ORDER BY c.nombre_cargo ASC, p.nombre_permiso ASC
    `);

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

module.exports = router;
