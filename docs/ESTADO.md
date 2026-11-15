# Estado del proyecto (para retomar en otro chat)

Léelo al empezar una conversación nueva: resume reglas, mapa del código y lo pendiente.

## Reglas fijas del diseño

- Enemigos solo con vida. Elementos: fuego, eléctrico y explosivo. Sin escudos, ranuras de inventario, audio
  procedural ni semillas.
- No tocar balance base, economía ni rarezas fuera de lo que se pida.
- Luces de color o sci-fi solo en legendarias (detalle de latón en gatillo o palanca, nunca boquillas de color).
- Sci-fi = "arma moderna de última generación": polímero, raíles, formas anguladas. Nada de celdas, aletas o pantallas.
- Armas nuevas = piezas que varían bases existentes, no modelos casi idénticos.
- Un arma es nueva por la combinación de piezas distintas. Si una combinación sale mal montada, se arregla el montaje;
  nunca se cambian sus piezas por las de la base (eso la convierte en una copia de la base).
- No recrear juegos existentes. No editar CREDITS.md: los créditos los lleva el usuario (si algún día se publica,
  acredita él). No preguntar por créditos ni licencias de los packs.
- Commits pequeños con `npm test` y `npm run build` en verde; los tests existentes no cambian sus valores.
- No publicar ni compilar distribuible sin permiso.

## Mapa del código

| Área | Ficheros |
|---|---|
| Generador de armas | `src/weapons/generator.ts` (variación, kit, cuerpo, estadísticas, `muzzleOptions`) |
| Pistolas y revólveres procedurales | `pistolgen.ts` (datos, arquetipos, mutaciones, siluetas), `pistolmesh.ts` (malla), `loft.ts` |
| Piezas por código | `procparts.ts` (culatas, guardamanos tubo/raíles/ranuras, añadidos de era) |
| Montaje y materiales | `assembler.ts`, `finish.ts`, `accessories.ts` |
| Agarres y efectos | `grip.ts`, `recipes.ts` + `src/data/recipes.json` |
| Juego | `src/game/` (gun, anim, shop, economy, save, ui) |
| Datos ajustables | `src/data/shop.json`, `loot.json`, `anim.json` |
| Banco de pruebas | `bench.html` → `window.__bench` (`lotSheet`, `varietySheet`, `closeups`, `inspect`…) |
| Documentos | `docs/DISENO.md`, `docs/ECONOMIA.md` |

## Último estado (ronda 07)

- Revólveres reproporcionados (cañón alineado con la recámara superior) y solo compensador como accesorio de boca.
- Sci-fi rehecho como armas modernas; tambores de pistola con cuello y disco adelantado.
- Bullpups con más variedad: guardamanos de ranuras, y no se aplican siempre todos los cambios.
- Economía: morada hacia los 30 min, caja común con papel (ver `docs/ECONOMIA.md`).

## Ronda 08

- Campo de tiro de noche con neón (rejilla en el suelo, tubos, pórticos de 10/25/50 m, rótulo) y resplandor;
  Ajustes → "Campo de tiro de noche" y "Resplandor del neón". Código en `src/game/world.ts` (`setNight`) y `main.ts`.
- Brazos V1 (`src/game/arms.ts`): guantes con dedos articulados, manga con puño, reloj. Agarres de cada mano en
  `GRIPS` al final de `src/game/gun.ts` (empuñadura, bajo el guardamanos, envolviendo, vertical, coger).
- Culata esqueleto de pletina; varillas de la plegable más gruesas; brace de polímero sobre tubo; apagallamas de jaula;
  guardamanos de madera en pistolas-carabina clásicas; revólver clásico con contrapeso en vez de compensador.
- Recarga: el cargador vacío cae al suelo; la mano vuelve de la cartuchera (abajo a la izquierda de la vista) con
  el nuevo; cargador rápido en revólveres y cartucho en escopetas; el arma se inclina hacia la mano izquierda.
