# Prompt de relevo: Project Procedural / Proving Grounds

> Copia todo lo que hay debajo de la línea y pégalo como primer mensaje en el chat nuevo.

---

Vas a continuar durante un tiempo el desarrollo de mi juego. Otro chat lo ha llevado hasta ahora y lo retomará
después, así que deja todo documentado y subido. Háblame siempre en **español de España, con tuteo**.

## 1. El proyecto

- **Qué es:** un *looter shooter* procedural privado, en primera persona. Las armas se generan combinando piezas
  3D: cuerpo, cañón, culata, guardamanos, cargador, empuñadura, miras y bocachas. Cada arma tiene rareza,
  estadísticas y aspecto propios.
- **Tecnología:** Three.js r160, TypeScript, Vite, Vitest (tests) y Playwright (capturas y pruebas en navegador).
  Se distribuye para Windows y Linux con Electron, y para Android en APK con Capacitor 6.2.0.
- **Repositorio:** `varelacambon15/Project_Procedural`, que es **privado**.
- **Rama:** `ccr-9154dbc6-lqpjb5`. Trabaja y sube **solo** a esta rama. No abras pull requests salvo que te lo pida.
- **Estado actual (noviembre 2026):** la última versión publicada es la **0.18.0**. Después hay mucho trabajo
  subido y sin publicar: equipamiento, súperes nuevas, tienda ampliada y asistente del hall. Está todo en
  **`docs/ESTADO.md`, sección «Ronda 38»**. Léela primero.
- **Antes de empezar:** lee `docs/ESTADO.md`. Es el mapa del código y el historial por rondas. Si vas a tocar
  kits, lee también `docs/ENCARGO_KITS.md`.

## 2. Reglas de trabajo (obligatorias)

1. **Commits pequeños**, con `npm test` y `npm run build` en verde antes de cada push.
   - Si los tests van justos de memoria, usa:
     `timeout 900 npx vitest run --minWorkers=1 --maxWorkers=2`.
   - **No cambies los valores esperados de los tests existentes sin decírmelo.** Si un test falla, arregla el
     código. Si el cambio es inevitable (por ejemplo, el número de súperes), avísame en tu respuesta.
     Sí puedes añadir tests nuevos.
   - Hay 141 tests. La batería completa tarda unos 8–10 minutos: lánzala en segundo plano.
2. **Pie de los commits:**
   - Pon al final el pie de atribución que te indique tu propia sesión.
   - No pongas identificadores de modelo en commits ni en el código.
3. **No toques `CREDITS.md`.** No hagas preguntas sobre licencias o procedencia de los assets.
4. **No recrees juegos existentes.** Se pueden tomar ideas de estilo (por ejemplo, el apuntado "estilo Black"),
   pero el juego es propio.
5. **Luces de color solo en las armas legendarias.** No añadas luces nuevas a la escena: para que algo brille, usa
   materiales emisivos o aditivos (`MeshBasicMaterial` con `AdditiveBlending`).
6. **Cuidado con el rendimiento:**
   - El número de luces de la escena debe ser **fijo**. Si cambia, Three.js recompila los shaders y el juego se
     congela unos segundos. Por eso se quitó la luz del arma tirada en el suelo.
   - Los shaders de las armas se precompilan con `renderer.compileAsync` (`prewarm` en `gun.ts`).
7. **Al terminar cada bloque de trabajo,** añade a `docs/ESTADO.md` una sección "Ronda N" con lo hecho y lo
   pendiente.
8. **Verifica visualmente lo que cambies:**
   - Monta el build con `npx vite preview --port 4173` y saca capturas con Playwright. Chromium ya está instalado:
     `require('playwright')` funciona y `chromium.launch()` no necesita opciones.
   - Guarda las capturas fuera del repositorio. No subas imágenes de prueba al repo.
   - Enséñame las fotos cuando haya algo visual.

### Publicar una versión

1. Sube `version` en `package.json` (la última publicada es la **0.18.0**).
2. Haz commit y push.
3. Lanza el workflow `.github/workflows/release.yml` con `workflow_dispatch` y ref igual a la rama
   (herramienta MCP `actions_run_trigger`, método `run_workflow`). Genera los instaladores de Windows y Linux y la
   APK de Android en GitHub Releases.
4. Unos 25 minutos después (programa un aviso con `send_later`), comprueba que la release salió bien y pásame los
   enlaces de descarga.

### Distribución

Es la **opción C**:
- El repositorio sigue privado y yo descargo a mano.
- **Sin** comando de instalación para SteamOS.
- **Sin** botón de "actualizar" en el juego.

## 3. Mis criterios de diseño (los que más importan)

### Armas
- Cada arma debe verse **natural y pulida**, no como una amalgama de piezas mal pegadas o deformes.
- Deben ser **reconocibles pero no idénticas** a armas reales.
- Que un arma salga con el cañón muy largo o muy corto está bien: es variedad.
- **No hace falta usar todas las piezas.** Usa las que encajen bien y, antes de descartar una, intenta adaptarla.
- **Estilos y texturas coherentes** entre las piezas de un arma.
- **El bullpup NO es una categoría propia.** Es una variante de fusil: un fusil sale bullpup con un 25 % de
  probabilidad.
