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

## Lista de pendientes del usuario (en orden)

1. Pulir las animaciones de las armas, recarga incluida. Recargas propias para las escopetas de doble cañón
   (basculante: abrir, sacar los cartuchos, meter dos y cerrar) y para los revólveres de acción simple (amartillar el
   martillo a mano en cada disparo y cargar por la portilla, cartucho a cartucho).
2. Armaduras equipables: casco, torso y parte inferior, con variantes, efectos y valores de reducción de daño. Los
   diseños los pasará el usuario más adelante (preparar el sistema: ranuras, botín, inventario, efectos).
3. Repasar las armas una a una (agarre, tamaño, encuadre) con hojas por tipo y corregir; el usuario mandará correcciones
   por modelo. Variedad en las bases de modelo entero (SMG sobre todo).
4. Pulir las animaciones de recarga (no están mal, pero se pueden mejorar).
5. Hecho (ronda 37): la pausa, el inventario y los demás menús paran el mundo.

## Ronda 38 (rama `ccr-9154dbc6-lqpjb5`, después de la 0.18.0; aún sin publicar como versión)

Todo esto está subido y con tests (141) y build en verde. **No se ha publicado versión nueva**: la última es la 0.18.0.

### Hecho
- **Visor en primera persona y agarres** (referencias del usuario de CoD y Destiny):
  - las armas se ven desde atrás;
  - pistolas más cerca, con la muñeca recta (`ARM_DATA.wristStraight`, `HandPose.straight` en `arms.ts`) y agarre en C a dos manos;
  - armas voluminosas más lejos (`bulk` = `AssembledWeapon.height`; `rearMax` y `adsGrip` en `anim.json`).
- **Sonidos:** cada arma tiene una muestra de disparo fija; los golpes y patadas que fallan hacen un silbido de aire.
- **Hall reorganizado:**
  - el hall es la zona de inicio y el campo de tiro está en la sala del fondo;
  - la arena de supervivencia está cerrada y se entra desde su ordenador;
  - un ordenador por modo de juego;
  - puerta sellada que pide 4 piezas;
  - botón «Volver al hall».
- **Rendimiento:**
  - AO de contacto asíncrono por franjas y precalentado de shaders;
  - la geometría de la incursión se fusiona (`mergeStatic`);
  - sombras cada 2 fotogramas y apagadas en incursiones;
  - en Ajustes: escala de render y contador de FPS.
- **Defensa:** ritmo más rápido, arena de 78–100 m, 3 anillos de plataformas, terminal junto al núcleo para adelantar la oleada y aviso al estar sobre una plataforma.
- **Incursión y hack** (`raidgen.ts`, `hackgen.ts`):
  - resumen al terminar;
  - hack por sectores: mapas de 5 salas, guardián, mejora y decidir entre extraer o bajar más; reglas por sector desde el sector 2;
  - temas: centro de datos, fundición, laberinto, arena y biolab;
  - plantas en L, T, U y cruz;
  - pasarelas con escalera que se suben (`Player.STEP` 0,42; `groundAt`);
  - pasillos en zigzag y relieve en las paredes.
- **Enemigos:** rodillas, codos, paso natural, silueta propia por tipo y volumen de soldado acorazado.
- **Miras de hierro de serie** en armas largas: se apunta a través de ellas.
- **Equipamiento** (sección nueva, separada de las granadas; `gadgets.ts` para los datos y `gadgetfx.ts` para los efectos):
  - controles: **LB / tecla X** = equipamiento, **RB / G** = granada, **LB+RB / V** = súper. Hay una ventana de 0,12 s para pulsar los dos a la vez (`input.ts`: `bumpT`, `bumpLock`);
  - **20 tipos:** torreta, escudo, cúpula, orbe, gancho, mina, gravedad, campo lento, salto, baliza, cuchillo, cargas en cadena, arpón, señuelo, fallo, munición, inyector, propulsor, teletransporte y **inyección temporal** (`chrono`: todo menos tú a cámara lenta);
  - rareza de común a legendaria; las cargas se recargan con `GrenadePouch` (`gpouch` en main.ts);
  - pestaña «Equipamiento» en el inventario y `#gadgethud`;
  - se empieza con una torreta común;
  - **cae como botín** (12 %, misma rareza que el arma: `dropGadget` y `pickGadget` en main.ts) y se vende en la tienda;
  - máximo 8 piezas;
  - ficha común: `gadgetCard` en `ui/common.ts`.
  - El usuario **no quiere granadas como equipamiento**: con dos legendarias se podrían usar sin parar.
