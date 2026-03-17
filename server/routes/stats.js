const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion');

// ============================================
// OBTENER ESTADÍSTICAS MENSUALES
// ============================================
router.get('/stats/mensual', async (req, res) => {
    try {
        const anio = parseInt(req.query.anio) || new Date().getFullYear();

        // 1. Metros Perforados Totales por Mes y Eficiencia de Combustible
        const [metricasRows] = await pool.execute(`
            SELECT 
                MONTH(fecha) as mes,
                SUM(mts_perforados) as total_metros,
                SUM(insumo_petroleo) as total_petroleo
            FROM informes_turno
            WHERE YEAR(fecha) = ? AND estado != 'Anulado'
            GROUP BY MONTH(fecha)
            ORDER BY mes ASC
        `, [anio]);

        // 2. Disponibilidad Mecánica (Días operativos vs Paradas) 
        // Nota: Basado en los campos hrs_trabajadas y tiempo productivo vs detenciones
        // Asumimos que la disponibilidad se puede aproximar por informes totales vs los que declaran detenciones críticas,
        // o sumar hrs_trabajadas. Para simplificar según requerimiento:
        const [disponibilidadRows] = await pool.execute(`
            SELECT 
                MONTH(fecha) as mes,
                COUNT(id_informe) as total_informes,
                SUM(horas_trabajadas) as total_hrs_trabajadas
            FROM informes_turno
            WHERE YEAR(fecha) = ? AND estado != 'Anulado'
            GROUP BY MONTH(fecha)
            ORDER BY mes ASC
        `, [anio]);

        // Formatear respuesta con los 12 meses
        const meses = Array.from({ length: 12 }, (_, i) => i + 1);
        
        const dataMetros = meses.map(m => {
            const row = metricasRows.find(r => r.mes === m);
            return row && row.total_metros ? parseFloat(row.total_metros) : 0;
        });

        const dataEficiencia = meses.map(m => {
            const row = metricasRows.find(r => r.mes === m);
            if (row && row.total_metros > 0 && row.total_petroleo) {
                // Promedio Litros/Metro
                return parseFloat((row.total_petroleo / row.total_metros).toFixed(2));
            }
            return 0;
        });

        const dataDisponibilidad = meses.map(m => {
            const row = disponibilidadRows.find(r => r.mes === m);
            return row ? {
                informes: parseInt(row.total_informes || 0),
                horas: parseFloat(row.total_hrs_trabajadas || 0)
            } : { informes: 0, horas: 0 };
        });

        // 3. Tarjetas de Resumen
        // Mejor Grupo del Mes (del mes actual o el último mes de la consulta si pedimos de otro año)
        const mesConsulta = anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;

        const [mejorGrupoRow] = await pool.execute(`
            SELECT 
                turno as grupo,
                SUM(mts_perforados) as total_metros
            FROM informes_turno
            WHERE YEAR(fecha) = ? AND MONTH(fecha) = ? AND estado != 'Anulado'
            GROUP BY turno
            ORDER BY total_metros DESC
            LIMIT 1
        `, [anio, mesConsulta]);

        // Avance Anual Acumulado
        const avanceAcumulado = dataMetros.reduce((acc, val) => acc + val, 0);

        res.json({
            anio,
            grafico_metros: dataMetros,
            grafico_eficiencia: dataEficiencia,
            disponibilidad: dataDisponibilidad,
            resumen: {
                mejor_grupo_mes: mejorGrupoRow.length > 0 ? mejorGrupoRow[0].grupo : 'Ninguno',
                mejor_grupo_metros: mejorGrupoRow.length > 0 ? parseFloat(mejorGrupoRow[0].total_metros) : 0,
                avance_anual: avanceAcumulado
            }
        });

    } catch (error) {
        console.error('[ERROR] Error obteniendo estadísticas mensuales:', error);
        res.status(500).json({ error: 'Error del servidor al obtener estadísticas.' });
    }
});

module.exports = router;
