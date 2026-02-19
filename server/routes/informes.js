const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

/**
 * GET /api/informes
 * Obtener informes con filtros
 * Query params:
 *   - operador: nombre o RUT del operador (búsqueda parcial)
 *   - desde: fecha desde (YYYY-MM-DD)
 *   - hasta: fecha hasta (YYYY-MM-DD)
 *   - estado: 'activos' | 'inactivos'
 */
router.get('/informes', async (req, res) => {
  let connection;
  try {
    const { operador, desde, hasta, estado = 'activos' } = req.query;

    connection = await pool.getConnection();

    let query = `
      SELECT 
        i.id_informe,
        i.numero_informe,
        i.fecha,
        i.turno,
        i.horas_trabajadas,
        i.faena,
        i.lugar,
        i.equipo,
        i.operador_rut,
        i.estado,
        i.creado_el,
        t.nombres,
        t.apellido_paterno,
        t.apellido_materno
      FROM informes_turno i
      LEFT JOIN trabajadores t ON i.operador_rut = t.RUT
      WHERE 1=1
    `;

    const params = [];

    // Filtro por estado
    if (estado === 'activos') {
      query += ` AND (i.estado = 'activo' OR i.estado = 1)`;
    } else if (estado === 'inactivos') {
      query += ` AND (i.estado = 'inactivo' OR i.estado = 0)`;
    }

    // Filtro por operador (nombre o RUT)
    if (operador && operador.trim()) {
      query += ` AND (
        t.nombres LIKE ? OR 
        t.apellido_paterno LIKE ? OR 
        t.apellido_materno LIKE ? OR 
        i.operador_rut LIKE ?
      )`;
      const operadorLike = `%${operador.trim()}%`;
      params.push(operadorLike, operadorLike, operadorLike, operadorLike);
    }

    // Filtro por rango de fechas
    if (desde) {
      query += ` AND i.fecha >= ?`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND i.fecha <= ?`;
      params.push(hasta);
    }

    query += ` ORDER BY i.fecha DESC, i.creado_el DESC`;

    const [informes] = await connection.execute(query, params);

    res.json(informes);

  } catch (error) {
    console.error('[ERROR] Error al obtener informes:', error);
    res.status(500).json({ error: 'Error al obtener informes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/informes/:id
 * Obtener un informe específico por ID
 */
router.get('/informes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();

    const [informes] = await connection.execute(
      `SELECT * FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    if (informes.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    res.json(informes[0]);

  } catch (error) {
    console.error('[ERROR] Error al obtener informe:', error);
    res.status(500).json({ error: 'Error al obtener el informe' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/informes/:id/detalles
 * Obtener informe con todas sus tablas relacionadas (actividades, herramientas, perforaciones)
 */
router.get('/informes/:id/detalles', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();

    // Obtener informe principal
    const [informes] = await connection.execute(
      `SELECT * FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    if (informes.length === 0) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }

    const informe = informes[0];

    // Obtener actividades
    const [actividades] = await connection.execute(
      `SELECT * FROM actividades_turno WHERE id_informe = ? ORDER BY hora_desde ASC`,
      [id]
    );

    // Obtener herramientas
    const [herramientas] = await connection.execute(
      `SELECT * FROM herramientas_turno WHERE id_informe = ? ORDER BY desde_mts ASC`,
      [id]
    );

    // Obtener perforaciones
    const [perforaciones] = await connection.execute(
      `SELECT * FROM perforaciones_turno WHERE id_informe = ? ORDER BY desde_mts ASC`,
      [id]
    );

    res.json({
      informe,
      actividades,
      herramientas,
      perforaciones
    });

  } catch (error) {
    console.error('[ERROR] Error al obtener detalles del informe:', error);
    res.status(500).json({ error: 'Error al obtener los detalles del informe' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/informes/:id
 * Actualizar un informe (puede ser edición completa o cambio de estado)
 */
router.put('/informes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const datosActualizados = req.body;

    // Si solo se está actualizando el estado (soft delete/restaurar)
    if (Object.keys(datosActualizados).length === 1 && datosActualizados.estado) {
      connection = await pool.getConnection();
      
      await connection.execute(
        `UPDATE informes_turno SET estado = ? WHERE id_informe = ?`,
        [datosActualizados.estado, id]
      );

      return res.json({ message: 'Estado actualizado correctamente' });
    }

    // Edición completa del informe
    connection = await pool.getConnection();

    const updateFields = [];
    const updateValues = [];

    // Mapear campos permitidos para actualización
    const camposPermitidos = [
      'numero_informe', 'fecha', 'turno', 'horas_trabajadas', 'faena', 'lugar',
      'equipo', 'operador_rut', 'ayudante_1', 'ayudante_2', 'pozo_numero',
      'sector', 'diametro', 'inclinacion', 'profundidad_inicial', 'profundidad_final',
      'mts_perforados', 'pull_down', 'rpm', 'horometro_inicial', 'horometro_final',
      'horometro_hrs', 'insumo_petroleo', 'insumo_lubricantes', 'observaciones', 'estado'
    ];

    camposPermitidos.forEach(campo => {
      if (datosActualizados.hasOwnProperty(campo)) {
        updateFields.push(`${campo} = ?`);
        updateValues.push(datosActualizados[campo]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updateValues.push(id);

    const query = `UPDATE informes_turno SET ${updateFields.join(', ')} WHERE id_informe = ?`;
    
    await connection.execute(query, updateValues);

    res.json({ message: 'Informe actualizado correctamente' });

  } catch (error) {
    console.error('[ERROR] Error al actualizar informe:', error);
    res.status(500).json({ error: 'Error al actualizar el informe', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * DELETE /api/informes/:id
 * Eliminar permanentemente un informe (hard delete)
 * NOTA: Esto eliminará también las tablas relacionadas si hay CASCADE configurado
 */
router.delete('/informes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Eliminar tablas relacionadas primero (para evitar errores de foreign key)
    await connection.execute(
      `DELETE FROM actividades_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.execute(
      `DELETE FROM herramientas_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.execute(
      `DELETE FROM perforaciones_turno WHERE id_informe = ?`,
      [id]
    );

    // Eliminar informe principal
    await connection.execute(
      `DELETE FROM informes_turno WHERE id_informe = ?`,
      [id]
    );

    await connection.commit();

    res.json({ message: 'Informe eliminado permanentemente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al eliminar informe:', error);
    res.status(500).json({ error: 'Error al eliminar el informe', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
