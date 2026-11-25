# Aportes propios (carpeta `Aportes propios/`, material del usuario de otro proyecto) — análisis 22/11/2026
La carpeta (4 GB) está **excluida de git en local** (`.git/info/exclude`) para que no se suba por accidente. Contiene formato Source/Garry's Mod: 195 modelos `.mdl`, 1.355 texturas `.vtf`, 1.318 sonidos `.wav`, scripts `.txt`/`.lua`. Cuatro paquetes: «parecidos a bf», «parecidos a mw», «parecidos a mw tre» y «puños a lo apex». Las ARMAS (modelos) no se aprovechan (habría que procesarlas al estilo del juego); sí el resto.
Herramienta: `.delegaciones/herramientas/leer-mdl.cjs` (lee secuencias de un .mdl: nombre, duración, fps y eventos de sonido).

## 1. Tiempos de referencia por clase (82 viewmodels leídos; segundos; mediana y rango)
| Clase | Recarga | Sacar |
|---|---|---|
| Pistola | 2,3–3,1 (rango 1,8–4,0) | 1,0–1,3 |
| Subfusil | 2,8–3,7 (1,8–4,9) | 0,9–1,6 |
| Fusil | 2,9–3,3 (2,4–3,7) | 1,3–1,8 |
| Francotirador | 3,3–4,6 (3,1–5,0) | 1,2–1,7 |
| Ametralladora | 3,6–6,8 | 1,2–2,5 |
| Escopeta (secuencia suelta) | 0,6–1,9 | 0,9–1,5 |
| Cuchillo | — | 1,05–1,2 |
| Equipo/granada | — | 0,8–0,9 |
Uso: calibrar los rangos de tiempo de recarga y de sacar por clase del juego.

## 2. Sincronía de sonido de la recarga (eventos con su posición en la animación)
Ejemplo AKS74U (recarga 3,24 s): golpe 19 %, cargador fuera 24 %, cargador dentro 49 %, golpe 70 %. Sacar: «deploy» 7 %, golpe 25 %. Usar estos porcentajes como valores por defecto de `reloadSnd.pasos`.

## 3. Vocabulario de animaciones que el juego aún no tiene
fire / fireburst / firesingle (cambio de modo), idle, reload y **reload en vacío** (distinta de la táctica), **último disparo** (arma abierta), **empty** (disparar en vacío), draw y **primer sacado/inspección** (inspect, en 19 modelos), silenciador puesto/quitado, cuchillo con combos (stab, midslash, left/right), granada (pullpin, throw), armas dobles (leftempty, rightlast).

## 4. Puños de Apex (`puños a lo apex`)
- Combo de **3 golpes** (izquierda, derecha, remate); los ligeros con retroceso de cámara (−1,5°, ±8°) y el remate fuerte (−7,5°, ±7°); intervalo 0,9 s por golpe; alcance 60 uds (~1,1 m); daño 40–60; marcador de impacto; animaciones propias de caminar, correr, agacharse, saltar y saltar corriendo; dirección de la fuerza distinta por golpe (izquierda, derecha, gancho/remate).
- Uso: base para los puños de inicio y el melee (encargo 04) y para las animaciones de brazos en movimiento.

## 5. Sonidos (1.318 wav, duración media 1,15 s)
Categorías por nombre: ~600 de **impactos por material** (metal, hormigón, madera, blando, cristal, plástico, rebotes y roturas), ~105 de **melee y cuchillo**, ~90 de **inspección**, ~80 de **recarga**, ~87 de **movimiento/equipo** (correr, ropa), ~54 de disparo en vacío, ~46 de cargador, ~33 de sacar. Encaja con: impactos por material (paso 14), melee, movimiento y recargas por clase. Hay que convertirlos a OGG y mapearlos a `assets/sonidos/manifest`.

