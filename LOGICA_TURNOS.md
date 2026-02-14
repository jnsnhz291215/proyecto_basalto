# Lógica de Turnos - Sistema Basalto

## 🎯 Resumen Ejecutivo

Sistema de **turnos rotativos con ciclo de 56 días** que organiza a los trabajadores en:
- **PISTA 1** (Semilla: 21-02-2026): Grupos A, B, C, D + combinados AB, CD
- **PISTA 2** (Semilla: 14-02-2026): Grupos E, F, G, H + combinados EF, GH

Ambas pistas siguen la misma lógica matemática de rotación, pero PISTA 2 tiene un desfase de 7 días.

---

## 📐 Fórmula Matemática (Implementada en Backend)

### Algoritmo de Cálculo de Turno

Para cualquier fecha y grupo, se ejecutan los siguientes pasos:

```
1. dias_diferencia = (FechaConsulta - FechaSemilla) en días
2. dia_ciclo = dias_diferencia % 56  → Normaliza a rango 0-55
3. fase = dia_ciclo ÷ 14 (división entera) → Fase 0, 1, 2 o 3
4. Consulta tabla de reglas según (fase, grupo) → Obtiene turno
```

**Ejemplo Práctico (PISTA 1 - Grupo C)**
- Fecha Semilla PISTA 1: 21-02-2026
- Fecha Consulta: 07-03-2026
- dias_diferencia = 14 días
- dia_ciclo = 14 % 56 = 14
- fase = 14 ÷ 14 = 1
- Regla Fase 1, Grupo C → **DESCANSO**

---

## 📋 Grupos de Trabajo

### Grupos Individuales
- **A, B, C, D**: Grupos de trabajadores individuales (Pista 1)
- **E, F, G, H**: Grupos de trabajadores individuales (Pista 2)
- **J, K**: Grupos especiales semanales

### Grupos Combinados (siempre turno día)
- **AB**: Trabaja cuando A-B están activos (siempre 08:00-20:00)
- **CD**: Trabaja cuando C-D están activos (siempre 08:00-20:00)
- **EF**: Trabaja cuando E-F están activos (siempre 08:00-20:00)
- **GH**: Trabaja cuando G-H están activos (siempre 08:00-20:00)

### Horarios de Turno

- **Turno Día/Mañana**: 08:00 - 20:00 (12 horas)
- **Turno Noche/Tarde**: 20:00 - 08:00 (12 horas)

## Reglas Generales

1. **Ciclo de trabajo**: 56 días = 4 fases de 14 días cada una
2. **Rotación de grupos**: Cada 14 días cambia el grupo que trabaja
3. **Turnos invertidos**: En fases pares (2, 3) se invierten los turnos día/noche
4. **Grupos dobles**: Siempre trabajan turno día, nunca descansan cuando su grupo trabaja

---

## 🔄 Reglas de Turno Detalladas

### PISTA 1 (Semilla: 21-02-2026) - Grupos A, B, C, D

#### FASE 0 (Días 0-13 del ciclo)
- **Grupo A**: Descanso
- **Grupo B**: Descanso
- **Grupo C**: Turno Día (08:00-20:00)
- **Grupo D**: Turno Noche (20:00-08:00)
- **Grupo AB**: Descanso
- **Grupo CD**: Turno Día (refuerzo, 08:00-20:00)

#### FASE 1 (Días 14-27)
- **Grupo A**: Turno Día (08:00-20:00)
- **Grupo B**: Turno Noche (20:00-08:00)
- **Grupo C**: Descanso
- **Grupo D**: Descanso
- **Grupo AB**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo CD**: Descanso

#### FASE 2 (Días 28-41) - TURNOS INVERTIDOS
- **Grupo A**: Descanso
- **Grupo B**: Descanso
- **Grupo C**: Turno Noche (20:00-08:00)
- **Grupo D**: Turno Día (08:00-20:00)
- **Grupo AB**: Descanso
- **Grupo CD**: Turno Día (refuerzo, 08:00-20:00)