- **Tienda:** 6 huecos de armas (`shop.json` `showcase.slots`) más **2 huecos extra** que ofrecen granada, equipamiento o armadura, nunca dos del mismo tipo en una ronda (`extraKind` en `ui/shop.ts`).
- **Súperes** (`supers.ts`, `supers.json`, `superfx.ts`; ahora hay 22):
  - nueva **Detonación de núcleo** (`core`), inspirada en la Super Ki Explosion: te blindas y recibes solo el 15 % del daño mientras cargas; luego estalla una esfera de 13 m;
  - nuevo **Torrente de cristal** (`torrent`): chorro de 3 s desde la palma, unos 70 cristales/s, poco daño cada uno, atraviesan enemigos; va envuelto en un **rayo amarillo** cónico (`beamTick`);
  - la **Dilatación temporal se sustituyó por Parada del tiempo** (`timestop`):
    - 7 s fijos con el mundo congelado;
    - imagen: negativo de 0,45 s y luego sepia (CSS `body.timestop` y `body.tsinv`);
    - sonido sintetizado: zumbido, gong, tictac cada segundo y barrido al reanudarse (`timeSnd` en main.ts);
    - las partidas guardadas con `chrono` pasan a `timestop`.
- **Inventario con mando:** pulsar un arma ya no la equipa. Ⓐ la coge, y Ⓐ sobre la ranura 1 o 2 la deja ahí (`grab` en `ui/inventory.ts`). Siguen los botones «Equipar en 1/2».
- **Asistente del hall** (`src/game/hallbot.ts`):
  - pantalla con cara en la **pared derecha del hall** (x = 24, z = 9), mirando hacia dentro. El usuario no la quería sobre el campo de tiro;
  - **11 estados de ánimo con cara propia** (tabla `FACES`): contento, neutro, eufórico, chulito, curioso, sorprendido, triste, dolido, enfadado, furioso y dormido. Las formas se interpolan;
  - **si le disparas** (`userData.onShot`, que se llama desde `gun.ts` al impactar en algo del mundo):
    - se pone roja, frunce el ceño, tiembla y aparecen interferencias;
    - suelta **groserías** (`bot.shot.*`); a partir de 5 tiros, más fuertes (`bot.rage.*`), con dientes y una vena palpitante;
    - el enfado baja solo y al final perdona con retintín (`bot.forgive.*`);
  - otras reacciones:
    - comenta al volver de una incursión ganada o perdida, y al subir de nivel (`event()`);
    - curiosidad si te acercas (`bot.near.*`);
    - si lo ignoras unos 70 s se aburre y se duerme, con zetas (`bot.bored.*`); al mirarle o acercarte se despierta sobresaltado (`bot.wake.*`);
  - para que parezca vivo: respira, parpadea a ritmo irregular (a veces doble), mueve los ojos a saltitos, te sigue con la mirada y ladea la cara;
  - **la voz cambia con el ánimo**: enfadado, más grave y rápida; triste o dormido, más lenta;
  - la cara se dibuja en un canvas: ojos que parpadean y siguen al jugador, y boca que se mueve al hablar;
  - habla con la **síntesis de voz del navegador** (`speechSynthesis`, es-ES o en-US) y también pone subtítulo;
  - al entrar en el hall te **saluda por tu nombre**, como mucho una vez cada 90 s; además suelta una frase cada 45–85 s (`bot.idle.*`, 14 frases);
  - **Ajustes:** «Tu nombre» (`settings.playerName`) y «Voz del asistente» (`settings.botVoice`).

- **Objetos del hall** (`src/game/hallprops.ts`; se crean en main.ts como `hallProps` y sus puntos de uso se añaden a `world.interactables`):
  - **Armero** (pared izquierda, z = 7,5): enseña en 3D las 6 primeras armas del almacén (`inv.storage[0..5]`); al usarlo se abre el almacén;
  - **3 drones de mantenimiento** que patrullan, se apartan del jugador y huyen si les disparas; el asistente los defiende (`bot.drone.*`, `defendDrone`);
  - **Radio** (mesita en la pared frontal): emisoras Ambiente (la pista de siempre), Neón FM y Pulso 118, generadas con Web Audio, y Apagada (`setMusicOn` en audio.ts);
  - **Máquina de bebidas:** 15 CR, +15 % de cadencia y velocidad durante 60 s (usa `injectT`);
  - **Fuente de agua** y **tablón de anuncios** (consejos `hb.tip.*`);
  - **Saco de boxeo** que se balancea con tiros y golpes (`meleeProp` en gun.ts: los golpes también avisan a los objetos con `userData.onShot`);
  - **decoración:** bancos, macetas, cajas y 4 carteles.
