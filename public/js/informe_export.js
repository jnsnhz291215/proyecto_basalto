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
    const btnPdfMain = document.getElementById('btn-descargar-pdf');
    const btnPdfSuccess = document.getElementById('btn-success-pdf');
    if (btnPdfMain) btnPdfMain.classList.add('btn-loading');
    if (btnPdfSuccess) btnPdfSuccess.classList.add('btn-loading');

    try {
        // 1. Fetch audit state
        let auditDateStr = null;
        if (state.currentReportId) {
            const res = await fetch('/api/logs');
            if (res.ok) {
                const logs = await res.json();
                const logForDoc = logs.find(l => l.detalle && l.detalle.includes(`ID_${state.currentReportId}`));
                if (logForDoc) {
                    const dt = new Date(logForDoc.fecha);
                    auditDateStr = dt.toLocaleDateString('es-CL');
                }
            }
        }

        // 2. Clone the container for clean PDF print
        const originalContainer = document.querySelector('.informe-container');
        const container = originalContainer.cloneNode(true);

        // Hide unwanted elements
        container.querySelectorAll('.status-banner').forEach(el => el.style.display = 'none');
        container.querySelectorAll('.action-bar').forEach(el => el.style.display = 'none');
        container.querySelectorAll('.tabs-header').forEach(el => el.style.display = 'none');
        container.querySelectorAll('button').forEach(el => el.style.display = 'none');
        
        // Show all tabs vertically
        container.querySelectorAll('.tab-content').forEach(el => {
            el.style.display = 'block';
            el.style.opacity = '1';
            el.classList.add('active');
        });

        // Convert form elements to span texts
        container.querySelectorAll('input, select, textarea').forEach(el => {
            let val = el.value || '';
            if (el.tagName === 'SELECT') {
                const opt = el.options[el.selectedIndex];
                val = opt ? opt.text : val;
                if (val.startsWith('—') && val.endsWith('—')) val = ''; // hide placeholder like text
            }
            const span = document.createElement('span');
            span.textContent = val || '-';
            span.style.padding = '4px 8px';
            span.style.display = 'inline-block';
            span.style.fontWeight = '600';
            span.style.color = '#1f2937';
            span.style.borderBottom = '1px dashed #cbd5e1';
            span.style.minWidth = '40px';
            if (el.tagName === 'TEXTAREA') {
                span.style.whiteSpace = 'pre-wrap';
                span.style.display = 'block';
                span.style.border = '1px solid #e2e8f0';
                span.style.padding = '10px';
                span.style.borderRadius = '6px';
                span.style.backgroundColor = '#f8fafc';
            }
            el.parentNode.replaceChild(span, el);
        });

        // Insert Logo
        const headerSection = container.querySelector('.header-section');
        if (headerSection) {
            const logoHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #4f46e5;">
                <div>
                    <h1 style="color: #4f46e5; margin: 0; font-size: 24px; letter-spacing: 1px;">BASALTO DRILLING</h1>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Servicios de Perforación de Alta Precisión</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 18px; color: #1f2937;">Informe Oficial de Turno</h2>
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #4b5563;">
                        Folio: ${document.getElementById('edit-numero-informe') ? document.getElementById('edit-numero-informe').value : (state.currentReportId ? 'ID-' + state.currentReportId : 'Borrador')}
                    </p>
                </div>
            </div>`;
            headerSection.insertAdjacentHTML('afterbegin', logoHtml);
        }

        // Insert Signatures box
        const signaturesHtml = `
        <div style="margin-top: 50px; display: flex; justify-content: space-around; break-inside: avoid;">
            <div style="text-align: center; width: 40%;">
                <div style="border-bottom: 1px solid #1f2937; margin-bottom: 8px; height: 60px;"></div>
                <p style="margin: 0; font-weight: 600; font-size: 14px; color: #374151;">Responsable de Turno</p>
            </div>
            <div style="text-align: center; width: 40%;">
                <div style="border-bottom: 1px solid #1f2937; margin-bottom: 8px; height: 60px;"></div>
                <p style="margin: 0; font-weight: 600; font-size: 14px; color: #374151;">Supervisor / Admin</p>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', signaturesHtml);

        // If audit applied
        if (auditDateStr) {
            const footerHtml = `
            <div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280;">
                <em>Documento validado mediante auditoría interna el ${auditDateStr}</em>
            </div>`;
            container.insertAdjacentHTML('beforeend', footerHtml);
        }

        // Adjust empty tables cleanup
        container.querySelectorAll('tbody').forEach(tbody => {
           if (tbody.children.length === 0) {
               const tr = document.createElement('tr');
               const tdCount = tbody.parentNode.querySelectorAll('th').length;
               tr.innerHTML = `<td colspan="${tdCount}" style="text-align:center;color:#9ca3af;font-style:italic;">No hay registros</td>`;
               tbody.appendChild(tr);
           } 
        });

        // Delete empty Action columns from tables
        container.querySelectorAll('th').forEach(th => {
            if (th.textContent.trim() === '') {
                const idx = Array.from(th.parentNode.children).indexOf(th);
                const table = th.closest('table');
                table.querySelectorAll('tr').forEach(tr => {
                    if (tr.children[idx]) tr.children[idx].style.display = 'none';
                });
            }
        });

        // Build a wrapper
        const wrapper = document.createElement('div');
        wrapper.appendChild(container);
        wrapper.style.padding = '30px';
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.color = '#000000';
        wrapper.style.width = '800px';

        document.body.appendChild(wrapper);

        // Hide main layout momentarily to apply global styles that PDF needs without interfering with main screen
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        wrapper.style.top = '0';

        const opt = {
            margin:       10,
            filename:     `Informe_${state.currentReportId || 'Nuevo'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(wrapper).save();

        document.body.removeChild(wrapper);

    } catch (err) {
        console.error('Error generando PDF:', err);
        alert('Ocurrió un error al generar el PDF.');
    } finally {
        const btnPdfMain = document.getElementById('btn-descargar-pdf');
        const btnPdfSuccess = document.getElementById('btn-success-pdf');
        if (btnPdfMain) btnPdfMain.classList.remove('btn-loading');
        if (btnPdfSuccess) btnPdfSuccess.classList.remove('btn-loading');
    }
}
