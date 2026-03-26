# Lógica de Turnos - Sistema Basalto

## 🎯 Resumen Ejecutivo

Sistema de **turnos rotativos con ciclo de 56 días** que organiza a los trabajadores en:
- **PISTA 1 (Principal)** (Semilla: 10-01-2026): Grupos A, B, C, D + combinados AB, CD
- **PISTA 2 (Sombra)** (Semilla: 17-01-2026): Grupos E, F, G, H + combinados EF, GH

**Nota crítica:** Ambas pistas siguen **EXACTAMENTE** la misma lógica y ciclo de 56 días. PISTA 2 es una copia completa con un desfase de 7 días. No hay descansos alternados: cuando A-B-C-D trabajan, E-F-G-H también trabajan (solo 7 días después).

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

**Ejemplo Práctico (PISTA 1 - Grupo A)**
- Fecha Semilla PISTA 1: 10-01-2026
- Fecha Consulta: 10-01-2026
- dias_diferencia = 0 días
- dia_ciclo = 0 % 56 = 0
- fase = 0 ÷ 14 = 0
- Regla Fase 0, Grupo A → **DÍA (08:00-20:00)**

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

### PISTA 1 (Semilla: 10-01-2026) - Grupos A, B, C, D

#### FASE 0 (Días 0-13 del ciclo | 10-01-2026 a 23-01-2026)
- **Grupo A**: Turno Día (08:00-20:00)
- **Grupo B**: Turno Noche (20:00-08:00)
- **Grupo C**: Descanso
- **Grupo D**: Descanso
- **Grupo AB**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo CD**: Descanso

#### FASE 1 (Días 14-27 | 24-01-2026 a 06-02-2026)
- **Grupo A**: Descanso
- **Grupo B**: Descanso
- **Grupo C**: Turno Día (08:00-20:00)
- **Grupo D**: Turno Noche (20:00-08:00)
- **Grupo AB**: Descanso
- **Grupo CD**: Turno Día (refuerzo, 08:00-20:00)

#### FASE 2 (Días 28-41 | 07-02-2026 a 20-02-2026) - TURNOS INVERTIDOS
- **Grupo A**: Turno Noche (20:00-08:00)
- **Grupo B**: Turno Día (08:00-20:00)
- **Grupo C**: Descanso
- **Grupo D**: Descanso
- **Grupo AB**: Turno Día (refuerzo, 08:00-20:00)
- **Grupo CD**: Descanso

#### FASE 3 (Días 42-55 | 21-02-2026 a 06-03-2026) - TURNOS INVERTIDOS
- **Grupo A**: Descanso
- **Grupo B**: Descanso
- **Grupo C**: Turno Noche (20:00-08:00)
- **Grupo D**: Turno Día (08:00-20:00)
- **Grupo AB**: Descanso
- **Grupo CD**: Turno Día (refuerzo, 08:00-20:00)

### PISTA 2 (Semilla: 17-01-2026) - Grupos E, F, G, H (Copia Sombra de PISTA 1)

**Mapeo directo:** E→A, F→B, G→C, H→D

**Ciclo idéntico al de PISTA 1, desplazado +7 días:**

#### FASE 0 (Días 0-13 del ciclo | 17-01-2026 a 30-01-2026)
- **Grupo E**: Turno Día (08:00-20:00) ➜ [igual a A]
- **Grupo F**: Turno Noche (20:00-08:00) ➜ [igual a B]
- **Grupo G**: Descanso ➜ [igual a C]
- **Grupo H**: Descanso ➜ [igual a D]
- **Grupo EF**: Turno Día (refuerzo, 08:00-20:00) ➜ [igual a AB]
- **Grupo GH**: Descanso ➜ [igual a CD]

#### FASE 1 (Días 14-27 | 31-01-2026 a 13-02-2026)
- **Grupo E**: Descanso ➜ [igual a A]
- **Grupo F**: Descanso ➜ [igual a B]
- **Grupo G**: Turno Día (08:00-20:00) ➜ [igual a C]
- **Grupo H**: Turno Noche (20:00-08:00) ➜ [igual a D]
- **Grupo EF**: Descanso ➜ [igual a AB]
- **Grupo GH**: Turno Día (refuerzo, 08:00-20:00) ➜ [igual a CD]

#### FASE 2 (Días 28-41 | 14-02-2026 a 27-02-2026) - TURNOS INVERTIDOS
- **Grupo E**: Turno Noche (20:00-08:00) ➜ [igual a A invertido]
- **Grupo F**: Turno Día (08:00-20:00) ➜ [igual a B invertido]
- **Grupo G**: Descanso ➜ [igual a C invertido]
- **Grupo H**: Descanso ➜ [igual a D invertido]
- **Grupo EF**: Turno Día (refuerzo, 08:00-20:00) ➜ [igual a AB]
- **Grupo GH**: Descanso ➜ [igual a CD]