#### FASE 3 (Días 42-55) - TURNOS INVERTIDOS
- **Grupo A**: Turno Noche (20:00-08:00)
- **Grupo B**: Turno Día (08:00-20:00)
- **Grupo C**: Descanso
- **Grupo D**: Descanso
- **Grupo AB**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo CD**: Descanso

### PISTA 2 (Semilla: 14-02-2026) - Grupos E, F, G, H

**Mapeo:** E←C, F←D, G←A, H←B

#### FASE 0 (Días 0-13 del ciclo)
- **Grupo E**: Descanso
- **Grupo F**: Descanso
- **Grupo G**: Turno Día (08:00-20:00)
- **Grupo H**: Turno Noche (20:00-08:00)
- **Grupo EF**: Descanso
- **Grupo GH**: Turno Día (refuerzo, 08:00-20:00)

#### FASE 1 (Días 14-27)
- **Grupo E**: Turno Día (08:00-20:00)
- **Grupo F**: Turno Noche (20:00-08:00)
- **Grupo G**: Descanso
- **Grupo H**: Descanso
- **Grupo EF**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo GH**: Descanso

#### FASE 2 (Días 28-41) - TURNOS INVERTIDOS
- **Grupo E**: Descanso
- **Grupo F**: Descanso
- **Grupo G**: Turno Noche (20:00-08:00)
- **Grupo H**: Turno Día (08:00-20:00)
- **Grupo EF**: Descanso
- **Grupo GH**: Turno Día (refuerzo, 08:00-20:00)

#### FASE 3 (Días 42-55) - TURNOS INVERTIDOS
- **Grupo E**: Turno Noche (20:00-08:00)
- **Grupo F**: Turno Día (08:00-20:00)
- **Grupo G**: Descanso
- **Grupo H**: Descanso
- **Grupo EF**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo GH**: Descanso

---

## 🔗 API Backend

### Endpoint: GET /api/calcular-turno

Calcula el turno de un grupo en una fecha específica usando la lógica matemática del ciclo de 56 días.

**Parámetros Query:**
- `fecha` (obligatorio): Fecha en formato YYYY-MM-DD
- `grupo` (obligatorio): Letra del grupo (A-H, AB, CD, EF, GH)

**Respuesta (JSON):**
```json
{
  "success": true,
  "fecha": "2026-02-07",
  "grupo": "C",
  "turno": "Día",
  "es_refuerzo": false
}
```

**Valores posibles de `turno`:**
- `"Día"`: Turno de 08:00-20:00
- `"Noche"`: Turno de 20:00-08:00
- `"Descanso"`: Día libre para ese grupo

**Campo `es_refuerzo`:**
- `true`: Grupo doble (AB, CD, EF, GH) trabajando como refuerzo
- `false`: Grupo individual o cualquier otra situación

**Ejemplo de Uso:**
```bash
curl "http://localhost:3000/api/calcular-turno?fecha=2026-02-14&grupo=C"
```

**Respuesta esperada (14-02-2026 es Semilla PISTA 1, este es Día 0 de FASE 0):**
```json
{
  "success": true,
  "fecha": "2026-02-14",
  "grupo": "C",
  "turno": "Día",
  "es_refuerzo": false
}
```

---

## 📅 Ejemplos de Cálculo Manual

### Ejemplo 1: Grupo C en 21-02-2026 (PISTA 1)
- **Fecha Semilla PISTA 1**: 21-02-2026
- **Fecha Consulta**: 21-02-2026
- **Cálculo**: 
  - dias_diferencia = 0
  - dia_ciclo = 0 % 56 = 0
  - fase = 0 ÷ 14 = 0
  - **Regla Fase 0, Grupo C = "Día"** ✅

### Ejemplo 2: Grupo C en 07-03-2026 (PISTA 1)
- **Fecha Semilla PISTA 1**: 21-02-2026
- **Fecha Consulta**: 07-03-2026
- **Cálculo**:
  - dias_diferencia = 14 días
  - dia_ciclo = 14 % 56 = 14
  - fase = 14 ÷ 14 = 1
  - **Regla Fase 1, Grupo C = "Descanso"** ✅

