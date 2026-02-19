const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion');

// Función helper para limpiar RUT
function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

// ============================================
// POST /api/login - Login Unificado
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { rut, password } = req.body;
    
    if (!rut || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere RUT y contraseña' 
      });
    }

    const rutLimpio = limpiarRUT(rut);

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

    console.log(`[AUTH] Intento de login - RUT: ${rutLimpio}`);

    // PASO 1: Intentar login como ADMIN
    try {
      const sqlAdmin = 'SELECT * FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? AND password = ? LIMIT 1';
      const [admins] = await pool.execute(sqlAdmin, [rutLimpio, passwordParaBuscar]);

      if (admins && admins.length > 0) {
        const admin = admins[0];
        const nombreCompleto = `${admin.nombres || ''} ${admin.apellido_paterno || ''} ${admin.apellido_materno || ''}`.trim() || rutLimpio;
        
        console.log(`[AUTH] Login exitoso como ADMIN - ${nombreCompleto}`);
        
        return res.json({
          success: true,
          role: 'admin',
          rut: admin.rut || rutLimpio,
          nombre: nombreCompleto,
          email: admin.email || null,
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
    } catch (adminError) {
      console.error('[AUTH] Error consultando admin_users:', adminError);
    }

    // PASO 2: Intentar login como USER (Trabajador)
    try {
      const sqlUser = 'SELECT * FROM users WHERE rut = ? AND password = ? AND activo = 1 LIMIT 1';
      const [users] = await pool.execute(sqlUser, [rutLimpio, passwordParaBuscar]);

      if (users && users.length > 0) {
        const user = users[0];
        const nombreCompleto = `${user.nombres || ''} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`.trim() || rutLimpio;
        
        console.log(`[AUTH] Login exitoso como USER - ${nombreCompleto}`);
        
        return res.json({
          success: true,
          role: 'user',
          rut: user.rut || rutLimpio,
          nombre: nombreCompleto,
          email: user.email || null,
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
      const sqlUserInactivo = 'SELECT rut FROM users WHERE rut = ? AND password = ? AND activo = 0 LIMIT 1';
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
