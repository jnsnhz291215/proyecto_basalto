🗺️ Mapa de Base de Datos (MariaDB)
Utiliza exclusivamente estos nombres de tablas y columnas para las consultas SQL en el servidor (server/routes/viajes.js) y el mapeo en el frontend:

ciudades: id_ciudad, nombre_ciudad.

trabajadores: RUT, nombres, apellido_paterno, apellido_materno, email, fecha_nacimiento, ciudad, telefono, id_grupo, cargo, activo.

viajes: id_viaje, rut_trabajador, fecha_registro, estado.

viajes_tramos: id_tramo, id_viaje, tipo_transporte, codigo_pasaje, fecha_salida, hora_salida, id_ciudad_origen, id_ciudad_destino, empresa_transporte.

informes_turno: id_informe, numero_informe, fecha, turno, horas_trabajadas, faena, lugar, equipo, operador_rut, ayudante_1, ayudante_2, pozo_numero, sector, diametro, inclinacion, profundidad_inicial, profundidad_final, mts_perforados, pull_down, rpm, horometro_inicial, horometro_final, horometro_hrs, insumo_petroleo, insumo_lubricantes, observaciones, estado, creado_el.

actividades_turno: id_actividad, id_informe, hora_desde, hora_hasta, detalle, hrs_bd, hrs_cliente.

herramientas_turno: id_herramienta, id_informe, tipo_elemente, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra.

perforaciones_turno: id_perforacion, id_informe, desde_mts, hasta_mts, mts_perforados, recuperacion, tipo_rocka, dureza.

admin_users: RUT, nombres, apellido_paterno, apellido_materno, email, password.

admin_logs: id_log, admin_rut, accion, detalle, fecha.

users: id_user, rut, nombres, apellido_paterno, apellido_materno, email, password, created_at, activo.

cargos: id_cargo, nombre_cargo.

configuracion_ciclos: id_conf, pista_nombre, fecha_semilla, activo.

excepciones: id_excepcion, rut_trabajador, fecha_inicio, fecha_fin, dias_duracion, motivo, creado_el.