## 6. Pendiente de mirar
- «Agarres»: no he encontrado datos de agarre utilizables; las poses de mano están dentro de las animaciones comprimidas de los modelos (haría falta un descompilador completo).
- Texturas `.vtf`: sin uso previsto.

## 7. Hecho el 22/11/2026
### Sonidos (solo donde faltaban; los existentes se conservan)
70 sonidos nuevos en `assets/sonidos/` (OGG mono, ~0,7 MB), cada uno con una **variación propia** (tono ±7 %, brillo, volumen, recorte y fundido; parámetros en `sonidos_variaciones.json` del scratchpad): impactos de bala por material (carne, hormigón, metal, madera, cristal, plástico, baldosa, arena: 22), pasos (hormigón, metal, rejilla, baldosa, madera: 15), sprint con equipo y salto (7), melee de puños y patadas (golpes, ganchos, uppercut, patada, rodillazo, codazo, preparar: 21) y rebotes de granada (5). Registrados en `manifest.json` → `efectos` con claves `bala_*`, `paso_*`, `sprint_equipo`, `salto`, `punos_*`, `patada`, `rodillazo`, `codazo`, `granada_rebote_*`. **Inertes hasta conectarlos** al juego (impactos: paso 14; pasos y salto: sistema de movimiento; puños: combo).
### Poses (lector propio de .mdl, sin descargar nada)
`.delegaciones/herramientas/poses/` (`mdlpose.cjs` lector de huesos y animaciones comprimidas; `exportar_poses.cjs`): recorridos de **muñecas respecto al arma** (m, ejes del juego: x boca, y arriba, z derecha), cuaterniones, **curvatura de dedos** (5 dedos por mano) y punto de apuntado (`tag_ads`), 14 muestras por secuencia. Tres bibliotecas: `poses_parecidosamw.json` (28 modelos, 186 secuencias), `poses_parecidosamwtre.json` (29, 153) y `poses_parecidosabf.json` (16, 94). Tipos: idle (agarre), draw/draw_first, inspect, reload/reload_empty, fire, melee (cuchillo), throw (granadas). Sin valores inválidos; comprobado en la recarga del AK: mano derecha fija en la empuñadura, izquierda del guardamanos al cargador y vuelta, con los dedos abriéndose y cerrándose.
### Integración propuesta (para Go)
1. Elegir por clase (pistola, subfusil, fusil, francotirador, escopeta, ametralladora, cuchillo, granada) un conjunto representativo o la media y guardarlo en `src/data/poses.json` (compacto).
2. Trasladar a nuestras armas **por anclas**, no por coordenadas absolutas: recorridos expresados respecto a la mano de apoyo en reposo y al pozo del cargador, escalados por el tamaño del arma; usar la tabla de tiempos por fase.
3. Dedos: aplicar la curvatura a la mano del juego (comprobar si `arms.ts` admite curvatura por dedo; si no, ampliarlo).
4. Verificar con tiras de fotogramas y con el registro de sesión.

## 8. Vídeo «Equipamiento desplegandose.mp4» (22/11/2026)
`Aportes propios/Animaciones y fotos de inspiracion/Animaciones armas/` · 240 MB, 1894×1026, 30 fps, ~4 min (7.368 fotogramas). Procesado con Blender (hojas de contacto a 1 fotograma/s). Es un **compendio de planos de juego en primera persona**, sobre todo de entorno: equipamiento que se despliega en el suelo (torreta con trípode, dispositivos que se lanzan y se plantan), explosiones, humo, retículos de objetivo (círculo amarillo discontinuo, marcas en cruz), visión con retícula en pasillos y planos de la muñeca con reloj. A esa resolución temporal las acciones de 1–2 s casi no se distinguen y la mano aparece poco. **El usuario lo considera solo inspiración** y aportará más animaciones y modelos. Para que sean aprovechables: clips cortos de una sola acción en primera persona (1–3 s), o modelos con animación como los .mdl (datos exactos de manos) o FBX/BVH con esqueleto.
