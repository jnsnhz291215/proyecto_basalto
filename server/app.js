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
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  ultimoEstado = data;
  res.json(data);
});

// Endpoint para guardar cambios
app.post("/guardar", (req, res) => {
  ultimoEstado = req.body;
  guardarCambios(req.body, "Guardado manual");
  res.send("Cambios guardados");
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