#### FASE 3 (Días 42-55 | 28-02-2026 a 14-03-2026) - TURNOS INVERTIDOS
- **Grupo E**: Descanso ➜ [igual a A invertido]
- **Grupo F**: Descanso ➜ [igual a B invertido]
- **Grupo G**: Turno Noche (20:00-08:00) ➜ [igual a C invertido]
- **Grupo H**: Turno Día (08:00-20:00) ➜ [igual a D invertido]
- **Grupo EF**: Descanso ➜ [igual a AB]
- **Grupo GH**: Turno Día (refuerzo, 08:00-20:00) ➜ [igual a CD]

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
curl "http://localhost:3000/api/calcular-turno?fecha=2026-01-10&grupo=A"
```

**Respuesta esperada (10-01-2026 es Semilla PISTA 1, este es Día 0 de FASE 0):**
```json
{
  "success": true,
  "fecha": "2026-01-10",
  "grupo": "A",
  "turno": "Día",
  "es_refuerzo": false
}
```

---

## 📅 Ejemplos de Cálculo Manual

### Ejemplo 1: Grupo A en 10-01-2026 (PISTA 1)
- **Fecha Semilla PISTA 1**: 10-01-2026
- **Fecha Consulta**: 10-01-2026
- **Cálculo**: 
  - dias_diferencia = 0
  - dia_ciclo = 0 % 56 = 0
  - fase = 0 ÷ 14 = 0
  - **Regla Fase 0, Grupo A = "Día"** ✅

### Ejemplo 2: Grupo C en 24-01-2026 (PISTA 1)
- **Fecha Semilla PISTA 1**: 10-01-2026
- **Fecha Consulta**: 24-01-2026
- **Cálculo**:
  - dias_diferencia = 14 días
  - dia_ciclo = 14 % 56 = 14
  - fase = 14 ÷ 14 = 1
  - **Regla Fase 1, Grupo C = "Día"** ✅

### Ejemplo 3: Grupo E en 17-01-2026 (PISTA 2)
- **Fecha Semilla PISTA 2**: 17-01-2026
- **Fecha Consulta**: 17-01-2026
- **Cálculo**:
  - dias_diferencia = 0
  - dia_ciclo = 0 % 56 = 0
  - fase = 0 ÷ 14 = 0
  - **Regla Fase 0, Grupo E = "Día"** ✅
  - (Nota: E se mapea de C según PISTA 2)

### Ejemplo 4: Grupo G en 31-01-2026 (PISTA 2)
- **Fecha Semilla PISTA 2**: 17-01-2026
- **Fecha Consulta**: 31-01-2026
- **Cálculo**:
  - dias_diferencia = 14 días
  - dia_ciclo = 14 % 56 = 14
  - fase = 14 ÷ 14 = 1
  - **Regla Fase 1, Grupo G = "Día"** ✅
  - (Nota: G se mapea de A según PISTA 2)

### Ejemplo 5: Grupo AB en 10-01-2026 (Refuerzo)
- **Tipo de Grupo**: Doble (refuerzo)
- **Cálculo**: Igual al grupo A
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

## Calendario Visual (Enero - Marzo 2026)

```
┌─────────────┬──────────────────────┬──────────────────────┐
│    FECHA    │    PISTA 1 (A-B-C-D) │   PISTA 2 (E-F-G-H)  │
├─────────────┼──────────────────────┼──────────────────────┤
│ 10-01-16/01 │ A(D),B(N),AB         │ (espera semilla)     │
│ 17-01-23/01 │ (continúa A-B)       │ E(D),F(N),EF [COPIA] │
│ 24-01-30/01 │ C(D),D(N),CD         │ G(D),H(N),GH [COPIA] │
│ 31-01-06/02 │ (continúa C-D)       │ (continúa G-H)       │
│ 07-02-13/02 │ A(N),B(D),AB [INV]   │ E(N),F(D),EF [COPIA] │
│ 14-02-20/02 │ (continúa A-B inv)   │ G(N),H(D),GH [COPIA] │
│ 21-02-27/02 │ C(N),D(D),CD [INV]   │ (continúa G-H inv)   │
│ 28-02-06/03 │ (continúa C-D inv)   │ (continúa E-F)       │
└─────────────┴──────────────────────┴──────────────────────┘