- Manos: disciplina de gatillo, cerrojo con la mano derecha, hombros que acompañan el retroceso.
- Noche: aristas de neón en volúmenes, números de calle, pared de la zona de equipo; tecla L alterna noche/día.
- Tests: si el contenedor va justo de memoria, `npx vitest run --minWorkers=1 --maxWorkers=2`.

## Ronda 09 (estilo)

- Noche = callejón urbano propio (`src/game/nightcity.ts`): paleta morada y rosa, ladrillo rojizo, asfalto mojado,
  rótulos de neón con reflejo, cielo con luna y edificios; toques de simulación (columnas de datos, pilares de luz).
  Nada de rejillas tipo Tron. De día sigue la sala cubierta.
- Referencias de estética del usuario: callejón cyberpunk morado/rosa y shooters de simulación de PSP (interiores
  técnicos con neón rosa/rojo y cian, hologramas, suelos hexagonales, HUD cian segmentado). Estilo propio inspirado.
- Punto de mira: anillo fino, punto central y cuatro marcas diagonales.

## Ronda 10

- Noche = recinto de campo de tiro (muros altos, cubierta, deflectores, parapeto) con el tono del callejón; rótulos
  en japonés; solo 8 luces reales (el resto, halos pintados).
- Barra del jefe arriba, solo mientras se le ataca; vida del jugador abajo a la izquierda.
- Puños sin arma (`fistsInput`/`updateFists` en gun.ts): 20 / 40 al esprintar, imán de embestida corta.
- Movimiento: agacharse (C/Ctrl, R3) y deslizarse al agacharse corriendo (player.ts).
- Música: `assets/music/ambient-02.ogg`, compuesta con `tools/music/compose2.py` + `render2.sh` (sin voz; vaivenes
  de dos notas). Perfil tomado del análisis de la referencia del usuario (remake de System Shock, Medical): sin
  pulso, Si menor, oscura, muy ancha. No copiar notas ni melodías de la referencia.
- Referencias de jugabilidad del usuario: Apex y Titanfall 2 (movimiento y gunplay).

## Ronda 11 (prompt 06, versión 0.6.0)

- Armas largas por código (`src/weapons/longgen.ts` + `longmesh.ts`): 18 arquetipos (6 bullpup, 6 ametralladora,
  6 escopeta) en 4 eras; layout "proc-long". Base más repetida por tipo en 300 armas: ≤25 % (antes LMG 92 %).
- Armas del usuario: `raw/armas-pulidas` → `u-fusil-a` (modular, pack modern) y `u-bullpup-b` (entera). Conversor
  "glbparts" en tools/convert/convert.js (`npm run assets -- u-`).
- Menú: fuente proporcional, cursor oculto en reposo, Storm Caller fijo (`src/data/showcase-weapon.json`) con brillo
  y chispas. Nombres por tipo sin repetir. Hojas con luz de contorno.
- Cargadores: solo se cambian por otros de forma parecida y solo se alargan los rectos. Tope de 6 cambios.

## Ronda 12 (jugabilidad, versión 0.6.6)

- Rendimiento: `mergeStatic` (src/game/merge.ts) funde mallas por material; las armas del suelo ya no traen luz
  (cambiar el número de luces recompila todos los shaders: congelones). El número de luces es fijo (8 lámparas).
  Oclusión de contacto (`src/weapons/ao.ts`) 2,5x más rápida y memorizada por especificación de arma.
- Manos: los brazos van fijos al arma; la mano izquierda se suaviza en el espacio del arma (gun.ts, `leftLocal`).
- Partida nueva sin nada: 0 CR (`newGameCredits`) y solo puños. Los muñecos de práctica pagan por daño
  (`practice` en shop.json: 1 CR / 100 de daño, tope 20 CR/min). `startCredits` queda para la simulación.
