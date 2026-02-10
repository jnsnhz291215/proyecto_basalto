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
