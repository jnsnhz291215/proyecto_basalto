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
    res.json(trabajadores);
  } catch (error) {
    console.error('Error al obtener trabajadores:', error);
    res.status(500).json({ error: 'Error al obtener trabajadores' });
  }
});

module.exports = router;