- Mapa 2: instalación clara (hormigón, paneles gris claro, franja naranja, paneles de luz, carteles legibles),
  muñecos naranjas, zona de entrenamiento con 3 muñecos para los puños (pared izquierda del vestíbulo) y sala de
  oleadas aparte detrás de la puerta del fondo (`wavesRoom` en world.ts; salir de la sala detiene las oleadas).
  El día es lo predeterminado; la noche sigue como opción (al usuario le gusta la idea: seguir trabajándola).
- Inventario: arrastrar armas entre las ranuras, la mochila y la zona de soltar (cae al suelo).

## Ronda 13 (versión 0.6.8)

- Tienda: compra de un clic, sin arma básica gratis; partida nueva con 200 CR. Venta de armas (`sell` en
  shop.json, por rareza; los accesorios montados pasan al banco), con historial "+CR".
- Almacén (puesto donde estaba Inspección): 40 huecos (`inv.storage`), solo visible en su puesto
  (`openScreen("inventory", true)`); se guarda con la partida (área "storage").
- Balanceo del arma con la velocidad de giro filtrada (anim.ts); retícula que se abre al disparar (`crossKick`,
  solo visual). Shaders de armas nuevas compilados en segundo plano (`prewarm`).

## Ronda 14 (pulido de armas, versión 0.7.0)

- Regla del usuario: no hace falta aprovechar todas las piezas; solo las que encajan de forma natural. Cada arma su
  propia cosa, reconocible pero no idéntica, y sobre todo pulida y natural. Cañones largos o cortos sí valen (variedad).
- Bases retiradas del sorteo (`RETIRED` en generator.ts): v-ppsh-drum, w-f2000, p-machine-gun-2. Kit: guardamanos
  liso k-handguard-556-01 (`KIT_RETIRED` en kit.ts; sigue siendo la referencia de serie).
- Modelos del usuario u-*: no prestan piezas; normales con pliegue. Pendiente: versión limpia de TAR-21 y ARX.
- `BASE_SIZE`: escala propia de compactos (MP5K, MP7…). `INTEGRAL_STOCK`: culatas integradas (P90…) con estirado suave.
- Pistolas: culatas solo macizas (carabina y madera corta con curvas), sin tubo en la boca. Escopetas sin supresor.
- Asa: patas hasta el cajón, baja. Carrillera: cuña biselada. Banda ventilada con alma. Cargadores de alto parecido.
- Arma en mano: empuñadura a distancia fija por clase (`gripZ` en anim.json). Armas apiladas: arreglado (`equipSeq`).

## Ronda 15 (versión 0.7.3)

- Regla del usuario: mejor adaptar las piezas que descartarlas. El guardamanos liso del kit vuelve, vestido con raíl,
  ranuras y remate (`dressHandguard` en assembler.ts). El ARX (u-fusil-a) presta culata, empuñadura y cargador.
- Fusiles del kit: culata por código maciza (sólida, polímero, carabina o esqueleto ancho) en el socket de la culata.
- Revólveres: culata solo como kit de carabina, con cañón alargado. Bullpups por código: cargadores curvos con forma real.
- APK Android (Capacitor, en release.yml) con controles táctiles (`src/game/touch.ts`).
- Distribución: el repositorio sigue privado y las versiones se descargan a mano desde GitHub (decisión del usuario:
  sin comando de SteamOS ni botón de actualizar).

- Bullpup: no es categoría propia (decisión del usuario). Se muestra y se filtra como fusil; en el sorteo es una
  variante de fusil (25 %). Internamente conserva su tipo "bullpup" (piezas, animación, estadísticas).

## Ronda 26 (relevo): contratos y sala B

- Contratos (`src/game/contracts.ts`, tests/contracts.test.ts): 3 diarios (cambian cada día) y 2 semanales (cada
  lunes), deterministas por fecha. Tipos: bajas con un tipo de arma, a la cabeza, a distancia, con los puños, llegar
  a una oleada, oleadas sin daño, jefes de oleada. Avanzan con `contractEvent` en main.ts (último impacto de cada
  enemigo en `lastHit`); al cumplirse, aviso; se cobran en el tablero del vestíbulo (x −4, interactuable
  "contracts", pantalla `#contracts`). Se guardan en `SaveData.contracts` (opcional; partidas antiguas sin él).
