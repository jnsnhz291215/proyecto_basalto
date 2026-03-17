document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de Seguridad y Permisos
    if (typeof checkPagePermission === 'function') {
        // Redirige a index.html si no tiene la clave admin_v_kpis
        checkPagePermission('admin_v_kpis');
    }

    // 2. Inicialización
    initDashboard();
});

let metroscChart = null;
let eficienciaChart = null;
const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

async function initDashboard() {
    const selectAnio = document.getElementById('select-anio');
    const anioActual = new Date().getFullYear();
    
    // Poblar de anioActual-2 hasta anioActual
    for (let i = anioActual; i >= anioActual - 2; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        selectAnio.appendChild(option);
    }

    selectAnio.addEventListener('change', (e) => cargarDatos(e.target.value));
    
    const btnRefrescar = document.getElementById('btn-refresh-kpi');
    if (btnRefrescar) {
        btnRefrescar.addEventListener('click', () => {
            const btn = btnRefrescar.querySelector('i');
            btn.classList.add('fa-spin');
            cargarDatos(selectAnio.value).finally(() => {
                setTimeout(() => btn.classList.remove('fa-spin'), 500);
            });
        });
    }

    // Carga inicial
    await cargarDatos(anioActual);
}

async function cargarDatos(anio) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/stats/mensual?anio=${anio}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        const emptyState = document.getElementById('empty-state-kpis');
        const dashboardContent = document.getElementById('dashboard-content');
        
        // Verifica si hay algun dato significativo. Si no, muestra el empty state.
        if (!data || !data.resumen || (data.resumen.avance_anual === 0 && data.resumen.mejor_grupo_metros === 0)) {
            if (emptyState) emptyState.style.display = 'block';
            if (dashboardContent) dashboardContent.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'block';
            
            actualizarTarjetas(data.resumen);
            actualizarGraficoMetros(data.grafico_metros);
            actualizarGraficoEficiencia(data.grafico_eficiencia);
            actualizarTablaDisponibilidad(data.disponibilidad);
        }
        
    } catch (error) {
        console.error("Error cargando KPIs:", error);
        // Si hay una función en common.js para errores podríamos usarla
        if (typeof showErrorModal === 'function') {
            showErrorModal("Ocurrió un error obteniendo los datos del servidor.");
        }
    }
}

function actualizarTarjetas(resumen) {
    document.getElementById('kpi-avance-anual').textContent = Math.round(resumen.avance_anual).toLocaleString('es-CL');
    document.getElementById('kpi-mejor-grupo').textContent = resumen.mejor_grupo_mes;
    document.getElementById('kpi-mejor-metros').textContent = `${Math.round(resumen.mejor_grupo_metros).toLocaleString('es-CL')} metros`;
}

function actualizarGraficoMetros(datosMetros) {
    const ctx = document.getElementById('chartMetros').getContext('2d');
    
    if (metroscChart) {
        metroscChart.destroy();
    }

    metroscChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombresMeses,
            datasets: [{
                label: 'Metros Perforados',
                data: datosMetros,
                backgroundColor: '#3b82f6', // blue-500
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [2, 4], color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function actualizarGraficoEficiencia(datosEficiencia) {
    const ctx = document.getElementById('chartEficiencia').getContext('2d');
    
    if (eficienciaChart) {
        eficienciaChart.destroy();
    }

    eficienciaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: nombresMeses,
            datasets: [{
                label: 'Lts Petróleo / Metro',
                data: datosEficiencia,
                borderColor: '#ef4444', // red-500
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#ef4444',
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} Lts/Mts`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [2, 4], color: '#f1f5f9' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function actualizarTablaDisponibilidad(dispList) {
    const tbody = document.getElementById('tabla-disponibilidad');
    tbody.innerHTML = '';

    dispList.forEach((item, index) => {
        if(item.informes === 0 && item.horas === 0) return; // No mostrar meses vacíos si se desea (o mostrar todos)

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';
        
        tr.innerHTML = `
            <td style="padding: 12px; font-weight: 500; color: #475569;">${nombresMeses[index]}</td>
            <td style="padding: 12px;">${item.informes}</td>
            <td style="padding: 12px;">${item.horas.toFixed(1)} hrs</td>
        `;
        tbody.appendChild(tr);
    });

    if(tbody.innerHTML === '') {
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #64748b;">No hay datos operativos registrados para este año</td></tr>';
    }
}