- **Zona de entrenamiento y de pruebas en el campo de tiro:**
  - los 3 muñecos pasan del hall al pasillo lateral, pasada la línea de tiro;
  - delante hay un **círculo de pruebas** (`world.testZone`): dentro, la súper está siempre cargada y el equipamiento no gasta cargas;
  - carteles colgados del techo.

- **Recoger del suelo** (armas, granadas, armaduras y equipamiento; `pickT`, `PICK_HOLD` = 0,45 s y `equipFromGround` en main.ts; `Frame.useHeld` en input.ts):
  - **pulsar** usar (Ⓧ / E) lo guarda, como antes;
  - **mantener** lo equipa en lugar de lo que llevas: el objeto vuela girando hasta la mano (`flyToHand`) y el arma anterior pasa a la mochila, o se tira al suelo si no cabe;
  - en el mando, tocar Ⓧ sobre un objeto del suelo ya no recarga.

- **Tienda de mobiliario** (terminal «MOBILIARIO» en la pared derecha del hall, cerca de la entrada; `openFurniture` en main.ts):
  - catálogo `FURNITURE` en `hallprops.ts`, con 18 objetos, precio, nivel mínimo y categoría (ocio, utilidad, vida y decoración);
  - lo comprado se guarda (`inv.furniture`, `SaveData.furniture`) y aparece en el hall al momento (`hallProps.apply`, que pone y quita colisiones, blancos y puntos de uso);
  - **gratis:** el asistente, el armero y el propio terminal. **Se vende** todo lo demás, incluido lo añadido antes: drones, radio, bebidas, fuente, tablón, saco, bancos, macetas, cajas y carteles;
  - **objetos nuevos:**
    - acuario holográfico con peces animados;
    - televisor con noticias y rótulo que se desplaza;
    - diana de dardos (si le disparas o golpeas te da la puntuación; `onShot` recibe ahora el punto de impacto);
    - rótulo de neón que parpadea;
    - alfombra;
    - cafetera (10 CR: recarga el equipamiento);
    - máquina recreativa con demo animada;
    - **robot aspirador** (`roomba`; sustituye a la mascota robot, y las partidas con `pet` pasan a `roomba`): recorre el hall rebotando contra los muebles y deja un rastro de suelo limpio que se desvanece; si le disparas dice «¡Ay!» con voz y subtítulo (`bot.ouch`/`hb.ouch.*`), gira sobre sí mismo y su luz se pone roja;
  - al comprar, el asistente lo celebra (`bot.furn`).
- **Animación de muerte** (`src/game/deathfx.ts`):
  - al morir, una mano enguantada sube delante de la cara y se desintegra en píxeles desde los dedos (un plano de recorte que baja y cubitos aditivos que se sueltan);
  - la cámara cae y se inclina, y la imagen pierde el color (CSS `body.dying`);
  - dura 2,6 s y luego se aplica lo de siempre según dónde estés (`hurtPlayer`);
  - mientras dura no hay control.

- **Acabado del hall** (`world.ts`, bloque «Acabado arquitectónico»):
  - fuera las franjas naranjas que recorrían las paredes y cruzaban las puertas (hall, campo de tiro y sala B). Al usuario no le gustaban;
  - añadidos: zócalo, friso inferior con remate metálico, pilastras con tira de luz vertical, moldura en el techo, marcos gruesos en las puertas (campo de tiro y sala B) con franja luminosa, y banda oscura en el suelo junto a las paredes;
  - todo se corta en los huecos de las puertas.
  - El usuario pide en general que el **mapeado y los escenarios** se parezcan más a un juego real; queda mucho por hacer (ver pendientes).