- Sala B: amplia (60 × 60 m) y vacía, a la derecha del vestíbulo (puerta en la pared derecha, z 16–20), sin luces
  nuevas (paneles emisivos); se llenará más adelante.

## Ronda 25 (relevo): criba de modelos

- `WHOLE_OUT` (generator.ts): 53 modelos que ya no salen como arma completa (criba del usuario); sus piezas siguen
  como donantes dentro de su familia. `RETIRED` (fuera del todo, piezas incluidas): u-fusil-a, u-bullpup-b,
  z-submachinegun-03 y p-submachine-gun-1 (las P90 del revés), x-subfusil-10, w-f2000, p-machine-gun-2.
- Familia de intercambio = pack + era (`sameEra`, con `AssetEntry.era` o `baseEra`): culatas, guardamanos,
  empuñaduras y cargadores. Los cargadores salen de todo el pack (no solo de las armas completas); los de tambor
  de subfusil (v-m3gg-drum, v-ppsh-drum) valen aunque cambie la altura.
- Orientación: `FLIP_FIX` en tools/weapon-jobs.mjs invierte `flipX` de z-assaultrifle-01, z-submachinegun-02/03,
  p-machine-gun-1, p-submachine-gun-1/5 y v-ppsh-drum (reconvertidas; ya apuntan a +X).
- Música: assets/music/ambient-02.ogg suavizada con ffmpeg (graves −9 dB, 2,5 kHz −8 dB, paso bajo 3,8 kHz, eco
  corto, loudnorm −26 LUFS): nivel y graves como la canción de ejemplo del usuario, sin agudos ásperos.
- Revólver: siempre el disparo del Python. Banco: `modelSheet(desde, n, ids)`.
- Armas de modelo que quedan: pistol 33, revolver 13, smg 31, rifle 30 (+4 bullpup), shotgun 25, sniper 24, lmg 3
  (más las generadas por código). Eras: modern 107, classic 39, scifi 15, rustic 2.

## Ronda 24 (relevo)

Hecho:
- Escopetas: con cargador (la pieza cuelga bajo el cajón) cambian el cargador; con tubo meten los cartuchos que faltan
  (`anim.reloadOverride`, tiempo y sonido por cartucho) y solo bombean si estaban vacías.
- Desmembramiento solo con el golpe que mata. Vender un arma ya no pasa sus accesorios al banco (desguazar sí).
- Revólver: pasos de recarga sincronizados con la animación del tambor; disparo según calibre (Judge solo pesados).
- Miras de serie de los packs: desde la 0.8.4 no se montaban; ahora se añaden y se apunta por ellas
  (`AssetEntry.ownSight`, calculado en tools/own-sights.mjs; alza → miras de hierro, punto rojo, holo, prisma, visor).
  Miras de hierro desmontables con más peso al generar (40 % cuando caben).
- Oleadas: `caster` (lanza esferas de energía; `Waves.orb`, sin luces), `sturdy` y `elite` en las generadas; jefe
  `warden` cada `bossEvery` (5) oleadas con barra grande arriba siempre visible (`alwaysBar`) y ráfagas de 5 esferas.
- Mapa: 48 m de ancho, campo hasta 82 m (línea de 75 m y más coberturas), vestíbulo hasta z 28, sala de oleadas
  60 × 73 m; muñecos de entrenamiento y jefe del campo recolocados. Máquinas con más detalle (sin luces nuevas).
- Banco: `__bench.modelSheet(desde, cuántas)` = hoja de criba con cada modelo tal cual.

Pendiente: respuesta del usuario a la criba de modelos (8 hojas); manos y pulgar (prioridad).

## Ronda 23 (relevo): pack de sonidos

