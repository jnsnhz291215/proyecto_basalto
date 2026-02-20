const express = require("express");
const { pool, obtenerTrabajadores, agregarTrabajador, eliminarTrabajador, editarTrabajador } = require("../ejemploconexion.js");

const app = express();

// Middleware para parsear JSON - DEBE IR PRIMERO
app.use(express.json());

// ============================================
// RUTAS DE AUTENTICACIÓN (SISTEMA UNIFICADO)
// ============================================
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// ============================================
// RUTAS DE TURNOS
// ============================================
const turnosRoutes = require('./routes/turnos');
app.use('/api', turnosRoutes);

// ============================================
// RUTAS DE VIAJES
// ============================================
const viajesRoutes = require('./routes/viajes');
app.use('/api', viajesRoutes);
// ============================================
// RUTAS DE TRABAJADORES
// ============================================
const trabajadoresRoutes = require('./routes/trabajadores');
app.use('/api', trabajadoresRoutes);
// ============================================
// RUTAS DE INFORMES
// ============================================
const informesRoutes = require('./routes/informes');
app.use('/api', informesRoutes);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});
app.use(express.static("public"));

const AUTO_CIERRE_MS = 60 * 60 * 1000; // 1 hora

let ultimoEstado = null;
let autoCierreTimeout = null;

// ============================================
// FUNCIÓN HELPER: REGISTRAR LOG DE AUDITORÍA
// ============================================
async function registrarLog(admin_rut, accion, detalle) {
  try {
    await pool.execute(
      'INSERT INTO admin_logs (admin_rut, accion, detalle, fecha) VALUES (?, ?, ?, NOW())',
      [admin_rut, accion, detalle]
    );
    console.log(`[LOG] ${accion} | Admin: ${admin_rut} | ${detalle}`);
  } catch (error) {
    // No detener la ejecución si falla el log
    console.error('[ERROR LOG] No se pudo registrar el log de auditoría:', error.message || error);
  }
}

// Resetear el timer de auto-cierre en cada petición
app.use((req, res, next) => {
  if (autoCierreTimeout) {
    clearTimeout(autoCierreTimeout);
  }

  autoCierreTimeout = setTimeout(() => {
    console.log("Auto-cierre: cerrando");
    process.exit(0);
  }, AUTO_CIERRE_MS);

  next();
});

// Endpoint para obtener datos
app.get("/datos", async (req, res) => {
  try {
    const incluirInactivos = req.query.incluirInactivos === 'true';
    const data = await obtenerTrabajadores(incluirInactivos);
    ultimoEstado = data;
    res.json(data);
  } catch (error) {
    console.error("Error al obtener trabajadores de la BD:", error);
    res.status(500).json({ error: "Error al obtener trabajadores" });
  }
});

// Endpoint para comprobar conexión a la base de datos
app.get('/ping-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1');
    res.json({ ok: true, rows });
  } catch (error) {
    console.error('Ping DB failed:', error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

// ============================================
// ENDPOINTS ANTIGUOS DE LOGIN (DESHABILITADOS)
// Se mantienen comentados para referencia
// ============================================

/*
// ANTIGUO: Endpoint de login (validación en servidor)
app.post('/login', async (req, res) => {
  try {
    const { usuario, clave } = req.body || {};
    if (!usuario || !clave) {
      return res.status(400).json({ error: 'Se requiere usuario y clave' });
    }

    // helpers
    const capitalizeWord = (w) => {
      if (!w) return '';
      return String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase();
    };
    const normalizeRut = (r) => String(r || '').replace(/[.\-]/g, '').trim().toUpperCase();

    const trabajadores = await obtenerTrabajadores();

    // buscar trabajador por usuario: NombrePrimerApellido con mayúsculas iniciales, todo junto
    const usuarioTrim = String(usuario || '').replace(/\s+/g, '');
    const found = trabajadores.find(t => {
      const nombres = (t.nombres || '').split(/\s+/).filter(Boolean);
      const apellidos = (t.apellidos || '').split(/\s+/).filter(Boolean);
      const firstName = nombres.length ? nombres[0] : '';
      const firstApellido = apellidos.length ? apellidos[0] : '';
      const expected = capitalizeWord(firstName) + capitalizeWord(firstApellido);
      return expected === usuarioTrim;
    });

    const remoteAddr = req.ip || req.connection && req.connection.remoteAddress || 'unknown';
    if (!found) {
      console.log(`[LOGIN FAIL] usuario=${usuarioTrim} ip=${remoteAddr} reason=not_found`);
      return res.status(401).json({ error: 'Usuario no encontrado o formato inválido' });
    }

    if (normalizeRut(clave) !== normalizeRut(found.RUT)) {
      console.log(`[LOGIN FAIL] usuario=${usuarioTrim} ip=${remoteAddr} reason=bad_password rut_try=${normalizeRut(clave)}`);
      return res.status(401).json({ error: 'Clave incorrecta' });
    }

    // éxito: log y devolver datos del trabajador
    console.log(`[LOGIN OK] usuario=${usuarioTrim} ip=${remoteAddr} rut=${found.RUT}`);
    return res.json({ success: true, trabajador: found });
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ error: 'Error en servidor' });
  }
});
*/

/*
// ANTIGUO: Endpoint admin-login: valida en tabla admin_users usando RUT (sin puntos/guion) y password
app.post('/admin-login', async (req, res) => {
  try {
    const { rut, password } = req.body || {};
    if (!rut || !password) return res.status(400).json({ error: 'Se requiere rut y password' });
    const rutNorm = String(rut).replace(/[.\-\s]/g, '').trim();
    // Buscar admin en la BD
    const sql = 'SELECT * FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
    try{
      const [rows] = await pool.execute(sql, [rutNorm]);
      if (!rows || rows.length === 0) {
        console.log(`[ADMIN LOGIN FAIL] rut=${rutNorm} reason=not_found ip=${req.ip||req.connection.remoteAddress}`);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const user = rows[0];
      
      console.log('[ADMIN LOGIN] Datos del usuario desde BD:', {
        id: user.id,
        rut: user.rut,
        nombres: user.nombres,
        apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno,
        email: user.email
      });
      
      // Comparar password (asumimos texto plano en columna `password`)
      if (String(user.password || '') !== String(password)) {
        console.log(`[ADMIN LOGIN FAIL] rut=${rutNorm} reason=bad_password ip=${req.ip||req.connection.remoteAddress}`);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      console.log(`[ADMIN LOGIN OK] rut=${rutNorm} ip=${req.ip||req.connection.remoteAddress}`);
      
      // Devolver respuesta con datos completos del admin
      const fullName = `${user.nombres || ''} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`.trim();
      
      const responseData = { 
        success: true, 
        user: { 
          id: user.id || null, 
          rut: user.rut || null, 
          nombres: user.nombres || null,
          apellido_paterno: user.apellido_paterno || null,
          apellido_materno: user.apellido_materno || null,
          email: user.email || null,
          fullName: fullName || user.rut || 'Administrador'
        } 
      };
      
      console.log('[ADMIN LOGIN] Respuesta que se envía al cliente:', responseData);
      
      return res.json(responseData);
    }catch(qe){
      console.error('Error query admin_users:', qe);
      return res.status(500).json({ error: 'Error en servidor' });
    }
  } catch (err) {
    console.error('Error en /admin-login:', err);
    res.status(500).json({ error: 'Error en servidor' });
  }
});
*/

// ============================================
// ENDPOINTS: LOGS DE AUDITORÍA
// ============================================

// GET /api/logs - Obtener logs de auditoría
app.get('/api/logs', async (req, res) => {
  try {
    const { admin_rut } = req.query;
    
    let query = 'SELECT * FROM admin_logs';
    let params = [];
    
    // Filtrar por admin específico si se proporciona
    if (admin_rut) {
      query += ' WHERE admin_rut = ?';
      params.push(admin_rut);
    }
    
    query += ' ORDER BY fecha DESC LIMIT 100';
    
    const [rows] = await pool.execute(query, params);
    res.json(rows);
    
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
});

// ============================================
// ENDPOINTS: GESTIÓN DE CARGOS
// ============================================

// GET /api/cargos - Obtener lista de cargos
app.get('/api/cargos', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_cargo, nombre_cargo FROM cargos ORDER BY nombre_cargo ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener cargos:', error);
    res.status(500).json({ error: 'Error al obtener cargos' });
  }
});

// POST /api/cargos - Crear nuevo cargo
app.post('/api/cargos', async (req, res) => {
  try {
    const { nombre_cargo } = req.body;
    
    if (!nombre_cargo || !nombre_cargo.trim()) {
      return res.status(400).json({ error: 'El nombre del cargo es requerido' });
    }

    const cargoNormalizado = nombre_cargo.trim();

    // Insertar el nuevo cargo
    const [result] = await pool.execute(
      'INSERT INTO cargos (nombre_cargo) VALUES (?)',
      [cargoNormalizado]
    );

    console.log(`[CARGO CREADO] ${cargoNormalizado}`);
    res.json({ success: true, id_cargo: result.insertId, nombre_cargo: cargoNormalizado });
    
  } catch (error) {
    // Error de duplicado (código 1062 en MySQL/MariaDB)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este cargo ya existe' });
    }
    
    console.error('Error al crear cargo:', error);
    res.status(500).json({ error: 'Error al crear el cargo' });
  }
});

