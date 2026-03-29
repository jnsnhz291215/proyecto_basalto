const express = require('express');
const router = express.Router();
const { pool } = require('../database');

function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const ADMIN_PERMISSION_GROUPS = {
  // Vistas por modulo (Gestionar)
  admin_trabajadores_v: ['admin_v_trabajadores', 'admin_trabajadores_v'],
  admin_viajes_v: ['admin_v_viajes', 'admin_viajes_v'],
  admin_informes_v: ['admin_v_informes', 'admin_informes_v', 'informes_ver'],
  admin_cargos_v: ['gestionar_cargos', 'admin_v_cargos'],
  admin_dashboard_v: ['admin_v_kpis'],

  // Edicion por modulo
  admin_trabajadores_e: ['admin_trabajadores_e'],
  admin_viajes_e: ['admin_viajes_g', 'admin_viajes_e'],
  admin_informes_e: ['informes_editar', 'admin_informes_e'],
  admin_cargos_e: ['admin_cargos_e'],

  // Soft delete por modulo
  admin_trabajadores_d: ['admin_trabajadores_d'],
  admin_viajes_d: ['admin_viajes_d'],
  admin_informes_d: ['informes_soft_delete', 'admin_informes_d'],
  admin_cargos_d: ['admin_cargos_d'],

  // Compatibilidad legacy
  admin_softdelete: ['admin_softdelete']
};

const ADMIN_PERMISSION_KEYS = Array.from(new Set(
  Object.values(ADMIN_PERMISSION_GROUPS).flat()
));

// ============================================
// MIDDLEWARE: Verificar que el usuario es Super Admin
// ============================================
async function verificarSuperAdmin(req, res, next) {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const headers = req.headers || {};
    const rutAdmin = body.rut_solicitante || query.rut_solicitante || headers['rut_solicitante'];
    
    if (!rutAdmin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Se requiere rut_solicitante en la petición' 
      });
    }

    // Consultar si el admin es Super Admin
    const rutSolicitanteLimpio = limpiarRUT(rutAdmin);
    const sql = 'SELECT es_super_admin, activo FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [admins] = await pool.execute(sql, [rutSolicitanteLimpio]);

    if (!admins || admins.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin no encontrado' 
      });
    }

    if (admins[0].activo === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cuenta de administrador inactiva' 
      });
    }

    if (!admins[0].es_super_admin) {
      console.warn(`[ADMIN_MGMT] Acceso denegado - ${rutSolicitanteLimpio} no es Super Admin`);
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Solo Super Administradores pueden realizar esta acción.' 
      });
    }

    next();
  } catch (error) {
    console.error('[ADMIN_MGMT] Error en middleware verificarSuperAdmin:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error de autenticación' 
    });
  }
}

// ============================================
// Función helper para limpiar RUT
// ============================================
function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

function obtenerPasswordBaseDesdeRut(rut) {
  const rutLimpio = limpiarRUT(rut);
  const rutSinDv = rutLimpio.length > 1 ? rutLimpio.slice(0, -1) : '';
  const cuerpoNumerico = rutSinDv.replace(/\D/g, '');
  if (!cuerpoNumerico) return '';
  return cuerpoNumerico.length > 4 ? cuerpoNumerico.slice(-4) : cuerpoNumerico;
}

// ============================================
// GET /api/admins - Lista de todos los administradores
// ============================================
router.get('/admins', verificarSuperAdmin, async (req, res) => {
  try {
    const sqlAdmins = `
      SELECT 
        rut,
        nombres,
        apellido_paterno,
        apellido_materno,
        email,
        activo,
        es_super_admin
      FROM admin_users
      ORDER BY es_super_admin DESC, apellido_paterno ASC, nombres ASC
    `;

    const sqlPermisos = `
      SELECT 
        ap.admin_rut,
        p.id_permiso,
        p.clave_permiso,
        p.descripcion
      FROM admin_permisos ap
      INNER JOIN permisos p ON ap.id_permiso = p.id_permiso
      ORDER BY p.clave_permiso ASC
    `;

    const [admins] = await pool.execute(sqlAdmins);
    const [permisosRows] = await pool.execute(sqlPermisos);

    const permisosPorRut = new Map();
    permisosRows.forEach((permiso) => {
      const rutLimpio = limpiarRUT(permiso.admin_rut);
      if (!permisosPorRut.has(rutLimpio)) {
        permisosPorRut.set(rutLimpio, []);
      }

      permisosPorRut.get(rutLimpio).push({
        id: permiso.id_permiso,
        clave: permiso.clave_permiso,
        descripcion: permiso.descripcion || permiso.clave_permiso
      });
    });

    const adminsConPermisos = admins.map((admin) => {
      const rutLimpio = limpiarRUT(admin.rut);

      return {
        rut: admin.rut,
        nombres: admin.nombres || '',
        apellido_paterno: admin.apellido_paterno || '',
        apellido_materno: admin.apellido_materno || '',
        nombre_completo: `${admin.nombres || ''} ${admin.apellido_paterno || ''} ${admin.apellido_materno || ''}`.trim(),
        email: admin.email,
        activo: Number(admin.activo) === 0 ? 0 : 1,
        es_super_admin: admin.es_super_admin,
        permisos: permisosPorRut.get(rutLimpio) || [],
        created_at: admin.created_at || null
      };
    });

    console.log(`[ADMIN_MGMT] Se obtuvieron ${adminsConPermisos.length} administradores`);
    res.json({ success: true, data: adminsConPermisos });

  } catch (error) {
    console.error('[ADMIN_MGMT] Error en GET /admins:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener administradores' 
    });
  }
});