Hecho:
- `assets/sonidos/` (pack del usuario, OGG; LEEME.md y manifest.json). Selección en `src/game/sounds.ts` (sin DOM,
  con tests en tests/sounds.test.ts); carga y reproducción en `audio.ts` (`initSounds`, `loadSamples`, `sample`,
  `playSample`, `fadeOut`). Carga perezosa: el manifest al arrancar y las muestras de cada tipo al equipar un arma.
- Disparo (`Gun.sampleShot`): muestra al azar del tipo (silenciada con silenciador), grave a 0,5, tono ±4 %,
  volumen ±10 % × `volumen_sugerido`; un disparo a menos de 0,25 s del anterior corta su cola con fundido.
  Si no hay muestra cargada, la síntesis de siempre (`layeredShot`). Lanzagranadas y lanzallamas: síntesis.
- Recarga: variante fija por arma (`pickReload` por la semilla); cada paso suena en su fracción `en`.
- Ciclo: `cycleKind` por `accion` (cerrojo, bombeo, martillo en revólver de acción simple); `gun.actionOf` lo da
  main.ts. Seco con `seco`. Casquillo, melee (puños), recoger arma y explosión desde `efectos`.
- `lejano` sin usar todavía: los enemigos no disparan (atacan cuerpo a cuerpo).
- Pulgar de la mano derecha: cierre máximo sin atravesar la empuñadura (`fitCurls` devuelve también el pulgar).

Pendiente: probar la mezcla de volúmenes en juego; `scifi_storm_psr` para armas sci-fi; corredera sin uso.
- PRIORIDAD (usuario): pulgar que atraviesa las empuñaduras (el ajuste de `fitCurls` no está comprobado en capturas) y
  rehacer las manos (dedos más finos y redondeados, menos separados; hoy parecen bloques).

## Ronda 22 (relevo): pistolas y revólveres en mano, guardamonte de revólver

Hecho (con el visto bueno del usuario sobre las capturas):
- Pistolas y revólveres más cerca (`gripZ` 0,22), más arriba y algo más al centro (`hip` [0,11, −0,123]).
- `gripAnchor` (anim.json, solo pistol/revolver): en cadera se colocan por la empuñadura (`gripY` del modelo), no
  por el centro: todas con la mano a la misma altura (un cargador largo o un tambor ya no suben el arma).
- Probado y descartado: girar el arma en reposo (boca abajo y hacia dentro); al usuario le pareció peor.
- Guardamonte de revólver: el tramo trasero baja pegado al frente de la empuñadura siguiendo su inclinación (antes
  quedaba un hueco y parecía una grapa colgando) y es algo más grueso.

Pendiente:
- Dedos: cierre ajustado a cada empuñadura al equipar (`Hand.fitCurls`, `fitCurl` en gun.ts). Guardamonte de
  revólver acotado al fondo del armazón (antes, gancho abierto con tambores cortos).

## Ronda 21 (relevo, versión 0.8.6): miras de hierro desmontables

Hecho:
- `raw/miras_hierro` → `assets/weapons/iron/` (los GLB se copian) y `manifest.iron` (`npm run assets -- iron`).
- Accesorio de mira `iron:<juego>` (estadísticas de `acc:iron`, zoom ×1,1). `generator.ironOptions`: tipo compatible,
  el arma con `raíl_superior` y `raíl_frontal`, y alzadores en rango (`ironRisers`, cálculo del LEEME). Se prefieren
  las de la era del arma; en era clásica también valen.
- Montaje (`assembler`, `ironNode`): alza en el `raíl_superior` del cajón/cuerpo y punto en el `raíl_frontal` del
  guardamanos montado (con su estirado). Si el cajón o la culata asoman por encima de la línea justo detrás del alza,
  se suben los dos alzadores lo mismo. La pieza "mira" del modelo se oculta. Las ópticas de los packs se apoyan ahora
  en `raíl_superior`.
- Apuntado (`sight = "irons"`): por el centro de la mirilla, zoom ×1,1, sin retícula; el ojo a 2,5 cm del alza
  (`sightX` del modelo), como en un shooter moderno; si así la mano de la empuñadura caía en el plano de la cámara (tapaba
  la vista), el ojo se retrasa a 6 cm por detrás de la empuñadura.

