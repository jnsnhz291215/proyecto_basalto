document.addEventListener('DOMContentLoaded', () => {
    const btnPdf = document.getElementById('btn-descargar-pdf');
    const btnReabrir = document.getElementById('btn-reabrir-turno');

    if (btnPdf) {
        btnPdf.addEventListener('click', generarPDF);
    }

    if (btnReabrir) {
        btnReabrir.addEventListener('click', reabrirTurno);
    }
    
    setupModalAdvertencia();
});

function setupModalAdvertencia() {
    const modal = document.getElementById('modal-advertencia-guardado');
    const btnEntendido = document.getElementById('btn-adv-entendido');
    const btnGuardarAhora = document.getElementById('btn-adv-guardar-ahora');
    
    if (!modal) return;

    if (btnEntendido) {
        btnEntendido.addEventListener('click', () => {
            modal.style.display = 'none';
            if (typeof document.body.style.overflow !== 'undefined') {
                document.body.style.overflow = '';
            }
        });
    }

    if (btnGuardarAhora) {
        btnGuardarAhora.addEventListener('click', async () => {
            modal.style.display = 'none';
            if (typeof document.body.style.overflow !== 'undefined') {
                document.body.style.overflow = '';
            }
            
            // Simular clic en el botón nativo de Guardar Borrador para aprovechar su lógica (spinners, loaders, validaciones de informe.js)
            const btnBorrador = document.getElementById('btn-guardar-borrador');
            if (btnBorrador) {
                btnBorrador.click();
            } else {
                // Fallback si no existe el boton en el dom (poco probable)
                if (typeof persistInforme === 'function') {
                    await persistInforme('Borrador');
                }
            }
        });
    }
}

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
        const modal = document.getElementById('modal-advertencia-guardado');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Bloquear scroll usando tactica similar a common.js / bootstrap
        } else {
            alert('Debes guardar el informe primero antes de generar el PDF.');
        }
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

async function ensurePdfLibraries() {
    const hasJsPdf = Boolean(window.jspdf && window.jspdf.jsPDF);
    const hasAutoTable = Boolean(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);

    if (hasJsPdf && hasAutoTable) return;

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(script);
    });

    if (!hasJsPdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const stillMissingAutoTable = !(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
    if (stillMissingAutoTable) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }

    const ready = Boolean(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable);
    if (!ready) {
        throw new Error('No se pudieron inicializar las librerias de PDF.');
    }
}

function getInputValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    return String(el.value || '').trim();
}

function getSelectLabel(id) {
    const select = document.getElementById(id);
    if (!select) return '';
    const selected = select.options[select.selectedIndex];
    if (!selected) return String(select.value || '').trim();
    return String(selected.textContent || selected.value || '').trim();
}

function getSelectValue(id) {
    const select = document.getElementById(id);
    if (!select) return '';
    return String(select.value || '').trim();
}

function formatValue(val) {
    if (val === null || val === undefined) return '-';
    const text = String(val).trim();
    return text || '-';
}

function normalizeCellValue(value) {
    return formatValue(value);
}

function normalizeWorkerLabel(value) {
    const text = String(value || '').trim();
    if (!text) return '-';

    // Quita sufijo "(RUT)" para que el PDF muestre solo el nombre.
    return text.replace(/\s*\([^)]*\)\s*$/, '').trim() || text;
}

function rowValuesByNames(row, names) {
    return names.map((name) => formatValue(row.querySelector(`[name="${name}"]`)?.value || ''));
}

function buildFolio(idInforme) {
    const numeric = Number(idInforme);
    const safe = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
    return `I-${String(safe).padStart(3, '0')}`;
}

function normalizeJornadaLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    if (normalized.includes('noche')) return 'Noche';
    if (normalized.includes('dia')) return 'Dia';
    return raw;
}

function extractGroupCode(value) {
    const text = String(value || '').trim();
    if (!text) return 'SG';
    const match = text.match(/grupo\s*([a-z0-9]+)/i);
    if (match && match[1]) return match[1].toUpperCase();
    return text.replace(/\s+/g, '').toUpperCase();
}

