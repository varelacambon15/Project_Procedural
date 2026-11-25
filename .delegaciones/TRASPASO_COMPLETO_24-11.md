# TRASPASO COMPLETO (24/11/2026, ~03:00) — LÉELO ENTERO ANTES DE HACER NADA

Este documento resume TODO lo hablado y decidido en la sesión anterior (que llegó al 71 % de contexto). Complementa `TRASPASO_SESION.md` (cronología) y manda sobre él si hay contradicción. Si algo no encaja, pregunta al usuario en vez de suponer.

## 0. Cómo empezar (primeros 10 minutos)
1. Lee este archivo, luego `PROGRESO.md`, `GESTION_LIMITES.md` y la sección «ESTADO ACTUALIZADO 24/11 ~02:30» de `TRASPASO_SESION.md`. Los encargos están en `.delegaciones/encargos/NN-*.md` (27–54).
2. `mcp__ccd_session_mgmt__get_usage`: mira el semanal y la ventana de 5 h (ver §4).
3. Comprueba si el agente del encargo 54 sigue vivo: PowerShell `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Select CommandLine` (busca el título «enc54»). Su log está en el scratchpad de la sesión anterior (`...\scratchpad\enc54.log`); si no existe, mira `git status`/`git diff` de `src/game/anim.json` y `anim.ts` y las hojas en `.delegaciones/comparacion_fps/`.
4. `git status --short` y repasa el diff de lo que toque el 54. Nada se ha commiteado.
5. Revisa tú las capturas del 54 (smg y Partisan) ANTES de aceptar (ver §6, regla de oro). Después sigue la cola (§7).
6. Al empezar tu primer mensaje, dile al usuario en 5 líneas dónde estás (le gusta ver progreso al hablar).

## 1. Proyecto y usuario
- «Project Procedural / Proving Grounds»: looter-shooter FPS procedural. TypeScript + Three.js r160 + Vite + Vitest; Electron (PC) + Capacitor (Android). Repo `C:\Github\Project_Procedural-ccr-9154dbc6-lqpjb5`, rama `ccr-9154dbc6-lqpjb5`. Vite dev en `http://localhost:5199` (puede que haya que relanzarlo).
- Usuario: español de España, tuteo. Siempre respondo en español. Al final de CADA respuesta: «Modelo y esfuerzo: <modelo> <esfuerzo>, <motivo>». Default Sonnet 5.5 medio; sube a alto con 3+ módulos, sistema nuevo, ambigüedad, decisiones irreversibles; Opus solo con los 3 disparadores de `~/.claude/CLAUDE.md`.
- Soy el DIRECTOR: planifico, escribo encargos, reviso. El trabajo de código/Blender lo hacen agentes de OpenCode Go. Solo hago yo ediciones triviales (1–2 líneas), lecturas y revisión.
- El usuario NO prueba cada cosa: prueba cuando hay mucho implementado y pulido. «Te dejo trabajar todo el día… ve avanzando sin pararte»; «cuando acabes, enséñame lo que has hecho y te digo». Quiere decisiones tomadas por mí (me las delegó), pero enseñarle capturas/resultados.
- Estilo visual: ha dicho que el estilo actual «es muy pobre y parece todo de juguete y plastilina». Quiere calidad tipo los modelos de Blender nuevos («ya se ven muchísimo mejor», «están muchísimo mejor ahora»). Extender esa calidad a: enemigos, props, equipamiento, soldado, y más adelante brazos y piernas del protagonista. Memoria guardada: `project-modelado-blender-calidad.md`.
- Hack → campaña por niveles, combate con más ritmo (memoria `project-hack-campana.md`). Cómo dirigir a OpenCode: memoria `feedback-director-delegacion.md`. Las memorias se cargan solas por `MEMORY.md`.