Pendiente:
- Mezclar alzas y puntos del mismo subtipo (variedad), y miras de hierro en pistolas (pocas pistolas llevan mira).
- Música: el usuario la prepara aparte y la pasará.

## Ronda 20 (relevo, versión 0.8.5): menús en Android

Hecho:
- Menús en móvil apaisado (`@media (max-height: 520px) and (orientation: landscape)` al final de menus.css): dos o
  tres columnas como en escritorio (en una sola, la ficha tapaba la lista y había desplazamientos anidados), letra
  más pequeña, tienda con 3 ofertas por fila, banco en 3 columnas, desplazamiento táctil en cada columna.
- En táctil (`body.touch`): sin la barra de teclas (Enter/Esc…) y el aviso abajo y pequeño dentro de los menús.
- Botón/gesto "atrás" de Android: plugin `@capacitor/app` (se instala en release.yml) → `backButton` cierra el menú
  abierto o pausa. Antes Android cerraba la app.
- Nombres de los accesorios de la biblioteca y del pack 4 (salían como "Factory sight"): su tipo; nuevo `acc.bipod`.
- Pruebas táctiles: `Input.synthesizeScrollGesture` no desplaza en el contenedor (ni en una página de control); usar
  `Input.dispatchTouchEvent` (touchStart/touchMove/touchEnd) para comprobar el desplazamiento.

Pendiente:
- Revisar en un móvil real el resto de pantallas (ajustes, partidas guardadas, diálogos).
- Acercar pistolas y revólveres (`gripZ` 0,29 → 0,25), pendiente del visto bueno. Miras de hierro (D).

## Ronda 19 (relevo, versión 0.8.4)

Hecho:
- Fusionada la rama `assets-miras-hierro` (solo raw/): pack 2 (`x-p2-*`, 7 armas con `accion`), `raíl_frontal` en
  todos los packs y `raw/miras_hierro/` (aún sin integrar: el usuario pidió dejarlo para más adelante).
- Reconvertidas todas las armas `x-` (~95 + piezas sueltas): `AssetEntry.anchors` (raíl_inferior, raíl_superior,
  raíl_frontal, boca…), `stockAcc` (accesorios de serie del pack 4) y `era`.
- Agarre y bípode en el `raíl_inferior` real cuando el guardamanos es el propio (`railT`); si no, bajo el tramo grueso.
- Accesorios de serie: bocacha/mira de serie en su hueco (60 %), agarre de serie (70 %), bípode de serie; las de serie
  entran en las listas de opciones de su arma (`serie()`), así se pueden desmontar y volver a montar.
- C (sin las miras de hierro): en los packs del usuario la pieza "mira" del modelo es decorativa; sin mira del pool se
  apunta estilo Black y, con una montada, la pieza se oculta. Ya no se ofrecen las miras de otros modelos como óptica.
- `subfusil_3`, `_4` y `_8` se quedan (decisión del usuario); solo se retira `x-subfusil-10`.

Pendiente:
- D: miras de hierro desmontables (`raw/miras_hierro`, LEEME con el cálculo de alzadores; zoom ×1,1).
- La óptica se apoya en el perfil del arma, no en `raíl_superior`: con el asa del G36C oculta puede quedar alta.
- Acercar pistolas y revólveres (propuesta: `gripZ` 0,29 → 0,25), pendiente del visto bueno del usuario.

## Ronda 18 (relevo, versión 0.8.3)

Hecho (revisión de las hojas p4 y lib2):
- Parecido: las despiezadas por encima del 90 % se vuelven a mezclar con 2 piezas ajenas (`mixLong(..., more)`), y
  si ninguna arma de modelo baja de 0,9, `generate` la descarta y genera otra (hasta 5; `generateOne`). Culata y
  guardamanos se cambian más que la empuñadura; más amplitud de largo (`rollTweaks`). Sigue la regla de 1-2 piezas.
