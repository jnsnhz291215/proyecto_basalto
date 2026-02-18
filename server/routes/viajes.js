const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

/**
 * GET /api/viajes/calendario
 * Obtener todos los viajes para renderizar en el calendario
 * Retorna: nombre, apellidos, cargo, ciudad origen/destino, hora_salida
 * Solo viajes no cancelados
 */
router.get('/viajes/calendario', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [viajes] = await connection.execute(
      `SELECT 
        vt.id_tramo,
        v.id_viaje,
        v.rut_trabajador,
        v.estado,
        t.nombres,
        CONCAT(t.apellido_paterno, ' ', IFNULL(t.apellido_materno, '')) as apellidos,
        t.cargo,
        vt.fecha_salida,
        vt.hora_salida,
        c_origen.nombre_ciudad AS ciudad_origen,
        c_destino.nombre_ciudad AS ciudad_destino,
        vt.codigo_pasaje
      FROM viajes v
      INNER JOIN viajes_tramos vt ON v.id_viaje = vt.id_viaje
      INNER JOIN trabajadores t ON v.rut_trabajador = t.RUT
      LEFT JOIN ciudades c_origen ON vt.id_ciudad_origen = c_origen.id_ciudad
      LEFT JOIN ciudades c_destino ON vt.id_ciudad_destino = c_destino.id_ciudad
      WHERE v.estado != 'Cancelado'
      ORDER BY vt.fecha_salida ASC, vt.hora_salida ASC`
    );

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener calendario de viajes:', error);
    res.status(500).json({ error: 'Error al obtener el calendario de viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes/mis-viajes?rut=xxxxx&ver_pasados=true|false
 * Obtener viajes del trabajador actual
 * por_defecto: mostrar viajes vigentes (desde ayer hasta futuro)
 * ver_pasados=true: mostrar solo viajes anteriores a ayer
 */
router.get('/viajes/mis-viajes', async (req, res) => {
  let connection;
  try {
    const { rut, ver_pasados = 'false' } = req.query;

    if (!rut) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    connection = await pool.getConnection();

    let query = `
      SELECT 
        v.id_viaje,
        v.rut_trabajador,
        v.estado,
        v.fecha_registro,
        vt.id_tramo,
        vt.codigo_pasaje,
        vt.fecha_salida,
        vt.hora_salida,
        c_origen.nombre_ciudad AS ciudad_origen,
        c_destino.nombre_ciudad AS ciudad_destino
      FROM viajes v
      INNER JOIN viajes_tramos vt ON v.id_viaje = vt.id_viaje
      LEFT JOIN ciudades c_origen ON vt.id_ciudad_origen = c_origen.id_ciudad
      LEFT JOIN ciudades c_destino ON vt.id_ciudad_destino = c_destino.id_ciudad
      WHERE v.rut_trabajador = ?
    `;

    let params = [rut];

    // Lógica de visibilidad
    if (ver_pasados === 'true' || ver_pasados === true) {
      // Mostrar viajes cuya fecha_salida sea anterior a ayer
      query += ` AND vt.fecha_salida < DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
    } else {
      // Por defecto: mostrar viajes vigentes (desde ayer hasta futuro)
      query += ` AND vt.fecha_salida >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`;
    }

    query += ` ORDER BY vt.fecha_salida ASC, vt.hora_salida ASC`;

    const [viajes] = await connection.execute(query, params);

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener mis viajes:', error);
    res.status(500).json({ error: 'Error al obtener tus viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * POST /api/viajes
 * Crear un viaje con múltiples tramos usando transacción SQL
 */
router.post('/viajes', async (req, res) => {
  let connection;
  try {
    const { rut_trabajador, tramos } = req.body;

    // Validaciones
    if (!rut_trabajador) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    if (!tramos || !Array.isArray(tramos) || tramos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un tramo' });
    }

    // Validar cada tramo
    for (let i = 0; i < tramos.length; i++) {
      const tramo = tramos[i];
      if (!tramo.tipo_transporte || !tramo.fecha || !tramo.hora || !tramo.id_ciudad_origen || !tramo.id_ciudad_destino) {
        return res.status(400).json({ 
          error: `Tramo ${i + 1}: Todos los campos son requeridos (tipo_transporte, fecha, hora, origen, destino)` 
        });
      }
    }

    // Calcular fecha de salida (fecha del primer tramo ordenado cronológicamente)
    const tramosOrdenados = [...tramos].sort((a, b) => {
      const fechaA = new Date(`${a.fecha}T${a.hora}`);
      const fechaB = new Date(`${b.fecha}T${b.hora}`);
      return fechaA - fechaB;
    });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Insertar el viaje principal
    const [resultViaje] = await connection.execute(
      `INSERT INTO viajes (rut_trabajador, fecha_registro, estado) VALUES (?, NOW(), 'Programado')`,
      [rut_trabajador]
    );

    const id_viaje = resultViaje.insertId;

    // 2. Insertar cada tramo asociado al viaje
    for (const tramo of tramos) {
      await connection.execute(
        `INSERT INTO viajes_tramos 
        (id_viaje, tipo_transporte, codigo_pasaje, fecha_salida, hora_salida, id_ciudad_origen, id_ciudad_destino) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id_viaje,
          tramo.tipo_transporte,
          tramo.codigo_transporte || null,
          tramo.fecha,
          tramo.hora,
          tramo.id_ciudad_origen,
          tramo.id_ciudad_destino
        ]
      );
    }

    await connection.commit();

    res.status(201).json({ 
      message: 'Viaje creado exitosamente',
      id_viaje: id_viaje,
      total_tramos: tramos.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al crear viaje:', error);
    res.status(500).json({ error: 'Error al crear el viaje', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * GET /api/viajes
 * Obtener viajes con filtros por tipo y mes (JOIN con trabajadores y ciudades)
 * Query params:
 *   - tipo: 'proximos' (default) | 'historial'
 *   - mes: '01' a '12' (opcional)
 */
router.get('/viajes', async (req, res) => {
  let connection;
  try {
    const { tipo = 'proximos', mes } = req.query;
    
    connection = await pool.getConnection();

    // Construir WHERE clause según filtros
    let whereConditions = [];
    let params = [];
    
    if (tipo === 'proximos') {
      // Viajes programados o en curso
      whereConditions.push("v.estado IN ('Programado', 'En curso')");
      // Agregar condición de fecha futura usando MIN de fecha_salida de tramos
      whereConditions.push('(SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) >= CURDATE()');
    } else if (tipo === 'historial') {
      // Viajes finalizados, cancelados o con fecha pasada
      whereConditions.push("(v.estado IN ('Finalizado', 'Cancelado') OR (SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) < CURDATE())");
    }
    
    // Filtro por mes (basado en fecha_salida del primer tramo)
    if (mes && mes.match(/^(0[1-9]|1[0-2])$/)) {
      whereConditions.push('MONTH((SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje)) = ?');
      params.push(parseInt(mes));
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Obtener viajes con datos del trabajador y fecha de salida calculada
    const [viajes] = await connection.execute(
      `SELECT 
        v.id_viaje,
        v.rut_trabajador,
        v.fecha_registro,
        v.estado,
        (SELECT MIN(fecha_salida) FROM viajes_tramos WHERE id_viaje = v.id_viaje) as fecha_salida,
        t.nombres,
        CONCAT(t.apellido_paterno, ' ', t.apellido_materno) as apellidos,
        t.id_grupo,
        t.cargo
      FROM viajes v
      INNER JOIN trabajadores t ON v.rut_trabajador = t.RUT
      ${whereClause}
      ORDER BY fecha_salida ASC, v.fecha_registro DESC`,
      params
    );

    // Para cada viaje, obtener sus tramos
    for (let viaje of viajes) {
      const [tramos] = await connection.execute(
        `SELECT 
          tr.id_tramo,
          tr.tipo_transporte,
          tr.codigo_pasaje as codigo_transporte,
          tr.fecha_salida as fecha,
          tr.hora_salida as hora,
          tr.id_ciudad_origen,
          tr.id_ciudad_destino,
          c_origen.nombre_ciudad AS origen,
          c_destino.nombre_ciudad AS destino
        FROM viajes_tramos tr
        LEFT JOIN ciudades c_origen ON tr.id_ciudad_origen = c_origen.id_ciudad
        LEFT JOIN ciudades c_destino ON tr.id_ciudad_destino = c_destino.id_ciudad
        WHERE tr.id_viaje = ?
        ORDER BY tr.fecha_salida, tr.hora_salida`,
        [viaje.id_viaje]
      );

      viaje.tramos = tramos;
    }

    res.json(viajes);

  } catch (error) {
    console.error('[ERROR] Error al obtener viajes:', error);
    res.status(500).json({ error: 'Error al obtener los viajes' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/viajes/:id/estado
 * Cambiar estado de un viaje (Programado, En curso, Finalizado, Cancelado)
 */
router.put('/viajes/:id/estado', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { activo } = req.body;

    // Convertir el boolean activo a estado enum
    const nuevoEstado = activo ? 'Programado' : 'Cancelado';

    connection = await pool.getConnection();

    const [result] = await connection.execute(
      'UPDATE viajes SET estado = ? WHERE id_viaje = ?',
      [nuevoEstado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    res.json({ 
      message: activo ? 'Viaje reactivado exitosamente' : 'Viaje cancelado exitosamente'
    });

  } catch (error) {
    console.error('[ERROR] Error al cambiar estado del viaje:', error);
    res.status(500).json({ error: 'Error al cambiar el estado del viaje' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * PUT /api/viajes/:id
 * Editar un viaje y sus tramos
 */
router.put('/viajes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { rut_trabajador, tramos } = req.body;

    // Validaciones
    if (!rut_trabajador) {
      return res.status(400).json({ error: 'RUT del trabajador es requerido' });
    }

    if (!tramos || !Array.isArray(tramos) || tramos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un tramo' });
    }

    // Validar cada tramo
    for (let i = 0; i < tramos.length; i++) {
      const tramo = tramos[i];
      if (!tramo.tipo_transporte || !tramo.fecha || !tramo.hora || !tramo.id_ciudad_origen || !tramo.id_ciudad_destino) {
        return res.status(400).json({ 
          error: `Tramo ${i + 1}: Todos los campos son requeridos` 
        });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Actualizar viaje principal (solo RUT, los tramos determinan las fechas)
    const [resultViaje] = await connection.execute(
      'UPDATE viajes SET rut_trabajador = ? WHERE id_viaje = ?',
      [rut_trabajador, id]
    );

    if (resultViaje.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    // 2. Eliminar tramos antiguos
    await connection.execute(
      'DELETE FROM viajes_tramos WHERE id_viaje = ?',
      [id]
    );

    // 3. Insertar nuevos tramos
    for (const tramo of tramos) {
      await connection.execute(
        `INSERT INTO viajes_tramos 
        (id_viaje, tipo_transporte, codigo_pasaje, fecha_salida, hora_salida, id_ciudad_origen, id_ciudad_destino) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          tramo.tipo_transporte,
          tramo.codigo_transporte || null,
          tramo.fecha,
          tramo.hora,
          tramo.id_ciudad_origen,
          tramo.id_ciudad_destino
        ]
      );
    }

    await connection.commit();

    res.json({ 
      message: 'Viaje actualizado exitosamente',
      total_tramos: tramos.length
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al editar viaje:', error);
    res.status(500).json({ error: 'Error al editar el viaje', detalle: error.message });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * DELETE /api/viajes/:id
 * Eliminar un viaje y todos sus tramos (cascada)
 */
router.delete('/viajes/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Eliminar tramos primero
    await connection.execute(
      'DELETE FROM viajes_tramos WHERE id_viaje = ?',
      [id]
    );

    // Eliminar viaje
    const [result] = await connection.execute(
      'DELETE FROM viajes WHERE id_viaje = ?',
      [id]
    );

    await connection.commit();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    res.json({ message: 'Viaje eliminado exitosamente' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ERROR] Error al eliminar viaje:', error);
    res.status(500).json({ error: 'Error al eliminar el viaje' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