// ============================================
// ENDPOINTS: GESTIÓN DE CIUDADES
// ============================================

// GET /api/ciudades - Obtener lista de ciudades
app.get('/api/ciudades', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_ciudad, nombre_ciudad FROM ciudades ORDER BY nombre_ciudad ASC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener ciudades:', error);
    res.status(500).json({ error: 'Error al obtener ciudades' });
  }
});

// POST /api/ciudades - Crear nueva ciudad
app.post('/api/ciudades', async (req, res) => {
  try {
    const { nombre_ciudad } = req.body;
    
    if (!nombre_ciudad || !nombre_ciudad.trim()) {
      return res.status(400).json({ error: 'El nombre de la ciudad es requerido' });
    }

    const ciudadNormalizada = nombre_ciudad.trim();

    // Insertar la nueva ciudad
    await pool.execute(
      'INSERT INTO ciudades (nombre_ciudad) VALUES (?)',
      [ciudadNormalizada]
    );

    console.log(`[CIUDAD CREADA] ${ciudadNormalizada}`);
    res.json({ success: true, nombre_ciudad: ciudadNormalizada });
    
  } catch (error) {
    // Error de duplicado (código 1062 en MySQL/MariaDB)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Esta ciudad ya existe' });
    }
    
    console.error('Error al crear ciudad:', error);
    res.status(500).json({ error: 'Error al crear la ciudad' });
  }
});