- Retirada `x-subfusil-10` (el "Hound": deforme con cualquier pieza). Las hojas no repiten base (como los cofres).
- Agarres: solo bajo el tramo grueso del guardamanos, en su cara inferior; nunca en era clásica.
- Bípodes reales del pack 4 (`k-bipod-l…`, slot Bipod, `Tweaks.bipod`) desplegados hacia la punta del guardamanos;
  sin la varilla por código en el kit del usuario. Sin culata plegada en el kit (quedaba como una placa).
- Culatas sueltas de la biblioteca solo en armas largas (no en subfusiles).
- Eras: `era_sugerida` del manifest de cada arma → `AssetEntry.era` (la Mosin y la Nagant son clásicas).
- `accion` en todos los tipos (`actionHint`): pistola semi/auto/cerrojo (Welrod: arquetipo `bolt`, peso 0),
  revólver simple (heavy) / doble (standard), subfusil, fusil, ametralladora, francotirador y escopeta.
- Profundidad: fuera el búfer logarítmico (caro en Android); las calcomanías usan `decal()` (polygonOffset) en
  world.ts y nightcity.ts. Las lámparas siguen parpadeando a propósito.

Pendiente:
- D (miras de hierro desmontables, raíl_frontal, packs actualizados): faltan los archivos (miras_hierro.zip y los
  packs con raíl_frontal no llegaron). C (apuntado solo por miras del pool; mira del arma decorativa) va con D.
- Pack 2 (RB-454, SG-226, VK-45, RD-556, DV-762, SR-1216, LS-556) y el kit de revólveres: no están en el repo.
- Accesorios de serie del pack 4; acercar armas lejanas (con capturas antes).
- `x-subfusil-3`, `-4` y `-8` se quedan (decisión del usuario); solo se retira `x-subfusil-10`.

## Ronda 17 (relevo)

Hecho:
- Packs 3 y 4 del usuario en `raw/pack3` y `raw/pack4`: 27 armas (ids `x-p3-*`, `x-p4-*`) en el pack del juego
  `kit39`, así que comparten piezas con el kit. Pack 4 no trae secciones: se miden junto al ancla (`measured` en
  `convertKit39`). Campo `accion` → `AssetEntry.action` → `actionHint` (francotirador de cerrojo/semi, escopeta
  de bombeo/semi).
- Piezas sueltas de `raw/kit39/piezas_sueltas`: culatas, guardamanos y empuñaduras como "donantes" (`x-lib-*`,
  kind `kit39part`, `AssetEntry.donor`): no salen como arma; `mixLong` las usa un 30 % y solo con junta 0,82–1,22.
  Bocachas (`k-att-<suppressor|brake|compensator|flashhider>-l…`, slot Muzzle) y agarres
  (`k-device-foregrip-l…`, slot Device) de la biblioteca y del pool del pack 4; miras del pack 4 (`-lp4…`).
- Animaciones (`anim.ts`: `boltCurve`, `pumpCurve`, `CYCLE_TIME`): cerrojo en cuatro tiempos (0,8 s; mano derecha a
  la manilla, arriba, atrás, adelante, abajo), bombeo seco (0,55 s), golpe al asentar el cargador, recarga táctica
  (`tactical`: quedaban balas) sin montar la palanca.
- Parpadeo del mapa: `logarithmicDepthBuffer` (near 0,02 / far 300 no separaba marcas del suelo y carteles) y
  `normalBias` en la sombra. Reloj del brazo sin verde.
- `baseSilhouette` de las despiezadas: solo con las piezas que lleva (fallaba si se le quitaba la mira de serie).
- Capturas: `window.__game` (juego) y `window.__bench.lotSheet(n, tipos, 1, "", "x-p4-")` (banco).