## 2. Reglas duras (no romper)
- Sin `git commit`, `git push`, `reset --hard`, borrados masivos ni instalar dependencias sin que el usuario lo pida. (Excepción ya aprobada: `@dimforge/rapier3d-compat ^0.21.0` instalado.)
- No tocar ni imprimir secretos. No editar `CREDITS.md`. Textos del juego en español e inglés (`src/i18n.ts`, `src/i18n-menus.ts`).
- No cambiar valores esperados de tests sin preguntar (ya se bajaron con permiso `tests/kit.test.ts` pistol min >8 y `tests/polish22b.test.ts` >2).
- No añadir luces reales nuevas a la escena. Sin verde en los brazos.
- Prohibidos modelos `iceman*` y `muse-spark*` (entrenan con nuestros datos). Sin Extra Usage ni recarga automática en OpenCode Go.
- Antes de dar por bueno cualquier cambio visual: mirar yo la captura. (Lección: el 35+46 se pasaron de rosca y yo había aceptado la métrica del agente sin mirar; el usuario lo vio.)
- Pruebas: vitest POR FICHERO (la suite completa tarda 25+ min por contención con Blender; no se ha verificado entera tras los últimos cambios; la última verde fue 40 ficheros / 284 tests antes de lo de las culatas). Dilo explícitamente en cada encargo («no ejecutes la suite completa»).

## 3. Cómo se lanzan y vigilan los agentes
- Comando: `opencode run --auto --agent coder --model opencode-go/deepseek-v4.1-flash --title "encNN nombre" "Lee .delegaciones/encargos/NN-….md y ejecútalo. <instrucciones firmes cortas>" < /dev/null > log 2>&1 &` (Bash). Para Blender: `--agent artist-3d` (flash por defecto; Pro `opencode-go/mimo-v2.6-pro` solo si falla 2 veces; si Pro falla, `gemini-4-argon` o `step-5-preview`). Cuota agotada: `hy4-flash-free` / `beam-free`.
- Hasta 4 agentes a la vez: 1 en `src/` + 3 Blender con CARPETAS DISTINTAS. Dos agentes jamás tocan los mismos archivos.
- Es imprescindible `< /dev/null` (si no, se cuelga). El log solo se escribe al terminar. Esperar con Monitor haciendo bucle sobre `Get-CimInstance Win32_Process` (`Name -eq 'opencode.exe'` y título). NUNCA matar procesos con un filtro de línea de comandos que incluya mi propio shell (ya maté mi wrapper una vez, exit 255). No hacer bucles de reintentos: 2 fallos seguidos → escalo yo (alto, luego Opus).
- Problemas vistos: agentes que leen el encargo y salen con exit 0 sin hacer nada (solución: prompt más corto y firme); agente que lanzó la suite completa durante horas (prohibirlo); agentes zombis editando los mismos archivos de Blender (matar los antiguos antes de relanzar).
- Flujo obligatorio al terminar un agente: `git status --short` y `git diff`, leer su informe, revisar capturas, `tsc` (`npx tsc --noEmit`) y los tests del área por fichero; corrección puntual al mismo agente si el fallo es menor.

## 4. Límites de uso (prioridad: Claude)
- El usuario y su pareja usan Claude para otras cosas. Techo de TRABAJO: 90 % del semanal (dejar 8–10 % libre). Cuando llegué a 71 % de semanal la sesión anterior tenía 71 % de contexto; el semanal subió 61 → 71 % en medio día.
- Escala: 75–85 % → solo trabajo delegado y mensajes cortos; 85–90 % → solo lo esencial y avisar; ≥90 % → parar y avisar. Ventana de 5 h por encima del 70 % → pausar hasta su reinicio. Consultar `get_usage` al inicio de cada tanda y actualizar `GESTION_LIMITES.md`/`PROGRESO.md`.
- Mensajes cortos, sesiones cortas (nueva sesión al 50 % de contexto), exploración por subagentes/agentes, nunca volcar archivos grandes ni listados al contexto. «Ya me irás actualizando tu progresión» → informe de uso cada vez que me hable.
- OpenCode Go: DeepSeek flash por defecto, sin créditos extra; el mensual está alto por un desastre de hace unos días, el consumo actual es mucho menor (capturas que pasó). Presupuesto de triángulos: soldado ≤4.000, robots ≤3.500, props ≤3.000, equipamiento ≤3.000, jefes ≤6.000 (a veces permite ~6.000 si el modelo lo merece).
- Dread Bard (`C:\Github\Dread Bard`): otro proyecto personal (port de Yu-Gi-Oh! Nightmare Troubadour para DS) que lleva OTRO chat con Haiku, con su CLAUDE.md. Comparte el límite semanal de Claude. No lo toques desde aquí; solo respeta que los dos suman al mismo techo. Si el usuario trae algo de ese proyecto, puedes ayudarle con resúmenes cortos.

