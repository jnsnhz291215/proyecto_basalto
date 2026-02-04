const express = require("express");
const { pool, obtenerTrabajadores, agregarTrabajador, eliminarTrabajador } = require("../ejemploconexion.js");

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

// Endpoint para eliminar trabajador por RUT
app.post("/eliminar-trabajador", async (req, res) => {
  try {
    const { rut } = req.body;
    if (!rut || typeof rut !== 'string' || rut.trim() === '') {
      return res.status(400).json({ error: "Se requiere el RUT del trabajador" });
    }
    
    const trabajadoresAntes = await obtenerTrabajadores();
    await eliminarTrabajador(rut.trim());
    const trabajadoresDespues = await obtenerTrabajadores();
    
    if (trabajadoresAntes.length === trabajadoresDespues.length) {
      return res.status(404).json({ error: "No se encontró un trabajador con ese RUT" });
    }
    
    ultimoEstado = trabajadoresDespues;
    res.json({ success: true, trabajadores: trabajadoresDespues, message: "Trabajador eliminado" });
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
