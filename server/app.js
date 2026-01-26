const express = require("express");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const DATA_PATH = "./data/trabajadores.json";
const AUTO_GUARDADO_MS = 10 * 60 * 1000; // 10 minutos
const AUTO_CIERRE_MS = 60 * 60 * 1000; // 1 hora

let ultimoEstado = null;
let autoCierreTimeout = null;

// Función para guardar cambios en archivo y git
function guardarCambios(data, motivo = "Auto-guardado") {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

  try {
    execSync("git add data/trabajadores.json");
    execSync(`git commit -m "${motivo}"`);
    execSync("git push");
  } catch (e) {
    console.log("Nada nuevo para commitear o error en git");
  }
}

// Resetear el timer de auto-cierre en cada petición
app.use((req, res, next) => {
  if (autoCierreTimeout) {
    clearTimeout(autoCierreTimeout);
  }
  
  autoCierreTimeout = setTimeout(() => {
    console.log("Auto-cierre: guardando y cerrando");
    if (ultimoEstado) {
      guardarCambios(ultimoEstado, "Auto-guardado final (1 hora)");
    }
    process.exit(0);
  }, AUTO_CIERRE_MS);

  next();
});

// Endpoint para obtener datos
app.get("/datos", (req, res) => {
  try {
    let data = [];
    if (fs.existsSync(DATA_PATH)) {
      const fileData = fs.readFileSync(DATA_PATH, "utf8");
      data = JSON.parse(fileData);
      // Asegurar que sea un array
      if (!Array.isArray(data)) {
        data = [];
      }
    }
    ultimoEstado = data;
    res.json(data);
  } catch (error) {
    console.error("Error al leer datos:", error);
    res.json([]);
  }
});

// Endpoint para guardar cambios
app.post("/guardar", (req, res) => {
  ultimoEstado = req.body;
  guardarCambios(req.body, "Guardado manual");
  res.send("Cambios guardados");
});

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
app.post("/agregar-trabajador", (req, res) => {
  try {
    const nuevoTrabajador = req.body;
    
    // Validar que todos los campos estén presentes y no estén vacíos
    if (!nuevoTrabajador.nombre || !nuevoTrabajador.apellido || !nuevoTrabajador.rut ||
        !nuevoTrabajador.email || !nuevoTrabajador.telefono || !nuevoTrabajador.grupo) {
      return res.status(400).json({ error: "Todos los campos son requeridos y no pueden estar en blanco" });
    }
    
    // Validar que los campos no sean solo espacios en blanco
    if (nuevoTrabajador.nombre.trim() === '' || nuevoTrabajador.apellido.trim() === '' ||
        nuevoTrabajador.rut.trim() === '' || nuevoTrabajador.email.trim() === '' ||
        nuevoTrabajador.telefono.trim() === '' || nuevoTrabajador.grupo.trim() === '') {
      return res.status(400).json({ error: "Ningún campo puede estar en blanco" });
    }
    
    // Validar formato de email
    if (!validarEmailServidor(nuevoTrabajador.email)) {
      return res.status(400).json({ error: "El formato del email es inválido. Debe ser: texto@texto.texto" });
    }
    
    // Validar formato de RUT
    if (!validarRUTServidor(nuevoTrabajador.rut)) {
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
    
    // Cargar trabajadores actuales
    let trabajadores = [];
    if (fs.existsSync(DATA_PATH)) {
      try {
        const data = fs.readFileSync(DATA_PATH, "utf8");
        trabajadores = JSON.parse(data);
        // Asegurar que trabajadores sea un array
        if (!Array.isArray(trabajadores)) {
          trabajadores = [];
        }
      } catch (error) {
        console.error("Error al leer trabajadores.json:", error);
        trabajadores = [];
      }
    }
    
    // Validar que el RUT no exista
    if (trabajadores.some(t => t.rut === nuevoTrabajador.rut)) {
      return res.status(400).json({ error: "Ya existe un trabajador con este RUT" });
    }
    
    // Agregar el nuevo trabajador
    trabajadores.push(nuevoTrabajador);
    ultimoEstado = trabajadores;
    
    // Guardar cambios
    guardarCambios(trabajadores, "Trabajador agregado");
    
    res.json({ 
      success: true, 
      trabajadores: trabajadores,
      message: "Trabajador agregado exitosamente" 
    });
  } catch (error) {
    console.error("Error al agregar trabajador:", error);
    res.status(500).json({ error: "Error al agregar trabajador" });
  }
});

// Endpoint para eliminar trabajador por RUT
app.post("/eliminar-trabajador", (req, res) => {
  try {
    const { rut } = req.body;
    if (!rut || typeof rut !== 'string' || rut.trim() === '') {
      return res.status(400).json({ error: "Se requiere el RUT del trabajador" });
    }
    let trabajadores = [];
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, "utf8");
      trabajadores = JSON.parse(data);
      if (!Array.isArray(trabajadores)) trabajadores = [];
    }
    const prev = trabajadores.length;
    trabajadores = trabajadores.filter(t => t.rut !== rut.trim());
    if (trabajadores.length === prev) {
      return res.status(404).json({ error: "No se encontró un trabajador con ese RUT" });
    }
    ultimoEstado = trabajadores;
    guardarCambios(trabajadores, "Trabajador eliminado");
    res.json({ success: true, trabajadores, message: "Trabajador eliminado" });
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
    guardarCambios(ultimoEstado, "Guardado antes de cerrar");
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Auto-guardado cada 10 minutos
setInterval(() => {
  if (ultimoEstado) {
    console.log("Auto-guardado cada 10 minutos");
    guardarCambios(ultimoEstado, "Auto-guardado (10 min)");
  }
}, AUTO_GUARDADO_MS);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
