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
      horas_trabajadas: parseFloat(document.getElementById('input-horas-trabajadas')?.value) || null,
      faena: document.getElementById('input-faena')?.value || '',
      lugar: document.getElementById('input-lugar')?.value || '',
      equipo: document.getElementById('input-equipo')?.value || '',
      operador_rut: document.getElementById('input-operador')?.value || '',
      ayudante_1: document.getElementById('input-ayudante-1')?.value || '',
      ayudante_2: document.getElementById('input-ayudante-2')?.value || '',
      pozo_numero: document.getElementById('input-pozo-num')?.value || '',
      sector: document.getElementById('input-sector')?.value || '',
      diametro: document.getElementById('input-diametro')?.value || '',
      inclinacion: document.getElementById('input-inclinacion')?.value || '',
      profundidad_inicial: parseFloat(document.getElementById('input-profundidad-inicial')?.value) || null,
      profundidad_final: parseFloat(document.getElementById('input-profundidad')?.value) || null,
      mts_perforados: parseFloat(document.getElementById('input-mts-perforados')?.value) || null,
      pull_down: parseFloat(document.getElementById('input-pulldown')?.value) || null,
      rpm: parseFloat(document.getElementById('input-rpm')?.value) || null,
      horometro_inicial: parseFloat(document.getElementById('input-horometro-inicial')?.value) || null,
      horometro_final: parseFloat(document.getElementById('input-horometro-final')?.value) || null,
      horometro_hrs: parseFloat(document.getElementById('input-horometro-hrs')?.value) || null,
      insumo_petroleo: parseFloat(document.getElementById('input-petroleo')?.value) || null,
      insumo_lubricantes: parseFloat(document.getElementById('input-lubricantes')?.value) || null,
      observaciones: document.getElementById('notas-observaciones')?.value || '',
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
        { campo: 'operador_rut', nombre: 'Operador' }
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
      const horaDesde = fila.querySelector('[name="hora_desde[]"]')?.value || '';
      const horaHasta = fila.querySelector('[name="hora_hasta[]"]')?.value || '';
      const detalle = fila.querySelector('[name="detalle[]"]')?.value || '';
      const hrsBd = parseFloat(fila.querySelector('[name="hrs_bd[]"]')?.value) || null;
      const hrsCliente = parseFloat(fila.querySelector('[name="hrs_cliente[]"]')?.value) || null;
      
      if (horaDesde || horaHasta || detalle) {
        actividades.push({ hora_desde: horaDesde, hora_hasta: horaHasta, detalle, hrs_bd: hrsBd, hrs_cliente: hrsCliente });
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
    
    // Herramientas (tipo_elemente, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra)
    const filasHerramientas = document.querySelectorAll('#tabla-herramientas tr');
    filasHerramientas.forEach(fila => {
      const tipo_elemente = fila.querySelector('[name="herr_tipo_elemente[]"]')?.value || '';
      const diametro = fila.querySelector('[name="herr_diametro[]"]')?.value || '';
      const numero_serie = fila.querySelector('[name="herr_numero_serie[]"]')?.value || '';
      const desde_mts = parseFloat(fila.querySelector('[name="herr_desde_mts[]"]')?.value) || null;
      const hasta_mts = parseFloat(fila.querySelector('[name="herr_hasta_mts[]"]')?.value) || null;
      const detalle_extra = fila.querySelector('[name="herr_detalle_extra[]"]')?.value || '';
      
      if (tipo_elemente || numero_serie) {
        herramientas.push({ tipo_elemente, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra });
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
                <td><input type="time" class="input-compact" name="hora_desde[]"></td>
                <td><input type="time" class="input-compact" name="hora_hasta[]"></td>
                <td><input type="text" class="input-compact" placeholder="Detalle de la actividad" name="detalle[]"></td>
                <td><input type="number" class="input-compact" placeholder="Hrs" name="hrs_bd[]" step="0.1"></td>
                <td><input type="number" class="input-compact" placeholder="Hrs" name="hrs_cliente[]" step="0.1"></td>
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

    // Tabla de Herramientas
    const btnAgregarHerramienta = document.querySelector('#btnAgregarHerramienta');
    const tablaHerramientas = document.getElementById('tabla-herramientas');

    if (btnAgregarHerramienta && tablaHerramientas) {
        btnAgregarHerramienta.addEventListener('click', function(e) {
            e.preventDefault();
            const nuevaFila = document.createElement('tr');
            nuevaFila.innerHTML = `
                <td><input type="text" class="input-compact" placeholder="Tipo elemento" name="herr_tipo_elemente[]"></td>
                <td><input type="text" class="input-compact" placeholder="Diámetro" name="herr_diametro[]"></td>
                <td><input type="text" class="input-compact" placeholder="Nº Serie" name="herr_numero_serie[]"></td>
                <td><input type="number" class="input-compact" placeholder="Desde (m)" name="herr_desde_mts[]" step="0.1"></td>
                <td><input type="number" class="input-compact" placeholder="Hasta (m)" name="herr_hasta_mts[]" step="0.1"></td>
                <td><input type="text" class="input-compact" placeholder="Detalle" name="herr_detalle_extra[]"></td>
                <td style="text-align: center;"><button class="btn-delete" type="button" onclick="eliminarFila(this)"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tablaHerramientas.appendChild(nuevaFila);
        });

        tablaHerramientas.addEventListener('click', function(ev) {
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

