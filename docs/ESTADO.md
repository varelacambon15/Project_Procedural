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
- No recrear juegos existentes. No editar CREDITS.md.
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
- Pendiente de decisión del usuario: repositorio público o de versiones (comando SteamOS y botón de actualizar).

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