// ============================================
// GET /api/permisos - Lista de todos los permisos disponibles
// ============================================
router.get('/permisos', verificarSuperAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT 
        id_permiso,
        clave_permiso,
        descripcion
      FROM permisos
      WHERE clave_permiso IN (${ADMIN_PERMISSION_KEYS.map(() => '?').join(', ')})
      ORDER BY clave_permiso ASC
    `;

    const [permisos] = await pool.execute(sql, ADMIN_PERMISSION_KEYS);

    console.log(`[ADMIN_MGMT] Se obtuvieron ${permisos.length} permisos disponibles`);
    res.json({ 
      success: true, 
      data: permisos 
    });

  } catch (error) {
    console.error('[ADMIN_MGMT] Error en GET /permisos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener permisos' 
    });
  }
});

// ============================================
// POST /api/admins/permisos - Actualizar permisos de un administrador
// ============================================
router.post('/admins/permisos', verificarSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { rut_admin, id_permisos } = req.body;
    const rutLimpio = limpiarRUT(rut_admin);

    if (!rut_admin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere rut_admin' 
      });
    }

    if (!Array.isArray(id_permisos)) {
      return res.status(400).json({ 
        success: false, 
        message: 'id_permisos debe ser un array de números' 
      });
    }

    const idsSolicitados = [...new Set(id_permisos.map((id) => Number(id)).filter(Number.isInteger))];

    // Verificar que el admin existe
    const sqlCheckAdmin = 'SELECT rut, es_super_admin FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [adminExists] = await connection.execute(sqlCheckAdmin, [rutLimpio]);

    if (!adminExists || adminExists.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Administrador no encontrado' 
      });
    }

    if (Number(adminExists[0].es_super_admin) === 1) {
      return res.status(403).json({
        success: false,
        message: 'No se pueden modificar los permisos de una cuenta Superadministrador'
      });
    }

    if (idsSolicitados.length > 0) {
      const sqlPermisosValidos = `
        SELECT id_permiso, clave_permiso
        FROM permisos
        WHERE id_permiso IN (${idsSolicitados.map(() => '?').join(', ')})
      `;
      const [permisosValidos] = await connection.execute(sqlPermisosValidos, idsSolicitados);
      const clavesInvalidas = permisosValidos.filter((permiso) => !ADMIN_PERMISSION_KEYS.includes(permiso.clave_permiso));

      if (permisosValidos.length !== idsSolicitados.length || clavesInvalidas.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Se intentó asignar permisos administrativos no permitidos'
        });
      }
    }

    // Iniciar transacción
    await connection.beginTransaction();

    // Eliminar permisos actuales
    const sqlDeletePermisos = 'DELETE FROM admin_permisos WHERE REPLACE(REPLACE(REPLACE(admin_rut, ".", ""), "-", ""), " ", "") = ?';
    await connection.execute(sqlDeletePermisos, [rutLimpio]);

    // Insertar nuevos permisos
    if (idsSolicitados.length > 0) {
      for (const idPermiso of idsSolicitados) {
        const sqlInsertPermiso = 'INSERT INTO admin_permisos (admin_rut, id_permiso) VALUES (?, ?)';
        await connection.execute(sqlInsertPermiso, [adminExists[0].rut, idPermiso]);
      }
    }

    // Confirmar transacción
    await connection.commit();

    console.log(`[ADMIN_MGMT] Permisos actualizados para admin ${rutLimpio}. Nuevos permisos: ${idsSolicitados.join(', ')}`);
    
    res.json({ 
      success: true, 
      message: `Permisos actualizados para el administrador`,
      rut_admin: rutLimpio,
      permisos_asignados: idsSolicitados.length
    });

  } catch (error) {
    await connection.rollback();
    console.error('[ADMIN_MGMT] Error en POST /admins/permisos:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar permisos' 
    });
  } finally {
    await connection.release();
  }
});

// ============================================
// POST /api/admins/crear - Registrar nuevo administrador
// ============================================
router.post('/admins/crear', verificarSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { rut, nombres, apellido_paterno, apellido_materno, apellidos, email, id_permisos } = req.body;
    const rutLimpio = limpiarRUT(rut);
    const emailNormalizado = String(email || '').trim().toLowerCase();
    const passwordInicial = obtenerPasswordBaseDesdeRut(rutLimpio);
    const apellidosRaw = String(apellidos || '').trim().replace(/\s+/g, ' ');
    const apellidoPaternoRaw = String(apellido_paterno || '').trim();
    const apellidoMaternoRaw = String(apellido_materno || '').trim();
    const apellidosParts = apellidosRaw ? apellidosRaw.split(' ').filter(Boolean) : [];
    const apellidoPaternoFinal = apellidoPaternoRaw || apellidosParts[0] || '';
    const apellidoMaternoFinal = apellidoMaternoRaw || apellidosParts.slice(1).join(' ') || null;
    const idsSolicitados = Array.isArray(id_permisos)
      ? [...new Set(id_permisos.map((id) => Number(id)).filter(Number.isInteger))]
      : [];

    // Validaciones
    if (!rut || !nombres || !apellidoPaternoFinal) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requieren: rut, nombres y apellidos' 
      });
    }

    if (!passwordInicial || passwordInicial.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'No fue posible derivar clave base desde el RUT. Verifique el formato.'
      });
    }

    // Verificar duplicado por RUT
    const sqlCheckRut = 'SELECT rut FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [existingRut] = await connection.execute(sqlCheckRut, [rutLimpio]);

    if (existingRut && existingRut.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ya existe un administrador con este RUT' 
      });
    }

    // Validación cruzada: un administrador no puede compartir RUT con un trabajador
    const sqlCheckTrabajadorRut = 'SELECT RUT FROM trabajadores WHERE REPLACE(REPLACE(REPLACE(RUT, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [existingTrabajadorRut] = await connection.execute(sqlCheckTrabajadorRut, [rutLimpio]);

    if (existingTrabajadorRut && existingTrabajadorRut.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Este RUT ya está registrado como trabajador. No puede crearse como administrador.'
      });
    }

    // Verificar duplicado por Email
    if (emailNormalizado) {
      const sqlCheckEmail = 'SELECT rut FROM admin_users WHERE LOWER(TRIM(email)) = ? LIMIT 1';
      const [existingEmail] = await connection.execute(sqlCheckEmail, [emailNormalizado]);

      if (existingEmail && existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un administrador con este Email'
        });
      }
    }

    if (idsSolicitados.length > 0) {
      const sqlPermisosValidos = `
        SELECT id_permiso, clave_permiso
        FROM permisos
        WHERE id_permiso IN (${idsSolicitados.map(() => '?').join(', ')})
      `;
      const [permisosValidos] = await connection.execute(sqlPermisosValidos, idsSolicitados);
      const clavesInvalidas = permisosValidos.filter((permiso) => !ADMIN_PERMISSION_KEYS.includes(permiso.clave_permiso));

      if (permisosValidos.length !== idsSolicitados.length || clavesInvalidas.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Se intentó asignar permisos administrativos no permitidos al crear el administrador'
        });
      }
    }

    await connection.beginTransaction();

    // Insertar nuevo admin
    const sqlInsert = `
      INSERT INTO admin_users 
      (rut, nombres, apellido_paterno, apellido_materno, email, password, es_super_admin, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;

    await connection.execute(sqlInsert, [
      rutLimpio,
      titleCase(nombres),
      titleCase(apellidoPaternoFinal),
      apellidoMaternoFinal ? titleCase(apellidoMaternoFinal) : null,
      emailNormalizado || null,
      passwordInicial,
      0
    ]);

    if (idsSolicitados.length > 0) {
      for (const idPermiso of idsSolicitados) {
        await connection.execute(
          'INSERT INTO admin_permisos (admin_rut, id_permiso) VALUES (?, ?)',
          [rutLimpio, idPermiso]
        );
      }
    }

    await connection.commit();

    console.log(`[ADMIN_MGMT] Nuevo administrador creado - RUT: ${rutLimpio} - password inicial configurada con ultimos 4 digitos del RUT sin DV - permisos: ${idsSolicitados.join(', ') || 'sin permisos'}`);

    res.status(201).json({ 
      success: true, 
      message: 'Administrador creado exitosamente',
      rut: rutLimpio,
      es_super_admin: 0,
      password_inicial: passwordInicial,
      permisos_asignados: idsSolicitados.length
    });

  } catch (error) {
    await connection.rollback();
    console.error('[ADMIN_MGMT] Error en POST /admins/crear:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear administrador' 
    });
  } finally {
    await connection.release();
  }
});

