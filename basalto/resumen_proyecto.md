# Resumen del Proyecto Basalto

## 1. Descripción general
Basalto es una aplicación web interna de operación y administración, orientada a controlar turnos, registrar informes de turno, gestionar viajes de personal y administrar usuarios, cargos y permisos.

- Frontend: HTML, CSS y JavaScript vanilla servidos como estáticos desde `public/`.
- Backend: API REST construida con Express 5 en `server/`.
- Base de datos: MariaDB/MySQL a través de `mysql2/promise`.
- Reportabilidad: exportación de informes a PDF y envío de correo mediante Puppeteer y Nodemailer.

## 2. Stack tecnológico
Dependencias verificadas en `package.json`:

- `express`: servidor HTTP y montaje de rutas API.
- `mysql2`: conexión a base de datos con pool.
- `dotenv`: carga de configuración desde variables de entorno.
- `puppeteer`: render HTML a PDF para informes.
- `nodemailer`: despacho de correos salientes.
- `exceljs`: soporte de exportación tabular.

Observaciones del runtime:

- El proyecto usa CommonJS (`"type": "commonjs"`).
- No hay script de arranque declarado en `package.json`; solo existe el script de migración `migrate:cargo-relations` y un `test` placeholder.

## 3. Estructura principal

### Frontend (`public/`)
Las vistas y scripts están organizados por módulo funcional:

- Operación principal y navegación: `index.html`, `dashboard.html`, `navbar.html`, `js/navbar.js`, `js/navbar_core.js`, `js/common.js`.
- Guardas de acceso y sesión: `js/auth_guard.js`, `js/route-guard.js`.
- Gestión operativa y maestra: `datos.html`, `gestionar.html`, `gestionadmins.html`, `gestioncargos.html`, `gestioninformes.html`, `gestionviajes.html`, `ciudades.html`.
- Informes: `informe.html`, `js/informe.js`, `js/informe_export.js`, `js/audit_viewer.js`.
- Viajes: `viajes.html`, `js/viajes.js`.
- Componentes reutilizables: `js/modules/CalendarComponent.js` (calendario visual usado por vistas de viajes y turnos).
- Configuración de calendario/turnos: `js/config.js` define fecha base, grupos y colores.

### Backend (`server/`)

- `app.js`: inicializa Express, aplica middlewares globales, sirve estáticos y monta rutas bajo `/api`.
- `database.js`: crea el pool de conexión, valida `.env` y concentra operaciones de datos reutilizadas.
- `helpers/shiftValidation.js`: lógica de turno, jornada y validación de trabajador/grupo en turno.
- `helpers/periodHelper.js`: cálculo de claves de período usadas para vincular instancias de trabajo con viajes.
- `utils/validators.js`: validaciones generales, incluyendo normalización/validación de RUT.
- `routes/auth.js`: autenticación unificada y resolución de contexto de cargo/grupo/permisos.
- `routes/turnos.js`: endpoints de estado de turno, grupos activos, jornada y salud del módulo.
- `routes/calendario.js`: endpoints modulares de calendario de turnos.
- `routes/viajes.js`: operaciones de viajes y tramos, incluyendo calendario y validaciones de eliminación.
- `routes/trabajadores.js`: trabajadores, grupos y responsables de turno.
- `routes/informes.js`: CRUD y reglas de negocio de informes, exportación PDF y correo.
- `routes/stats.js`: KPIs mensuales para dashboard.
- `routes/admin_management.js`: administración de cuentas admin y permisos directos.
- `routes/cargos.js`: cargos y permisos por cargo.
- `scripts/generate-instances.js`: pre-generación de filas `instancias_trabajo` para todos los grupos en un rango de fechas.
- `scripts/migrate-cargo-relations.js`: soporte de migración de relaciones cargo-permiso.

## 4. Flujos funcionales principales

### Autenticación y contexto de usuario
- El login está centralizado en `POST /api/login`.
- El backend normaliza RUT y resuelve el contexto del usuario a partir de tablas de administradores, trabajadores, cargos, grupos y permisos.
- La respuesta distingue entre perfiles administrativos y operativos, e incluye permisos directos y permisos heredados por cargo.
- Se contemplan cuentas inactivas tanto para admins como para usuarios asociados.

### Turnos y validación operativa
- El módulo `turnos` expone endpoints de consulta de turno por RUT, grupos activos por fecha, jornada por grupo y endpoint de salud.
- El sistema implementa un ciclo rotativo de 56 días con 2 pistas (Tracks) desfasadas 7 días entre sí, y 14 grupos: A-H (rotativos), AB/CD/EF/GH (combinados de día fijo) y J/K (semanales de oficina).
- Las instancias de trabajo se pre-generan en la tabla `instancias_trabajo` y se consultan por grupo/fecha. Las excepciones individuales se registran en `excepciones_turno`.
- Varias operaciones del sistema usan esta capa para decidir si un trabajador puede editar o registrar información durante una jornada activa.

