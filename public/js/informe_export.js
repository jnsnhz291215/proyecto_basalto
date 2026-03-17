document.addEventListener('DOMContentLoaded', () => {
    const btnPdf = document.getElementById('btn-descargar-pdf');
    const btnReabrir = document.getElementById('btn-reabrir-turno');

    if (btnPdf) {
        btnPdf.addEventListener('click', generarPDF);
    }

    if (btnReabrir) {
        btnReabrir.addEventListener('click', reabrirTurno);
    }
});

async function reabrirTurno() {
    if (!state.currentReportId) return;
    const confirmacion = confirm('¿Está seguro que desea reabrir este turno? El estado pasará a "Borrador".');
    if (!confirmacion) return;

    try {
        const payload = {
            datosGenerales: { estado: 'Borrador' },
            is_audit_edit: true,
            admin_rut: state.userRut
        };

        const res = await fetch(`/api/informes/${state.currentReportId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al reabrir el turno');

        alert('Turno reabierto con éxito.');
        window.location.reload();
    } catch (err) {
        console.error(err);
        alert('Error al reabrir turno: ' + err.message);
    }
}

async function generarPDF() {
    // Para el botón de informe.html
    const id = typeof state !== 'undefined' ? state.currentReportId : null;
    if (!id) {
        alert('Debes guardar el informe primero antes de generar el PDF.');
        return;
    }
    
    const btnPdfMain = document.getElementById('btn-descargar-pdf');
    const btnPdfSuccess = document.getElementById('btn-success-pdf');
    if (btnPdfMain) btnPdfMain.classList.add('btn-loading');
    if (btnPdfSuccess) btnPdfSuccess.classList.add('btn-loading');
    
    try {
        await exportarInformeAPDF(id);
    } catch (e) {
        console.error('Generar PDF error', e);
    } finally {
        if (btnPdfMain) btnPdfMain.classList.remove('btn-loading');
        if (btnPdfSuccess) btnPdfSuccess.classList.remove('btn-loading');
    }
}

// Generador Universal y On-Demand
async function exportarInformeAPDF(idInforme) {
    if (!idInforme) {
        throw new Error("No hay ID de informe válido");
    }

    try {
        // 1. Fetch de datos completos
        const res = await fetch(`/api/informes/${idInforme}/detalles`);
        if (!res.ok) throw new Error('Error al cargar datos del informe desde la base de datos.');
        const { informe, actividades, herramientas, perforaciones } = await res.json();

        // 2. Revisar logs para marca de auditoría
        let auditDateStr = null;
        const resLogs = await fetch('/api/logs');
        if (resLogs.ok) {
            const logs = await resLogs.json();
            const logForDoc = logs.find(l => l.detalle && l.detalle.includes(`ID_${idInforme}`));
            if (logForDoc) {
                const dt = new Date(logForDoc.fecha);
                auditDateStr = dt.toLocaleDateString('es-CL') + ' ' + dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute:'2-digit' });
            }
        }

        // 3. Obtener nombres de trabajadores si están disponibles en la caché (opcional)
        // intentamos mapear rut a nombre pero como esto debe ser on-demand, mostramos el rut si no.
        let operadorLabel = informe.operador_rut || '-';
        if (typeof trabajadores !== 'undefined' && trabajadores.length > 0) {
            const ts = trabajadores.find(t => t.RUT === operadorLabel);
            if (ts) operadorLabel = `${ts.nombres} ${ts.apellido_paterno} ${ts.apellido_materno || ''}`.trim();
        }

        // --- CONSTRUCTOR DEL DOM INDUSTRIAL ---
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.color = '#000000';
        wrapper.style.width = '210mm'; // Ancho estricto A4
        wrapper.style.padding = '10mm';
        wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';
        wrapper.style.fontSize = '12px';
        wrapper.style.lineHeight = '1.4';

        const borderStyle = '1px solid #000000';
        const headerBg = '#f2f2f2';

        const safeStr = (val) => val == null || val === '' ? '-' : String(val);

        // A. Encabezado
        const headerHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: ${borderStyle};">
                <tr>
                    <td style="width: 25%; padding: 10px; border: ${borderStyle}; text-align: center;">
                        <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">BASALTO DRILLING</h1>
                        <p style="margin: 3px 0 0 0; font-size: 9px;">Servicios Perforación</p>
                    </td>
                    <td style="width: 50%; padding: 10px; border: ${borderStyle}; text-align: center; vertical-align: middle;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: bold;">REPORTE DIARIO DE PERFORACIÓN</h2>
                    </td>
                    <td style="width: 25%; padding: 10px; border: ${borderStyle};">
                        <div style="font-weight: bold; margin-bottom: 5px;">FOLIO: <span style="color: #dc2626;">${safeStr(informe.numero_informe)}</span></div>
                        <div style="font-weight: bold;">FECHA: <span style="font-weight: normal;">${safeStr(informe.fecha).split('T')[0]}</span></div>
                    </td>
                </tr>
            </table>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: ${borderStyle}; text-align: center; font-size: 11px;">
                <tr style="background-color: ${headerBg}; font-weight: bold;">
                    <td style="padding: 5px; border: ${borderStyle};">Turno</td>
                    <td style="padding: 5px; border: ${borderStyle};">Faena / C. Costo</td>
                    <td style="padding: 5px; border: ${borderStyle};">Lugar / Sector</td>
                    <td style="padding: 5px; border: ${borderStyle};">Equipo</td>
                </tr>
                <tr>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.turno)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.faena)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.lugar)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.equipo)}</td>
                </tr>
            </table>
        `;

        // B. Cuerpo Técnico
        const techHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: ${borderStyle}; text-align: center; font-size: 11px;">
                <tr style="background-color: ${headerBg}; font-weight: bold;">
                    <td style="padding: 5px; border: ${borderStyle};">Pozo N°</td>
                    <td style="padding: 5px; border: ${borderStyle};">Diámetro</td>
                    <td style="padding: 5px; border: ${borderStyle};">Inclinación</td>
                    <td style="padding: 5px; border: ${borderStyle};">Prof. Inicial</td>
                    <td style="padding: 5px; border: ${borderStyle};">Prof. Final</td>
                    <td style="padding: 5px; border: ${borderStyle};">Mts Perforados</td>
                </tr>
                <tr>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.pozo_numero)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.diametro)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.inclinacion)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.profundidad_inicial)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.profundidad_final)}</td>
                    <td style="padding: 5px; border: ${borderStyle}; font-weight: bold;">${safeStr(informe.mts_perforados)}</td>
                </tr>
            </table>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: ${borderStyle}; text-align: center; font-size: 11px;">
                <tr style="background-color: ${headerBg}; font-weight: bold;">
                    <td style="padding: 5px; border: ${borderStyle};">Pull Down (lbs)</td>
                    <td style="padding: 5px; border: ${borderStyle};">RPM</td>
                    <td style="padding: 5px; border: ${borderStyle};">Horómetro Inicial</td>
                    <td style="padding: 5px; border: ${borderStyle};">Horómetro Final</td>
                    <td style="padding: 5px; border: ${borderStyle};">Petróleo (Gal)</td>
                    <td style="padding: 5px; border: ${borderStyle};">Lubricantes (Ltr)</td>
                </tr>
                <tr>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.pull_down)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.rpm)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.horometro_inicial)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.horometro_final)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.insumo_petroleo)}</td>
                    <td style="padding: 5px; border: ${borderStyle};">${safeStr(informe.insumo_lubricantes)}</td>
                </tr>
            </table>
        `;

        // C. Bitácora de Actividades
        let actsRows = '';
        if (actividades && actividades.length > 0) {
            actividades.forEach(a => {
                actsRows += `<tr>
                    <td style="padding: 4px; border: ${borderStyle}; text-align: center;">${safeStr(a.hora_desde).substring(0,5)}</td>
                    <td style="padding: 4px; border: ${borderStyle}; text-align: center;">${safeStr(a.hora_hasta).substring(0,5)}</td>
                    <td style="padding: 4px; border: ${borderStyle};">${safeStr(a.detalle)}</td>
                    <td style="padding: 4px; border: ${borderStyle}; text-align: center;">${safeStr(a.hrs_bd)}</td>
                    <td style="padding: 4px; border: ${borderStyle}; text-align: center;">${safeStr(a.hrs_cliente)}</td>
                </tr>`;
            });
        } else {
            actsRows = `<tr><td colspan="5" style="padding: 10px; border: ${borderStyle}; text-align: center; color: #666; font-style: italic;">Sin actividades registradas</td></tr>`;
        }

        const logHtml = `
            <div style="font-weight: bold; background-color: ${headerBg}; border: ${borderStyle}; border-bottom: none; padding: 5px; font-size: 12px; margin-top: 20px;">
                BITÁCORA DE ACTIVIDADES
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: ${borderStyle}; font-size: 10px;">
                <tr style="background-color: ${headerBg}; font-weight: bold; text-align: center;">
                    <td style="padding: 5px; border: ${borderStyle}; width: 10%;">Desde</td>
                    <td style="padding: 5px; border: ${borderStyle}; width: 10%;">Hasta</td>
                    <td style="padding: 5px; border: ${borderStyle}; width: 60%; text-align: left;">Descripción de la Tarea</td>
                    <td style="padding: 5px; border: ${borderStyle}; width: 10%;">Hrs BD</td>
                    <td style="padding: 5px; border: ${borderStyle}; width: 10%;">Hrs Cli</td>
                </tr>
                ${actsRows}
            </table>
        `;
        
        // Observaciones
        let obsHtml = '';
        if (informe.observaciones) {
            obsHtml = `
            <div style="font-weight: bold; margin-bottom: 5px; font-size: 11px;">OBSERVACIONES / NOVEDADES:</div>
            <div style="border: ${borderStyle}; min-height: 40px; padding: 8px; font-size: 11px; white-space: pre-wrap; margin-bottom: 25px;">${safeStr(informe.observaciones)}</div>
            `;
        } else {
            obsHtml = `<div style="height: 40px;"></div>`;
        }

        // D. Footer (Firmas y Auditoría)
        let auditNote = '';
        if (auditDateStr || (informe.is_audit_edit && informe.is_audit_edit == 1)) {
            const dateStr = auditDateStr || 'Sin Fecha';
            auditNote = `
                <div style="margin-top: 15px; font-size: 10px; text-align: center; font-style: italic; font-weight: bold;">
                    📍 Documento interceptado y validado mediante auditoría interna el ${dateStr}.
                </div>
            `;
        }

        const sigsHtml = `
            <div style="display: flex; justify-content: space-between; margin-top: 40px; text-align: center; font-size: 11px;">
                <div style="width: 40%;">
                    <div style="border-bottom: 1px solid #000; height: 50px; margin-bottom: 5px;"></div>
                    <div style="font-weight: bold;">FIRMA RESPONSABLE</div>
                    <div>${operadorLabel}</div>
                </div>
                <div style="width: 40%;">
                    <div style="border-bottom: 1px solid #000; height: 50px; margin-bottom: 5px;"></div>
                    <div style="font-weight: bold;">SUPERVISOR / ADMIN</div>
                    <div>Aprobación V°B°</div>
                </div>
            </div>
            ${auditNote}
        `;

        wrapper.innerHTML = headerHtml + techHtml + logHtml + obsHtml + sigsHtml;

        // Montar y disparar html2pdf
        document.body.appendChild(wrapper);
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        wrapper.style.top = '0';

        const opt = {
            margin:       10, // mm
            filename:     `Reporte_IT_${safeStr(informe.numero_informe)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(wrapper).save();
        document.body.removeChild(wrapper);

    } catch (err) {
        console.error('Error generando PDF bajo demanda:', err);
        throw err;
    }
}
