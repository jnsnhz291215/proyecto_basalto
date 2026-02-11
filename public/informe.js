// ============================================
// FUNCIÓN GENERAL PARA ABRIR PESTAÑAS (TABS)
// ============================================
function abrirPestaña(event, idTab) {
  event.preventDefault();
  
  // Remover clase 'active' de todos los botones y contenidos
  const botonesTabs = document.querySelectorAll('.tab-btn');
  const contenidosTabs = document.querySelectorAll('.tab-content');
  
  botonesTabs.forEach(btn => btn.classList.remove('active'));
  contenidosTabs.forEach(cont => cont.classList.remove('active'));
  
  // Agregar clase 'active' solo al botón y contenido clickeado
  event.target.closest('.tab-btn').classList.add('active');
  const tabActual = document.getElementById(idTab);
  if (tabActual) {
    tabActual.classList.add('active');
    tabActual.style.display = 'flex';
  }
}

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR INFORME
// ============================================
async function enviarInforme(estadoFinal) {
  try {
    // 1. RECOLECTAR DATOS GENERALES (INPUTS ESTÁTICOS)
    const datosGenerales = {
      fecha: document.getElementById('input-fecha')?.value || '',
      turno: document.getElementById('input-turno')?.value || '',
      horometro_inicial: parseFloat(document.getElementById('input-horometro-inicial')?.value) || null,
      horometro_final: parseFloat(document.getElementById('input-horometro-final')?.value) || null,
      faena: document.getElementById('input-faena')?.value || '',
      equipo: document.getElementById('input-equipo')?.value || '',
      operador: document.getElementById('input-operador')?.value || '',
      pozo_numero: document.getElementById('input-pozo-num')?.value || '',
      sector: document.getElementById('input-sector')?.value || '',
      inclinacion: document.getElementById('input-inclinacion')?.value || '',
      profundidad_final: document.getElementById('input-profundidad')?.value || '',
      pulldown: parseFloat(document.getElementById('input-pulldown')?.value) || null,
      rpm: parseFloat(document.getElementById('input-rpm')?.value) || null,
      petroleo: parseFloat(document.getElementById('input-petroleo')?.value) || null,
      lubricantes: parseFloat(document.getElementById('input-lubricantes')?.value) || null,
      aceites: parseFloat(document.getElementById('input-aceites')?.value) || null,
      otros_insumos: parseFloat(document.getElementById('input-otros')?.value) || null,
      observaciones: document.getElementById('notas-observaciones')?.value || '',
      firma_operador: document.getElementById('input-firma-operador')?.value || '',
      firma_ito: document.getElementById('input-firma-ito')?.value || '',
      firma_supervisor: document.getElementById('input-firma-supervisor')?.value || '',
      firma_cliente: document.getElementById('input-firma-cliente')?.value || '',
      estado: estadoFinal
    };

    // 2. VALIDACIÓN: Si es 'Finalizado', exigir campos clave
    if (estadoFinal === 'Finalizado') {
      const camposRequeridos = [
        { campo: 'fecha', nombre: 'Fecha' },
        { campo: 'turno', nombre: 'Turno' },
        { campo: 'horometro_inicial', nombre: 'Horómetro Inicial' },
        { campo: 'horometro_final', nombre: 'Horómetro Final' },
        { campo: 'faena', nombre: 'Faena' },
        { campo: 'equipo', nombre: 'Equipo' },
        { campo: 'operador', nombre: 'Operador' }
      ];

      for (const { campo, nombre } of camposRequeridos) {
        if (!datosGenerales[campo]) {
          alert(`El campo "${nombre}" es obligatorio para finalizar el turno.`);
          return;
        }
      }
    }

    // 3. RECOLECTAR ACTIVIDADES (TABLA DINÁMICA)
    const actividades = [];
    const filasActividades = document.querySelectorAll('#lista-actividades tr');
    filasActividades.forEach(fila => {
      const horaInicio = fila.querySelector('[name="hora_inicio[]"]')?.value || '';
      const horaFin = fila.querySelector('[name="hora_fin[]"]')?.value || '';
      const detalle = fila.querySelector('[name="detalle[]"]')?.value || '';
      
      if (horaInicio || horaFin || detalle) {
        actividades.push({ hora_inicio: horaInicio, hora_fin: horaFin, detalle });
      }
    });

    // 4. RECOLECTAR PERFORACIONES (TABLA DINÁMICA)
    const perforaciones = [];
    const filasPerforacion = document.querySelectorAll('#tabla-perforacion tr');
    filasPerforacion.forEach(fila => {
      const desde = parseFloat(fila.querySelector('[name="perf_desde[]"]')?.value) || null;
      const hasta = parseFloat(fila.querySelector('[name="perf_hasta[]"]')?.value) || null;
      const metros = parseFloat(fila.querySelector('[name="perf_metros[]"]')?.value) || null;
      const recuperacion = parseFloat(fila.querySelector('[name="perf_recuper[]"]')?.value) || null;
      const tipoRoca = fila.querySelector('[name="perf_tipo[]"]')?.value || '';
      const dureza = fila.querySelector('[name="perf_dureza[]"]')?.value || '';
      
      if (desde !== null || hasta !== null || metros !== null) {
        perforaciones.push({ desde, hasta, metros_perforados: metros, recuperacion, tipo_roca: tipoRoca, dureza });
      }
    });

    // 5. RECOLECTAR HERRAMIENTAS/MATERIALES (TABLAS PEQUEÑAS)
    const herramientas = [];
    
    // Aceros
    const filasAceros = document.querySelectorAll('#tabla-aceros tr');
    filasAceros.forEach(fila => {
      const inputs = fila.querySelectorAll('.input-compact');
      if (inputs.length >= 2) {
        const tipo = inputs[0]?.value || '';
        const cantidad = parseInt(inputs[1]?.value) || 0;
        if (tipo || cantidad) herramientas.push({ categoria: 'Aceros', tipo, cantidad });
      }
    });

    // Rebaje
    const filasRebaje = document.querySelectorAll('#tabla-rebaje tr');
    filasRebaje.forEach(fila => {
      const inputs = fila.querySelectorAll('.input-compact');
      if (inputs.length >= 2) {
        const tipo = inputs[0]?.value || '';
        const cantidad = parseInt(inputs[1]?.value) || 0;
        if (tipo || cantidad) herramientas.push({ categoria: 'Rebaje', tipo, cantidad });
      }
    });

    // Accesorios
    const filasAccesorios = document.querySelectorAll('#tabla-accesorios tr');
    filasAccesorios.forEach(fila => {
      const inputs = fila.querySelectorAll('.input-compact');
      if (inputs.length >= 2) {
        const tipo = inputs[0]?.value || '';
        const cantidad = parseInt(inputs[1]?.value) || 0;
        if (tipo || cantidad) herramientas.push({ categoria: 'Accesorios', tipo, cantidad });
      }
    });

    // Casing
    const filasCasing = document.querySelectorAll('#tabla-casing tr');
    filasCasing.forEach(fila => {
      const inputs = fila.querySelectorAll('.input-compact');
      if (inputs.length >= 2) {
        const tipo = inputs[0]?.value || '';
        const cantidad = parseInt(inputs[1]?.value) || 0;
        if (tipo || cantidad) herramientas.push({ categoria: 'Casing', tipo, cantidad });
      }
    });

    // Aditivos
    const filasAditivos = document.querySelectorAll('#tabla-aditivos tr');
    filasAditivos.forEach(fila => {
      const inputs = fila.querySelectorAll('.input-compact');
      if (inputs.length >= 2) {
        const tipo = inputs[0]?.value || '';
        const cantidad = parseInt(inputs[1]?.value) || 0;
        if (tipo || cantidad) herramientas.push({ categoria: 'Aditivos', tipo, cantidad });
      }
    });

    // 6. ARMAR PAYLOAD COMPLETO
    const payload = {
      datosGenerales,
      actividades,
      perforaciones,
      herramientas
    };

    console.log('Enviando informe:', payload);

    // 7. ENVIAR AL BACKEND
    const response = await fetch('/api/informes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await response.json();

    if (response.ok) {
      alert(`✅ Informe guardado exitosamente.\nFolio: ${resultado.folio}\nEstado: ${estadoFinal}`);
      
      // Si fue finalizado, podríamos redirigir o limpiar el formulario
      if (estadoFinal === 'Finalizado') {
        // Opcional: redirigir a listado de informes o limpiar formulario
        // window.location.href = '/informes.html';
      }
    } else {
      alert(`❌ Error al guardar: ${resultado.error || 'Error desconocido'}`);
    }

  } catch (error) {
    console.error('Error al enviar informe:', error);
    alert('❌ Error de conexión con el servidor. Por favor, intenta de nuevo.');
  }
}

// ============================================
// TABLA DINÁMICA DE ACTIVIDADES
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // ========== INICIALIZACIÓN DE TABLAS DINÁMICAS ==========
    const btnAgregar = document.querySelector('#btnAgregar');
    const listaActividades = document.getElementById('lista-actividades');

    if (btnAgregar && listaActividades) {
        btnAgregar.addEventListener('click', function(e) {
            e.preventDefault();
            const nuevaFila = document.createElement('tr');
            nuevaFila.innerHTML = `
                <td><input type="time" class="input-compact" name="hora_inicio[]"></td>
                <td><input type="time" class="input-compact" name="hora_fin[]"></td>
                <td><input type="text" class="input-compact" placeholder="Detalle de la actividad" name="detalle[]"></td>
                <td style="text-align: center;"><button class="btn-delete" type="button" onclick="eliminarFila(this)"><i class="fa-solid fa-trash"></i></button></td>
            `;
            listaActividades.appendChild(nuevaFila);
        });

        // Delegación para eliminar filas
        listaActividades.addEventListener('click', function(ev) {
            const b = ev.target.closest && ev.target.closest('.btn-delete');
            if (b) {
                ev.preventDefault();
                eliminarFila(b);
            }
        });
    }

    // Tabla de Perforación
    const btnAgregarPerforacion = document.querySelector('#btnAgregarPerforacion');
    const tablaPerforacion = document.getElementById('tabla-perforacion');

    if (btnAgregarPerforacion && tablaPerforacion) {
        btnAgregarPerforacion.addEventListener('click', function(e) {
            e.preventDefault();
            const nuevaFila = document.createElement('tr');
            nuevaFila.innerHTML = `
                <td><input type="number" class="input-compact" placeholder="Desde" name="perf_desde[]"></td>
                <td><input type="number" class="input-compact" placeholder="Hasta" name="perf_hasta[]"></td>
                <td><input type="number" class="input-compact" placeholder="Metros" name="perf_metros[]"></td>
                <td><input type="number" class="input-compact" placeholder="%" name="perf_recuper[]"></td>
                <td><input type="text" class="input-compact" placeholder="Tipo roca" name="perf_tipo[]"></td>
                <td><input type="text" class="input-compact" placeholder="Dureza" name="perf_dureza[]"></td>
                <td style="text-align: center;"><button class="btn-delete" type="button" onclick="eliminarFila(this)"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tablaPerforacion.appendChild(nuevaFila);
        });

        tablaPerforacion.addEventListener('click', function(ev) {
            const b = ev.target.closest && ev.target.closest('.btn-delete');
            if (b) {
                ev.preventDefault();
                eliminarFila(b);
            }
        });
    }

    // ========== EVENT LISTENERS PARA BOTONES DE ACCIÓN ==========
    // Botón Guardar Borrador
    const btnBorrador = document.getElementById('btn-guardar-borrador');
    if (btnBorrador) {
        btnBorrador.addEventListener('click', function(e) {
            e.preventDefault();
            enviarInforme('Borrador');
        });
    }

    // Botón Finalizar y Bloquear Turno
    const btnFinalizar = document.getElementById('btn-finalizar-turno');
    if (btnFinalizar) {
        btnFinalizar.addEventListener('click', function(e) {
            e.preventDefault();
            const confirmar = confirm('¿Estás seguro de finalizar y bloquear este turno? Esta acción no se puede deshacer.');
            if (confirmar) {
                enviarInforme('Finalizado');
            }
        });
    }
});

// ============================================
// FUNCIÓN GENERAL PARA ELIMINAR FILAS
// ============================================
function eliminarFila(boton) {
    const fila = boton.closest('tr');
    if (fila) fila.remove();
}

// ============================================
// FUNCIÓN GENERAL PARA AGREGAR FILAS (TABLAS PEQUEÑAS)
// ============================================
function agregarFila(idTabla, camposInputs = null) {
    const tabla = document.getElementById(idTabla);
    if (!tabla) return;

    const nuevaFila = document.createElement('tr');
    let html = '';

    // Crear inputs según número de columnas (excluyendo botón delete)
    const filaEjemplo = tabla.querySelector('tr');
    if (filaEjemplo) {
        const numColumnas = filaEjemplo.querySelectorAll('th').length - 1; // restar 1 por botón delete
        
        for (let i = 0; i < numColumnas; i++) {
            html += `<td><input type="text" class="input-compact" placeholder="..."></td>`;
        }
    } else {
        // Fallback
        html += `<td><input type="text" class="input-compact" placeholder="..."></td>`;
    }

    html += `<td style="text-align: center;"><button class="btn-delete" type="button" onclick="eliminarFila(this)"><i class="fa-solid fa-trash"></i></button></td>`;
    
    nuevaFila.innerHTML = html;
    tabla.appendChild(nuevaFila);

    // Capturar eventos de delete en la nueva fila
    nuevaFila.addEventListener('click', function(ev) {
        const b = ev.target.closest && ev.target.closest('.btn-delete');
        if (b) {
            ev.preventDefault();
            eliminarFila(b);
        }
    });
}