// ============================================
// ENDPOINT: CREAR INFORME DE TURNO
// ============================================
app.post('/api/informes', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { datosGenerales, actividades, perforaciones, herramientas } = req.body;

    if (!datosGenerales) {
      return res.status(400).json({ error: 'Se requieren datos generales del informe' });
    }

    // PASO 1: GENERAR FOLIO AUTOMÁTICO
    const [ultimoInforme] = await connection.execute(
      'SELECT numero_informe FROM informes_turno ORDER BY id_informe DESC LIMIT 1'
    );

    let nuevoNumero = 1;
    if (ultimoInforme && ultimoInforme.length > 0 && ultimoInforme[0].numero_informe) {
      // Extraer el número del folio (ej: "INF-0005" -> 5)
      const match = ultimoInforme[0].numero_informe.match(/INF-(\d+)/);
      if (match) {
        nuevoNumero = parseInt(match[1], 10) + 1;
      }
    }

    const folio = `INF-${String(nuevoNumero).padStart(4, '0')}`;
    console.log(`[INFORME] Generando folio: ${folio}`);

    // PASO 2: INICIAR TRANSACCIÓN
    await connection.beginTransaction();

    // PASO 3A: INSERT EN TABLA PRINCIPAL (informes_turno)
    const [resultInforme] = await connection.execute(
      `INSERT INTO informes_turno (
        numero_informe, fecha, turno, horas_trabajadas, faena, lugar, equipo, operador_rut, 
        ayudante_1, ayudante_2, pozo_numero, sector, diametro, inclinacion, profundidad_inicial,
        profundidad_final, mts_perforados, pull_down, rpm, horometro_inicial, horometro_final, 
        horometro_hrs, insumo_petroleo, insumo_lubricantes, observaciones, estado, creado_el
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        folio,
        datosGenerales.fecha || null,
        datosGenerales.turno || null,
        datosGenerales.horas_trabajadas || null,
        datosGenerales.faena || null,
        datosGenerales.lugar || null,
        datosGenerales.equipo || null,
        datosGenerales.operador_rut || null,
        datosGenerales.ayudante_1 || null,
        datosGenerales.ayudante_2 || null,
        datosGenerales.pozo_numero || null,
        datosGenerales.sector || null,
        datosGenerales.diametro || null,
        datosGenerales.inclinacion || null,
        datosGenerales.profundidad_inicial || null,
        datosGenerales.profundidad_final || null,
        datosGenerales.mts_perforados || null,
        datosGenerales.pull_down || null,
        datosGenerales.rpm || null,
        datosGenerales.horometro_inicial || null,
        datosGenerales.horometro_final || null,
        datosGenerales.horometro_hrs || null,
        datosGenerales.insumo_petroleo || null,
        datosGenerales.insumo_lubricantes || null,
        datosGenerales.observaciones || null,
        datosGenerales.estado || 'Borrador'
      ]
    );

    const idInforme = resultInforme.insertId;
    console.log(`[INFORME] Informe creado con ID: ${idInforme}`);

    // PASO 3B: INSERT DE ACTIVIDADES
    if (actividades && actividades.length > 0) {
      for (const act of actividades) {
        await connection.execute(
          'INSERT INTO actividades_turno (id_informe, hora_desde, hora_hasta, detalle, hrs_bd, hrs_cliente) VALUES (?, ?, ?, ?, ?, ?)',
          [idInforme, act.hora_desde || null, act.hora_hasta || null, act.detalle || null, act.hrs_bd || null, act.hrs_cliente || null]
        );
      }
      console.log(`[INFORME] ${actividades.length} actividades insertadas`);
    }

    // PASO 3C: INSERT DE PERFORACIONES
    if (perforaciones && perforaciones.length > 0) {
      for (const perf of perforaciones) {
        await connection.execute(
          'INSERT INTO perforaciones_turno (id_informe, desde, hasta, metros_perforados, recuperacion, tipo_roca, dureza) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            idInforme,
            perf.desde || null,
            perf.hasta || null,
            perf.metros_perforados || null,
            perf.recuperacion || null,
            perf.tipo_roca || null,
            perf.dureza || null
          ]
        );
      }
      console.log(`[INFORME] ${perforaciones.length} perforaciones insertadas`);
    }

    // PASO 3D: INSERT DE HERRAMIENTAS/MATERIALES
    if (herramientas && herramientas.length > 0) {
      for (const herr of herramientas) {
        await connection.execute(
          'INSERT INTO herramientas_turno (id_informe, tipo_elemente, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [idInforme, herr.tipo_elemente || null, herr.diametro || null, herr.numero_serie || null, herr.desde_mts || null, herr.hasta_mts || null, herr.detalle_extra || null]
        );
      }
      console.log(`[INFORME] ${herramientas.length} herramientas insertadas`);
    }

    // PASO 4: COMMIT DE LA TRANSACCIÓN
    await connection.commit();
    console.log(`[INFORME] Transacción completada exitosamente`);

    // RESPUESTA EXITOSA
    res.status(201).json({
      success: true,
      folio: folio,
      id_informe: idInforme,
      estado: datosGenerales.estado || 'Borrador',
      message: 'Informe guardado correctamente'
    });

  } catch (error) {
    // ROLLBACK EN CASO DE ERROR
    await connection.rollback();
    console.error('[INFORME ERROR]', error);
    res.status(500).json({
      error: 'Error al guardar el informe',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// ============================================
// ENDPOINT FUTURO: ACTUALIZAR INFORME (PUT)
// ============================================
// IMPORTANTE: Cuando se implemente el endpoint PUT para actualizar informes,
// se debe validar que el estado del informe NO sea 'Finalizado'.
// Si estado === 'Finalizado', rechazar con:
// return res.status(403).json({ error: 'No se puede editar un informe finalizado y bloqueado' });
// ============================================

// Endpoint /guardar eliminado (guardado en JSON ya no se usa)

// Funciones de validación del servidor
function validarEmailServidor(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validarRUTServidor(rut) {
  // Validar formato con guion: 12345678-9
  const rutRegex = /^\d{7,8}-[\dkK]$/;
  return rutRegex.test(rut);
}

function validarTelefonoServidor(telefono) {
  // Validar formato +56934946889
  const telefonoRegex = /^\+56\d{9}$/;
  return telefonoRegex.test(telefono);
}

function limpiarRUTServidor(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

async function resolverIdGrupo(grupoInput) {
  const valor = String(grupoInput || '').trim();
  if (!valor) return null;

  const posibleId = parseInt(valor, 10);
  if (Number.isInteger(posibleId)) {
    const [rows] = await pool.execute(
      'SELECT id_grupo FROM grupos WHERE id_grupo = ? LIMIT 1',
      [posibleId]
    );
    return rows && rows[0] ? rows[0].id_grupo : null;
  }

  const [rows] = await pool.execute(
    'SELECT id_grupo FROM grupos WHERE nombre_grupo = ? LIMIT 1',
    [valor]
  );
  return rows && rows[0] ? rows[0].id_grupo : null;
}

async function resolverNombreCargo(cargoInput) {
  const valor = String(cargoInput || '').trim();
  if (!valor) return null;

  const posibleId = parseInt(valor, 10);
  if (Number.isInteger(posibleId)) {
    const [rows] = await pool.execute(
      'SELECT nombre_cargo FROM cargos WHERE id_cargo = ? LIMIT 1',
      [posibleId]
    );
    return rows && rows[0] ? rows[0].nombre_cargo : null;
  }

  return valor;
}

// Endpoint para agregar trabajador
const handleAgregarTrabajador = async (req, res) => {
  let connection;
  try {
    const nuevoTrabajador = req.body;
    
    // Validar que todos los campos estén presentes y no estén vacíos
    const grupoInput = nuevoTrabajador.id_grupo || nuevoTrabajador.grupo;

    if (!nuevoTrabajador.nombres || !nuevoTrabajador.apellidos || !nuevoTrabajador.RUT ||
        !nuevoTrabajador.email || !nuevoTrabajador.telefono || !grupoInput) {
      return res.status(400).json({ error: "Todos los campos son requeridos y no pueden estar en blanco" });
    }
    
    // Validar que los campos no sean solo espacios en blanco
    if (nuevoTrabajador.nombres.trim() === '' || nuevoTrabajador.apellidos.trim() === '' ||
        nuevoTrabajador.RUT.trim() === '' || nuevoTrabajador.email.trim() === '' ||
        nuevoTrabajador.telefono.trim() === '' || String(grupoInput).trim() === '') {
      return res.status(400).json({ error: "Ningún campo puede estar en blanco" });
    }
    
    // Validar formato de email
    if (!validarEmailServidor(nuevoTrabajador.email)) {
      return res.status(400).json({ error: "El formato del email es inválido. Debe ser: texto@texto.texto" });
    }
    
    // Validar formato de RUT
    if (!validarRUTServidor(nuevoTrabajador.RUT)) {
      return res.status(400).json({ error: "El formato del RUT es inválido. Debe tener entre 7-8 dígitos seguidos de un guion y dígito verificador" });
    }
    
    // Validar formato de teléfono
    if (!validarTelefonoServidor(nuevoTrabajador.telefono)) {
      return res.status(400).json({ error: "El formato del teléfono es inválido. Debe ser: +56 seguido de 9 dígitos" });
    }
    
    // Validar grupo
    const id_grupo = await resolverIdGrupo(grupoInput);
    if (!id_grupo) {
      return res.status(400).json({ error: "El grupo seleccionado no es válido" });
    }
    
    // Verificar que el RUT no exista en la BD
    const trabajadoresExistentes = await obtenerTrabajadores();
    if (trabajadoresExistentes.some(t => t.RUT === nuevoTrabajador.RUT)) {
      return res.status(400).json({ error: "Ya existe un trabajador con este RUT" });
    }

    // Preparar apellidos (paterno / materno)
    const apellidosRaw = (nuevoTrabajador.apellidos || '').trim();
    let apellido_paterno = '';
    let apellido_materno = '';
    if (apellidosRaw) {
      const parts = apellidosRaw.split(/\s+/);
      apellido_paterno = parts.shift() || '';
      apellido_materno = parts.join(' ') || '';
    }

    // Normalizar capitalización: primera letra en mayúscula por palabra
    const titleCase = s => {
      if (!s && s !== '') return s;
      return String(s || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const nombresNorm = titleCase(nuevoTrabajador.nombres);
    const apellidoPaternoNorm = titleCase(apellido_paterno);
    const apellidoMaternoNorm = titleCase(apellido_materno);
    const cargoNombre = await resolverNombreCargo(nuevoTrabajador.id_cargo || nuevoTrabajador.cargo);
    const cargoNorm = cargoNombre ? titleCase(cargoNombre) : null;
    const ciudadNorm = nuevoTrabajador.ciudad ? titleCase(nuevoTrabajador.ciudad) : null;
    const fechaNacimiento = nuevoTrabajador.fecha_nacimiento || null;

    // Limpieza de RUT para password inicial en users
    const rutLimpio = limpiarRUTServidor(nuevoTrabajador.RUT);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // INSERT 1: trabajadores
    await connection.execute(
      'INSERT INTO trabajadores (nombres, apellido_paterno, apellido_materno, RUT, email, telefono, id_grupo, cargo, ciudad, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nombresNorm,
        apellidoPaternoNorm,
        apellidoMaternoNorm,
        nuevoTrabajador.RUT,
        nuevoTrabajador.email,
        nuevoTrabajador.telefono,
        id_grupo,
        cargoNorm,
        ciudadNorm,
        fechaNacimiento
      ]
    );

    // INSERT 2: users (password inicial = RUT limpio)
    await connection.execute(
      'INSERT INTO users (rut, nombres, apellido_paterno, apellido_materno, email, password) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password = password',
      [
        rutLimpio,
        nombresNorm,
        apellidoPaternoNorm,
        apellidoMaternoNorm,
        nuevoTrabajador.email,
        rutLimpio
      ]
    );

    await connection.commit();
    
    // Registrar log de auditoría (si se proporcionó admin_rut)
    if (nuevoTrabajador.admin_rut) {
      await registrarLog(
        nuevoTrabajador.admin_rut,
        'AGREGAR_TRABAJADOR',
        `Se agregó el trabajador: ${nuevoTrabajador.nombres} ${nuevoTrabajador.apellidos} (RUT: ${nuevoTrabajador.RUT})`
      );
    }
    
    const trabajadores = await obtenerTrabajadores();
    ultimoEstado = trabajadores;
    
    res.json({ 
      success: true, 
      trabajadores: trabajadores,
      message: "Trabajador agregado exitosamente" 
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error("Error al agregar trabajador:", error);
    const resp = { error: "Error al agregar trabajador" };
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      resp.detail = error && (error.message || String(error));
    }
    res.status(500).json(resp);
  } finally {
    if (connection) connection.release();
  }
};

app.post("/agregar-trabajador", handleAgregarTrabajador);
app.post("/api/trabajadores", handleAgregarTrabajador);

// Endpoint para editar trabajador
const handleEditarTrabajador = async (req, res) => {
  try {
    const trabajador = req.body;
    
    // Validar que todos los campos estén presentes y no estén vacíos
    const grupoInput = trabajador.id_grupo || trabajador.grupo;

    if (!trabajador.rut || !trabajador.nombres || !trabajador.apellidos || 
        !trabajador.email || !trabajador.telefono || !grupoInput) {
      return res.status(400).json({ error: "Todos los campos son requeridos y no pueden estar en blanco" });
    }
    
    // Validar que los campos no sean solo espacios en blanco
    if (trabajador.rut.trim() === '' || trabajador.nombres.trim() === '' || trabajador.apellidos.trim() === '' ||
        trabajador.email.trim() === '' || trabajador.telefono.trim() === '' || String(grupoInput).trim() === '') {
      return res.status(400).json({ error: "Ningún campo puede estar en blanco" });
    }
    
    // Validar formato de email
    if (!validarEmailServidor(trabajador.email)) {
      return res.status(400).json({ error: "El formato del email es inválido. Debe ser: texto@texto.texto" });
    }
    
    // Validar formato de teléfono
    if (!validarTelefonoServidor(trabajador.telefono)) {
      return res.status(400).json({ error: "El formato del teléfono es inválido. Debe ser: +56 seguido de 9 dígitos" });
    }
    
    // Validar grupo
    const id_grupo = await resolverIdGrupo(grupoInput);
    if (!id_grupo) {
      return res.status(400).json({ error: "El grupo seleccionado no es válido" });
    }

    // Preparar apellidos (paterno / materno)
    const apellidosRaw = (trabajador.apellidos || '').trim();
    let apellido_paterno = '';
    let apellido_materno = '';
    if (apellidosRaw) {
      const parts = apellidosRaw.split(/\s+/);
      apellido_paterno = parts.shift() || '';
      apellido_materno = parts.join(' ') || '';
    }

    // Editar el trabajador en la BD
    try {
      const cargoNombre = await resolverNombreCargo(trabajador.id_cargo || trabajador.cargo);

      await editarTrabajador(
        trabajador.rut,
        trabajador.nombres,
        apellido_paterno,
        apellido_materno,
        trabajador.email,
        trabajador.telefono,
        id_grupo,
        cargoNombre || null,
        trabajador.ciudad || null,
        trabajador.fecha_nacimiento || null
      );
    } catch (e) {
      if (e && e.code === 'RUT_NOT_FOUND') {
        return res.status(404).json({ error: "No se encontró un trabajador con ese RUT" });
      }
      throw e;
    }
    
    // Registrar log de auditoría (si se proporcionó admin_rut)
    if (trabajador.admin_rut) {
      await registrarLog(
        trabajador.admin_rut,
        'EDITAR_TRABAJADOR',
        `Se editó el trabajador: ${trabajador.nombres} ${trabajador.apellidos} (RUT: ${trabajador.rut})`
      );
    }
    
    const trabajadores = await obtenerTrabajadores();
    ultimoEstado = trabajadores;
    
    res.json({ 
      success: true, 
      trabajadores: trabajadores,
      message: "Trabajador actualizado exitosamente" 
    });
  } catch (error) {
    console.error("Error al editar trabajador:", error);
    const resp = { error: "Error al editar trabajador" };
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      resp.detail = error && (error.message || String(error));
    }
    res.status(500).json(resp);
  }
};

app.post("/editar-trabajador", handleEditarTrabajador);
app.put("/api/trabajadores/:rut", async (req, res) => {
  if (!req.body || !req.body.rut) {
    req.body = req.body || {};
    req.body.rut = req.params.rut;
  }
  return handleEditarTrabajador(req, res);
});

// ============================================
// ENDPOINTS: Soft Delete / Estado de Trabajador
// ============================================

// PUT /api/trabajadores/:rut/estado - Cambiar estado activo/inactivo (Soft Delete)
app.put("/api/trabajadores/:rut/estado", async (req, res) => {
  let connection;
  try {
    const { rut } = req.params;
    const { activo, admin_rut } = req.body;

    if (!rut || rut.trim() === '') {
      return res.status(400).json({ error: "RUT requerido" });
    }

    if (activo === undefined || activo === null) {
      return res.status(400).json({ error: "Estado 'activo' requerido (true/false)" });
    }

    // Normalizar RUT
    const rutNormalizado = rut.trim().toUpperCase();
    const rutLimpio = limpiarRUTServidor(rut);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Operacion A: trabajadores
    await connection.execute(
      'UPDATE trabajadores SET activo = ? WHERE RUT = ?',
      [activo ? 1 : 0, rutNormalizado]
    );

    // Operacion B: users
    await connection.execute(
      'UPDATE users SET activo = ? WHERE rut = ?',
      [activo ? 1 : 0, rutLimpio]
    );

    // Operacion C: viajes (cascada)
    await connection.execute(
      'UPDATE viajes SET estado = ? WHERE rut_trabajador = ?',
      [activo ? 'Programado' : 'Cancelado', rutNormalizado]
    );

    await connection.commit();

    // Registrar log de auditoría
    const accion = activo ? 'REACTIVAR_TRABAJADOR' : 'DESACTIVAR_TRABAJADOR';
    if (admin_rut) {
      await registrarLog(admin_rut, accion, `Trabajador ${rutNormalizado} - Nueva estado: ${activo ? 'Activo' : 'Inactivo'}`);
    }

    // Retornar lista actualizada
    const trabajadoresDespues = await obtenerTrabajadores(false);
    ultimoEstado = trabajadoresDespues;

    res.json({
      success: true,
      message: activo ? "Trabajador reactivado" : "Trabajador desactivado",
      trabajadores: trabajadoresDespues
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    console.error("Error al cambiar estado de trabajador:", error);
    res.status(500).json({ error: "Error al cambiar estado del trabajador" });
  } finally {
    if (connection) connection.release();
  }
});

// Endpoint para eliminar trabajador por RUT
const handleEliminarTrabajador = async (req, res) => {
  try {
    const { rut, admin_rut, admin_password } = req.body;
    
    if (!rut || typeof rut !== 'string' || rut.trim() === '') {
      return res.status(400).json({ error: "Se requiere el RUT del trabajador" });
    }
    
    // Si se proporciona contraseña de admin, validarla
    if (admin_password) {
      // Validar que el admin existe y la contraseña es correcta
      const rutNorm = String(admin_rut).replace(/[.\-\s]/g, '').trim();
      const sql = 'SELECT * FROM admin_users WHERE REPLACE(REPLACE(REPLACE(rut, ".", ""), "-", ""), " ", "") = ? LIMIT 1';
      
      try {
        const [rows] = await pool.execute(sql, [rutNorm]);
        if (!rows || rows.length === 0) {
          console.log(`[HARD DELETE FAIL] rut_worker=${rut} admin_rut=${rutNorm} reason=admin_not_found`);
          return res.status(401).json({ error: 'Credenciales de administrador inválidas' });
        }
        
        const user = rows[0];
        if (String(user.password || '') !== String(admin_password)) {
          console.log(`[HARD DELETE FAIL] rut_worker=${rut} admin_rut=${rutNorm} reason=bad_password`);
          return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }
        
        // Contraseña válida - proceder con eliminación
        console.log(`[HARD DELETE AUTHORIZED] rut_worker=${rut} admin_rut=${rutNorm}`);
      } catch (qe) {
        console.error('Error validando credenciales de admin:', qe);
        return res.status(500).json({ error: 'Error al validar credenciales' });
      }
    }
    
    try {
      await eliminarTrabajador(rut.trim());
      
      // Registrar log de auditoría
      if (admin_rut) {
        await registrarLog(admin_rut, 'ELIMINAR_TRABAJADOR', `Se eliminó DEFINITIVAMENTE el trabajador con RUT: ${rut.trim()}`);
      }
      
      const trabajadoresDespues = await obtenerTrabajadores();
      ultimoEstado = trabajadoresDespues;
      res.json({ success: true, trabajadores: trabajadoresDespues, message: "Trabajador eliminado definitivamente" });
    } catch (e) {
      if (e && e.code === 'RUT_NOT_FOUND') {
        return res.status(404).json({ error: "No se encontró un trabajador con ese RUT" });
      }
      console.error('Error en eliminarTrabajador:', e);
      return res.status(500).json({ error: 'Error al eliminar trabajador' });
    }
  } catch (error) {
    console.error("Error al eliminar trabajador:", error);
    res.status(500).json({ error: "Error al eliminar trabajador" });
  }
};

app.post("/eliminar-trabajador", handleEliminarTrabajador);
app.delete("/api/trabajadores/:rut", async (req, res) => {
  if (!req.body || !req.body.rut) {
    req.body = req.body || {};
    req.body.rut = req.params.rut;
  }
  return handleEliminarTrabajador(req, res);
});

// ============================================
// ENDPOINTS: Descarga de Trabajadores (Excel)
// ============================================

// GET /api/trabajadores/download - Descargar tabla de trabajadores en Excel
app.get('/api/trabajadores/download', async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    
    console.log('[DESCARGA] Generando Excel de trabajadores...');
    
    // Obtener todos los trabajadores de la BD
    const [trabajadores] = await pool.execute(
      `SELECT RUT, nombres, apellido_paterno, apellido_materno, email, 
              fecha_nacimiento, ciudad, telefono, id_grupo, cargo, activo
       FROM trabajadores
       ORDER BY apellido_paterno, apellido_materno, nombres ASC`
    );
    
    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trabajadores');
    
    // Definir encabezados
    const headers = ['RUT', 'NOMBRE', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 
                     'EMAIL', 'FECHA NACIMIENTO', 'CIUDAD', 'TELÉFONO', 'GRUPO', 'CARGO', 'ESTADO'];
    
    worksheet.columns = headers.map(header => ({ 
      header: header, 
      width: header === 'EMAIL' ? 25 : header === 'FECHA NACIMIENTO' ? 18 : 15
    }));
    
    // Agregar filas de datos
    trabajadores.forEach(t => {
      const grupoLetra = t.id_grupo ? String.fromCharCode(64 + t.id_grupo) : 'N/A';
      const estado = t.activo === 1 ? 'Activo' : 'Inactivo';
      const fechaNacimiento = t.fecha_nacimiento ? new Date(t.fecha_nacimiento).toLocaleDateString('es-CL') : '';
      
      worksheet.addRow([
        t.RUT || '',
        t.nombres || '',
        t.apellido_paterno || '',
        t.apellido_materno || '',
        t.email || '',
        fechaNacimiento,
        t.ciudad || '',
        t.telefono || '',
        grupoLetra,
        t.cargo || '',
        estado
      ]);
    });
    
    // Estilos básicos a los encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    
    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Configurar respuesta para descargar
    const filename = `Trabajadores_Basalto_Drilling.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    console.log(`[DESCARGA] Excel generado correctamente: ${trabajadores.length} trabajadores`);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('[ERROR DESCARGA] Error al generar Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel' });
  }
});