- **Más detalle en el hall:** techo con casetones, conductos laterales y bandeja de cables; pasarela de rejilla de la entrada a la puerta del campo de tiro; tuberías con válvulas en la pared frontal; rejillas de ventilación; extintores; 4 cámaras de seguridad que giran (`cams`); reloj de pared con la hora real (`drawClock`).
- **Sala B convertida en sala de mando** (rótulo «SALA DE MANDO»):
  - estrado circular con mesa holográfica: planeta de malla y anillos que giran (`holo`);
  - pantalla de misión gigante en la pared del fondo;
  - 4 bancos de consolas con pantallas de datos;
  - columnas con tiras de luz, techo con casetones y pasarela de rejilla desde la puerta.
- **Pendiente del repaso de escenario:**
  - campo de tiro: mamparas, raíles de blancos, focos y paredes acústicas;
  - incursiones: mobiliario que cuente algo, escombros y desgaste;
  - iluminación por zonas;
  - un mostrador de recepción en el hall.

- **Repaso de miras y apuntado** (auditoría con `scratchpad/adsaudit.cjs`: equipa 6 armas por tipo, apunta y proyecta el punto de mira en pantalla):
  - **antes:** pistolas, revólveres y muchas armas sin mira apuntaban «estilo Black» (arma a un lado, sin alinear), con desvíos de 30 a 400 px; varias armas largas con miras de hierro quedaban muy por debajo del centro;
  - **ahora:** todas las armas auditadas quedan a 0–2 px del centro;
  - **cambios en `assembler.ts`:**
    - si los alzadores no dan para nivelar alza y punto, el punto de mira sube lo necesario, hasta 10 cm (antes iban los dos al máximo y el punto quedaba bajo);
    - la línea de mira pasa por la punta del punto de mira cuando difiere poco del alza;
    - las pistolas y armas sin miras usan una línea de mira por el lomo, o por sus miras propias si las traen;
    - las pistolas modulares tienen alza en la parte trasera;
    - si el cajón asoma detrás del alza, la línea sube;
  - **cambios en `gun.ts`:** las pistolas y los revólveres también apuntan a través de esa línea (`irons`);
  - **cambio en `anim.ts`:** el ojo queda a 6,5 cm detrás del alza (antes a 2,5 cm, y cualquier desajuste se veía enorme);
  - **retirada la M60** (`w-m60`): el modelo está descentrado (todo fuera del eje) y apuntaba de lado.
  - Pendiente: la mira trasera «rústica» de algún subfusil se ve como un bloque grande delante; revisar su modelo.

### Tests cambiados (avisado al usuario)
- `tests/supers.test.ts`: número de súperes 20 → 22, y el test de módulos (`slice` e índice) ajustado.
- `tests/shop.test.ts`: huecos de armas del escaparate 5 → 6.

### Pendiente o en curso (por orden)
1. **Súperes y categoría legendaria.** El objetivo es **25 súperes: 20 normales y 5 legendarias.**
   - **Legendarias:** la Nova espiritual (`spirit`) seguro. Las otras 4 que propuse: orbital, cañón de riel, parada del tiempo y vórtice. **El usuario aún no lo ha confirmado.**
   - **Falta montar la categoría legendaria:** botín raro (cofre del guardián o piezas de la puerta sellada), marco dorado, más potencia y carga más lenta.
   - **Propuestas sin elegir:**
     - mías: golpe sísmico, espejo (dos copias holográficas) y cadenas de energía (el daño se reparte);
     - inspiradas en las definitivas de Xenoverse 2: cañón final, esfera de la muerte, tormenta gigante, andanada total, ataque fantasma, impacto definitivo, disco destructor doble y explosión de planeta. Yo recomendé cañón final, esfera de la muerte (posible legendaria) e impacto definitivo.
   - El usuario manda referencias concretas (enlaces a la wiki de DBXV2) y yo las adapto «a la realidad del juego»: energía y tecnología, sin copiar.
2. **Equipamiento:** no tiene sonidos propios (el hook `sound` de `gadgetfx` no hace nada) y no hay desbloqueo por progreso. Se propusieron desguace y mejora de rareza con chatarra, que está sin hacer.
3. **Asistente del hall:** sin probar con voz real (en Playwright no hay voces). Posibles mejoras: frases según el contexto (vuelta de una incursión, poco dinero, súper nueva) y elegir la voz.
4. Ya anotado antes:
   - los enemigos cuerpo a cuerpo no llegan al jugador cuando está sobre una pasarela;
   - miras en LMG y escopetas generadas por código;
   - diseños de armadura;
   - crafteo con chatarra.
5. Publicar versión (0.19.0) cuando el usuario lo pida o al cerrar un bloque grande.