// ============================================
// PUT /api/admins/:rut - Editar datos basicos de un administrador
// ============================================
router.put('/admins/:rut', verificarSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const rutObjetivo = limpiarRUT(req.params.rut);
    const { rut, nombres, apellido_paterno, apellido_materno, apellidos, email } = req.body || {};

    const rutNuevo = limpiarRUT(rut);
    const nombresFinal = titleCase(nombres);
    const emailFinal = String(email || '').trim().toLowerCase();
    const apellidosRaw = String(apellidos || '').trim().replace(/\s+/g, ' ');
    const apellidoPaternoRaw = String(apellido_paterno || '').trim();
    const apellidoMaternoRaw = String(apellido_materno || '').trim();
    const apellidosParts = apellidosRaw ? apellidosRaw.split(' ').filter(Boolean) : [];
    const apellidoPaternoFinal = titleCase(apellidoPaternoRaw || apellidosParts[0] || '');
    const apellidoMaternoFinal = (apellidoMaternoRaw || apellidosParts.slice(1).join(' ') || null)
      ? titleCase(apellidoMaternoRaw || apellidosParts.slice(1).join(' '))
      : null;

    if (!rutObjetivo) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el RUT objetivo del administrador'
      });
    }

    if (!rutNuevo || !nombresFinal || !apellidoPaternoFinal) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren rut, nombres y apellidos'
      });
    }

    // Verificar admin objetivo
    const sqlCheckTarget = 'SELECT rut, es_super_admin FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [targetRows] = await connection.execute(sqlCheckTarget, [rutObjetivo]);

    if (!targetRows || targetRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    if (Number(targetRows[0].es_super_admin) === 1) {
      return res.status(403).json({
        success: false,
        message: 'No se pueden editar los datos de una cuenta Superadministrador desde esta vista'
      });
    }

    // Validacion cruzada con trabajadores para nuevo RUT
    const sqlCheckTrabajadorRut = 'SELECT RUT FROM trabajadores WHERE REPLACE(REPLACE(REPLACE(RUT, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [existingTrabajadorRut] = await connection.execute(sqlCheckTrabajadorRut, [rutNuevo]);

    if (existingTrabajadorRut && existingTrabajadorRut.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Este RUT ya está registrado como trabajador. No puede asignarse al administrador.'
      });
    }

    // Verificar RUT duplicado en otros admins
    const sqlCheckRut = `
      SELECT rut
      FROM admin_users
      WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ?
        AND REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") <> ?
      LIMIT 1
    `;
    const [existingRut] = await connection.execute(sqlCheckRut, [rutNuevo, rutObjetivo]);

    if (existingRut && existingRut.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe otro administrador con este RUT'
      });
    }

    if (emailFinal) {
      const sqlCheckEmail = `
        SELECT rut
        FROM admin_users
        WHERE LOWER(TRIM(email)) = ?
          AND REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") <> ?
        LIMIT 1
      `;
      const [existingEmail] = await connection.execute(sqlCheckEmail, [emailFinal, rutObjetivo]);

      if (existingEmail && existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe otro administrador con este correo electrónico'
        });
      }
    }

    await connection.beginTransaction();

    const sqlUpdateAdmin = `
      UPDATE admin_users
      SET rut = ?, nombres = ?, apellido_paterno = ?, apellido_materno = ?, email = ?
      WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ?
    `;
    await connection.execute(sqlUpdateAdmin, [
      rutNuevo,
      nombresFinal,
      apellidoPaternoFinal,
      apellidoMaternoFinal,
      emailFinal || null,
      rutObjetivo
    ]);

    // Si cambia el RUT, sincronizar FK logica en tabla admin_permisos
    if (rutNuevo !== rutObjetivo) {
      const sqlSyncPermisosRut = `
        UPDATE admin_permisos
        SET admin_rut = ?
        WHERE REPLACE(REPLACE(REPLACE(admin_rut, ".", ""), "-", ""), " ", "") = ?
      `;
      await connection.execute(sqlSyncPermisosRut, [rutNuevo, rutObjetivo]);
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Datos del administrador actualizados correctamente',
      rut_anterior: rutObjetivo,
      rut_nuevo: rutNuevo
    });
  } catch (error) {
    await connection.rollback();
    console.error('[ADMIN_MGMT] Error en PUT /admins/:rut:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar datos del administrador'
    });
  } finally {
    await connection.release();
  }
});