function toDateDash(isoDate) {
    const text = String(isoDate || '').trim();
    const parts = text.split('-');
    if (parts.length !== 3) return text || 'S/F';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function toDateUnderscore(isoDate) {
    const text = String(isoDate || '').trim();
    const parts = text.split('-');
    if (parts.length !== 3) return String(text || 'S_F').replace(/[^a-zA-Z0-9]+/g, '_');
    return `${parts[2]}_${parts[1]}_${parts[0]}`;
}

async function fetchInformeHeaderById(idInforme) {
    try {
        const res = await fetch(`/api/informes/${idInforme}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (_error) {
        return null;
    }
}

function resolveJornadaFromReportData(reportData) {
    const inputJornada = normalizeJornadaLabel(getInputValue('input-jornada'));
    if (inputJornada) {
        console.log(`[PDF_ENGINE] Jornada detectada desde datos del informe: ${inputJornada}.`);
        return inputJornada;
    }

    const dbCandidates = [
        reportData?.jornada,
        reportData?.turno_jornada,
        reportData?.jornada_turno,
        reportData?.tipo_turno,
        reportData?.turno_tipo
    ];
    for (const candidate of dbCandidates) {
        const value = normalizeJornadaLabel(candidate);
        if (value) {
            console.log(`[PDF_ENGINE] Jornada detectada desde datos del informe: ${value}.`);
            return value;
        }
    }

    const turnoDisplay = String(getInputValue('input-turno-display') || '').trim();
    const turnoValue = String(getInputValue('input-turno') || reportData?.turno || '').trim();
    const displayCandidate = normalizeJornadaLabel(`${turnoDisplay} ${turnoValue}`);
    if (displayCandidate === 'Dia' || displayCandidate === 'Noche') {
        console.log(`[PDF_ENGINE] Jornada detectada desde datos del informe: ${displayCandidate}.`);
        return displayCandidate;
    }

    const fallback = 'SinJornada';
    console.log(`[PDF_ENGINE] Jornada detectada desde datos del informe: ${fallback}.`);
    return fallback;
}

async function fetchWorkerCatalog() {
    try {
        // Priorizar lista cargada en memoria si existe; fallback a API
        const inMemoryWorkers = Array.isArray(window?.state?.listaTrabajadores)
            ? window.state.listaTrabajadores
            : null;

        let workers = inMemoryWorkers;
        if (!workers) {
            const response = await fetch('/api/trabajadores');
            if (!response.ok) return new Map();
            workers = await response.json();
        }

        const catalog = new Map();
        workers.forEach((worker) => {
            const rut = String(worker.RUT || worker.rut || '').trim();
            if (!rut) return;
            const cargoReal = String(
                worker.cargo_nombre
                || worker.nombre_cargo
                || worker.cargo
                || ''
            ).trim();

            catalog.set(rut, {
                nombre: normalizeWorkerLabel(`${worker.nombres || ''} ${worker.apellido_paterno || ''} ${worker.apellido_materno || ''}`),
                cargo: cargoReal
            });
        });
        return catalog;
    } catch (_error) {
        return new Map();
    }
}

async function imageUrlToBase64(url) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('No se pudo convertir imagen a base64'));
            reader.readAsDataURL(blob);
        });

        return dataUrl;
    } catch (error) {
        console.warn('[PDF_ENGINE] No se pudo cargar el logo para PDF:', error?.message || error);
        return null;
    }
}

async function collectPdfData() {
    const workerCatalog = await fetchWorkerCatalog();

    const resolveCargo = (rut, nombreTrabajador) => {
        const found = workerCatalog.get(String(rut || '').trim());
        const cargoReal = String(found?.cargo || '').trim() || '-';
        console.log(`[PDF_ENGINE] Mapeando Cargo para ${nombreTrabajador || '-'}: ${cargoReal}`);
        return cargoReal;
    };

    const todayDate = getInputValue('input-fecha');
    const grupo = getInputValue('input-turno') || getInputValue('input-grupo') || getInputValue('input-turno-display');
    const faena = getInputValue('input-faena');
    const equipo = getInputValue('input-equipo');
    const responsableRut = getSelectValue('input-operador');
    const responsable = normalizeWorkerLabel(getSelectLabel('input-operador'));

    const personalRows = [
        ['Responsable de Turno', formatValue(responsable), formatValue(resolveCargo(responsableRut, responsable))]
    ];
    for (let index = 1; index <= 5; index += 1) {
        const helperRut = getSelectValue(`input-ayudante-${index}`);
        const helperLabel = normalizeWorkerLabel(getSelectLabel(`input-ayudante-${index}`));
        if (helperRut && helperLabel !== '— Ninguno —' && helperLabel !== '-' && helperRut !== responsableRut) {
            personalRows.push([
                `Ayudante ${index}`,
                formatValue(helperLabel),
                formatValue(resolveCargo(helperRut, helperLabel))
            ]);
        }
    }

    const perforacionRowsRaw = Array.from(document.querySelectorAll('#tabla-perforacion tr')).map((row) => {
        const desdeRaw = row.querySelector('[name="perf_desde[]"]')?.value || '';
        const hastaRaw = row.querySelector('[name="perf_hasta[]"]')?.value || '';
        const recuperRaw = row.querySelector('[name="perf_recuper[]"]')?.value || '';
        const tipoRaw = row.querySelector('[name="perf_tipo[]"]')?.value || '';
        const durezaRaw = row.querySelector('[name="perf_dureza[]"]')?.value || '';

        const desdeNum = Number(desdeRaw);
        const hastaNum = Number(hastaRaw);
        const mtsPerf = Number.isFinite(desdeNum) && Number.isFinite(hastaNum)
            ? Number((hastaNum - desdeNum).toFixed(2))
            : null;

        return {
            desde: formatValue(desdeRaw),
            hasta: formatValue(hastaRaw),
            mtsPerf,
            recuperacion: formatValue(recuperRaw),
            tipoRoca: formatValue(tipoRaw),
            dureza: formatValue(durezaRaw)
        };
    });

    const perforacionRows = perforacionRowsRaw
        .map((row) => [
            row.desde,
            row.hasta,
            formatValue(row.mtsPerf),
            row.recuperacion,
            row.tipoRoca,
            row.dureza
        ])
        .filter((row) => row.some((cell) => cell !== '-'));

    const totalMtsPerforados = perforacionRowsRaw.reduce((acc, row) => (
        Number.isFinite(row.mtsPerf) ? acc + row.mtsPerf : acc
    ), 0);

    const actividadRows = Array.from(document.querySelectorAll('#lista-actividades tr')).map((row) =>
        rowValuesByNames(row, ['hora_desde[]', 'hora_hasta[]', 'detalle[]', 'hrs_bd[]', 'hrs_cliente[]'])
    ).filter((row) => row.some((cell) => cell !== '-'));

    const hrsHorometro = getInputValue('input-horometro-hrs');
    const mtsPerforados = getInputValue('input-mts-perforados');
    const observaciones = getInputValue('notas-observaciones');

    const consumiblesRows = [
        ['Petroleo (Gal)', formatValue(getInputValue('input-petroleo'))],
        ['Aceites (Ltr)', formatValue(getInputValue('input-aceites'))],
        ['Lubricantes (Ltr)', formatValue(getInputValue('input-lubricantes'))],
        ['Aditivos / Otros (Kg)', formatValue(getInputValue('input-otros'))]
    ];

    const herramientasRows = Array.from(document.querySelectorAll('#tabla-herramientas tr')).map((row) =>
        rowValuesByNames(row, ['herr_tipo_elemento[]', 'herr_diametro[]', 'herr_numero_serie[]', 'herr_desde_mts[]', 'herr_hasta_mts[]', 'herr_detalle_extra[]'])
    ).filter((row) => row.some((cell) => cell !== '-'));

    const datos = [
        todayDate,
        grupo,
        faena,
        equipo,
        responsable,
        hrsHorometro,
        mtsPerforados,
        observaciones,
        ...consumiblesRows.flat(),
        ...herramientasRows.flat(),
        ...personalRows.flat(),
        ...perforacionRows.flat(),
        ...actividadRows.flat()
    ].filter((value) => String(value || '').trim() !== '');

    return {
        encabezado: {
            fecha: formatValue(todayDate),
            grupo: formatValue(grupo),
            faena: formatValue(faena),
            equipo: formatValue(equipo),
            responsable: formatValue(responsable)
        },
        personalRows,
        perforacionRows,
        actividadRows,
        consumiblesRows,
        herramientasRows,
        observaciones: formatValue(observaciones),
        calculos: {
            hrsHorometro: formatValue(hrsHorometro),
            mtsPerforados: formatValue(totalMtsPerforados > 0 ? totalMtsPerforados.toFixed(2) : '0.00'),
            totalMtsPerforados
        },
        datos,
        todayDate,
        grupo
    };
}

// Generador Universal y On-Demand
async function exportarInformeAPDF(idInforme, options = {}) {
    const { saveFile = true, returnBlob = false } = options;
    if (!idInforme) {
        throw new Error("No hay ID de informe válido");
    }

    try {
        await ensurePdfLibraries();

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const logoBase64 = await imageUrlToBase64('/IMG/logoBASALTO.png');
        const {
            encabezado,
            personalRows,
            perforacionRows,
            actividadRows,
            consumiblesRows,
            herramientasRows,
            observaciones,
            calculos,
            datos
           } = await collectPdfData();

        const reportData = await fetchInformeHeaderById(idInforme);
        const todayDate = getInputValue('input-fecha') || String(reportData?.fecha || '').split('T')[0] || '';
        const grupoRaw = getInputValue('input-turno') || getInputValue('input-grupo') || reportData?.turno || encabezado.grupo;
        const grupoCodigo = extractGroupCode(grupoRaw);
        const jornada = resolveJornadaFromReportData(reportData || {});

        const folio = buildFolio(idInforme);

        let cursorY = 16;

        if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', 12, 10, 28, 18);
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text('Reporte Diario de Operaciones', 105, 18, { align: 'center' });
        pdf.setTextColor(220, 38, 38);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(folio, 198, 14, { align: 'right' });
        pdf.setTextColor(0, 0, 0);
        const metadatosLinea = `${toDateDash(todayDate)} - Grupo ${grupoCodigo} - ${jornada}`;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(metadatosLinea, 198, 19, { align: 'right' });
        cursorY = 34;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('1. Antecedentes', 14, cursorY);
        cursorY += 2;

        pdf.autoTable({
            startY: cursorY,
            head: [['Fecha', 'Grupo', 'Faena', 'Equipo', 'Responsable de Turno']],
            body: [[
                encabezado.fecha,
                encabezado.grupo,
                encabezado.faena,
                encabezado.equipo,
                encabezado.responsable
            ]],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('2. Personal', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Rol', 'Trabajador', 'Cargo']],
            body: personalRows.length ? personalRows : [['Responsable de Turno', '-', '-']],
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
            headStyles: { fillColor: [249, 115, 22], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('3. Operación', 14, cursorY);

        cursorY += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('3.1 Perforación', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Desde', 'Hasta', 'Mts Perf', 'Recuperacion %', 'Tipo Roca', 'Dureza']],
            body: perforacionRows.length ? perforacionRows : [['-', '-', '-', '-', '-', '-']],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
            headStyles: { fillColor: [75, 85, 99], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('3.2 Descripción Actividades Realizadas', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Desde', 'Hasta', 'Detalle', 'Hrs BD', 'Hrs Cliente']],
            body: actividadRows.length ? actividadRows : [['-', '-', '-', '-', '-']],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
            columnStyles: { 2: { halign: 'left' } },
            headStyles: { fillColor: [75, 85, 99], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('4. Materiales', 14, cursorY);

        cursorY += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('4.1 Consumibles', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Consumible', 'Cantidad']],
            body: consumiblesRows.length ? consumiblesRows : [['-', '-']],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('4.2 Herramientas de Perforación', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Tipo Elemento', 'Diametro', 'N Serie', 'Desde (m)', 'Hasta (m)', 'Detalle']],
            body: herramientasRows.length ? herramientasRows : [['-', '-', '-', '-', '-', '-']],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2.5, halign: 'center' },
            columnStyles: { 5: { halign: 'left' } },
            headStyles: { fillColor: [75, 85, 99], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 8;
        const pageHeightForCalc = pdf.internal.pageSize.getHeight();
        const minCalcBlockHeight = 42;
        if (cursorY + minCalcBlockHeight > pageHeightForCalc - 14) {
            pdf.addPage();
            cursorY = 20;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('5. Cierre y Firmas', 14, cursorY);

        pdf.autoTable({
            startY: cursorY + 2,
            head: [['Total Horas Horómetro', 'Total Metros Perforados']],
            body: [[calculos.hrsHorometro, calculos.mtsPerforados]],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 }
        });

        // Validar cálculos: mts perforados debe coincidir con suma de perforación
        const mtsPerfsumFromTable = calculos.totalMtsPerforados || 0;
        const displayMtsPerf = calculos.mtsPerforados;
        console.log(`[PDF_ENGINE] Validación de Mts Perf: Tabla sumada=${mtsPerfsumFromTable}, Mostrado en PDF=${displayMtsPerf}`);

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 4;
        pdf.autoTable({
            startY: cursorY,
            head: [['Notas / Observaciones']],
            body: [[observaciones]],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, minCellHeight: 20, valign: 'top', halign: 'left' },
            headStyles: { fillColor: [75, 85, 99], textColor: 255 }
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 10;
        const pageHeight = pdf.internal.pageSize.getHeight();
        const signatureBlockHeight = 42;
        if (cursorY + signatureBlockHeight > pageHeight - 12) {
            pdf.addPage();
            cursorY = 20;
        }

        const leftX = 14;
        const rightX = 110;
        const boxWidth = 86;
        const boxHeight = 24;
        const lineY = cursorY + 18;

        pdf.rect(leftX, cursorY, boxWidth, boxHeight);
        pdf.rect(rightX, cursorY, boxWidth, boxHeight);
        pdf.line(leftX + 6, lineY, leftX + boxWidth - 6, lineY);
        pdf.line(rightX + 6, lineY, rightX + boxWidth - 6, lineY);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text('Firma Responsable de Turno', leftX + (boxWidth / 2), cursorY + 22, { align: 'center' });
        pdf.text('Firma Supervisor / Cliente', rightX + (boxWidth / 2), cursorY + 22, { align: 'center' });

                // ===== CONSTRUIR NOMBRE DE ARCHIVO (JORNADA REAL DEL INFORME) =====
                const fechaFormato = toDateUnderscore(todayDate);
                const jornadaArchivo = String(jornada || 'SinJornada').replace(/\s+/g, '');
                const nombreArchivo = `Informe_Turno_Grupo_${grupoCodigo}_${jornadaArchivo}_${fechaFormato}.pdf`;
        
        if (saveFile) {
            pdf.save(nombreArchivo);
            console.log(`[PDF_ENGINE] Exportando archivo: ${nombreArchivo}`);
        }

        const pdfBlob = returnBlob ? pdf.output('blob') : null;
        console.log(`[PDF_ENGINE] Documento generado exitosamente con ${datos.length} campos.`);

        return {
            nombreArchivo,
            blob: pdfBlob
        };

    } catch (err) {
        console.error('Error generando PDF bajo demanda:', err);
        throw err;
    }
}

async function generarPDFBase64ParaCorreo(idInforme) {
    const resultado = await exportarInformeAPDF(idInforme, { saveFile: false, returnBlob: true });
    if (!resultado?.blob) {
        throw new Error('No fue posible generar el PDF para correo.');
    }

    const pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = String(reader.result || '');
            resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);
        };
        reader.onerror = () => reject(new Error('No se pudo convertir PDF a base64'));
        reader.readAsDataURL(resultado.blob);
    });

    return {
        pdfBase64,
        nombreArchivo: resultado.nombreArchivo
    };
}