## Ronda 36 (versión 0.16.0): pack 5, sonidos nuevos, animaciones por tipo y visor

- Pack 5 del usuario (`raw/pack5`, ids `x-p5-*` en el pack kit39): MG338, RPD, MG4HK (lmg), LPM1, LPM4 (fusil), VSV,
  DUPLET (francotirador), MAGNUM (revólver de acción simple), SR410 (escopeta de tambor) y ESC1 (bombeo). Piezas
  sueltas como donantes (`x-lib5-*`: 4 empuñaduras, 5 guardamanos, 4 culatas) y accesorios del pool (`lp5`: agarres,
  bocachas, miras, bípode). "sci-fi realista" → era scifi. Revisar en juego: la LPM1 salió con una culata rara en el lote.
- Sonidos: 63 disparos nuevos (`disparo_gh_*` / `silenciado_gh_*`) recortados de las grabaciones largas del usuario
  (scratchpad `cutshots.py`: inicio de cada disparo por la envolvente, el que más hueco tiene detrás, fundido final y
  loudnorm); pistola, revólver (sin silenciado), subfusil, escopeta, francotirador, ametralladora; el M27 también en fusil.
- Enemigos: animaciones por tipo (`Dummy.animStyle`), visor continuo en banda curva (también la araña).
- Test del banco (mira en francotirador): busca un francotirador sin raíl en vez de la semilla 1 (cambia con modelos nuevos).

## Ronda 35 (versión 0.15.0): referencias de Coded Arms, patada, granadas como armas y enemigos pulidos

- Referencias del usuario (capturas de Coded Arms y Destiny): soldados con casco y visor luminoso, venas de luz,
  suelos hexagonales, molduras de neón, columnas de luz y paneles holográficos de datos.
- Enemigos humanoides de oleada/incursión como soldados (casco y visor por tipo `VISOR`, hombreras con emblema,
  chaleco, bolsas, mochila, rodilleras, botas; venas `veinMat` en lanzador, élite, comandante y fallo). Brazos que se
  balancean y zarpazo al atacar. Araña con las patas bien (muslo arriba, tibia al suelo, pasos en trípode).
- Muerte: cae hacia donde le dispararon (`deathDir`, rodillas que ceden, rebote) y luego se desintegra (0,85 s después).
- Desmembramiento: la pieza sale volando entera girando, muñón luminoso, fogonazo de cuadrados, más fragmentos,
  pausa de 130 ms, sacudida y crujido grave.
- Patada (Z / R3, configurable): pierna en primera persona, 55 de daño y empuje fuerte, con puños o con arma.
  Puños: golpe sordo (no el sonido de cuchillo).
- Granadas con el formato de las armas: `grenadeCard`/`grenadeTile` (common.ts) en tienda, inventario y suelo; en el
  suelo ya no se recogen solas: aviso y usar (como las armas). Fotos de 320 × 140 de lado.
- Escenario: `simtex.ts` (hexágonos que se repiten y paneles de datos). Arena de oleadas oscura con neón (suelo
  hexagonal luminoso, molduras rosa/cian, columnas de luz con remates rojos, paneles holográficos); incursiones con
  suelo hexagonal, columnas y paneles y paletas más oscuras; vestíbulo con columnas cian y paneles suaves (sigue claro).

## Ronda 34 (versión 0.14.0): controles, arena de oleadas, estética de simulación y pulidos

- Controles (Opciones → Controles): correr/apuntar/agacharse en modo mantener o alternar, invertir eje vertical,
  sensibilidad al apuntar y del mando, teclas configurables (`settings.binds`, `Input.binds`) y botones del mando
  configurables (`settings.padBinds`, `DEFAULT_PAD`): por defecto como Call of Duty (Ⓧ pulsar = recargar, mantener =
  recoger/usar con progreso en el aviso; Ⓐ saltar, Ⓑ agacharse, Ⓨ cambiar, RB granada, LB súper, L3 correr).
  Arreglado: en mando, saltar, recargar y cambiar de arma no tenían botón.
- Oleadas: arena generada (`arenagen.ts` puro + `arena.ts`): coberturas al azar al empezar (cajas, muros, pilares,
  barreras, pilones de datos) y cada 5 oleadas, tras el jefe, se reconfigura un poco (suben, se hunden o se deslizan;
  cambia el color de acento). Se lanza desde el ordenador de la sala de oleadas, como antes.