// ============================================
// POST /api/admins/estado - Activar / desactivar administrador (Soft Delete)
// ============================================
router.post('/admins/estado', verificarSuperAdmin, async (req, res) => {
  try {
    const { rut_admin, activo, rut_solicitante } = req.body;
    const rutAdminLimpio = limpiarRUT(rut_admin);
    const rutSolicitanteLimpio = limpiarRUT(rut_solicitante);
    const nuevoEstado = Number(activo) === 0 ? 0 : 1;

    if (!rut_admin || typeof activo === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Se requieren rut_admin y activo'
      });
    }

    if (rutAdminLimpio === rutSolicitanteLimpio && nuevoEstado === 0) {
      return res.status(400).json({
        success: false,
        message: 'No puede desactivar su propia cuenta'
      });
    }

    const sqlCheck = 'SELECT rut, es_super_admin FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [adminRows] = await pool.execute(sqlCheck, [rutAdminLimpio]);

    if (!adminRows || adminRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Administrador no encontrado'
      });
    }

    if (Number(adminRows[0].es_super_admin) === 1 && nuevoEstado === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede desactivar un Super Administrador'
      });
    }

    const sqlUpdate = 'UPDATE admin_users SET activo = ? WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ?';
    await pool.execute(sqlUpdate, [nuevoEstado, rutAdminLimpio]);

    res.json({
      success: true,
      message: nuevoEstado === 1 ? 'Administrador activado' : 'Administrador desactivado',
      rut_admin: rutAdminLimpio,
      activo: nuevoEstado
    });
  } catch (error) {
    console.error('[ADMIN_MGMT] Error en POST /admins/estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado del administrador'
    });
  }
});