## 5. Lo que está hecho (todo SIN commit; no se ha verificado la suite completa)
- Equipamiento: 20 fotos 2D en Blender (`assets/equipo/*.png`, `gadgetthumb.ts` con respaldo procedural), 20 GLB (`assets/equipo3d/*.glb`, fuente en `raw/pack9_equipo`), integrados en el juego con despliegue animado (`gadgetmodel.ts`, `gadgetfx.ts`, `grenademodel.ts`; 17 tipos cargan, torreta sin piezas `mov_*` salvo la cúpula), gestos de manos al usar equipamiento/lanzar/lanzar suave («lanzar suave» no tiene tecla asignada aún). Granadas reclasificadas y guardado v3.
- Retículas unificadas: una sola `#reddot` por óptica, catálogo de 10 formas (`src/game/reticles.ts`, tests, `tools/strip-reticles.mjs`, `tools/audit-reticles.mjs`, originales en `raw/opticas_originales/`).
- Agarres (encargo 30): anclajes grip/support/magwell/charge, perfiles `hold` (`src/weapons/grip.ts`), NaN corregido, pistola con culata a dos manos.
- Culatas: ~15 % de pistolas y de revólveres con culata (`generator.ts`: `PISTOL_STOCK_P` 0.09, `CARBINE_STOCK_P` 0.1, `rare.hgStock`, `KIT_SHARE {rifle .3, pistol .04, shotgun .4}`).
- Registro de sesión automático: `SessionRecorder` (`src/game/session.ts`), plugin Vite `/__session/write` → `Documentos\ProvingGrounds\sesiones`; F10 descarga manual. El usuario deja ahí sus notas.
- Modelado Blender (Blender 5.3 CLI; librería `.delegaciones/blender/equipo/_comun.py`; convención GLB: metros, +X frente, +Y arriba, origen en el suelo, malla por pieza, pivotes `mov_*`, Principled, sin texturas/luces/cámaras): pack7 (66 piezas donantes de armas), pack8 pilotos, pack10 lote 2 (araña, rodante artillero, dispensador, recreativa, armero), rodante explosivo, pack11 soldado ciber modular (paletas en `paletas.json`), pack12 escenarios (10 props), pack13 robots (bombardero, reparador, centinela flotante, arañita, sabueso y mech rehechos en 45), pack14 humanoides especiales (asesino, granadero, incinerador, invocador, berserker). ~80 modelos nuevos, NINGUNO integrado aún en el juego salvo el equipamiento. Contact sheets con Playwright (`hoja5.cjs`, `hoja20.cjs`, `refs.cjs`).
- Barrido de armas por categoría (encargo 38): informes en `.delegaciones/barrido/` (bullpup: cañón 10–15 % del largo y `receiver`/`front` solapados ~80 %; lmg 19 solapes; pistolas 8; smg con mano <7 cm; lanzagranadas y lanzallamas NO son necesarios → no crearlos). Aún sin arreglar (encargo 48).
- Encuadre FPS: 22 referencias del usuario (`.delegaciones/referencias_fps/`, `LEEME.md`, `refs_1..4.png`). Conclusión: el arma entra por la esquina inferior derecha en DIAGONAL, cañón convergente 8–12° al centro, culata fuera de pantalla, antebrazo izquierdo saliendo por el borde inferior. Encargos 50/51 hechos (`vmfit.ts`, `hipsize.test.ts`, `vmfit.test.ts`, `anim.json` con hipYaw/pitch, 12 hojas en `.delegaciones/comparacion_fps/`). El usuario: «Sí, mucho mejor». Quedó: «El subfusil se ve pequeño» y «la Partisan se sigue viendo enorme y rara» → encargo 54 (en marcha).
- Animaciones: encargo 49 tanda A (pistola/revólver: recarga, sacar, inspeccionar con recorridos reales; `tools/build-poses.mjs`, `src/data/poses.json`, `handpath.ts`, `tests/poses.test.ts`). Fuente de datos: `poses_lowpoly_iw.json` (38 modelos, 347 secuencias). Defectos conocidos: disco negro del manguito junto a la mano, orientación de muñeca no aplicada, encuadre de inspeccionar.
- Rapier instalado. Nada más de físicas aún.
- Documentos: `PROGRESO.md`, `TRASPASO_SESION.md`, `GESTION_LIMITES.md`, `LISTA_PENDIENTES.md` (hasta el ítem 32), `PLAN_ENEMIGOS.md` (13 enemigos nuevos APROBADOS por el usuario: «Ok a los enemigos nuevos»).