- Incursión: salas con estilo (cajas, pilares, filas de servidores, ruedo), altura propia y decoración de paredes;
  suelos con rejilla del color de acento. Firma sonora sintetizada de cada súper (`SIG` en main.ts).
- Estética de simulación (Coded Arms) del complejo, de día: rejilla luminosa fina en el suelo, pistas de circuito en
  las paredes (emisivo, sin luces) y partículas de datos que suben; de noche se apaga (la ciudad tiene sus neones).
- Manos: palma más redondeada con talón, base del pulgar y nudillos. Legendarias: vetas luminosas finas del color de
  la rareza en el cajón y el cañón (material `legendvein`, se respeta en `applyFinish`).
- Bípodes del pack 4: ya estaban integrados (ronda 18).

Pendiente: realismo de pistolas; pulgar (comprobar en juego); armas lejanas caso por caso; ajuste de progresión y
dificultad con partidas reales; nuevas súperes (el usuario elegirá de la lista).

## Ronda 33 (versión 0.13.0): enemigos nuevos (inspirados en las familias de Coded Arms, sin bichos)

- Robots (`Kind.shape`, `Dummy.buildRobot/animRobot`): dron centinela (vuela a 3,2 m, dispara esferas y se mueve de
  lado; ojo = punto débil), araña robot (seis patas que dan pasos, se abalanza), bomba rodante (luz que parpadea más
  rápido al acercarse; explota al llegar sin dar recompensa, o sobre los suyos si la matas: `selfDestruct`,
  `gun.explode`) y torreta desplegada (estática, cabeza que gira; núcleo trasero = punto débil).
- Guardián con escudo (`Kind.shield`, zona "shield": 8 % del daño y chispas; piernas ×1,5), tirador (`gun: "rifle"`,
  ráfagas de 3 balas rápidas, se mueve de lado) y francotirador (`gun: "sniper"`: láser rojo 1,2 s y bala a 110 m/s,
  esquivable moviéndose).
- Médico (cura al aliado más herido con un rayo verde), comandante (aura de 10 m: +25 % velocidad y +30 % daño a los
  suyos, `buffT`) y fallo de código (salta cada 2–4 s y es intocable mientras salta).
- Aparecen en oleadas generadas (`extraWave`) y en las salas de incursión (`roomEnemies`). Nombres en i18n `dummy.*`.
- Arreglado: el destello de impacto de la ronda 32 apagaba la rejilla luminosa de los muñecos (`baseEm`).

## Ronda 32 (versión 0.12.0): respuesta de los enemigos a los impactos

- `Dummy.react(zone, point, dir, dmg, crit)` (llamado desde `gun.hooks.onHit` en main.ts): inclinación del cuerpo con
  muelle según la dirección y la zona, cabeza que va hacia atrás, pierna que flexiona; destello emisivo (más fuerte y
  amarillo con críticos); partículas por tipo (chispas en blindados/casco, fragmentos pixelados en la cabeza, polvo y
  trozos en el resto); marcas de impacto pegadas a la pieza más cercana (máx. 14, se borran al morir).
- Al morir: empuje en la dirección del disparo y caída hacia atrás mientras se desintegra (`deathOff/deathTilt`).
  La peana de los muñecos de práctica va en el grupo (no se inclina ni se desintegra).
- Barra de vida con el daño reciente en blanco (`.hptrack .lag`) que baja tras 0,4 s.
- Sonidos de impacto sintetizados por zona (`Gun.hitSound`: cuerpo, cabeza, metal, baja).
- Hitstop: el mundo se para 50 ms al matar (120 ms jefes) y 25 ms con críticos (`hitstop` en main.ts).
- Números de daño: los seguidos al mismo enemigo se suman en uno; críticos más grandes con rebote.
- Gravedad cero sin levitación del jugador (decisión del usuario).

## Ronda 31 (versión 0.11.0): 15 súperes con módulos y modo desarrollador

- 5 súperes nuevas: Torreta centinela (se planta delante y dispara 20 s al más cercano), Gravedad cero (`Dummy.lift`:
  flotan indefensos y caen con daño), Dilatación temporal (`sfx.timeScale`: enemigos, sus esferas y sus golpes a
  cámara lenta; filtro de pantalla `body.chrono`), Sanguijuela (cables que drenan a 5 enemigos y curan) y Holograma
  señuelo (`Waves.decoy`: los enemigos van a por él y luego estalla).