### Ejemplo 3: Grupo G en 14-02-2026 (PISTA 2)
- **Fecha Semilla PISTA 2**: 14-02-2026
- **Fecha Consulta**: 14-02-2026
- **Cálculo**:
  - dias_diferencia = 0
  - dia_ciclo = 0 % 56 = 0
  - fase = 0 ÷ 14 = 0
  - **Regla Fase 0, Grupo G = "Día"** ✅
  - (Nota: G se mapea de A según PISTA 2)

### Ejemplo 4: Grupo E en 14-02-2026 (PISTA 2)
- **Fecha Semilla PISTA 2**: 14-02-2026
- **Fecha Consulta**: 14-02-2026
- **Cálculo**:
  - dias_diferencia = 0
  - dia_ciclo = 0 % 56 = 0
  - fase = 0 ÷ 14 = 0
  - **Regla Fase 0, Grupo E = "Descanso"** ✅
  - (Nota: E se mapea de C según PISTA 2)

### Ejemplo 5: Grupo CD en 21-02-2026 (Refuerzo)
- **Tipo de Grupo**: Doble (refuerzo)
- **Cálculo**: Igual al grupo C
- **Resultado**: "Día" con `es_refuerzo: true` 

---

## 📝 Notas Importantes

1. **Normalizador de Ciclos**: El módulo (%) 56 garantiza que las fechas negativas (pasadas) se conviertan a positivas
   - Ejemplo: -7 % 56 = 49 en JavaScript (se ajusta automáticamente)

2. **Grupos Dobles**: AB, CD, EF, GH:
   - Solo trabajan cuando su grupo correspondiente (A, C, E, G o B, D, F, H) está en turno
   - Siempre trabajan turno Día (08:00-20:00)
   - Nunca descansan en la misma fase que su grupo

3. **Grupos Semanales**: J y K:
   - No utilizan el sistema de ciclos de 56 días
   - Tienen lógica separada no incluida en este endpoint

4. **Excepciones de Turno**:
   - Los empleados pueden tener excepciones de turno registradas en `excepciones_turno`
   - Estas excepciones deben validarse antes de aplicar la lógica de ciclos
   - El endpoint `/api/excepciones/:rut` permite obtener el historial de un trabajador

---

## Calendario Visual (Febrero - Abril 2026)

```
┌─────────────┬──────────────┬──────────────┐
│    FECHA    │   PISTA 1    │   PISTA 2    │
│             │   (A-B-C-D)  │   (E-F-G-H)  │
├─────────────┼──────────────┼──────────────┤
│ 07/02-13/02 │ A(D),B(N),AB │ Descanso     │
│ 14/02-20/02 │ A(D),B(N),AB │ G(D),H(N),GH │
│ 21/02-27/02 │ C(D),D(N),CD │ G(D),H(N),GH │
│ 28/02-06/03 │ C(D),D(N),CD │ E(D),F(N),EF │
│ 07/03-13/03 │ A(D),B(N),AB │ E(D),F(N),EF │
│ 14/03-20/03 │ A(D),B(N),AB │ Descanso     │
│ 21/03-27/03 │ C(N),D(D),CD │ G(N),H(D),GH │
│ 28/03-03/04 │ C(N),D(D),CD │ E(N),F(D),EF │
│ 04/04-10/04 │ A(N),B(D),AB │ E(N),F(D),EF │
│ 11/04-17/04 │ A(N),B(D),AB │ Descanso     │
│ 18/04-24/04 │ C(N),D(D),CD │ G(D),H(N),GH │
└─────────────┴──────────────┴──────────────┘

Leyenda:
- (D) = Turno Día (08:00-20:00)
- (N) = Turno Noche (20:00-08:00)
- AB, CD, EF, GH siempre trabajan turno (D) cuando su grupo está activo
- Pista 2 tiene 7 días de desfase respecto a Pista 1
```

---

## Fórmula de Cálculo Programática

### Para grupos A-B-C-D (Pista 1)

