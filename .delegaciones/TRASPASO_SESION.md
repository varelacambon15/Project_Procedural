# Traspaso de sesión (23/11/2026, ~14:00)

Proyecto: Project Procedural / Proving Grounds (TS + Three.js + Vite + Vitest; Electron + Capacitor). Repo `C:\Github\Project_Procedural-ccr-9154dbc6-lqpjb5`, rama `ccr-9154dbc6-lqpjb5`. Sin commit ni push (solo cuando el usuario lo pida). Usuario: español de España, tuteo; yo soy el director y reporto «Modelo y esfuerzo» al final. Reglas de equipo en `~/.claude/CLAUDE.md`; límites en `.delegaciones/GESTION_LIMITES.md` (prioridad Claude).

## Hecho hoy (todo sin commit)
- Fotos 2D del equipamiento en Blender (20 PNG en `assets/equipo/`) e integración con respaldo procedural (`src/game/gadgetthumb.ts`). Slot E, arrastrar y granadas reclasificadas (guardado v3).
- Pilotos de calidad Blender: dron, torreta enemiga y máquina de bebidas en `raw/pack8_pilotos/` (GLB ≤4.000 tris). Piezas donantes pack7 (66).
- Recarga de fusil con recorridos reales de mano (`src/game/handpath.ts`, `src/data/poses.json`, `tools/build-poses.mjs`). El usuario la probó: «en rifles no vi mucha mejora» (pendiente pedirle qué esperaba).
- Culatas en pistolas y revólveres al ~15 % (generador: `KIT_SHARE.pistol` 0.04, `hgStock` y `CARBINE_STOCK_P`); tests `kit.test.ts` y `polish22b.test.ts` con mínimos bajados (aprobado). Suite completa en verde antes de esto (40 ficheros, 284 tests).
- Registro de sesión en navegador: F10 descarga un .json (en `main.ts`; sin probar en pantalla).
- Dread Bard (otro proyecto en `C:\Github\Dread Bard`): carpeta con `CLAUDE.md`, `PROMPT_INICIAL.md`, `MODO_AUTONOMO.md`; lo lleva otro chat con Haiku.

