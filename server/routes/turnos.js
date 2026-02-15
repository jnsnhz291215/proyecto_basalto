const express = require('express');
const router = express.Router();
const { pool } = require('../../ejemploconexion.js');

// Constantes de la lógica de turnos (igual que en app.js frontend)
const INICIO_CD = new Date(2026, 1, 21); // 21 de febrero 2026 (Pista 1: C-D)
const INICIO_EFGH = new Date(2026, 1, 14); // 14 de febrero 2026 (Pista 2: G-H)
const CICLO_COMPLETO = 56; // Días del ciclo completo
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Obtener el estado del turno de un trabajador
 * GET /api/estado-turno/:rut
 */
router.get('/estado-turno/:rut', async (req, res) => {
  let connection;
  try {
    const { rut } = req.params;
    
    // Obtener datos del trabajador
    connection = await pool.getConnection();
    const [trabajadores] = await connection.execute(
      'SELECT RUT, nombres, apellidos, grupo FROM trabajadores WHERE RUT = ? AND activo = 1 LIMIT 1',
      [rut]
    );
    
    if (!trabajadores || trabajadores.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    
    const trabajador = trabajadores[0];
    const grupo = trabajador.grupo;
    
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
    const estadoTurno = calcularEstadoTurno(grupo, hoy);
    
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
function calcularEstadoTurno(grupo, fecha) {
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
    return calcularEstadoPista1(grupo, fechaCopy);
  } else if (pista2Grupos.includes(grupo)) {
    return calcularEstadoPista2(grupo, fechaCopy);
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
      horario: 'Lunes a Viernes',
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
 * Calcular estado para Pista 1 (A, B, C, D, AB, CD)
 */
function calcularEstadoPista1(grupo, fecha) {
  const diasCD = Math.floor((fecha - INICIO_CD) / MS_PER_DAY);
  const cicloCD = ((diasCD % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let gruposTrabajando = [];
  let horario = '';
  let fase = '';
  
  if (cicloCD >= 0 && cicloCD < 14) {
    fase = 'CD_normal';
    gruposTrabajando = ['C', 'D', 'CD'];
    horario = 'C: 8:00-20:00 | D: 20:00-8:00';
  } else if (cicloCD >= 14 && cicloCD < 28) {
    fase = 'AB_normal';
    gruposTrabajando = ['A', 'B', 'AB'];
    horario = 'A: 8:00-20:00 | B: 20:00-8:00';
  } else if (cicloCD >= 28 && cicloCD < 42) {
    fase = 'CD_invertido';
    gruposTrabajando = ['C', 'D', 'CD'];
    horario = 'D: 8:00-20:00 | C: 20:00-8:00';
  } else if (cicloCD >= 42 && cicloCD < 56) {
    fase = 'AB_invertido';
    gruposTrabajando = ['A', 'B', 'AB'];
    horario = 'B: 8:00-20:00 | A: 20:00-8:00';
  }
  
  const estaTrabajando = gruposTrabajando.includes(grupo);
  
  if (estaTrabajando) {
    // Calcular días restantes del turno actual
    const diasRestantesTurno = calcularDiasRestantesFase(cicloCD);
    
    // Calcular próxima jornada (después del descanso)
    const proximaJornada = calcularProximaJornadaPista1(grupo, fecha, cicloCD);
    
    return {
      estado: 'en_turno',
      mensaje: `En turno activo (${fase})`,
      grupo: grupo,
      turno_tipo: 'pista1',
      horario: horario,
      dias_restantes: diasRestantesTurno,
      proxima_jornada: proximaJornada,
      fase_actual: fase
    };
  } else {
    // En descanso - calcular próximo turno
    const proximaJornada = calcularProximaJornadaPista1(grupo, fecha, cicloCD);
    const diasHastaProximo = calcularDiasHastaProximoTurno(fecha, proximaJornada.inicio);
    
    if (diasHastaProximo <= 7) {
      return {
        estado: 'proximo_turno',
        mensaje: `Próximo a turno en ${diasHastaProximo} día${diasHastaProximo !== 1 ? 's' : ''}`,
        grupo: grupo,
        turno_tipo: 'pista1',
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    } else {
      return {
        estado: 'en_descanso',
        mensaje: 'En descanso',
        grupo: grupo,
        turno_tipo: 'pista1',
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    }
  }
}

/**
 * Calcular estado para Pista 2 (E, F, G, H, EF, GH)
 */
function calcularEstadoPista2(grupo, fecha) {
  const diasEFGH = Math.floor((fecha - INICIO_EFGH) / MS_PER_DAY);
  const cicloEFGH = ((diasEFGH % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let gruposTrabajando = [];
  let horario = '';
  let fase = '';
  
  if (cicloEFGH >= 0 && cicloEFGH < 14) {
    fase = 'GH_normal';
    gruposTrabajando = ['G', 'H', 'GH'];
    horario = 'G: 8:00-20:00 | H: 20:00-8:00';
  } else if (cicloEFGH >= 14 && cicloEFGH < 28) {
    fase = 'EF_normal';
    gruposTrabajando = ['E', 'F', 'EF'];
    horario = 'E: 8:00-20:00 | F: 20:00-8:00';
  } else if (cicloEFGH >= 28 && cicloEFGH < 42) {
    fase = 'GH_invertido';
    gruposTrabajando = ['G', 'H', 'GH'];
    horario = 'H: 8:00-20:00 | G: 20:00-8:00';
  } else if (cicloEFGH >= 42 && cicloEFGH < 56) {
    fase = 'EF_invertido';
    gruposTrabajando = ['E', 'F', 'EF'];
    horario = 'F: 8:00-20:00 | E: 20:00-8:00';
  }
  
  const estaTrabajando = gruposTrabajando.includes(grupo);
  
  if (estaTrabajando) {
    const diasRestantesTurno = calcularDiasRestantesFase(cicloEFGH);
    const proximaJornada = calcularProximaJornadaPista2(grupo, fecha, cicloEFGH);
    
    return {
      estado: 'en_turno',
      mensaje: `En turno activo (${fase})`,
      grupo: grupo,
      turno_tipo: 'pista2',
      horario: horario,
      dias_restantes: diasRestantesTurno,
      proxima_jornada: proximaJornada,
      fase_actual: fase
    };
  } else {
    const proximaJornada = calcularProximaJornadaPista2(grupo, fecha, cicloEFGH);
    const diasHastaProximo = calcularDiasHastaProximoTurno(fecha, proximaJornada.inicio);
    
    if (diasHastaProximo <= 7) {
      return {
        estado: 'proximo_turno',
        mensaje: `Próximo a turno en ${diasHastaProximo} día${diasHastaProximo !== 1 ? 's' : ''}`,
        grupo: grupo,
        turno_tipo: 'pista2',
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    } else {
      return {
        estado: 'en_descanso',
        mensaje: 'En descanso',
        grupo: grupo,
        turno_tipo: 'pista2',
        dias_restantes: diasHastaProximo,
        proxima_jornada: proximaJornada
      };
    }
  }
}

/**
 * Calcular días restantes de la fase actual (14 días)
 */
function calcularDiasRestantesFase(posicionCiclo) {
  const posicionEnFase = posicionCiclo % 14;
  return 14 - posicionEnFase;
}

/**
 * Calcular próxima jornada para Pista 1
 */
function calcularProximaJornadaPista1(grupo, fechaActual, cicloActual) {
  // Determinar a qué par pertenece el grupo
  const esAB = ['A', 'B', 'AB'].includes(grupo);
  const esCD = ['C', 'D', 'CD'].includes(grupo);
  
  let diasHastaProximoTurno = 0;
  
  if (cicloActual >= 0 && cicloActual < 14) {
    // Estamos en CD_normal (días 0-13)
    if (esCD) {
      // CD está trabajando ahora, próximo turno es CD_invertido (día 28)
      diasHastaProximoTurno = 28 - cicloActual;
    } else {
      // AB está en descanso, próximo turno es AB_normal (día 14)
      diasHastaProximoTurno = 14 - cicloActual;
    }
  } else if (cicloActual >= 14 && cicloActual < 28) {
    // Estamos en AB_normal (días 14-27)
    if (esAB) {
      // AB está trabajando ahora, próximo turno es AB_invertido (día 42)
      diasHastaProximoTurno = 42 - cicloActual;
    } else {
      // CD está en descanso, próximo turno es CD_invertido (día 28)
      diasHastaProximoTurno = 28 - cicloActual;
    }
  } else if (cicloActual >= 28 && cicloActual < 42) {
    // Estamos en CD_invertido (días 28-41)
    if (esCD) {
      // CD está trabajando ahora, próximo turno es CD_normal (día 0 del siguiente ciclo)
      diasHastaProximoTurno = 56 - cicloActual;
    } else {
      // AB está en descanso, próximo turno es AB_invertido (día 42)
      diasHastaProximoTurno = 42 - cicloActual;
    }
  } else if (cicloActual >= 42 && cicloActual < 56) {
    // Estamos en AB_invertido (días 42-55)
    if (esAB) {
      // AB está trabajando ahora, próximo turno es AB_normal (día 14 del siguiente ciclo)
      diasHastaProximoTurno = (56 - cicloActual) + 14;
    } else {
      // CD está en descanso, próximo turno es CD_normal (día 0 del siguiente ciclo)
      diasHastaProximoTurno = 56 - cicloActual;
    }
  }
  
  const inicioProximo = new Date(fechaActual);
  inicioProximo.setDate(inicioProximo.getDate() + diasHastaProximoTurno);
  
  const finProximo = new Date(inicioProximo);
  finProximo.setDate(finProximo.getDate() + 13); // 14 días de turno
  
  return {
    inicio: formatearFecha(inicioProximo),
    fin: formatearFecha(finProximo)
  };
}

/**
 * Calcular próxima jornada para Pista 2
 */
function calcularProximaJornadaPista2(grupo, fechaActual, cicloActual) {
  const esEF = ['E', 'F', 'EF'].includes(grupo);
  const esGH = ['G', 'H', 'GH'].includes(grupo);
  
  let diasHastaProximoTurno = 0;
  
  if (cicloActual >= 0 && cicloActual < 14) {
    // Estamos en GH_normal (días 0-13)
    if (esGH) {
      // GH está trabajando ahora, próximo turno es GH_invertido (día 28)
      diasHastaProximoTurno = 28 - cicloActual;
    } else {
      // EF está en descanso, próximo turno es EF_normal (día 14)
      diasHastaProximoTurno = 14 - cicloActual;
    }
  } else if (cicloActual >= 14 && cicloActual < 28) {
    // Estamos en EF_normal (días 14-27)
    if (esEF) {
      // EF está trabajando ahora, próximo turno es EF_invertido (día 42)
      diasHastaProximoTurno = 42 - cicloActual;
    } else {
      // GH está en descanso, próximo turno es GH_invertido (día 28)
      diasHastaProximoTurno = 28 - cicloActual;
    }
  } else if (cicloActual >= 28 && cicloActual < 42) {
    // Estamos en GH_invertido (días 28-41)
    if (esGH) {
      // GH está trabajando ahora, próximo turno es GH_normal (día 0 del siguiente ciclo)
      diasHastaProximoTurno = 56 - cicloActual;
    } else {
      // EF está en descanso, próximo turno es EF_invertido (día 42)
      diasHastaProximoTurno = 42 - cicloActual;
    }
  } else if (cicloActual >= 42 && cicloActual < 56) {
    // Estamos en EF_invertido (días 42-55)
    if (esEF) {
      // EF está trabajando ahora, próximo turno es EF_normal (día 14 del siguiente ciclo)
      diasHastaProximoTurno = (56 - cicloActual) + 14;
    } else {
      // GH está en descanso, próximo turno es GH_normal (día 0 del siguiente ciclo)
      diasHastaProximoTurno = 56 - cicloActual;
    }
  }
  
  const inicioProximo = new Date(fechaActual);
  inicioProximo.setDate(inicioProximo.getDate() + diasHastaProximoTurno);
  
  const finProximo = new Date(inicioProximo);
  finProximo.setDate(finProximo.getDate() + 13);
  
  return {
    inicio: formatearFecha(inicioProximo),
    fin: formatearFecha(finProximo)
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