## 6. Decisiones y matices del usuario (no re-litigar)
- Ambas cosas del equipamiento: «prefiero ambas, aunque sean sencillas» (GLB y gestos).
- Animaciones: «Me interesaría para todas (las clases) si sale bien el piloto». Procedurales por anclas porque dan flexibilidad con combinaciones y armas futuras; lo que importa es que la calidad mejore y se parezca a las referencias. La prueba del fusil «no vi mucha mejora» fue sobre todo por los agarres.
- Munición de reserva: de momento se queda como está (no tocar).
- Una sola mira por arma: si el modelo trae mira propia, se EXTRAE como accesorio aprovechable y se quita del arma (porque lleva las nuestras); no apilar mira nuestra sobre la del modelo. Las armas poco modulares pero que quedan bien se mantienen: mirar bien qué se quita. Francotiradores: el tercer ejemplo que le pasé (tipo M40 ordinaria) es poco modular → candidato a eliminar tras contar cuántos hay. Piezas/accesorios sin forma de usarse o que no encajan se descartan; si una pieza se pasa un poco de triángulos pero es muy buena, se estudia. Lanzagranadas/lanzallamas no son necesarios.
- Miras de hierro: referencias de CoD (wiki iron sights; PDF con texto extraído con `pdftotext`; sin extracción de fotos). Los puntitos de tritio/rojos solo en armas futuristas (eras scifi/modern). La desalineación NO le gusta («no sé si me gustaría mucho»): no implementar. Escopetas: mejoran ~25 % la dispersión al apuntar (`3.4*(1-aimT*0.25)`, resto `*(1-aimT*0.75)`): el código está bien, NO tocar.
- Retículas personalizables y coleccionables (forma y color elegibles en el taller, desbloqueo por hitos, hasta 20 formas) → encargo 53.
- Enemigos: incinerador y granadero se quedan como están («déjalos al incinerador y al granadero así»). El rodante explosivo (kamikaze) se añade como enemigo nuevo y se edita ligeramente. Más variedad de enemigos (aprobado). Desmembramiento en píxeles de partes con daño muy alto al morir: MANTENER (`Dummy.dismember(zone, at)` en `src/game/dummies.ts`), también con ragdoll.
- Motor: no migrar de motor por ahora; probar Rapier y, según el informe, valorar Godot/Unity/Babylon más adelante.
- Recreativa: es objeto decorativo del hall; el usuario aceptó subir tope de triángulos a 3.000–6.000 si hace falta.
- Tarea 46 (silueta proyectada) fue para todas las armas, no solo la Partisan, pero se detuvo; ahora lo cubren 50/51/54.
- Exe: está en `C:\Github\_noche\exe_build`; el usuario prueba en el navegador y no pidió reconstruir el exe.