## En marcha / cola (orden, sin solapar `src/`)
1. Encargo 30 agarres (agente en curso): anclajes, NaN, pistola con culata a dos manos, encuadre de la mano de apoyo; capturas en `.delegaciones/capturas/`. Revisar capturas antes/después, `tsc`, tests.
2. Encargo 32 equipamiento GLB (agente en curso): `raw/pack9_equipo/`.
3. Encargo 31 retículas unificadas (escrito, sin lanzar; lanzar cuando acabe el 30): quitar retículas de los modelos de 10 ópticas del kit, catálogo `src/game/reticles.ts`, un solo dibujo `#reddot`.
4. Integrar equipamiento GLB en el juego por lotes (torreta, escudo, cúpula, mina, gancho primero).
5. Extender poses de recarga a las demás clases (pistola/revólver, escopeta, subfusil, francotirador, ametralladora) si el usuario valida.
6. Llevar al juego el dron, la torreta enemiga y la máquina de bebidas; brazos y piernas del protagonista; escenarios.
7. Pendiente menor: opcional reconstruir el `.exe` (`C:\Github\_noche\exe_build`); usuario prueba en el navegador (http://localhost:5199, vite en marcha).

## Datos útiles
- Agentes: `opencode run --auto --agent coder --model opencode-go/deepseek-v4.1-flash --title X "…" < /dev/null > log &` (en segundo plano funciona; esperar con Monitor, solo cuando terminen).
- Herramientas de capturas en `.delegaciones/herramientas/capturas/` (fp.cjs, ads.cjs, manos.cjs; Playwright y vite dev en :5199; `window.__game`).
- Backlog completo: `.delegaciones/LISTA_PENDIENTES.md`.

## Añadido 23/11 ~14:50
- Cola nueva (usuario: «prefiero ambas, aunque sean sencillas»): encargo 33 (GLB del equipamiento en el juego + despliegue) y encargo 34 (gestos de mano: activar, lanzar, lanzar suave). Orden en `src/`: 30 agarres (hecho) → 31 retículas (en curso) → 37 registro de sesión automático → 35 tamaño de armas en cadera → 33 → 34. Exportación 3D (encargo 32) hecha: `raw/pack9_equipo/` con 20 GLB (la torreta sin piezas `mov_*` separadas: solo la cúpula las tiene).

- Cola: tras el 35, encargo 38 (barrido de armas por categoría, pedido del usuario: «hay muchísimas que necesitan trabajo»).

## ESTADO ACTUALIZADO 23/11 ~21:25 (lo más reciente; manda sobre lo anterior)
Usuario: quiere que trabaje todo el día sin parar y ver progreso al hablar (ver `.delegaciones/PROGRESO.md`); Claude semanal ~61 % (techo de trabajo 90 %, dejar 8–10 % libre; ver `GESTION_LIMITES.md`); hasta 4 agentes a la vez (1 en `src/` + 3 Blender); presupuesto de triángulos: soldado ≤4.000, robots ≤3.500, props ≤3.000, equipamiento ≤3.000, jefes ≤6.000. Pruebas en juego las hará él cuando haya mucho pulido; notas de sesión ya se guardan solas en Documentos\ProvingGrounds\sesiones (vite dev en :5199).
### Hecho y revisado hoy (sin commit)
Equipamiento: 20 fotos + 20 GLB + integrado en el juego con despliegue (encargo 33; 17 tipos cargan; torreta se ve bien). Retículas unificadas (31). Agarres (30, mejora parcial: la mano de apoyo asoma por abajo). Tamaño de armas en cadera (35). Registro de sesión automático (37). Culatas pistolas/revólveres ~15 % (tests kit/polish22b bajados con permiso). Modelado Blender: pilotos (dron, torreta, máquina bebidas), lote 2 (araña, rodante artillero, dispensador, recreativa, armero), rodante explosivo, escenarios (10 props, `pack12`), robots lote 3 (`pack13`: bombardero, reparador, centinela, arañita bien; sabueso y mech flojos), soldado ciber modular (`pack11`, segunda pasada aceptable aunque de bloques).
### En marcha al cerrar la sesión
- Encargo 34 gestos de manos (src). Encargo 45 rehacer sabueso y mech pesado (Blender). Revisar sus informes y capturas (`.delegaciones/capturas/gesto_*.png`, `raw/pack13_robots`).
### Cola (src, uno por vez)
1. Arreglar armas: bullpup (cañón 10–15 % del largo, `receiver`/`front` solapados ~80 %), lmg (19 solapes), pistolas (8), smg con mano <7 cm (launcher y flamethrower: el usuario dice que NO son necesarias, no crear). Datos en `.delegaciones/barrido/`.
2. Integrar en `src/` los modelos: enemigos (`dummies.ts`: cargador GLB con respaldo procedural, piezas `mov_*`; rodante artillero como tipo nuevo; rodante explosivo para el kamikaze `roller`; resto del plan en `.delegaciones/PLAN_ENEMIGOS.md`, 13 enemigos nuevos APROBADOS), props del hall y escenarios (pack10/pack12), soldado modular (pack11 + `paletas.json`).
3. Encargo 43 (Blender): humanoides con piezas propias (asesino, granadero, incinerador, invocador, berserker) sobre el cuerpo base; jefes nuevos (Colosus, Reina araña, Núcleo) después.
4. Taller tipo Modern Warfare Gunsmith: auditoría sin tocar código (lista 30). Poses de recarga para el resto de clases (usuario: «prefiero todas si el piloto sale bien»; probó el fusil: «no vi mucha mejora»; preguntarle qué esperaba). Brazos y piernas del protagonista.
5. Pendientes menores: reducir triángulos de dron/araña/rodante si el rendimiento lo pide (~3.950); reconstruir el `.exe` si lo pide; `acc:acog` y ópticas procedurales con retícula propia; la suite completa de vitest no termina en ~25 min (tests pesados + Blender): correr por ficheros.
### Reglas que sigo respetando
Sin commit/push/instalaciones salvo orden; no editar CREDITS.md; textos en español e inglés; no cambiar valores esperados de tests sin preguntar; no luces reales nuevas en la escena; sin verde en brazos; reportar «Modelo y esfuerzo» al final; el otro chat (Dread Bard, Haiku) tiene su CLAUDE.md con los mismos límites.

### Aviso 23/11 ~21:40
El usuario ve la Partisan (rifle seed 11) todavía enorme y rara tras el encargo 35: lo confirmé en la captura (más de la mitad del ancho). Encargo 46 (silueta proyectada medida + escala del arma en mano) escrito, para lanzar en cuanto termine el 34 (ambos tocan anim.ts/gun.ts).

### 23/11 ~22:15
Usuario aprobó Rapier: instalado `@dimforge/rapier3d-compat` 0.21.0 (único cambio en package.json). Encargo 47 (prototipo de físicas: ragdoll de humanoides, explosiones, props físicos, medición e informe) escrito; orden en `src/`: 34 (en curso) → 46 (tamaño de arma proyectado) → 47. Decisión: seguir en Three.js y valorar migrar de motor más adelante según el informe de Rapier (opciones comparadas: Godot o Unity si hace falta; Babylon como salto barato).

- Decisión del usuario (23/11): animar mejor TODAS las clases con las referencias y corregir agarres/dedos («animaciones en general»). Encargo 49 escrito (tandas A pistol/revólver, B shotgun/smg, C sniper/lmg/bullpup, D fusil+sprint+idle). Orden en `src/`: 46 (en curso) → 49 → 47 → 48.

- 24/11 00:10 El ajuste de tamaño (encargos 35+46) se pasó: armas lejísimas y pequeñas, antebrazos como palos (el usuario lo confirmó). Encargo 46 detenido; encargo 50 (recalibrar: volver a la posición previa al 35, escala solo para atípicas como la Partisan, con comparación medida contra `tamano_antes_*`) en curso. Después: 49 (animaciones, tandas A–D) → 47 (físicas) → 48 (armas).

- 24/11: el usuario dice que el arma en mano desentona «una barbaridad» y que no se parece a los FPS reales. Mañana aporta fotos de gameplay de armas que queden bien: con ellas se CALIBRA por clase posición, rotación y escala del arma en mano con una herramienta de comparación lado a lado (referencia vs nuestro juego). Hasta entonces, no gastar más en ajustar el encuadre (el encargo 50 solo corrige el exceso). El encargo 49 (animaciones por anclas) puede seguir. La Partisan puede ser problema de diseño del arma (bloque trasero grande, vista de frente).

- 24/11 00:50 Referencias FPS del usuario recibidas (22 capturas; copia de hojas en `.delegaciones/referencias_fps/`). Conclusión: el problema es ORIENTACIÓN y posición (arma paralela a la vista) y no tamaño: en las referencias el arma entra por la esquina inferior derecha en diagonal, cañón convergente 8–12° al centro, culata fuera de pantalla, antebrazo izquierdo saliendo del borde inferior. Encargo 51 escrito (parámetros por clase + herramienta de comparación lado a lado con medidas); orden: 50 (en curso) → 51 → 49 → 47 → 48.

- 24/11 Referencias de miras de hierro de CoD (capturas del usuario; la página del wiki devolvió 402). Encargo 52 escrito: generador paramétrico de miras de hierro (peep, ghost ring, U, V, cuadrada, plegable × poste, orejas, bola, capuchón, aro × carcasa, puntitos luminosos), regla de «imagen limpia» y asignación por clase con variedad; tras la tanda A del 48. Orden en `src/`: 50 → 51 → 49 → 47 → 48A → 52 → 48B.

- 24/11 PDF de iron sights (texto extraído con `pdftotext`; fotos no extraíbles con las herramientas actuales): añadido al 52 (puntitos que se ponen rojos sobre un enemigo, mira mejorada para pistolas, desalineación opcional como rareza, tiempos de ADS por clase 0,15–0,50 s) y nuevo encargo 53 (retículas personalizables y coleccionables: forma y color elegibles en el taller, desbloqueo por hitos, catálogo hasta 20 formas). Orden en `src/`: 50 → 51 → 49 → 47 → 48A → 52 → 53 → 48B.

## ESTADO ACTUALIZADO 24/11 ~02:30 (manda sobre lo anterior)
Claude semanal 71 % (techo 90 %, dejar 8–10 % libre); contexto de la sesión anterior 71 %: ABRIR SESIÓN NUEVA. Agente en marcha: encargo 54 (ajuste fino del encuadre: smg ancho ≥0,42, Partisan escala ≥0,78). Hecho desde el 21:25 del 23/11: 33 equipamiento 3D en el juego; 34 gestos de manos; 42/43/45 robots y humanoides (pack13, pack14); 38 barrido de armas; 50 recalibración y 51 encuadre FPS (aprobado por el usuario: «mucho mejor»; hojas en `.delegaciones/comparacion_fps/`; referencias en `.delegaciones/referencias_fps/`); 49 tanda A (pistol/revólver, recorridos reales; defecto: disco negro del manguito, orientación de muñeca sin aplicar → corrección en el propio 49 ANTES de la tanda B). Escritos y sin lanzar: 47 físicas Rapier (instalado `@dimforge/rapier3d-compat`; requisito: conservar desmembramiento en píxeles `Dummy.dismember`), 48 (prioridad 0: extraer la mira propia del modelo como accesorio y quitarla del arma; prioridad 1: bases casi enteras → candidatas a donante SOLO tras revisión del director; criterio de descarte de piezas con tope de triángulos orientativo; lanzagranadas/lanzallamas NO), 52 (miras de hierro: 9 familias de alza, «imagen limpia», puntitos de tritio solo en eras scifi/modern, sin desalineación), 53 (retículas personalizables y coleccionables). Orden en `src/`: 54 → 49 (corrección + B, C, D) → 47 → 48A → 52 → 53 → 48B. Otras: integrar enemigos/props/soldado en el juego (PLAN_ENEMIGOS.md: 13 enemigos nuevos aprobados); taller tipo Gunsmith (auditoría); poses de recarga restantes; brazos y piernas del protagonista; rediseño de enemigos humanoides si hace falta. Regla de revisión: mirar yo las capturas antes de dar por bueno un cambio visual. Decisiones del usuario: no migrar de motor por ahora (se valorará con el informe de Rapier); la escopeta mejora un 25 % al apuntar (no tocar); lo de la desalineación NO.

## LEER PRIMERO: `TRASPASO_COMPLETO_24-11.md` (24/11 ~03:00) contiene todo el contexto, reglas, decisiones del usuario y cola. Manda sobre lo anterior.
