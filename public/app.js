import { FECHA_BASE, GRUPOS, COLORES } from "./config.js";

let trabajadores = [];

fetch("/datos")
  .then(r => r.json())
  .then(data => {
    trabajadores = data;
    render();
  });

function render() {
  const cal = document.getElementById("calendario");
  cal.innerHTML = "";

  trabajadores.forEach(t => {
    const div = document.createElement("div");
    div.textContent = t.nombre + " → " + t.dias.join(", ");
    div.style.background = t.color;
    div.style.padding = "10px";
    div.style.marginBottom = "5px";
    cal.appendChild(div);
  });
}

document.getElementById("guardar").onclick = () => {
  fetch("/guardar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trabajadores)
  })
  .then(r => r.text())
  .then(alert);
};
document.getElementById("cerrar").onclick = () => {
    fetch("/cerrar", { method: "POST" })
      .then(() => {
        alert("La aplicación se cerró");
        window.close();
      });
  };
  