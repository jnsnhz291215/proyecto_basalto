const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

// Constantes de la lógica de turnos
const CICLO_COMPLETO = 56; // Días del ciclo completo (14 días × 4 fases)
const DIAS_POR_FASE = 14; // Días trabajados / descansados por fase
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DESFASE_PISTA2 = 7; // Pista 2 (EFGH) tiene +7 días de desfase respecto a Pista 1

// Cache para la fecha semilla
let fechaSemillaCache = null;
let ultimaActualizacionCache = 0;
const CACHE_DURACION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtener fecha semilla desde la base de datos (con caché)
 */
async function obtenerFechaSemilla() {
  const ahora = Date.now();
  
  // Usar caché si está vigente
  if (fechaSemillaCache && (ahora - ultimaActualizacionCache < CACHE_DURACION)) {
    return fechaSemillaCache;
  }
  
  // Obtener desde BD
  const [rows] = await pool.execute(
    'SELECT fecha_semilla FROM configuracion_ciclos WHERE activo = 1 LIMIT 1'
  );
  
  if (!rows || rows.length === 0) {
    // Fallback a fecha por defecto si no hay configuración
    console.warn('[TURNOS] No se encontró configuración en BD, usando fecha por defecto');
    fechaSemillaCache = new Date(2026, 1, 7); // 07/02/2026
  } else {
    fechaSemillaCache = new Date(rows[0].fecha_semilla);
  }
  
  fechaSemillaCache.setHours(0, 0, 0, 0);
  ultimaActualizacionCache = ahora;
  
  return fechaSemillaCache;
}

/**
 * Obtener el estado del turno de un trabajador
 * GET /api/estado-turno/:rut
 */
router.get('/estado-turno/:rut', async (req, res) => {
  let connection;
  try {
    const { rut } = req.params;
    
    // Obtener fecha semilla
    const fechaSemilla = await obtenerFechaSemilla();
    
    // Obtener datos del trabajador
    connection = await pool.getConnection();
    const [trabajadores] = await connection.execute(
      'SELECT RUT, nombres, apellidos, id_grupo FROM trabajadores WHERE RUT = ? AND activo = 1 LIMIT 1',
      [rut]
    );
    
    if (!trabajadores || trabajadores.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    
    const trabajador = trabajadores[0];
    const grupo = trabajador.id_grupo;
    
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
    const estadoTurno = calcularEstadoTurno(grupo, hoy, fechaSemilla);
    
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
function calcularEstadoTurno(grupo, fecha, fechaSemilla) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  // Grupos semanales J y K
  if (grupo === 'J' || grupo === 'K') {
    return calcularEstadoSemanal(grupo, fechaCopy);
  }
  
  // Determinar si es Pista 1 (A, B, C, D, AB, CD) o Pista 2 (E, F, G, H, EF, GH)
  const pista1Grupos = ['A', 'B', 'C', 'D', 'AB', 'CD'];
  const pista2Grupos = ['E', 'F', 'G', 'H', 'EF', 'GH'];
  
  if (pista1Grupos.includes(grupo)) {
    return calcularEstadoPista(grupo, fechaCopy, fechaSemilla, 'pista1');
  } else if (pista2Grupos.includes(grupo)) {
    // Pista 2 tiene +7 días de desfase
    const fechaSemillaPista2 = new Date(fechaSemilla);
    fechaSemillaPista2.setDate(fechaSemillaPista2.getDate() + DESFASE_PISTA2);
    return calcularEstadoPista(grupo, fechaCopy, fechaSemillaPista2, 'pista2');
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
function calcularEstadoSemanal(grupo, fecha) {
  const dia = fecha.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sab
  let trabaja = false;
  
  if (grupo === 'J') {
    trabaja = [1, 2, 3, 4].includes(dia); // Lun-Jue
  } else if (grupo === 'K') {
    trabaja = [2, 3, 4, 5].includes(dia); // Mar-Vie
  }
  
  if (trabaja) {
    return {
      estado: 'en_turno',
      mensaje: 'En turno semanal',
      grupo: grupo,
      turno_tipo: 'semanal',
      horario: grupo === 'J' ? 'Lunes a Jueves' : 'Martes a Viernes',
      dias_restantes: null,
      proxima_jornada: null
    };
  } else {
    return {
      estado: 'en_descanso',
      mensaje: 'Día de descanso',
      grupo: grupo,
      turno_tipo: 'semanal',
      dias_restantes: null,
      proxima_jornada: null
    };
  }
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