## 7. Cola ordenada (en `src/`, UNO por vez; Blender en paralelo si hay hueco)
1. Encargo 54 (en marcha): smg ancho ≥0,42 y escala Partisan ≥0,78. Revisar hojas en `comparacion_fps/` con mis ojos. Mostrar al usuario antes/después.
2. Encargo 49: CORRECCIÓN de la tanda A (orientación de muñeca, disco negro del manguito, encuadre de inspeccionar) → después tandas B (escopeta/smg), C (francotirador/lmg/bullpup), D (fusil rehecho + sprint + idle). Capturar fotogramas y revisarlos yo.
3. Encargo 47: prototipo Rapier (ragdoll de humanoides, explosiones, props físicos, informe de rendimiento; conservar desmembramiento en píxeles).
4. Encargo 48A: extracción de la mira propia como accesorio + medir candidatas a donante (solo medir; revisión mía); criterios de descarte. Después 52 (catálogo de miras de hierro: ~9 familias de alza, «imagen limpia», puntitos de tritio solo scifi/modern, sin desalineación; ADS 0,15–0,50 s por clase), 53 (retículas personalizables) y 48B (arreglos por categoría: bullpup, lmg, pistolas, smg; eliminar francotirador poco modular; auditoría de piezas).
5. Integrar modelos en el juego: enemigos (`dummies.ts` KINDS: cargador GLB con respaldo procedural y piezas `mov_*`; araña, rodante artillero y explosivo, dron bombardero/reparador, sabueso, centinela flotante, arañita, mech pesado, humanoides especiales y soldado modular + paletas), props (pack10/pack12), 13 enemigos nuevos con comportamientos (`PLAN_ENEMIGOS.md`), jefes después (Colosus, Reina araña, Núcleo). Torreta: su GLB no tiene `mov_*` separadas.
6. Resto: taller tipo Modern Warfare Gunsmith (primero auditoría SIN tocar código; ítem 30 de la lista), poses de recarga de más clases, brazos y piernas del protagonista, posible reducción de triángulos de dron/araña/rodante (~3.950) y reconstrucción del exe si lo pide.

## 8. Herramientas útiles
- Playwright: `C:/Users/varel/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright` sobre `http://localhost:5199`; gancho `window.__game` (gen, gun, inv, newGame…); `makeItem` de `/src/game/inventory.ts`.
- Capturas: `.delegaciones/herramientas/capturas/` (fp.cjs, ads.cjs, manos.cjs, fpseed.cjs, comparar_fps.cjs, anim_a.cjs, equipo3d.cjs, gestos.cjs, barrido.cjs). Semillas útiles: rifle Partisan = seed 11.
- `pdftotext` en `/ucrt64/bin` funciona; PIL no existe; el visor PDF del navegador integrado no muestra texto.
- Para enseñar imágenes al usuario: `SendUserFile` con la hoja (p. ej. `hoja_anim_pistol.png`).
- Geometría de arma en mano: `src/game/anim.ts` (`animParams`, `hipBase`, `hipAway`, VM_FOV 62°), `src/data/anim.json`, `src/game/gun.ts`, `src/weapons/{generator,assembler,grip,accbank,accessories}.ts`, `src/data/eras.json`.

## 9. Antes de cerrar cada tanda
Actualizar `PROGRESO.md` y `TRASPASO_SESION.md`; informar de uso Claude; recomendar sesión nueva al 50 % de contexto; resumen ejecutivo: qué se hizo, qué verificaste, qué queda, modelo/esfuerzo. Mostrar capturas de lo visual.
