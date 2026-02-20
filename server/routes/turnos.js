const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

// Constantes de la lógica de turnos
const CICLO_COMPLETO = 56; // Días del ciclo completo (14 días × 4 fases)
const DIAS_POR_FASE = 14; // Días trabajados / descansados por fase
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DESFASE_PISTA2 = 7; // Pista 2 (EFGH) tiene +7 días de desfase respecto a Pista 1

// Cache para la configuración de ciclos
let configCache = null;
let ultimaActualizacionCache = 0;
const CACHE_DURACION = 5 * 60 * 1000; // 5 minutos

function normalizarNombreConfig(nombre) {
  return String(nombre || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function parsearDiasSemana(diasStr) {
  return String(diasStr || '')
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => !Number.isNaN(v));
}

/**
 * Obtener configuración de ciclos desde la base de datos (con caché)
 */
async function obtenerConfigCiclos() {
  const ahora = Date.now();

  if (configCache && (ahora - ultimaActualizacionCache < CACHE_DURACION)) {
    return configCache;
  }

  const [rows] = await pool.execute(
    'SELECT pista_nombre, tipo_ciclo, fecha_semilla, dias_semana FROM configuracion_ciclos WHERE activo = 1'
  );

  const config = {
    rotativo: {
      pista1: null,
      pista2: null
    },
    semanal: {
      J: null,
      K: null
    }
  };

  if (rows && rows.length) {
    rows.forEach(row => {
      const nombre = normalizarNombreConfig(row.pista_nombre);
      const tipo = String(row.tipo_ciclo || '').toUpperCase();

      if (tipo === 'ROTATIVO') {
        if (nombre === 'PISTA_1' && row.fecha_semilla) {
          config.rotativo.pista1 = new Date(row.fecha_semilla);
        }
        if (nombre === 'PISTA_2' && row.fecha_semilla) {
          config.rotativo.pista2 = new Date(row.fecha_semilla);
        }
      }

      if (tipo === 'SEMANAL') {
        if (nombre === 'TURNO_J' || nombre === 'J') {
          config.semanal.J = parsearDiasSemana(row.dias_semana);
        }
        if (nombre === 'TURNO_K' || nombre === 'K') {
          config.semanal.K = parsearDiasSemana(row.dias_semana);
        }
      }
    });
  }

  configCache = config;
  ultimaActualizacionCache = ahora;
  return configCache;
}

/**
 * Obtener el estado del turno de un trabajador
 * GET /api/estado-turno/:rut
 */
router.get('/estado-turno/:rut', async (req, res) => {
  let connection;
  try {
    const { rut } = req.params;
    
    // Obtener configuración de ciclos
    const configCiclos = await obtenerConfigCiclos();
    
    // Obtener datos del trabajador
    connection = await pool.getConnection();
    const [trabajadores] = await connection.execute(
      `SELECT 
        t.RUT, 
        t.nombres, 
        t.apellidos, 
        t.id_grupo,
        g.nombre_grupo
      FROM trabajadores t
      LEFT JOIN grupos g ON t.id_grupo = g.id_grupo
      WHERE t.RUT = ? AND t.activo = 1
      LIMIT 1`,
      [rut]
    );
    
    if (!trabajadores || trabajadores.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    
    const trabajador = trabajadores[0];
    const grupo = trabajador.nombre_grupo
      ? String(trabajador.nombre_grupo).trim()
      : (trabajador.id_grupo ? String(trabajador.id_grupo) : null);
    
    if (!grupo) {
      return res.json({
        estado: 'sin_grupo',
        mensaje: 'No tiene grupo asignado',
        grupo: null
      });
    }
    
    // Fecha de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Determinar el estado basado en el grupo
    const estadoTurno = calcularEstadoTurno(grupo, hoy, configCiclos);
    
    res.json(estadoTurno);
    
  } catch (error) {
    console.error('[ERROR] Error al obtener estado de turno:', error);
    res.status(500).json({ error: 'Error al calcular el estado del turno' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * Calcular el estado del turno basado en el grupo y la fecha
 */
function calcularEstadoTurno(grupo, fecha, configCiclos) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  // Grupos semanales J y K
  if (grupo === 'J' || grupo === 'K') {
    return calcularEstadoSemanal(grupo, fechaCopy, configCiclos);
  }

  const semillaPista1 = configCiclos?.rotativo?.pista1
    ? new Date(configCiclos.rotativo.pista1)
    : new Date(2026, 1, 7);
  semillaPista1.setHours(0, 0, 0, 0);

  let semillaPista2 = null;
  if (configCiclos?.rotativo?.pista2) {
    semillaPista2 = new Date(configCiclos.rotativo.pista2);
  } else {
    semillaPista2 = new Date(semillaPista1);
    semillaPista2.setDate(semillaPista2.getDate() + DESFASE_PISTA2);
  }
  semillaPista2.setHours(0, 0, 0, 0);
  
  // Determinar si es Pista 1 (A, B, C, D, AB, CD) o Pista 2 (E, F, G, H, EF, GH)
  const pista1Grupos = ['A', 'B', 'C', 'D', 'AB', 'CD'];
  const pista2Grupos = ['E', 'F', 'G', 'H', 'EF', 'GH'];
  
  if (pista1Grupos.includes(grupo)) {
    return calcularEstadoPista(grupo, fechaCopy, semillaPista1, 'pista1');
  } else if (pista2Grupos.includes(grupo)) {
    return calcularEstadoPista(grupo, fechaCopy, semillaPista2, 'pista2');
  }
  
  return {
    estado: 'sin_datos',
    mensaje: 'Grupo no reconocido',
    grupo: grupo
  };
}

/**
 * Calcular estado para grupos semanales (J y K)
 */
function calcularEstadoSemanal(grupo, fecha, configCiclos) {
  const dia = ((fecha.getDay() + 6) % 7) + 1; // 1=Lun ... 7=Dom
  let diasTrabajo = [];

  if (grupo === 'J') {
    diasTrabajo = configCiclos?.semanal?.J?.length ? configCiclos.semanal.J : [1, 2, 3, 4];
  } else if (grupo === 'K') {
    diasTrabajo = configCiclos?.semanal?.K?.length ? configCiclos.semanal.K : [2, 3, 4, 5];
  }

  const trabaja = diasTrabajo.includes(dia);
  const diasTexto = formatearDiasSemana(diasTrabajo);
  const horario = diasTexto ? `Días: ${diasTexto}` : null;

  if (trabaja) {
    return {
      estado: 'en_turno',
      mensaje: 'En turno semanal',
      grupo: grupo,
      turno_tipo: 'semanal',
      horario: horario,
      dias_restantes: null,
      proxima_jornada: null,
      dias_semana: diasTrabajo
    };
  }

  return {
    estado: 'en_descanso',
    mensaje: 'Día de descanso',
    grupo: grupo,
    turno_tipo: 'semanal',
    horario: horario,
    dias_restantes: null,
    proxima_jornada: null,
    dias_semana: diasTrabajo
  };
}

/**
 * Calcular estado para Pista 1 o Pista 2 (lógica unificada)
 * Rotación: A/B → C/D → AB/CD (donde AB/CD siempre son DÍA)
 */
function calcularEstadoPista(grupo, fecha, fechaSemilla, tipoPista) {
  // Calcular días desde fecha semilla
  const diasDesdeInicio = Math.floor((fecha - fechaSemilla) / MS_PER_DAY);
  const ciclo = ((diasDesdeInicio % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  // Determinar grupos base según la pista
  const gruposBase = tipoPista === 'pista1' 
    ? { g1: 'A', g2: 'B', g3: 'C', g4: 'D', ref1: 'AB', ref2: 'CD' }
    : { g1: 'E', g2: 'F', g3: 'G', g4: 'H', ref1: 'EF', ref2: 'GH' };
  
  let gruposTrabajando = [];
  let horario = '';
  let fase = '';
  let esFaseRefuerzo = false;
  
  // NUEVA LÓGICA DE ROTACIÓN:
  // Día 0-13: A/B (o E/F) - A día, B noche
  // Día 14-27: C/D (o G/H) - C día, D noche  
  // Día 28-41: AB (o EF) - SOLO DÍA (12 horas)
  // Día 42-55: CD (o GH) - SOLO DÍA (12 horas)
  
  if (ciclo >= 0 && ciclo < 14) {
    fase = `${gruposBase.g1}${gruposBase.g2}_normal`;
    gruposTrabajando = [gruposBase.g1, gruposBase.g2];
    horario = `${gruposBase.g1}: 8:00-20:00 | ${gruposBase.g2}: 20:00-8:00`;
  } else if (ciclo >= 14 && ciclo < 28) {
    fase = `${gruposBase.g3}${gruposBase.g4}_normal`;
    gruposTrabajando = [gruposBase.g3, gruposBase.g4];
    horario = `${gruposBase.g3}: 8:00-20:00 | ${gruposBase.g4}: 20:00-8:00`;
  } else if (ciclo >= 28 && ciclo < 42) {
    fase = `${gruposBase.ref1}_dia`;
    gruposTrabajando = [gruposBase.ref1];
    horario = `${gruposBase.ref1}: 8:00-20:00 (SOLO DÍA)`;
    esFaseRefuerzo = true;
  } else if (ciclo >= 42 && ciclo < 56) {
    fase = `${gruposBase.ref2}_dia`;
    gruposTrabajando = [gruposBase.ref2];
    horario = `${gruposBase.ref2}: 8:00-20:00 (SOLO DÍA)`;
    esFaseRefuerzo = true;
  }
  
  const estaTrabajando = gruposTrabajando.includes(grupo);
  
  if (estaTrabajando) {
    // Calcular días restantes del turno actual
    const diasRestantesFase = calcularDiasRestantesFase(ciclo);
    
    // Calcular próxima jornada (después del descanso)
    const proximaJornada = calcularProximaJornada(grupo, fecha, ciclo, fechaSemilla, gruposBase);
    
    return {
      estado: 'en_turno',
      mensaje: `En turno activo (${fase})`,
      grupo: grupo,
      turno_tipo: tipoPista,
      horario: horario,
      dias_restantes: diasRestantesFase,
      proxima_jornada: proximaJornada,
      fase_actual: fase,
      es_refuerzo: esFaseRefuerzo
    };
  } else {
    // En descanso - calcular próximo turno
    const proximaJornada = calcularProximaJornada(grupo, fecha, ciclo, fechaSemilla, gruposBase);
    const diasHastaProximo = calcularDiasHastaProximoTurno(fecha, proximaJornada.inicio);
    
    if (diasHastaProximo <= 7) {
      return {
        estado: 'proximo_turno',
        mensaje: `Próximo a turno en ${diasHastaProximo} día${diasHastaProximo !== 1 ? 's' : ''}`,
        grupo: grupo,
        turno_tipo: tipoPista,
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    } else {
      return {
        estado: 'en_descanso',
        mensaje: 'En descanso',
        grupo: grupo,
        turno_tipo: tipoPista,
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    }
  }
}

function formatearDiasSemana(dias) {
  const nombres = {
    1: 'Lun',
    2: 'Mar',
    3: 'Mié',
    4: 'Jue',
    5: 'Vie',
    6: 'Sáb',
    7: 'Dom'
  };

  const lista = Array.from(new Set(dias || []))
    .filter(dia => nombres[dia])
    .sort((a, b) => a - b)
    .map(dia => nombres[dia]);

  return lista.join(', ');
}

function obtenerInicioFaseGrupo(grupo, gruposBase) {
  if (grupo === gruposBase.g1 || grupo === gruposBase.g2) return 0;
  if (grupo === gruposBase.g3 || grupo === gruposBase.g4) return 14;
  if (grupo === gruposBase.ref1) return 28;
  if (grupo === gruposBase.ref2) return 42;
  return null;
}

function calcularDiasRestantesFase(ciclo) {
  const posicion = ((ciclo % DIAS_POR_FASE) + DIAS_POR_FASE) % DIAS_POR_FASE;
  return DIAS_POR_FASE - posicion;
}

function calcularProximaJornada(grupo, fecha, ciclo, fechaSemilla, gruposBase) {
  if (!fechaSemilla) return null;

  const inicioFase = obtenerInicioFaseGrupo(grupo, gruposBase);
  if (inicioFase === null) return null;

  const diasDesdeInicio = Math.floor((fecha - fechaSemilla) / MS_PER_DAY);
  const inicioCicloDias = diasDesdeInicio - ciclo;
  const inicioCiclo = new Date(fechaSemilla);
  inicioCiclo.setDate(inicioCiclo.getDate() + inicioCicloDias);

  const offset = ciclo < inicioFase ? inicioFase : inicioFase + CICLO_COMPLETO;
  const inicio = new Date(inicioCiclo);
  inicio.setDate(inicio.getDate() + offset);

  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + DIAS_POR_FASE - 1);

  return {
    inicio: formatearFecha(inicio),
    fin: formatearFecha(fin)
  };
}

/**
 * Calcular días hasta el próximo turno
 */
function calcularDiasHastaProximoTurno(fechaActual, fechaInicioStr) {
  const fechaInicio = parsearFecha(fechaInicioStr);
  const diff = fechaInicio - fechaActual;
  return Math.ceil(diff / MS_PER_DAY);
}

/**
 * Formatear fecha a DD/MM/YYYY
 */
function formatearFecha(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Parsear fecha de DD/MM/YYYY a Date
 */
function parsearFecha(fechaStr) {
  const [dia, mes, anio] = fechaStr.split('/').map(Number);
  return new Date(anio, mes - 1, dia);
}

module.exports = router;