### Informes de turno
- El módulo `informes` aplica reglas por estado del informe, bloqueo de estados cerrados/finalizados/validados y validaciones de turno.
- Existe prevención simple de doble envío en memoria por ventana corta de tiempo.
- Se soporta exportación a PDF y envío por correo usando configuración SMTP obtenida desde variables de entorno.
- Hay lógica explícita para bypass de validación de turno en casos de Super Administrador.

### Viajes
- El módulo `viajes` consulta viajes y tramos, entrega información para calendario y valida operaciones sensibles.
- La gestión considera origen, destino, fechas, empresas de transporte, códigos de pasaje y estado del viaje.
- Ciertas eliminaciones físicas están restringidas a Super Administrador.

### Administración, cargos y permisos
- El sistema separa permisos directos de administradores (`admin_permisos`) y permisos heredados por cargo (`cargo_permisos`).
- `admin_management.js` protege varias rutas con middleware de Super Administrador.
- `cargos.js` permite crear/editar cargos y asociar permisos, incluyendo el permiso especial `responsable_turno`.
- `trabajadores.js` expone un endpoint específico para obtener responsables de turno según grupo activo.

### Dashboard y métricas
- `stats.js` entrega métricas mensuales agregadas desde `informes_turno`.
- Los indicadores actuales incluyen metros perforados, eficiencia estimada por consumo y horas/informes trabajados.
- También calcula tarjetas de resumen como mejor grupo del mes y avance anual acumulado.

## 5. Seguridad y comportamiento relevante

- Normalización consistente de RUT en múltiples rutas para comparar entradas con y sin puntos, guion o espacios.
- Headers anti-cache aplicados globalmente para evitar reutilización de contenido sensible en cliente.
- Límite de payload JSON y URL-encoded configurado en 50 MB.
- Pool de base de datos inicializado desde `.env`, con tolerancia a valores copiados entre corchetes.
- Registro de auditoría para acciones administrativas en tabla `admin_logs`.
- Auto-cierre del proceso por inactividad tras 1 hora sin peticiones.
- Endpoint de diagnóstico de BD (`/ping-db`) y endpoint de salud del módulo turnos (`/api/turnos/health`).

## 6. Estado de madurez observado

Fortalezas:
- Estructura clara por dominios funcionales, con separación razonable entre frontend, API y helpers.
- Cobertura funcional amplia: autenticación, turnos, informes, viajes, trabajadores, cargos, permisos y métricas.
- Modelo de permisos más rico que un simple rol único, combinando permisos directos y permisos por cargo.
- Reglas de negocio específicas del dominio ya implementadas, especialmente en turnos, informes y operaciones restringidas.

Riesgos y mejoras potenciales:
- Las contraseñas se comparan en texto plano según el comportamiento observado y el esquema SQL, por lo que falta hash seguro y política de endurecimiento de autenticación.
- No existen pruebas automatizadas operativas; el script `test` actual falla intencionalmente.
- Parte del control anti doble envío/rate limit está en memoria, adecuado para una sola instancia pero no para despliegue distribuido.
- El cierre automático del servidor por inactividad puede ser útil en entornos controlados, pero riesgoso si se despliega como servicio persistente.
- Hay varios logs de depuración en rutas productivas, lo que sugiere margen para depurar observabilidad y reducir ruido operacional.

## 7. Ejecución y operación

1. Configurar `.env` con al menos variables de base de datos (`DB_HOST`, `DB_USER`, `DB_NAME`, `DB_PASS` o `DB_PASSWORD`, opcionalmente `DB_PORT`).
2. Configurar variables SMTP (`SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`) o sus aliases `MAIL_*` para el envío de informes.
3. Instalar dependencias con `npm install` en la raíz de `proyecto_basalto`.
4. Iniciar el servidor con el comando Node que corresponda al entorno, ya que no existe script `start` declarado.
5. Acceder a las vistas estáticas servidas por Express.

## 8. Resumen ejecutivo
Basalto es una plataforma operativa interna relativamente madura, enfocada en control de turnos, trazabilidad de informes y logística de viajes, con un esquema administrativo basado en permisos por usuario y por cargo. La arquitectura actual es funcional y modular para operación diaria, pero sus principales prioridades técnicas son endurecer autenticación, formalizar scripts de ejecución y pruebas, y reemplazar controles en memoria si el sistema va a escalar o desplegarse en más de una instancia.