// ============================================
// DELETE /api/admins/:rut - Eliminar administrador físicamente
// ============================================
router.delete('/admins/:rut', verificarSuperAdmin, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const rutParaEliminar = limpiarRUT(req.params.rut);
    const body = req.body || {};
    const query = req.query || {};
    const headers = req.headers || {};
    const rutSolicitante = limpiarRUT(body.rut_solicitante || query.rut_solicitante || headers['rut_solicitante']);

    if (!rutParaEliminar) {
      return res.status(400).json({ success: false, message: 'Se requiere el RUT del administrador a eliminar' });
    }

    if (rutParaEliminar === rutSolicitante) {
      return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta administrativamente' });
    }

    // Verificar existencia previa
    const sqlCheck = 'SELECT rut, es_super_admin FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    const [adminRows] = await connection.execute(sqlCheck, [rutParaEliminar]);

    if (!adminRows || adminRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Administrador no encontrado' });
    }

    if (Number(adminRows[0].es_super_admin) === 1) {
      return res.status(403).json({ success: false, message: 'No se puede eliminar la cuenta de un Super Administrador' });
    }

    await connection.beginTransaction();

    const sqlDeletePermisos = 'DELETE FROM admin_permisos WHERE admin_rut = ?';
    await connection.execute(sqlDeletePermisos, [adminRows[0].rut]);

    const sqlDeleteAdmin = 'DELETE FROM admin_users WHERE rut = ?';
    await connection.execute(sqlDeleteAdmin, [adminRows[0].rut]);

    await connection.commit();

    console.log(`[ADMIN_MGMT] Administrador ELIMINADO FISICAMENTE: ${rutParaEliminar} por ${rutSolicitante}`);
    res.json({ success: true, message: 'Administrador eliminado definitivamente' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[ADMIN_MGMT] Error en DELETE /admins/:rut:', error);
    res.status(500).json({ success: false, message: 'Error interno al intentar eliminar al administrador' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
