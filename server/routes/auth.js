const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// Función helper para limpiar RUT
function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

function toSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function obtenerContextoCargoPorRut(rutLimpio) {
  try {
    const sqlCargo = `
      SELECT c.id_cargo, c.nombre_cargo, t.id_grupo, g.nombre_grupo
      FROM trabajadores t
      LEFT JOIN cargos c ON LOWER(TRIM(c.nombre_cargo)) = LOWER(TRIM(t.cargo))
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE UPPER(REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', '')) = UPPER(?)
      LIMIT 1
    `;

    const [cargoRows] = await pool.execute(sqlCargo, [rutLimpio]);
    if (!cargoRows || cargoRows.length === 0) {
      return {
        cargo: null,
        id_grupo: null,
        nombre_grupo: null,
        permisos_cargo: [],
        permisos_cargo_ids: []
      };
    }

    let cargo = null;
    let permisosCargo = [];

    if (cargoRows[0].id_cargo) {
      cargo = {
        id_cargo: cargoRows[0].id_cargo,
        nombre_cargo: cargoRows[0].nombre_cargo
      };

      const sqlPermisosCargo = `
        SELECT p.id_permiso, p.clave_permiso, p.descripcion
        FROM cargo_permisos cp
        INNER JOIN permisos p ON p.id_permiso = cp.id_permiso
        WHERE cp.id_cargo = ?
        ORDER BY p.clave_permiso ASC
      `;

      const [permisosCargoRows] = await pool.execute(sqlPermisosCargo, [cargo.id_cargo]);
      permisosCargo = (permisosCargoRows || []).map((p) => ({
        id_permiso: p.id_permiso,
        clave_permiso: p.clave_permiso,
        descripcion: p.descripcion || null,
        slug: toSlug(p.clave_permiso)
      }));
    }

    return {
      cargo,
      id_grupo: cargoRows[0].id_grupo,
      nombre_grupo: cargoRows[0].nombre_grupo,
      permisos_cargo: permisosCargo.map((p) => p.clave_permiso),
      permisos_cargo_ids: permisosCargo.map((p) => p.id_permiso)
    };
  } catch (error) {
    console.warn('[AUTH] No se pudo obtener contexto de cargo:', error.message);
    return {
      cargo: null,
      id_grupo: null,
      nombre_grupo: null,
      permisos_cargo: [],
      permisos_cargo_ids: []
    };
  }
}