// ============================================
// ENDPOINTS: Excepciones de Turno
// ============================================

// POST /api/excepciones - Guardar nueva excepción de turno
app.post("/api/excepciones", async (req, res) => {
  try {
    const { rut, inicio, fin, motivo } = req.body;

    // Validación básica
    if (!rut || !inicio || !fin) {
      return res.status(400).json({ error: "Faltan datos requeridos (rut, inicio, fin)" });
    }

    // Calcular diferencia de días
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    
    if (fechaFin < fechaInicio) {
      return res.status(400).json({ error: "La fecha de fin no puede ser anterior a la fecha de inicio" });
    }

    const diffTime = Math.abs(fechaFin - fechaInicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días

    // Insertar en la base de datos
    await pool.execute(
      'INSERT INTO excepciones_turno (rut_trabajador, fecha_inicio, fecha_fin, dias_duracion, motivo) VALUES (?, ?, ?, ?, ?)',
      [rut, inicio, fin, diffDays, motivo || null]
    );

    res.json({ 
      success: true, 
      message: "Excepción de turno guardada correctamente",
      dias_duracion: diffDays
    });
  } catch (error) {
    console.error("Error al guardar excepción de turno:", error);
    res.status(500).json({ error: "Error al guardar excepción de turno" });
  }
});

// GET /api/excepciones/:rut - Obtener historial de excepciones de un trabajador
app.get("/api/excepciones/:rut", async (req, res) => {
  try {
    const { rut } = req.params;

    if (!rut) {
      return res.status(400).json({ error: "RUT no proporcionado" });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM excepciones_turno WHERE rut_trabajador = ? ORDER BY fecha_inicio DESC',
      [rut]
    );

    res.json({ success: true, excepciones: rows });
  } catch (error) {
    console.error("Error al obtener excepciones:", error);
    res.status(500).json({ error: "Error al obtener excepciones" });
  }
});

// ============================================
// LÓGICA DE TURNOS ROTATIVOS (CICLO 56 DÍAS)
// ============================================

/**
 * Obtener la semilla (fecha referencia) para un grupo
 * @param {string} grupo - Letra del grupo (A-H)
 * @returns {Promise<Date>} - Fecha semilla del ciclo
 */
async function obtenerSemillaGrupo(grupo) {
  try {
    const pista = ['A', 'B', 'C', 'D'].includes(grupo.toUpperCase()) ? 'PISTA_1' : 'PISTA_2';
    const [rows] = await pool.execute(
      'SELECT fecha_semilla FROM configuracion_ciclos WHERE pista_nombre = ? AND tipo_ciclo = "ROTATIVO" AND activo = 1 LIMIT 1',
      [pista]
    );
    
    if (rows.length === 0) {
      console.error(`No se encontró semilla para ${pista}`);
      return null;
    }
    
    return new Date(rows[0].fecha_semilla);
  } catch (error) {
    console.error('Error al obtener semilla:', error);
    return null;
  }
}

/**
 * Calcular el día del ciclo (0-55) para una fecha dada
 * @param {Date} fechaConsulta - Fecha a calcular
 * @param {Date} fechaSemilla - Fecha semilla del ciclo
 * @returns {number} - Día del ciclo (0-55)
 */
function calcularDiaCiclo(fechaConsulta, fechaSemilla) {
  if (!fechaConsulta || !fechaSemilla) return 0;
  
  // Normalizar a medianoche para comparación correcta
  const consulta = new Date(fechaConsulta);
  consulta.setHours(0, 0, 0, 0);
  
  const semilla = new Date(fechaSemilla);
  semilla.setHours(0, 0, 0, 0);
  
  // Diferencia en milisegundos
  const diffMs = consulta - semilla;
  
  // Convertir a días
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Normalizar a rango 0-55 (asegurar que negativos se conviertan a positivos)
  let diaCiclo = diffDias % 56;
  if (diaCiclo < 0) {
    diaCiclo += 56;
  }
  
  return diaCiclo;
}

/**
 * Determinar la fase (0-3) basada en el día del ciclo
 * @param {number} diaCiclo - Día del ciclo (0-55)
 * @returns {number} - Fase (0-3)
 */
function determinarFase(diaCiclo) {
  return Math.floor(diaCiclo / 14);
}

/**
 * Obtener reglas de turno para PISTA 1 (grupos A, B, C, D)
 * @param {number} fase - Fase del ciclo (0-3)
 * @returns {object} - Objeto con reglas de turno por grupo
 */
function obtenerReglasPista1(fase) {
  const reglas = {
    0: { // Fase 0: C=Día, D=Noche, CD=Día (refuerzo), A/B/AB=Descanso
      A: { turno: 'Descanso', es_refuerzo: false },
      B: { turno: 'Descanso', es_refuerzo: false },
      C: { turno: 'Día', es_refuerzo: false },
      D: { turno: 'Noche', es_refuerzo: false },
      AB: { turno: 'Descanso', es_refuerzo: false },
      CD: { turno: 'Día', es_refuerzo: true }
    },
    1: { // Fase 1: A=Día, B=Noche, AB=Día (refuerzo), C/D/CD=Descanso
      A: { turno: 'Día', es_refuerzo: false },
      B: { turno: 'Noche', es_refuerzo: false },
      C: { turno: 'Descanso', es_refuerzo: false },
      D: { turno: 'Descanso', es_refuerzo: false },
      AB: { turno: 'Día', es_refuerzo: true },
      CD: { turno: 'Descanso', es_refuerzo: false }
    },
    2: { // Fase 2: D=Día, C=Noche, CD=Día (refuerzo), A/B/AB=Descanso
      A: { turno: 'Descanso', es_refuerzo: false },
      B: { turno: 'Descanso', es_refuerzo: false },
      C: { turno: 'Noche', es_refuerzo: false },
      D: { turno: 'Día', es_refuerzo: false },
      AB: { turno: 'Descanso', es_refuerzo: false },
      CD: { turno: 'Día', es_refuerzo: true }
    },
    3: { // Fase 3: B=Día, A=Noche, AB=Día (refuerzo), C/D/CD=Descanso
      A: { turno: 'Noche', es_refuerzo: false },
      B: { turno: 'Día', es_refuerzo: false },
      C: { turno: 'Descanso', es_refuerzo: false },
      D: { turno: 'Descanso', es_refuerzo: false },
      AB: { turno: 'Día', es_refuerzo: true },
      CD: { turno: 'Descanso', es_refuerzo: false }
    }
  };
  
  return reglas[fase] || reglas[0];
}

/**
 * Obtener reglas de turno para PISTA 2 (grupos E, F, G, H)
 * Mapeo: E=C, F=D, G=A, H=B
 * @param {number} fase - Fase del ciclo (0-3)
 * @returns {object} - Objeto con reglas de turno por grupo
 */
function obtenerReglasPista2(fase) {
  const reglasPista1 = obtenerReglasPista1(fase);
  
  // Mapeo: C->E, D->F, A->G, B->H
  const mapeo = {
    C: 'E',
    D: 'F',
    A: 'G',
    B: 'H',
    CD: 'EF',
    AB: 'GH'
  };
  
  const reglasPista2 = {};
  
  // Mapear las reglas de Pista 1 a Pista 2
  for (const [grupo, regla] of Object.entries(reglasPista1)) {
    const grupoMapeado = mapeo[grupo];
    if (grupoMapeado) {
      reglasPista2[grupoMapeado] = regla;
    }
  }
  
  return reglasPista2;
}

/**
 * Calcular el turno de un grupo en una fecha específica
 * @param {Date} fecha - Fecha a calcular
 * @param {string} grupo - Grupo (A-H, AB, CD, EF, GH)
 * @returns {Promise<object>} - { turno: 'Día'|'Noche'|'Descanso', es_refuerzo: boolean }
 */
async function calcularTurno(fecha, grupo) {
  if (!fecha || !grupo) {
    return { turno: 'Descanso', es_refuerzo: false };
  }
  
  const grupoUpper = String(grupo).toUpperCase();
  
  // Obtener semilla según el grupo
  const semilla = await obtenerSemillaGrupo(grupoUpper);
  if (!semilla) {
    console.error(`No se puede calcular turno sin semilla para ${grupoUpper}`);
    return { turno: 'Descanso', es_refuerzo: false };
  }
  
  // Calcular día del ciclo
  const diaCiclo = calcularDiaCiclo(fecha, semilla);
  
  // Determinar fase
  const fase = determinarFase(diaCiclo);
  
  // Obtener reglas según pista
  let reglas;
  if (['A', 'B', 'C', 'D', 'AB', 'CD'].includes(grupoUpper)) {
    reglas = obtenerReglasPista1(fase);
  } else if (['E', 'F', 'G', 'H', 'EF', 'GH'].includes(grupoUpper)) {
    reglas = obtenerReglasPista2(fase);
  } else {
    // Grupos J y K (semanales) - no usan ciclos
    return { turno: 'Descanso', es_refuerzo: false };
  }
  
  // Retornar el turno del grupo
  return reglas[grupoUpper] || { turno: 'Descanso', es_refuerzo: false };
}

// GET /api/calcular-turno - Endpoint para calcular el turno de un grupo en una fecha
app.get("/api/calcular-turno", async (req, res) => {
  try {
    const { fecha, grupo } = req.query;
    
    if (!fecha || !grupo) {
      return res.status(400).json({ 
        error: "Parámetros requeridos: fecha (YYYY-MM-DD) y grupo (A-H, AB, CD, EF, GH)" 
      });
    }
    
    // Validar formato de fecha
    const fechaObj = new Date(fecha);
    if (isNaN(fechaObj.getTime())) {
      return res.status(400).json({ error: "Formato de fecha inválido. Use YYYY-MM-DD" });
    }
    
    // Calcular turno
    const resultado = await calcularTurno(fechaObj, grupo);
    
    res.json({
      success: true,
      fecha: fecha,
      grupo: grupo.toUpperCase(),
      turno: resultado.turno,
      es_refuerzo: resultado.es_refuerzo
    });
  } catch (error) {
    console.error("Error al calcular turno:", error);
    res.status(500).json({ error: "Error al calcular turno" });
  }
});

// ============================================
// ENDPOINTS: Configuración de Ciclos de Turnos
// ============================================

// GET /api/config-turnos - Obtener fechas semilla actuales
app.get("/api/config-turnos", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_conf, pista_nombre, tipo_ciclo, fecha_semilla, dias_semana, activo FROM configuracion_ciclos WHERE activo = 1 ORDER BY pista_nombre'
    );

    if (rows.length === 0) {
      return res.status(500).json({ 
        error: "No se encontró configuración de ciclos" 
      });
    }

    const configs = rows.map(row => ({
      id_conf: row.id_conf,
      pista_nombre: row.pista_nombre,
      tipo_ciclo: row.tipo_ciclo,
      fecha_semilla: row.fecha_semilla ? row.fecha_semilla.toISOString().split('T')[0] : null,
      dias_semana: row.dias_semana || null,
      activo: row.activo
    }));
    
    res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error("Error al obtener configuración de ciclos:", error);
    res.status(500).json({ error: "Error al obtener configuración de ciclos" });
  }
});