Leyenda:
- (D) = Turno Día (08:00-20:00)
- (N) = Turno Noche (20:00-08:00)
- [COPIA] = PISTA 2 sigue exactamente el mismo ciclo que PISTA 1
- [INV] = Turnos invertidos (noche ↔ día)
- **NO hay solapamientos de descanso**: siempre hay cobertura
- PISTA 2 inicia exactamente 7 días después de PISTA 1
```

---

## Fórmula de Cálculo Programática

### Para grupos A-B-C-D (Pista 1)

```javascript
// Fecha de referencia: 10/01/2026 = Día 0 para A-B
const INICIO_AB = new Date(2026, 0, 10); // mes 0 = enero (0-indexed)
const MS_PER_DAY = 86400000;
const CICLO_14_DIAS = 14;
const CICLO_COMPLETO = 56; // 4 bloques de 14 días

function obtenerTurnoPista1(fecha) {
  const dias = Math.floor((fecha - INICIO_AB) / MS_PER_DAY);
  const posicionCiclo = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let grupo = null;
  let turno = null;
  
  if (posicionCiclo >= 0 && posicionCiclo < 14) {
    // A-B trabajando, turno normal
    grupo = { manana: 'A', tarde: 'B', doble: 'AB' };
  } else if (posicionCiclo >= 14 && posicionCiclo < 28) {
    // C-D trabajando, turno normal
    grupo = { manana: 'C', tarde: 'D', doble: 'CD' };
  } else if (posicionCiclo >= 28 && posicionCiclo < 42) {
    // A-B trabajando, turno INVERTIDO
    grupo = { manana: 'B', tarde: 'A', doble: 'AB' };
  } else if (posicionCiclo >= 42 && posicionCiclo < 56) {
    // C-D trabajando, turno INVERTIDO
    grupo = { manana: 'D', tarde: 'C', doble: 'CD' };
  }
  
  return grupo;
}
```

### Para grupos E-F-G-H (Pista 2 - Sombra)

```javascript
// PISTA 2 usa la MISMA LÓGICA que PISTA 1, pero con fecha inicial 7 días después
// Fecha de referencia: 17/01/2026 = Día 0 para E-F (7 días después que A-B)
const INICIO_EF = new Date(2026, 0, 17);

function obtenerTurnoPista2(fecha) {
  const dias = Math.floor((fecha - INICIO_EF) / MS_PER_DAY);
  const posicionCiclo = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO);
  
  let grupo = null;
  
  if (posicionCiclo >= 0 && posicionCiclo < 14) {
    // E-F trabajando (mismo que A-B), turno normal
    grupo = { manana: 'E', tarde: 'F', doble: 'EF' };
  } else if (posicionCiclo >= 14 && posicionCiclo < 28) {
    // G-H trabajando (mismo que C-D), turno normal
    grupo = { manana: 'G', tarde: 'H', doble: 'GH' };
  } else if (posicionCiclo >= 28 && posicionCiclo < 42) {
    // E-F trabajando (mismo que A-B), turno INVERTIDO
    grupo = { manana: 'F', tarde: 'E', doble: 'EF' };
  } else if (posicionCiclo >= 42 && posicionCiclo < 56) {
    // G-H trabajando (mismo que C-D), turno INVERTIDO
    grupo = { manana: 'H', tarde: 'G', doble: 'GH' };
  }
  
  return grupo;
}
```

**Resumen:** E→A, F→B, G→C, H→D. El ciclo de 56 días es idéntico, solo desplazado 7 días. Garantiza cobertura 100% sin solapamientos de descanso.

**Referencias legacy:**
```javascript
const INICIO_GH = new Date(2026, 0, 17); // igual a INICIO_EF (para compatibilidad)
```

---

## Notas Importantes

1. **Los grupos dobles (AB, CD, EF, GH) SIEMPRE trabajan turno día** independientemente del horario de su grupo hermano.

2. **El ciclo completo es de 56 días** (4 bloques de 14 días) después del cual los turnos vuelven al inicio.

3. **PISTA 1 y PISTA 2 son copias idénticas, no independientes**
   - Mismo ciclo de 56 días
   - Mismo mapeo de grupos (A-B-C-D ↔ E-F-G-H)
   - PISTA 2 inicia 7 días después de PISTA 1
   - **Esto garantiza que NUNCA hay solapamiento de descansos** (cobertura 100%)

4. **Inversión de turnos**: Cada 28 días (mitad del ciclo), los grupos intercambian sus horarios (día ↔ noche) para distribución equitativa.

5. **Grupos separados J/K** (semanales): Tienen lógica independiente basada en weekday, no participan en el ciclo de 56 días.

---

**Última actualización**: 26/03/2026
**Estructura final**: 2 Pistas idénticas con desfase +7 días | A-B-C-D (semilla 10/01) y E-F-G-H (semilla 17/01)
