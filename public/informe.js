// Tabla dinámica de actividades: añadir y eliminar filas
document.addEventListener('DOMContentLoaded', function() {
    const btnAgregar = document.querySelector('.btn-add-row');
    const listaActividades = document.getElementById('lista-actividades');

    if (btnAgregar && listaActividades) {
        btnAgregar.addEventListener('click', function(e) {
            e.preventDefault();
            const nuevaFila = document.createElement('tr');
            nuevaFila.innerHTML = `
                <td><input type="time" class="input-compact" name="hora_inicio[]"></td>
                <td><input type="time" class="input-compact" name="hora_fin[]"></td>
                <td><input type="text" class="input-compact" placeholder="Detalle de la actividad" name="detalle[]"></td>
                <td><button class="btn-delete" type="button" onclick="eliminarFila(this)">X</button></td>
            `;
            listaActividades.appendChild(nuevaFila);
        });

        // Delegación: también capturar clicks en botones .btn-delete si se crean sin onclick
        listaActividades.addEventListener('click', function(ev) {
            const b = ev.target.closest && ev.target.closest('.btn-delete');
            if (b) {
                ev.preventDefault();
                eliminarFila(b);
            }
        });
    }
});

// Función global para eliminar fila (para compatibilidad con onclick inline)
function eliminarFila(boton) {
    const fila = boton.closest('tr');
    if (fila) fila.remove();
}