// PUT /api/config-turnos - Actualizar configuración de ciclos
app.put("/api/config-turnos", async (req, res) => {
  try {
    const { id_conf, pista_nombre, tipo_ciclo, fecha_semilla, dias_semana } = req.body;

    // Validación
    if (!pista_nombre) {
      return res.status(400).json({ 
        error: "Se requiere pista_nombre" 
      });
    }

    const tipoCiclo = String(tipo_ciclo || '').toUpperCase();
    if (!tipoCiclo) {
      return res.status(400).json({ error: "Se requiere tipo_ciclo" });
    }

    let fechaSemillaFinal = null;
    let diasSemanaFinal = null;

    if (tipoCiclo === 'ROTATIVO') {
      if (!fecha_semilla) {
        return res.status(400).json({ error: "Se requiere fecha_semilla" });
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha_semilla)) {
        fechaSemillaFinal = fecha_semilla;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha_semilla)) {
        const [dia, mes, anio] = fecha_semilla.split('/').map(Number);
        const dd = String(dia).padStart(2, '0');
        const mm = String(mes).padStart(2, '0');
        fechaSemillaFinal = `${anio}-${mm}-${dd}`;
      } else {
        const fecha = new Date(fecha_semilla);
        if (isNaN(fecha.getTime())) {
          return res.status(400).json({ error: "Formato de fecha inválido" });
        }
        fechaSemillaFinal = fecha.toISOString().split('T')[0];
      }
    } else if (tipoCiclo === 'SEMANAL') {
      if (!dias_semana) {
        return res.status(400).json({ error: "Se requieren días para ciclo semanal" });
      }
      diasSemanaFinal = String(dias_semana).trim();
    } else {
      return res.status(400).json({ error: "tipo_ciclo inválido" });
    }

    // Actualizar configuración
    const query = id_conf 
      ? 'UPDATE configuracion_ciclos SET pista_nombre = ?, tipo_ciclo = ?, fecha_semilla = ?, dias_semana = ? WHERE id_conf = ?'
      : 'UPDATE configuracion_ciclos SET pista_nombre = ?, tipo_ciclo = ?, fecha_semilla = ?, dias_semana = ? WHERE pista_nombre = ? AND activo = 1';
    
    const params = id_conf 
      ? [pista_nombre, tipoCiclo, fechaSemillaFinal, diasSemanaFinal, id_conf]
      : [pista_nombre, tipoCiclo, fechaSemillaFinal, diasSemanaFinal, pista_nombre];

    await pool.execute(query, params);

    console.log(`[ACTUALIZACIÓN] Ciclo re-calibrado: ${pista_nombre} (${tipoCiclo})`);

    res.json({ 
      success: true, 
      message: "Configuración actualizada correctamente",
      config: {
        pista_nombre: pista_nombre,
        tipo_ciclo: tipoCiclo,
        fecha_semilla: fechaSemillaFinal,
        dias_semana: diasSemanaFinal
      }
    });
  } catch (error) {
    console.error("Error al actualizar configuración de ciclos:", error);
    res.status(500).json({ error: "Error al actualizar configuración de ciclos" });
  }
});

// Endpoint para cerrar aplicación
app.post("/cerrar", (req, res) => {
  console.log("Solicitud de cierre recibida");
  res.send("Cerrando aplicación");
  // Guardar antes de cerrar
  if (ultimoEstado) {
    // no se guarda en JSON: no-op
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Auto-guardado eliminado (ya no se usa archivo JSON)

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