- **La "culata" de un bullpup es solo la carcasa trasera.** No se mezcla con culatas convencionales; los bullpup
  entran enteros.
- **Retiradas del generador** (conjunto `RETIRED` en `generator.ts`): `v-ppsh-drum`, `w-f2000`, `p-machine-gun-2`,
  `u-fusil-a` y `u-bullpup-b`.
- **Los cargadores de tambor** se ven de frente: el disco queda visible desde el lateral.

### Miras y apuntado (ADS)
- **Sin óptica:** apuntado **estilo Black**. El arma se acerca y se hace zoom de ×1,35, sin alinear el alza.
  Está en `anim.ts`, parámetro `iron`.
- **Con cualquier óptica real** (punto rojo, holográfica, ACOG, prisma, visor): se apunta **por el centro de la
  lente**.
- **Pantalla de visor:**
  - Solo para miras **de francotirador** y la **térmica**.
  - No tiene marco negro: es un **desenfoque alrededor**, al estilo de *CoD Ghosts*.
  - Una ACOG con ×2 **no** es mira de francotirador: apunta a través del modelo.
- **Un arma sin mira no hace zoom de visor**, aunque sea un francotirador. Ese fallo ya se corrigió; no lo
  reintroduzcas.

### Manos y agarres
- **Si el arma tiene agarre vertical (foregrip),** la mano de apoyo lo sujeta siempre.
- **Pistolas:**
  - Si tienen agarre en V y longitud suficiente (`pistolLen ≥ 0.17`), también lo sujetan.
  - Si no, se cogen con una o dos manos en la empuñadura.
- **En el banco de trabajo (workbench)** el jugador elige el agarre: una mano, dos manos o **posición libre**
  con un deslizador a lo largo del arma.
- **Los dedos deben rodear el arma,** no quedarse abiertos. Los brazos tienen que verse refinados.
- **Colores de los brazos:**
  - manga gris pizarra `#4b5462`;
  - guante coyote oscuro `#43392f`;
  - parche naranja.
  - **Nada de verde.**
- **Inercia mínima:**
  - Al girar, los brazos solo se mueven un poco.
  - El retorcimiento de brazos se debía a que `camQ.multiply` mutaba `camQ`; ahora se usa `camQ.clone()` en
    `gun.ts`. **No lo rompas.**
- **Distancia del arma:** no debe verse ni lejana ni pequeña. `gripZ` por clase está en `src/data/anim.json`, y la
  culata nunca queda a más de 0,34 m por detrás del ojo.

### Juego y economía
- **Inicio de partida:** se empieza con **150 CR** y **sin arma básica gratis**.
- **Cápsulas** (no "cajas"):
  - la **primera cápsula común es gratis**;
  - se compra con **un solo clic**, sin confirmación.
- **Créditos por practicar:** disparar a los muñecos de práctica da créditos (`practice` en `src/data/shop.json`).
- **Venta en la tienda:** precios por rareza.
- **Estación Storage:** sustituye a la antigua "Inspect". Es un almacén de 40 huecos donde las armas se arrastran.
- **Oleadas:**
  - **infinitas**, con un 8 % más de vida por oleada extra;
  - en una **sala aparte** grande (arena de 46 × 56 m);
  - enemigos **sin peanas** y con **aspecto variado** (`randomLook`).
- **Desmembramiento con píxeles** en cabeza o extremidades cuando el daño es muy alto: tiros de francotirador,
  revólver, escopeta de cerca o una pistola con mucho daño.
- **Mapa:**
  - **de día y claro** por defecto, legible y sin neón oscuro;
  - el **modo noche** sigue como opción y se mejoró.
- **Android:** controles táctiles en `src/game/touch.ts`. Los botones de los menús ya funcionan al tocar.

## 4. Mapa rápido del código