```javascript
// Fecha de referencia: 21/02/2026 = Día 0 para C-D
const INICIO_CD = new Date(2026, 1, 21); // mes 1 = febrero (0-indexed)
const MS_PER_DAY = 86400000;
const CICLO_14_DIAS = 14;
const CICLO_COMPLETO = 56; // 4 bloques de 14 días

function obtenerTurnoPista1(fecha) {
  const dias = Math.floor((fecha - INICIO_CD) / MS_PER_DAY);
  const posicionCiclo = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let grupo = null;
  let turno = null;
  
  if (posicionCiclo >= 0 && posicionCiclo < 14) {
    // C-D trabajando, turno normal
    grupo = { manana: 'C', tarde: 'D', doble: 'CD' };
  } else if (posicionCiclo >= 14 && posicionCiclo < 28) {
    // A-B trabajando, turno normal
    grupo = { manana: 'A', tarde: 'B', doble: 'AB' };
  } else if (posicionCiclo >= 28 && posicionCiclo < 42) {
    // C-D trabajando, turno INVERTIDO
    grupo = { manana: 'D', tarde: 'C', doble: 'CD' };
  } else if (posicionCiclo >= 42 && posicionCiclo < 56) {
    // A-B trabajando, turno INVERTIDO
    grupo = { manana: 'B', tarde: 'A', doble: 'AB' };
  }
  
  return grupo;
}
```

### Para grupos E-F (Pista 2)

```javascript
// Fecha de referencia: 14/02/2026 = Día 0 para E-F (7 días antes que C-D)
const INICIO_EF = new Date(2026, 1, 14);

function obtenerTurnoPista2(fecha) {
  const dias = Math.floor((fecha - INICIO_EF) / MS_PER_DAY);
  const posicionCiclo = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let grupo = null;
  
  if (posicionCiclo >= 0 && posicionCiclo < 14) {
    // E-F trabajando, turno normal
    grupo = { manana: 'E', tarde: 'F', doble: 'EF' };
  } else if (posicionCiclo >= 14 && posicionCiclo < 28) {
    // Descanso
    grupo = null;
  } else if (posicionCiclo >= 28 && posicionCiclo < 42) {
    // E-F trabajando, turno INVERTIDO
    grupo = { manana: 'F', tarde: 'E', doble: 'EF' };
  } else if (posicionCiclo >= 42 && posicionCiclo < 56) {
    // Descanso
    grupo = null;
  }
  
  return grupo;
}
```

### Para grupos G-H (Pista 3)

```javascript
// G-H usan la misma lógica que E-F con la misma fecha de inicio
const INICIO_GH = new Date(2026, 1, 14);

function obtenerTurnoPista3(fecha) {
  const dias = Math.floor((fecha - INICIO_GH) / MS_PER_DAY);
  const posicionCiclo = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let grupo = null;
  
  if (posicionCiclo >= 0 && posicionCiclo < 14) {
    grupo = { manana: 'G', tarde: 'H', doble: 'GH' };
  } else if (posicionCiclo >= 14 && posicionCiclo < 28) {
    grupo = null; // Descanso
  } else if (posicionCiclo >= 28 && posicionCiclo < 42) {
    grupo = { manana: 'H', tarde: 'G', doble: 'GH' };
  } else if (posicionCiclo >= 42 && posicionCiclo < 56) {
    grupo = null; // Descanso
  }
  
  return grupo;
}
```

---

## Notas Importantes

1. **Los grupos dobles (AB, CD, EF, GH) SIEMPRE trabajan turno día** independiente de si su grupo hermano está en día o noche.

2. **El ciclo completo es de 56 días** (4 bloques de 14 días) después del cual los turnos vuelven a la configuración original.

3. **Desfase de 7 días**: E-F y G-H empiezan 7 días después que sus respectivos grupos de referencia, creando solapamiento en los períodos de trabajo.

4. **Inversión de turnos**: Cada 28 días, los grupos intercambian sus horarios (día ↔ noche) para distribuir equitativamente los turnos.

---

**Última actualización**: 14/02/2026