Pendiente / abierto:
- Bípodes del pack 4 sin integrar (no hay sistema de bípode como pieza; el "bipod" actual es por código).
- Accesorios de serie del pack 4 (`accesorios_de_serie`) no se montan por defecto.
- Algunas culatas macizas de la biblioteca quedan bastas en subfusiles; vigilar en juego.
- Revisar la recarga en juego (las capturas por software no dejan ver la mano de apoyo en movimiento).
- Acercar las armas que se ven lejanas (pedido del usuario), caso por caso.
- La conversión de armas tarda ~1-2 min por arma: lanzarla en segundo plano por filtros (`x-p4-`, `x-lib-`…).

## Ronda 16 (versiones 0.7.4 – 0.8.2) y relevo

Para retomar en otro chat: rama `ccr-9154dbc6-lqpjb5`. Antes de subir: `npm test` (si va justo de memoria,
`npx vitest run --minWorkers=1 --maxWorkers=2`) y `npm run build` en verde. Publicar: subir `version` en package.json,
commit y push, y lanzar el workflow `release.yml` (workflow_dispatch) → Windows, Linux y APK en GitHub Releases.
Comunicación con el usuario en español de España (tuteo). Commits con el pie de atribución que indique la sesión.

Hecho en esta ronda:
- Kit del usuario v3 (`raw/kit39`, pack "kit39", ids `x-…`): 24 armas modulares y 15 enteras; conversor kind "kit39"
  en tools/convert/convert.js; `npm run assets -- x-` (≈25 min). Sin añadidos por código (generator.ts, bloque kit39).
- 16 miras de su biblioteca como miras reales del kit (`k-att-<tipo>-l…`, kind "libsight"), con `lens` y `zoom`.
  Pantalla de visor (con desenfoque alrededor) solo en miras de francotirador y térmica.
- Apuntado sin óptica estilo Black (anim.ts `iron`): el arma se acerca y zoom ×1,35; con óptica, por el centro de lente.
- Agarres: el agarre vertical siempre se usa (grip.ts `gripTraits`, `vgripAnchor` en assembler.ts); en el banco se
  elige el agarre (`gripChoices`), incluido una mano y agarre libre con deslizador (`hold.at`).
- Brazos: arreglado el retorcimiento al girar (camQ.clone en gun.ts); dedos que rodean el arma; mangas más finas.
- Oleadas infinitas (waves.ts `extraWave`), enemigos sin peana y variados (`randomLook`), arena 46 × 56 m.
- Desmembramiento pixelado con impactos muy fuertes (`Dummy.dismember`).
- Economía: cápsulas, la primera común gratis, 150 CR al empezar. Bullpup = variante de fusil (25 %).
- Android: controles táctiles (src/game/touch.ts) y menús táctiles arreglados.
- Distribución manual (repositorio privado; sin comando de SteamOS ni botón de actualizar).

Pendiente:
- Piezas sueltas de la biblioteca (culatas, guardamanos, cargadores, agarres, bocachas): montarlas en las anclas.
- Seguir puliendo manos y brazos (mano de apoyo en pistolas, forma del antebrazo) y la distancia del arma por caso.
- Campo de tiro con estilo más "Coded Arms" (pedido del usuario, aplazado).
- Encargo para el chat de kits: `docs/ENCARGO_KITS.md` (la culata de un bullpup es solo carcasa: no mezclar).

## Pendiente (prompt 06)

- Miras que no funcionan: falta auditarlas (comparar sightY con el centro de la óptica en muchas armas).
- C/D/E/F: culatas de pistola visibles en lote, guardamonte por spline, añadidos más pequeños, cachas.
- H: legendarias más distintivas. A/B/L: hoja de decisión, matriz y rehacer casos (Harrier 9, Bulldog…).
- Legendarias: el nombre es el del efecto de firma (16), por eso se repite entre tipos; decidir si cambiarlo.

## Pendiente

- Integrar packs nuevos (revólveres PSX, Semi Realistic convertidos a glb; aún no integrados).
- Seguir puliendo el realismo de las pistolas (detalle, biseles, texturas).
- Probar en juego las poses de mano en todas las armas (las capturas por software no permiten ver la recarga fluida).
- Probar en juego la economía nueva y ajustar `shop.json`.