| Zona | Archivos |
|---|---|
| Generador de armas | `src/weapons/generator.ts`: `RETIRED`, `INTEGRAL_STOCK`, `BASE_SIZE`, bloque kit39 al final de `rollOps`, `mixLong`, `opticOptions`; el bucle `vary` hace 110 intentos con amplitud máxima 2.8 |
| Montaje 3D | `src/weapons/assembler.ts` (anclas, `dressHandguard`, `vgripAnchor`, `kitZoom`, escala BASE_SIZE), `ao.ts` (oclusión de contacto con caché `memoAO`) |
| Piezas del kit | `src/weapons/kit.ts` (`KitPart` con `lens` y `zoom`, `options`), `procparts.ts` (culatas procedurales), `addons.ts`, `longgen.ts`, `longmesh.ts` |
| Agarres | `src/weapons/grip.ts` (`gripTraits`, `gripChoices`, `KIT39_VGRIP`, modo "custom" con `at`) |
| Accesorios | `src/weapons/accessories.ts` (`libAlias` para las miras de la biblioteca) |
| Arma en mano / manos (IK) | `src/game/gun.ts` (`updateHands`, `GRIPS`, `equipSeq` contra armas apiladas, `prewarm`), `src/game/arms.ts` (forma de brazos y dedos) |
| Animación y apuntado | `src/game/anim.ts`, `src/data/anim.json` |
| Mundo | `src/game/world.ts` (mapa, carteles, taquillas, sala de oleadas, lámparas), `dummies.ts`, `waves.ts` |
| Bucle principal | `src/game/main.ts` |
| UI | `src/game/ui/shop.ts`, `ui/workshop.ts` (sección de agarre), `ui/inventory.ts` (arrastrar y soltar, almacén) |
| Datos | `src/data/shop.json`, `waves.json`, `anim.json` |
| Textos | i18n: claves `sign.*`, `ui.storage*`, `shop.sell*`, `hold.*`, cápsulas |
| Conversión de assets | `tools/convert/convert.js` (kinds `kit39` y `libsight`), `tools/weapon-jobs.mjs`, `tools/build-assets.mjs`; `npm run assets -- <filtro>` (con `x-` tarda unos 25 min: lánzalo en segundo plano y escribe el manifest solo al terminar) |
| Kit del usuario | `raw/kit39/` (39 armas, `catalogo.json`, `piezas_sueltas/piezas.json`) → `assets/weapons/kit39/` (ids `x-<nombre>`) |
| Publicación | `.github/workflows/release.yml`, `capacitor.config.json` |

## 5. Tareas pendientes (por prioridad)

La lista detallada y al día está en `docs/ESTADO.md`, sección «Ronda 38 → Pendiente». En resumen:

1. **Súperes:** llegar a 25 (20 normales y 5 legendarias) y montar la categoría legendaria.
   - Legendarias: Nova espiritual seguro. Para las otras 4 propuse orbital, cañón de riel, parada del tiempo y
     vórtice; **pregúntame si no lo he confirmado**.
   - Para las normales que faltan te mandaré referencias, a menudo de las definitivas de Dragon Ball Xenoverse 2.
     Adáptalas a mi juego: energía y tecnología, nunca copias.
2. **Equipamiento:** sonidos propios, desbloqueo por progreso y desguace y mejora de rareza con chatarra.
3. **Asistente del hall** (`hallbot.ts`): frases según el contexto y probarlo con voz real.
4. Pendientes antiguos:
   - enemigos cuerpo a cuerpo que no suben a las pasarelas;
   - miras de las LMG y escopetas generadas por código;
   - diseños de armadura;
   - crafteo con chatarra;
   - posturas de armas concretas que te marque.

Cuando acabes un bloque grande, o cuando te lo pida, publica la **0.19.0**.

### Mapa del código añadido en la ronda 38
| Zona | Archivos |
|---|---|
| Equipamiento | `src/game/gadgets.ts` (tipos, rarezas, `makeGadget`), `src/game/gadgetfx.ts` (efectos y hooks), main.ts (`gpouch`, `gadgets`, `dropGadget`/`pickGadget`, `injectT`, `chronoT`), `ui/inventory.ts` (`renderGadgets`), `ui/common.ts` (`gadgetCard`) |
| Súperes | `src/game/supers.ts` (`SuperId`, `SUPER_IDS`), `supers.json` (animación y números), `superfx.ts` (efectos por id; `torrentShard`, `beamTick`), main.ts (`SIG` sonidos, `timeSnd`, `superHud`), `ui/inventory.ts` (`GLYPH`) |
| Controles | `src/game/input.ts` (LB = equipamiento, RB = granada, LB+RB = súper con ventana `bumpT`) |
| Tienda | `src/data/shop.json` (`showcase.slots`: 6 armas), `ui/shop.ts` (`extraKind`, `nadeAt`, `gadgetAt`, `armorAt`: 2 huecos extra) |
| Asistente del hall | `src/game/hallbot.ts`, `settings.ts` (`playerName`, `botVoice`), `ui/start.ts` (campo de nombre), textos `bot.*` en `src/i18n-menus.ts` |
| Incursión / hack | `src/game/raidgen.ts` (`RAID_THEMES`, formas, pasarelas), `hackgen.ts`, `raid.ts`, `merge.ts` |
| Textos | `src/i18n.ts` (súperes `sp.*`) y `src/i18n-menus.ts` (equipamiento `gd.*`, ajustes `set.*`, asistente `bot.*`). Siempre en inglés y en español |

## 6. Al terminar tu turno

- Deja todo subido a la rama, con tests y build en verde.
- Añade en `docs/ESTADO.md` una sección "Ronda N (relevo)" con lo hecho, decisiones tomadas, problemas abiertos y
  pendientes.
- Si has publicado versión, apunta el número.
- No dejes trabajo a medias sin anotarlo. El otro chat retomará desde ahí.