- Módulos: las súperes se desbloquean (`inv.supersOwned`, `hasSuper`); probabilidades en `MODULE_CHANCE` (supers.ts):
  0,3 % por baja, 1,2 % grandes, 6 % jefes, 6 % cofres de incursión, 25 % (+10 %/dificultad) jefe de incursión; la
  primera incursión completada da uno seguro (`inv.raidsDone`). Repetido = 400 CR. Partidas anteriores conservan la
  súper que tenían elegida. Sin módulo, el HUD del súper no aparece.
- Modo desarrollador (Opciones → Desarrollador, `settings.dev`): todas las súperes y siempre cargadas; atajos +1 y +10
  niveles, +10.000 CR, desbloquear todos los módulos y reiniciar la primera incursión.

## Ronda 30 (versión 0.10.0): niveles, 10 súperes e incursiones

- **Niveles a lo Borderlands** (`src/game/progress.ts` puro + `src/data/progress.json` números; tests/progress.test.ts):
  nivel 1–100 con experiencia (bajas de oleada e incursión según tipo y nivel del enemigo, oleadas superadas,
  contratos cobrados). Las armas nuevas salen a ±2/+1 niveles del jugador (`rollWeaponLevel`, en `rollWeapon` y en el
  escaparate con la semilla); un arma de nivel superior hace menos daño (−12 %/nivel, mínimo 40 %; aviso en la ficha).
  Los enemigos de oleada van al nivel del jugador (+1 cada 5 oleadas): vida `enemyHealthMult` y daño
  `enemyDamageMult`; la vida del jugador sube un 3 % por nivel. Partidas antiguas: empiezan al nivel de su mejor arma.
  HUD `#xphud` arriba a la izquierda. Se guarda en `SaveData.progress` (`inv.progress`).
- **Árbol de habilidades** (pestaña Progreso del inventario): un punto por nivel; ramas Tirador, Superviviente y
  Táctico (rangos de 8 y una habilidad final que pide 15 puntos en la rama). Efectos en `perks()` → `applyPerks` en
  main.ts (`gun.perks`, `PlayerHealth.setMax/regenMult/delayMult`, `meter.gain`, `sfx.power/span`,
  `player.speedMult`, recarga de granadas, Segundo aliento en `hurtPlayer`). Reiniciar cuesta 25 CR × nivel.
- **10 súperes**: Nova ígnea, Estasis (`Dummy.freeze`, más daño recibido), Bombardeo orbital (punto al que se mira:
  hook `aim`), Enjambre buscador (misiles), Égida (cura y −65 % de daño: `sfx.guard`), Ojo letal (críticos
  asegurados: `buff.crit`), Vórtice (atrae con `Dummy.drag` y colapsa). Animaciones en supers.json (`index` = cierre
  del índice para señalar). Viñetas de pantalla para Ojo letal y Égida (`body.deadeye/aegis`).
- **Incursiones** (ordenador de la sala B, interactuable "raid"): `raidgen.ts` (puro, tests/raid.test.ts) genera una
  cadena de salas en cuadrícula de 46 m con pasillos, salas laterales de botín (cofre que suelta 2 armas), coberturas
  y el jefe (`warden`) al final; `raid.ts` lo construye en x = 700 (sin luces nuevas), cierra las puertas con
  barreras al entrar en una sala de combate y las abre al acabar. Enemigos con un segundo `Waves` (`mobs`,
  `spawnAt`). Opciones: duración 4/6/8 salas y dificultad Normal/Difícil/Pesadilla (+0/+1/+2 niveles, más enemigos,
  premio raro/épico/legendario). Al ganar: arma, créditos y experiencia y vuelta al vestíbulo en 6 s (el botín del
  suelo viene contigo); al morir, vuelta al vestíbulo sin perder nada.

Pendiente: ajustar el ritmo de subida de nivel y la dificultad con partidas reales; más variedad visual en las salas
de incursión (decoración, alturas, tipos de sala) y enemigos propios de incursión; sonidos propios de los súperes.

## Ronda 29: manos redondeadas y súperes (habilidades)

- **Manos** (`arms.ts`): dedos y pulgar ahora son cápsulas (`phalanx`), más finos y redondeados que las cajas anteriores.
- **Súperes** (`supers.ts` datos puros + `supers.json` números + `superfx.ts` efectos): tres, elegibles en la **pestaña Habilidades** del inventario
  (se guarda en `SaveData.superId`): **Sobrecarga** (9 s: +50 % daño, +35 % cadencia, sin gastar munición), **Onda de choque**
  (explosión de 520 de daño en 15 m con empuje) y **Tormenta eléctrica** (7 s de rayos sobre enemigos cercanos que saltan a los vecinos).
