# Plan: ritmo de combate + modo Campaña (propuesta del director, 22/11/2026)
Origen: el usuario dice que el combate es plano y le falta ritmo; el modo hack no le convence y prefiere algo como una incursión con niveles que se desbloquean y muchos objetivos variados, como una campaña.
Hoy hay: incursión (`raidgen.ts`/`raid.ts`), hack por sectores (`hackgen.ts`, mapas de 5 salas, guardián, mejora, extraer o bajar), defensa (`defense.ts`), arena de supervivencia (`arena.ts`/`arenagen.ts`), campo de tiro, contratos (`contracts.ts`), modificadores (`wavemods.ts`).

## A. Ritmo del combate (primero: se nota en 5 minutos)
1. **Sensación de disparo/impacto** (paso 14 retomado): fogonazo, casquillos, trazadoras, hit marker, indicador de daño, humo. Base ya hecha en `fxpool.ts`/`combatfx.ts` (inertes).
2. **Roles de enemigo** con comportamiento distinto: rusher (cuerpo a cuerpo), tirador a distancia, escudado (hay que flanquear/romper), flanqueador, pesado con punto débil, apoyo que cura/refuerza. Cada rol con telegrafía (aviso antes de atacar).
3. **Ritmo por encuentro**: emboscada → pico → pausa breve (recoger munición/vida) → siguiente. Evitar el flujo constante. Pesos por oleada en `waves.ts`.
4. **Bucle de recompensa inmediato**: las bajas sueltan munición/vida/recarga de súper; racha ("impulso") que da un bonus corto (velocidad de recarga, daño) y se pierde si te quedas quieto o te golpean.
5. **Movimiento con decisión**: deslizamiento o esquiva con enfriamiento, cobertura útil, recarga cancelable.
Medir: cada cambio con captura/clip y un test de lógica pura (como `fxpool.test.ts`).

## B. Campaña (sustituye al hack; reutiliza `hackgen.ts` y `raidgen.ts`)
- **Estructura:** 3 actos (temas existentes: centro de datos, fundición, laberinto; luego arena y biolab), 3–4 niveles por acto. Cada nivel se desbloquea al terminar el anterior; estrellas por objetivos opcionales. Progreso en `save.ts`.
- **Nivel = cadena de objetivos** en 3–6 salas, no solo «llegar al guardián». Tipos de objetivo (una tabla de datos, no código por nivel):
  1. Eliminar objetivo prioritario. 2. Hackear terminal: mantener la posición N s mientras llegan oleadas. 3. Recuperar un objeto y volver a la salida. 4. Destruir generadores/antenas (con fuego enemigo y refuerzos). 5. Escoltar o abrir paso a un aliado/dron. 6. Sabotaje silencioso (evitar alarma; si salta, oleada). 7. Sobrevivir una oleada. 8. Jefe de nivel (fases, patrón aprendible). 9. Extraer.
  - **Opcionales:** cofre oculto, tiempo, sin recibir daño, sin alarma. Dan estrellas y botín.
- **Modificadores por nivel** (`wavemods.ts`): visibilidad baja, enemigos blindados, munición escasa, etc., con recompensa extra.
- **Recompensas:** créditos, botín con rareza, piezas para la puerta sellada del hall, y desbloqueos (gadgets/súperes) en hitos.
- **Rejugable:** semillas por nivel con variación de salas y objetivos opcionales, para que repetir no sea idéntico.
- **Primera pieza vertical (a probar antes de ampliar):** 5 niveles con 5 tipos de objetivo, estrellas y guardado (el nivel 5 con jefe, por confirmar).

## C. Reparto (cuando vuelva la cuota de Go; yo dirijo y reviso con imágenes)
1. Tanda A1: retomar paso 14 (conectar efectos, capturas). Tanda A2: roles de enemigo (3 primero) + telegrafía. Tanda A3: ritmo de oleadas + drops + impulso.
2. Tanda B1: modelo de datos de campaña (niveles, objetivos, guardado) con tests puros. B2: 5 tipos de objetivo en el motor de incursión. B3: UI de selección de nivel y estrellas en el hall (ordenador de campaña). B4: acto 1 completo con el jefe.
Reglas: flash por defecto, tandas cortas, revisión mía entre tandas, parar al límite de cuota.

## D. Decisiones del usuario antes de empezar
- **DECIDIDO (22/11):** la campaña SUSTITUYE al modo hack y se llama también **Hack** (mismo nombre, nuevo diseño).
- **DECIDIDO (22/11):** 5 niveles en la primera versión (antes se proponían 3). Se mantienen sin cambiar defensa, arena y la incursión (raid) como modos aparte.
- **DECIDIDO (22/11):** jefe en el nivel 5: algo MUY distinto al resto, que imponga (escala, sala propia, fases y un patrón reconocible) y con una **legendaria garantizada**.
- **DECIDIDO (22/11):** hacen falta enemigos nuevos y jefes nuevos para los modos (no solo la campaña). Ver sección E.
- **EN ESTUDIO:** las súperes se desbloquearían por desafíos o logros en vez de por otra vía. Ver sección F.


## E. Enemigos y jefes nuevos
- Enemigos nuevos por rol (ver A.2) y por tema/modo; un rol nuevo debe obligar a cambiar de táctica, no solo tener más vida.
- Jefes: uno por modo/tema, con fases y un patrón aprendible. El del nivel 5 de Hack es el jefe final: escala y presencia únicas, arena propia, introducción cinematográfica corta, y **drop de legendaria garantizada** (tabla de botín con rareza fija).
- Reutilizar `dummies.ts`/`waves.ts` (siluetas y volúmenes ya hechos). Los modelos son procedurales: dar a cada jefe silueta y paleta propias.

## F. Súperes: fichas y desafío de Spirit Nova (DECIDIDO 22/11)
- Todas las súperes parten **bloqueadas**. **Cada 5 niveles se gana una «ficha de súper»** que desbloquea **una súper al azar entre las que siguen bloqueadas** (sin repetir). (CONFIRMADO: nivel del jugador, 1–100 en progress.ts → hasta 20 fichas.)
- **Spirit Nova** (id `spirit`, «nova espiritual»: hay que quedarse quieto mientras carga) es **legendaria**, queda **fuera del sorteo** y es una súper **secreta**: se desbloquea cuando se cumplen TRES condiciones: (1) **completar la campaña Hack** (los 5 niveles, incluido el jefe), (2) **llegar lejos en supervivencia (arena)** y (3) **llegar lejos en defensa de torre**. **Umbrales ACEPTADOS por el usuario (22/11): oleada 15 en defensa y oleada 20 en supervivencia** (a ajustar con partidas reales si hace falta). Guardar el mejor resultado por modo en save.ts; la ficha de súper se muestra como «???» con una pista vaga y el progreso de las tres condiciones solo al conseguir la primera.
- El resto: 21 súperes en el sorteo (22 en total hoy; ajuste a 25 aparcado).
- Sustituye al desbloqueo actual por módulos e incursiones (`supersOwned`, `raidsDone` en save.ts): migrar partidas guardadas sin quitar lo ya desbloqueado.
- Por decidir: los umbrales exactos de supervivencia y defensa; si se gana alguna ficha extra por otra vía (p. ej. al vencer al jefe del nivel 5 de Hack); cómo se muestran las fichas y las bloqueadas en el hall/inventario.
