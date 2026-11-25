# Gestión de límites (decisión del usuario, 23/11/2026): prioridad CLAUDE

El usuario usa Claude (plan Pro) para otras cosas y su pareja también (uso ligero). Mi trabajo en ESTE proyecto y en Dread Bard consume el mismo límite semanal de Claude. Gestiono yo los límites de Claude y de OpenCode Go para los dos proyectos.

## Cómo medir (barato)
- Claude: herramienta `mcp__ccd_session_mgmt__get_usage` (límite de 5 h, semanal y contexto de la sesión). Consultar al empezar cada tanda de agentes y antes de gastar mucho. Estado 23/11 13:45: 5 h 10 %, semanal 57 % (reinicia vie 28/11 21:00 España), uso extra desactivado.
- OpenCode Go: la consola web (el usuario pasa capturas) o una sonda con `.delegaciones/comprobar_cuota.sh` (una sola, nunca en bucle). Estado 23/11: 5 h 1 %, semanal 6 %, mensual 53 % (herencia de un día anterior), créditos 0 $ y recarga automática desactivada.

## Reglas de Claude (semanal) — actualizado 23/11/2026
- Reserva para el usuario (trabajo suyo y uso de su pareja): terminar la semana con **8–10 % libre**. Techo de trabajo de los dos proyectos: **90 %** del semanal.
- Menos de 75 %: trabajo normal (delegar, revisar informes y capturas).
- 75–85 %: solo trabajo delegado; informes de 10 líneas; sin barridos de capturas ni lecturas largas; mensajes cortos.
- 85–90 %: solo lo esencial (arreglos pequeños, tests). Avisar al usuario.
- 90 % o más: PARAR el trabajo del proyecto y avisar. Esperar al reinicio o a que el usuario decida.
- Ventana de 5 h por encima del 70 %: pausar hasta su reinicio (un solo aviso, sin sondear).
- Ritmo: a 23/11 13:45 quedaba un 43 % de semanal (hasta el vie 28/11 21:00): ~33 puntos de margen de trabajo hasta el techo del 90 %, a repartir en 5 días (~6-7 puntos al día). Una sesión larga gasta mucho más por mensaje: preferir sesiones nuevas cortas.
- Dread Bard (otro chat): Haiku dirige, Sonnet solo para decisiones; mismo techo del 90 % compartido (el consumo de los dos proyectos suma); sin Opus.

## Higiene de sesión (lo que más ahorra)
- Cada turno recontaba todo el historial: sesiones largas = más gasto por mensaje. Abrir sesión nueva (con `.delegaciones/TRASPASO_SESION.md`) al llegar al 50 % del contexto o entre bloques grandes.
- Una sola espera por tanda: armar un vigilante que avise cuando terminen TODOS los agentes, y decidir en un solo turno.
- No leer archivos grandes ni repetir mediciones: delegar el análisis a scripts y agentes.

## Reglas de OpenCode Go
- Flash (DeepSeek) por defecto; MiMo solo si falla; modelos gratuitos (`hy4-flash-free`, `beam-free`) para tareas de bajo riesgo.
- Hasta 4 agentes a la vez (1 en `src/` + hasta 3 de Blender con carpetas distintas) mientras el semanal de Go esté bajo (<20 %); lotes de ~10 modelos. Solo uno en `src/`. Sin reintentos en bucle (2 fallos: parar y diagnosticar).
- Sin Extra Usage ni créditos de pago salvo orden expresa del usuario. Si el semanal llega al 20 % o el mensual proyectado no cubre el mes, pasar a gratuitos y avisar.

## Presupuesto de triángulos (usuario, 23/11/2026: «baja el tope para no castigar al rendimiento y poder añadir más»)
Soldado base: ≤4.000 (piezas ≤700); enemigos robot: ≤3.500; props y escenarios: ≤3.000; equipamiento: ≤3.000; jefes: hasta 6.000. Pensado también para Android.