- **Carga**: +8 % por baja de oleada (+35 % jefe) y 1 / 240 s pasivo; no carga mientras se invoca o hay un efecto activo. Se invoca con **V**, cruceta arriba o el botón táctil ✦. Barra en pantalla (`#superhud`).
- **Invocación en primera persona**: un único flujo (`SuperFx.cast`) reproduce la línea de tiempo del súper: manos (posición, giro, cierre de dedos),
  FOV, inclinación de cámara y arma que baja (`Gun.superPose`, `Arms.override`); en el instante `hit` se dispara el efecto. Sin luces nuevas: mallas aditivas.
  Para pulir una animación se editan las claves de `src/game/supers.json` (hay una nota `_help` con el significado de cada campo).
- Tests: `tests/supers.test.ts` (datos coherentes, muestreo, medidor). Pendiente: panel de ajuste en directo (F9), sonidos propios y animaciones más finas.

## Ronda 28 (relevo): música, barras de vida, mira y modificadores

- Punto de mira: flecha (chevrón) al esprintar; escopeta = círculo limpio (0,65× el radio, sin punto ni marcas);
  francotirador sin mira salvo al apuntar (`aimT` ≥ 0,4).
- Modificadores de oleada (`wavemods.ts`, `Waves.mod`): desde la 3.ª, 40 % de las oleadas sin jefe llevan uno:
  rápidos (+50 % velocidad), duros (+80 % vida), enjambre (+10 pequeños), sin regeneración, golpes letales (+70 % daño).
  Pagan ×1,3–1,5 los créditos de fin de oleada; aviso al empezar y nombre en la barra de vida del jugador.

- Barras de vida (dummies.ts): ya no están siempre visibles, como en Borderlands o Destiny. Se ven al mirar al
  enemigo (cerca de la mira) o tras dañarlo: 5 s los normales, 9 s élites, resistentes y grandes, 12 s el jefe (que
  mantiene su barra grande arriba mientras vive).

- `assets/music/ambient-03.ogg` sustituye a ambient-02 (que se retiró; sigue en el historial de git): la canción de
  ejemplo del usuario (19 min), pasada a OGG con bucle sin corte (cola y cabeza mezcladas 8 s), paso alto 30 Hz,
  paso bajo 6,5 kHz y loudnorm −27 LUFS. Pesa 11 MB. Es provisional hasta que el usuario pase la definitiva.

## Ronda 27 (relevo, versión 0.8.9): granadas

- Granadas equipables (`src/game/grenades.ts`, tests/grenades.test.ts): tipos frag, incendiaria, descarga, racimo,
  singularidad y adhesiva; rareza común–legendaria (daño, radio, cargas, recarga). Sin granada equipada no se lanza
  nada; las cargas se recargan solas (`GrenadePouch`).
- Lanzamiento y efectos en `src/game/grenadefx.ts` (parábola, rebote, mecha, destello sin luces, sonidos del pack).
  Teclas: G, RB del mando y botón táctil ✹. Indicador `#nadehud` con cargas y recarga.
- Se consiguen: en la tienda, ocupando a veces un hueco del escaparate (≈ 1 de cada 6 huecos, `nadeAt`), y como
  botín de enemigos de oleada (20 % de los drops que tocan, en lugar del arma; se recogen al pasar por encima).
  No salen en cápsulas ni como premio de oleada (decisión del usuario). Se equipan y venden en el inventario (hasta 8).
- Modelo `assets/grenade/grenade.glb` (del usuario) en `src/game/grenademodel.ts`: color del cuerpo por tipo, anillo y
  brillo por rareza, proporciones por tipo; fotos para tienda e inventario (`grenadeThumb`, `fillNadeThumbs`).
- Inventario: las granadas son fichas como las armas (`nadeTileHTML`): ranura G junto a las armas (arrastrar para
  equipar), el resto en la mochila, ficha de detalle (`nadeCard`) y soltar al suelo; se venden en la tienda (un tercio
  del precio del escaparate). Corregido: el jefe seguía lanzando ráfagas tras parar las oleadas (`Waves.stop`). Se guardan en `SaveData.grenades` / `grenadeActive`.

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
