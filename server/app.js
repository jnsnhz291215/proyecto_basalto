const express = require("express");
const { pool, obtenerTrabajadores, agregarTrabajador, eliminarTrabajador, editarTrabajador } = require("../ejemploconexion.js");

const app = express();
app.use(express.json());
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
    const data = await obtenerTrabajadores();
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

// Endpoint de login (validación en servidor)
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

// Endpoint admin-login: valida en tabla admin_users usando RUT (sin puntos/guion) y password
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
      // Comparar password (asumimos texto plano en columna `password`)
      if (String(user.password || '') !== String(password)) {
        console.log(`[ADMIN LOGIN FAIL] rut=${rutNorm} reason=bad_password ip=${req.ip||req.connection.remoteAddress}`);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      console.log(`[ADMIN LOGIN OK] rut=${rutNorm} ip=${req.ip||req.connection.remoteAddress}`);
      // devolver respuesta mínima
      return res.json({ success: true, user: { id: user.id || null, rut: user.rut || null, name: user.name || null } });
    }catch(qe){
      console.error('Error query admin_users:', qe);
      return res.status(500).json({ error: 'Error en servidor' });
    }
  } catch (err) {
    console.error('Error en /admin-login:', err);
    res.status(500).json({ error: 'Error en servidor' });
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
        numero_informe, fecha, turno, horometro_inicial, horometro_final,
        faena, equipo, operador, pozo_numero, sector, inclinacion,
        profundidad_final, pulldown, rpm, petroleo, lubricantes, aceites,
        otros_insumos, observaciones, firma_operador, firma_ito,
        firma_supervisor, firma_cliente, estado, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        folio,
        datosGenerales.fecha || null,
        datosGenerales.turno || null,
        datosGenerales.horometro_inicial || null,
        datosGenerales.horometro_final || null,
        datosGenerales.faena || null,
        datosGenerales.equipo || null,
        datosGenerales.operador || null,
        datosGenerales.pozo_numero || null,
        datosGenerales.sector || null,
        datosGenerales.inclinacion || null,
        datosGenerales.profundidad_final || null,
        datosGenerales.pulldown || null,
        datosGenerales.rpm || null,
        datosGenerales.petroleo || null,
        datosGenerales.lubricantes || null,
        datosGenerales.aceites || null,
        datosGenerales.otros_insumos || null,
        datosGenerales.observaciones || null,
        datosGenerales.firma_operador || null,
        datosGenerales.firma_ito || null,
        datosGenerales.firma_supervisor || null,
        datosGenerales.firma_cliente || null,
        datosGenerales.estado || 'Borrador'
      ]
    );

    const idInforme = resultInforme.insertId;
    console.log(`[INFORME] Informe creado con ID: ${idInforme}`);

    // PASO 3B: INSERT DE ACTIVIDADES
    if (actividades && actividades.length > 0) {
      for (const act of actividades) {
        await connection.execute(
          'INSERT INTO actividades_turno (id_informe, hora_inicio, hora_fin, detalle) VALUES (?, ?, ?, ?)',
          [idInforme, act.hora_inicio || null, act.hora_fin || null, act.detalle || null]
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
          'INSERT INTO herramientas_turno (id_informe, categoria, tipo, cantidad) VALUES (?, ?, ?, ?)',
          [idInforme, herr.categoria || null, herr.tipo || null, herr.cantidad || 0]
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

// Endpoint para agregar trabajador
app.post("/agregar-trabajador", async (req, res) => {
  try {
    const nuevoTrabajador = req.body;
    
    // Validar que todos los campos estén presentes y no estén vacíos
    if (!nuevoTrabajador.nombres || !nuevoTrabajador.apellidos || !nuevoTrabajador.RUT ||
        !nuevoTrabajador.email || !nuevoTrabajador.telefono || !nuevoTrabajador.grupo) {
      return res.status(400).json({ error: "Todos los campos son requeridos y no pueden estar en blanco" });
    }
    
    // Validar que los campos no sean solo espacios en blanco
    if (nuevoTrabajador.nombres.trim() === '' || nuevoTrabajador.apellidos.trim() === '' ||
        nuevoTrabajador.RUT.trim() === '' || nuevoTrabajador.email.trim() === '' ||
        nuevoTrabajador.telefono.trim() === '' || nuevoTrabajador.grupo.trim() === '') {
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
    
    // Validar que el grupo sea válido
    const gruposValidos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
    if (!gruposValidos.includes(nuevoTrabajador.grupo)) {
      return res.status(400).json({ error: "El grupo debe ser A, B, C, D, E, F, G, H, J o K" });
    }
    
    // Verificar que el RUT no exista en la BD
    const trabajadoresExistentes = await obtenerTrabajadores();
    if (trabajadoresExistentes.some(t => t.RUT === nuevoTrabajador.RUT)) {
      return res.status(400).json({ error: "Ya existe un trabajador con este RUT" });
    }

    // Preparar apellidos (paterno / materno) y mapear grupo letra -> id_grupo
    const apellidosRaw = (nuevoTrabajador.apellidos || '').trim();
    let apellido_paterno = '';
    let apellido_materno = '';
    if (apellidosRaw) {
      const parts = apellidosRaw.split(/\s+/);
      apellido_paterno = parts.shift() || '';
      apellido_materno = parts.join(' ') || '';
    }

    const idx = gruposValidos.indexOf(nuevoTrabajador.grupo);
    const id_grupo = idx >= 0 ? idx + 1 : null;

    // Agregar el nuevo trabajador a la BD (apellido_paterno/materno, id_grupo)
    await agregarTrabajador(
      nuevoTrabajador.nombres,
      apellido_paterno,
      apellido_materno,
      nuevoTrabajador.RUT,
      nuevoTrabajador.email,
      nuevoTrabajador.telefono,
      id_grupo,
      nuevoTrabajador.cargo || null
    );
    
    const trabajadores = await obtenerTrabajadores();
    ultimoEstado = trabajadores;
    
    res.json({ 
      success: true, 
      trabajadores: trabajadores,
      message: "Trabajador agregado exitosamente" 
    });
  } catch (error) {
    console.error("Error al agregar trabajador:", error);
    const resp = { error: "Error al agregar trabajador" };
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      resp.detail = error && (error.message || String(error));
    }
    res.status(500).json(resp);
  }
});

// Endpoint para editar trabajador
app.post("/editar-trabajador", async (req, res) => {
  try {
    const trabajador = req.body;
    
    // Validar que todos los campos estén presentes y no estén vacíos
    if (!trabajador.rut || !trabajador.nombres || !trabajador.apellidos || 
        !trabajador.email || !trabajador.telefono || !trabajador.grupo) {
      return res.status(400).json({ error: "Todos los campos son requeridos y no pueden estar en blanco" });
    }
    
    // Validar que los campos no sean solo espacios en blanco
    if (trabajador.rut.trim() === '' || trabajador.nombres.trim() === '' || trabajador.apellidos.trim() === '' ||
        trabajador.email.trim() === '' || trabajador.telefono.trim() === '' || trabajador.grupo.trim() === '') {
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
    
    // Validar que el grupo sea válido
    const gruposValidos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
    if (!gruposValidos.includes(trabajador.grupo)) {
      return res.status(400).json({ error: "El grupo debe ser A, B, C, D, E, F, G, H, J o K" });
    }

    // Preparar apellidos (paterno / materno) y mapear grupo letra -> id_grupo
    const apellidosRaw = (trabajador.apellidos || '').trim();
    let apellido_paterno = '';
    let apellido_materno = '';
    if (apellidosRaw) {
      const parts = apellidosRaw.split(/\s+/);
      apellido_paterno = parts.shift() || '';
      apellido_materno = parts.join(' ') || '';
    }

    const idx = gruposValidos.indexOf(trabajador.grupo);
    const id_grupo = idx >= 0 ? idx + 1 : null;

    // Editar el trabajador en la BD
    try {
      await editarTrabajador(
        trabajador.rut,
        trabajador.nombres,
        apellido_paterno,
        apellido_materno,
        trabajador.email,
        trabajador.telefono,
        id_grupo,
        trabajador.cargo || null
      );
    } catch (e) {
      if (e && e.code === 'RUT_NOT_FOUND') {
        return res.status(404).json({ error: "No se encontró un trabajador con ese RUT" });
      }
      throw e;
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
});

// Endpoint para eliminar trabajador por RUT
app.post("/eliminar-trabajador", async (req, res) => {
  try {
    const { rut } = req.body;
    if (!rut || typeof rut !== 'string' || rut.trim() === '') {
      return res.status(400).json({ error: "Se requiere el RUT del trabajador" });
    }
    try {
      await eliminarTrabajador(rut.trim());
      const trabajadoresDespues = await obtenerTrabajadores();
      ultimoEstado = trabajadoresDespues;
      res.json({ success: true, trabajadores: trabajadoresDespues, message: "Trabajador eliminado" });
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
