const express = require('express');
const { pool } = require('../../ejemploconexion.js');

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

module.exports = router;