// ============================================
// POST /api/login - Login Unificado
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { rut, password } = req.body;
    let userAdmin = null;
    let userTrabajador = null;
    let userFound = null;

    console.log('[AUTH][DIAG] req.body keys:', Object.keys(req.body || {}));
    console.log('RUT Recibido:', rut);
    
    if (!rut || !password) {
      console.log('[AUTH][DIAG] Rechazo en validación inicial: faltan llaves o valores de `rut`/`password`');
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere RUT y contraseña' 
      });
    }

    const rutLimpio = limpiarRUT(rut);
    console.log('[AUTH][DIAG] RUT Normalizado para consulta:', rutLimpio);

    // Limpieza condicional de password
    const passwordOriginal = String(password).trim();
    const passwordLimpiada = String(password)
      .replace(/[.\-]/g, '')
      .trim()
      .toUpperCase();

    // Si la password limpiada coincide con el RUT limpio, usamos la versión limpia
    // En caso contrario, usamos la password original (para claves complejas)
    const passwordParaBuscar = (passwordLimpiada === rutLimpio)
      ? rutLimpio
      : passwordOriginal;

    console.log('[AUTH][DIAG] Método password: comparación en texto plano (sin bcrypt)');
    console.log('[AUTH][DIAG] Password mode:', (passwordLimpiada === rutLimpio) ? 'RUT normalizado' : 'texto original');

    console.log(`[AUTH] Intento de login - RUT: ${rutLimpio}`);

    // PASO 1: Intentar login como ADMIN
    try {
      const sqlAdminDiag = 'SELECT rut, password, activo FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
      const [adminsDiag] = await pool.execute(sqlAdminDiag, [rutLimpio]);
      userAdmin = (adminsDiag && adminsDiag.length > 0) ? adminsDiag[0] : null;

      console.log('Admin Encontrado:', userAdmin ? 'SÍ' : 'NO');
      if (userAdmin) {
        console.log('Estado Activo:', userAdmin?.activo);
        const adminPasswordOk = String(userAdmin.password || '') === String(passwordParaBuscar || '');
        console.log('[AUTH][DIAG] Admin password match:', adminPasswordOk ? 'SÍ' : 'NO');
      }

      const sqlAdmin = `
        SELECT a.*, t.id_grupo, g.nombre_grupo
        FROM admin_users a 
        LEFT JOIN trabajadores t ON UPPER(REPLACE(REPLACE(REPLACE(a.rut, '.', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', ''))
        LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
        WHERE UPPER(REPLACE(REPLACE(REPLACE(a.rut, '.', ''), '-', ''), ' ', '')) = UPPER(?) 
          AND a.password = ? 
          AND a.activo = 1 
        LIMIT 1
      `;
      const [admins] = await pool.execute(sqlAdmin, [rutLimpio, passwordParaBuscar]);

      if (admins && admins.length > 0) {
        const admin = admins[0];
        const nombreCompleto = `${admin.nombres || ''} ${admin.apellido_paterno || ''} ${admin.apellido_materno || ''}`.trim() || rutLimpio;
        const contextoCargo = await obtenerContextoCargoPorRut(rutLimpio);
        
        // Obtener permisos del administrador
        let permisos = [];
        let esSuperAdmin = admin.es_super_admin || 0;
        
        try {
          const sqlPermisos = `
            SELECT p.id_permiso, p.clave_permiso 
            FROM admin_permisos ap
            INNER JOIN permisos p ON ap.id_permiso = p.id_permiso
            WHERE REPLACE(REPLACE(REPLACE(ap.admin_rut, ".", ""), "-", ""), " ", "") = ?
            ORDER BY p.clave_permiso ASC
          `;
          const [permisosData] = await pool.execute(sqlPermisos, [rutLimpio]);
          
          if (permisosData && permisosData.length > 0) {
            permisos = permisosData.map(p => p.clave_permiso);
          }
          
          console.log(`[AUTH] Permisos obtenidos para admin ${rutLimpio}:`, permisos);
        } catch (permisosError) {
          console.error('[AUTH] Error Crítico consultando permisos:', permisosError.message);
          return res.status(500).json({ 
            success: false, 
            message: 'Error de integridad SQL: No se pudo cargar el perfil de permisos. ' + permisosError.message
          });
        }
        
        console.log(`[AUTH] Login exitoso como ADMIN - ${nombreCompleto} (Super Admin: ${esSuperAdmin})`);
        
        return res.json({
          success: true,
          role: 'admin',
          rut: admin.rut || rutLimpio,
          nombre: nombreCompleto,
          email: admin.email || null,
          es_super_admin: esSuperAdmin,
          permisos: permisos,
          permisos_ids: [],
          id_grupo: admin.id_grupo || contextoCargo.id_grupo,
          grupo: admin.nombre_grupo || contextoCargo.nombre_grupo,
          cargo: contextoCargo.cargo,
          permisos_cargo: contextoCargo.permisos_cargo,
          permisos_cargo_ids: contextoCargo.permisos_cargo_ids,
          permisos_totales: {
            admin: [...new Set(permisos || [])],
            cargo: [...new Set(contextoCargo.permisos_cargo || [])]
          },
          redirect: '/gestionar.html',
          user: {
            rut: admin.rut || rutLimpio,
            nombres: admin.nombres || null,
            apellido_paterno: admin.apellido_paterno || null,
            apellido_materno: admin.apellido_materno || null,
            email: admin.email || null
          }
        });
      }

      const sqlAdminInactivo = 'SELECT rut FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? AND password = ? AND activo = 0 LIMIT 1';
      const [adminsInactivos] = await pool.execute(sqlAdminInactivo, [rutLimpio, passwordParaBuscar]);
      if (adminsInactivos && adminsInactivos.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Su cuenta de administrador está desactivada. Contacte a un Super Administrador.'
        });
      }
    } catch (adminError) {
      console.error('[AUTH] Error consultando admin_users:', adminError);
    }

    // PASO 2: Intentar login como USER (Trabajador)
    try {
      const sqlUserDiag = 'SELECT rut, password, activo FROM users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
      const [usersDiag] = await pool.execute(sqlUserDiag, [rutLimpio]);
      userTrabajador = (usersDiag && usersDiag.length > 0) ? usersDiag[0] : null;

      console.log('Trabajador Encontrado:', userTrabajador ? 'SÍ' : 'NO');
      if (userTrabajador) {
        console.log('Estado Activo:', userTrabajador?.activo);
        const userPasswordOk = String(userTrabajador.password || '') === String(passwordParaBuscar || '');
        console.log('[AUTH][DIAG] Trabajador password match:', userPasswordOk ? 'SÍ' : 'NO');
      }

      userFound = userAdmin || userTrabajador;
      console.log('[AUTH][DIAG] userFound RAW:', JSON.stringify(userFound));
      console.log('Estado Activo:', userFound?.activo);

      const sqlUser = `
        SELECT u.*, t.id_grupo, g.nombre_grupo
        FROM users u 
        LEFT JOIN trabajadores t ON UPPER(REPLACE(REPLACE(REPLACE(u.rut, '.', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', ''))
        LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
        WHERE UPPER(REPLACE(REPLACE(REPLACE(u.rut, '.', ''), '-', ''), ' ', '')) = UPPER(?) 
          AND u.password = ? 
          AND u.activo = 1 
        LIMIT 1
      `;
      const [users] = await pool.execute(sqlUser, [rutLimpio, passwordParaBuscar]);

      if (users && users.length > 0) {
        const user = users[0];
        const nombreCompleto = `${user.nombres || ''} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`.trim() || rutLimpio;
        const contextoCargo = await obtenerContextoCargoPorRut(rutLimpio);
        
        console.log(`[AUTH] Login exitoso como USER - ${nombreCompleto}`);
        
        return res.json({
          success: true,
          role: 'user',
          rut: user.rut || rutLimpio,
          nombre: nombreCompleto,
          email: user.email || null,
          id_grupo: user.id_grupo || contextoCargo.id_grupo,
          grupo: user.nombre_grupo || contextoCargo.nombre_grupo,
          cargo: contextoCargo.cargo,
          permisos_cargo: contextoCargo.permisos_cargo,
          permisos_cargo_ids: contextoCargo.permisos_cargo_ids,
          permisos_totales: {
            admin: [],
            cargo: [...new Set(contextoCargo.permisos_cargo || [])]
          },
          redirect: '/index.html',
          user: {
            rut: user.rut || rutLimpio,
            nombres: user.nombres || null,
            apellido_paterno: user.apellido_paterno || null,
            apellido_materno: user.apellido_materno || null,
            email: user.email || null
          }
        });
      }

      // Si existe pero esta inactivo, responder con mensaje especifico
      const sqlUserInactivo = 'SELECT rut FROM users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? AND password = ? AND activo = 0 LIMIT 1';
      const [usersInactivos] = await pool.execute(sqlUserInactivo, [rutLimpio, passwordParaBuscar]);
      if (usersInactivos && usersInactivos.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Su cuenta ha sido desactivada. Contacte al administrador.'
        });
      }
    } catch (userError) {
      console.error('[AUTH] Error consultando users:', userError);
    }

    // PASO 3: Credenciales inválidas
    console.log('[AUTH][DIAG] Rechazo final 401: no hubo coincidencia válida en admin_users ni users con password/activo');
    console.log(`[AUTH] Login fallido - RUT: ${rutLimpio}`);
    return res.status(401).json({ 
      success: false, 
      message: 'Credenciales inválidas' 
    });

  } catch (error) {
    console.error('[AUTH] Error general en login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

// ============================================
// GET /api/auth/me - Sincroniza sesión actual con DB
// ============================================
router.get('/auth/me', async (req, res) => {
  try {
    const rutRaw = req.query?.rut || req.headers['x-user-rut'] || req.headers['rut_solicitante'];
    const rutLimpio = limpiarRUT(rutRaw);

    if (!rutLimpio) {
      return res.status(400).json({ success: false, message: 'Se requiere rut para sincronizar sesión' });
    }

    const sqlTrabajador = `
      SELECT
        t.RUT,
        t.nombres,
        t.apellido_paterno,
        t.apellido_materno,
        t.email,
        t.telefono,
        t.id_grupo,
        g.nombre_grupo,
        t.cargo,
        t.activo
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', '') = ?
      LIMIT 1
    `;

    const [trabRows] = await pool.execute(sqlTrabajador, [rutLimpio]);
    if (!trabRows || trabRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado en trabajadores' });
    }

    const trabajador = trabRows[0];

    const [adminRows] = await pool.execute(
      `SELECT es_super_admin, activo, email
       FROM admin_users
       WHERE REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
      [rutLimpio]
    );

    const esAdmin = Boolean(adminRows && adminRows.length > 0 && Number(adminRows[0].activo) === 1);
    const esSuperAdmin = Boolean(esAdmin && Number(adminRows[0].es_super_admin) === 1);
    const role = esAdmin ? 'admin' : 'user';

    const nombreCompleto = `${trabajador.nombres || ''} ${trabajador.apellido_paterno || ''} ${trabajador.apellido_materno || ''}`.trim() || rutLimpio;
    const grupo = trabajador.nombre_grupo ? String(trabajador.nombre_grupo).trim() : (trabajador.id_grupo ? String(trabajador.id_grupo) : null);
    const email = trabajador.email || (esAdmin ? adminRows[0].email : null) || null;

    const contextoCargo = await obtenerContextoCargoPorRut(rutLimpio);

    return res.json({
      success: true,
      rut: trabajador.RUT || rutLimpio,
      role,
      nombre: nombreCompleto,
      email,
      es_super_admin: esSuperAdmin ? 1 : 0,
      id_grupo: trabajador.id_grupo || null,
      grupo,
      cargo: trabajador.cargo || contextoCargo?.cargo?.nombre_cargo || null,
      permisos_cargo: contextoCargo?.permisos_cargo || [],
      permisos_cargo_ids: contextoCargo?.permisos_cargo_ids || [],
      user: {
        rut: trabajador.RUT || rutLimpio,
        nombres: trabajador.nombres || null,
        apellido_paterno: trabajador.apellido_paterno || null,
        apellido_materno: trabajador.apellido_materno || null,
        email
      }
    });
  } catch (error) {
    console.error('[AUTH] Error sincronizando /auth/me:', error);
    return res.status(500).json({ success: false, message: 'Error sincronizando sesión', error: error.message });
  }
});

// ============================================
// GET /api/auth/perfil - Perfil de sesión sincronizado desde DB
// ============================================
router.get('/auth/perfil', async (req, res) => {
  try {
    const rutSesion = req.session?.userRut || req.session?.rut || null;
    const rutRaw = rutSesion || req.query?.rut || req.headers['x-user-rut'] || req.headers['rut_solicitante'];
    const rutLimpio = limpiarRUT(rutRaw);

    if (!rutLimpio) {
      return res.status(400).json({ success: false, message: 'No existe RUT de sesión para sincronizar perfil' });
    }

    const sqlTrabajador = `
      SELECT
        t.RUT,
        t.nombres,
        t.apellido_paterno,
        t.apellido_materno,
        t.email,
        t.telefono,
        t.id_grupo,
        g.nombre_grupo,
        t.cargo,
        t.activo
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE REPLACE(REPLACE(REPLACE(t.RUT, '.', ''), '-', ''), ' ', '') = ?
      LIMIT 1
    `;

    const [trabRows] = await pool.execute(sqlTrabajador, [rutLimpio]);
    if (!trabRows || trabRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado para el RUT de sesión' });
    }

    const trabajador = trabRows[0];
    const [adminRows] = await pool.execute(
      `SELECT es_super_admin, activo, email
       FROM admin_users
       WHERE REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
      [rutLimpio]
    );

    const esAdmin = Boolean(adminRows && adminRows.length > 0 && Number(adminRows[0].activo) === 1);
    const isSuperAdmin = Boolean(esAdmin && Number(adminRows[0].es_super_admin) === 1);
    const role = esAdmin ? 'admin' : 'user';

    const userName = `${trabajador.nombres || ''} ${trabajador.apellido_paterno || ''} ${trabajador.apellido_materno || ''}`.trim() || rutLimpio;
    const userEmail = trabajador.email || (esAdmin ? adminRows[0].email : null) || null;

    return res.json({
      success: true,
      RUT: trabajador.RUT || rutLimpio,
      Nombre: userName,
      Correo: userEmail,
      Rol: role,
      isSuperAdmin,
      user: {
        userRut: trabajador.RUT || rutLimpio,
        userName,
        userEmail,
        userRole: role,
        isSuperAdmin,
        grupo: trabajador.nombre_grupo ? String(trabajador.nombre_grupo).trim() : (trabajador.id_grupo ? String(trabajador.id_grupo) : null),
        cargo: trabajador.cargo || null
      }
    });
  } catch (error) {
    console.error('[AUTH] Error sincronizando /auth/perfil:', error);
    return res.status(500).json({ success: false, message: 'Error sincronizando perfil', error: error.message });
  }
});

// ============================================
// GET /api/perfil/:rut - Obtener datos completos del trabajador
// ============================================
router.get('/perfil/:rut', async (req, res) => {
  try {
    const rutParam = req.params.rut;
    const rutLimpio = limpiarRUT(rutParam);

    console.log(`[AUTH] Consultando perfil - RUT: ${rutLimpio}`);

    // Consultar en la tabla MAESTRA 'trabajadores' para obtener todos los detalles
    const sql = `
      SELECT 
        t.RUT, 
        t.nombres, 
        t.apellido_paterno, 
        t.apellido_materno, 
        t.email, 
        t.telefono, 
        t.id_grupo, 
        g.nombre_grupo,
        t.cargo, 
        t.activo,
        t.fecha_nacimiento,
        t.ciudad
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE REPLACE(REPLACE(REPLACE(t.RUT, ".", ""), "-", ""), " ", "") = ?
      LIMIT 1
    `;
    
    const [rows] = await pool.execute(sql, [rutLimpio]);

    if (rows && rows.length > 0) {
      const trabajador = rows[0];
      
      const grupoLetra = trabajador.nombre_grupo
        ? String(trabajador.nombre_grupo).trim()
        : (trabajador.id_grupo ? String(trabajador.id_grupo) : null);

      const perfil = {
        rut: trabajador.RUT,
        nombres: trabajador.nombres,
        apellido_paterno: trabajador.apellido_paterno,
        apellido_materno: trabajador.apellido_materno,
        apellidos: `${trabajador.apellido_paterno || ''} ${trabajador.apellido_materno || ''}`.trim(),
        email: trabajador.email,
        telefono: trabajador.telefono,
        grupo: grupoLetra,
        cargo: trabajador.cargo,
        activo: trabajador.activo === 1,
        fecha_nacimiento: trabajador.fecha_nacimiento,
        ciudad: trabajador.ciudad
      };

      console.log(`[AUTH] Perfil encontrado para RUT: ${rutLimpio}`);
      return res.json(perfil);
    } else {
      console.log(`[AUTH] Perfil no encontrado para RUT: ${rutLimpio}`);
      return res.status(404).json({ 
        message: 'Trabajador no encontrado en registros oficiales' 
      });
    }

  } catch (error) {
    console.error('[AUTH] Error obteniendo perfil:', error);
    return res.status(500).json({ 
      error: 'Error del servidor',
      message: error.message 
    });
  }
});

module.exports = router;
