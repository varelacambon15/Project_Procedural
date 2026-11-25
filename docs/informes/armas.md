# Tarea 13 — Posición de las armas, animaciones y gunplay (`opus/armas`)

Por petición del usuario se ha trabajado **todo el apartado y todas las clases de una vez** (no por categorías), con
la herramienta de validación primero. Las hojas de contactos de cada clase y acción están en `docs/informes/img/`
(prefijo `armas_`), a 960×470 y 1280×720, con armas reales del generador.

## Qué se ha hecho
1. **Herramienta de validación** (`tools/capture/vmcap.mjs`, ver su README): secuencias de ≥16 fotogramas por acción
   (reposo, disparo, sacar, recarga táctica y en vacío, inspección, ADS) a los dos tamaños, anclas medidas por
   fotograma y hojas de contactos. Para capturar fotograma a fotograma, `main.ts` tiene un modo manual
   (`__game.step(dt)`, `debug.manual`/`debug.noDraw`), que no afecta al juego normal.
2. **Posición en cadera por objetivos en pantalla** (`src/game/hipframe.ts`, `anim.json` → `frame`). Antes cada
   clase tenía constantes que cada arma interpretaba a su manera: las largas salían «altísimas» y las pistolas, con la
   mano en el borde. Ahora, para cada arma real (con sus accesorios), se calcula la pose que pone la empuñadura y la
   boca donde están en las referencias (empuñadura abajo a la derecha, boca en x 0,55–0,56, y 0,55). En pistolas y
   revólveres se fija la dirección del cañón (≈19° arriba, 7° hacia dentro), porque fijar la boca los ponía «en vela».
   Las armas voluminosas se alejan en proporción a su grosor (ametralladoras con tambor, bullpups, escopetas gruesas).
   **Reconciliación de referencias:** los vídeos muestran pistolas casi verticales al centro-derecha; las 22 capturas
   muestran diagonales desde la derecha. Se ha seguido cada fuente para su clase: armas cortas casi verticales con la
   boca alta, y largas en diagonal desde la esquina.
3. **Brazos**: los dos antebrazos entran en diagonal por el borde inferior (el izquierdo ya no es un poste vertical) y
   el brazo derecho cuelga del codo (antes pasaba junto a la cámara como un bloque).
4. **Animación por poses clave** (`src/game/vmpose.ts`, `src/game/vmtracks.ts`): pocas poses por acción con curva de
   llegada (anticipación → acción → pausa → golpe seco → asentado con micro-rebote), con pivote en la mano derecha, que
   **nunca suelta la empuñadura**. Sustituyen a los recorridos remapeados de otros juegos (siguen en el repo, apagados).
   - Pistola: sube y gira el brocal hacia la izquierda, el cargador cae, la izquierda entra en diagonal con el nuevo,
     palmada y bajada en ~0,4 s. En vacío, la palmada suelta la corredera bloqueada (estilo MW2019): pasar la mano
     por encima de la corredera hacía que el antebrazo tapase media pantalla.
   - Revólver: abre el tambor, boca arriba y caen las vainas, se tumba, la izquierda trae el cargador rápido (se ve con
     sus balas), lo mete, cierra con la palma y vuelve.
   - Subfusil, fusil, bullpup, ametralladora, francotirador y escopetas de caja: plantilla común por clase. El cargador
     sale y, en la táctica, va a la cartuchera en la mano; en vacío cae al suelo. El nuevo llega en la mano y entra con
     golpe seco. En vacío se cierra con una palmada al retén del cerrojo, porque ir a la palanca de carga, junto a la
     cámara, dejaba un poste en mitad de la vista.
   - Escopeta de tubo: pista generada con las MISMAS fases que el sonido; un cartucho rojo visible por vuelta de la
     mano a la ventana de carga (bajo el cajón; antes cargaba en la punta del tubo) y bombeo al final si estaba vacía.
   - Inspección y sacar: por clase, sin acercar el arma a la cámara.
5. **Gunplay** (`src/game/gunfeel.ts`): tabla por clase con referencias de Apex (wiki oficial) y CoD:

   | Clase | ADS (manejo 50) | Sacar | Recarga táctica / vacía (manejo 60) |
   |---|---|---|---|
   | Pistola | 0,16 s | 0,30 s | 1,47 / 1,65 s |
   | Revólver | 0,19 | 0,36 | 2,42 (cargador rápido) |
   | Subfusil | 0,21 | 0,38 | 1,89 / 2,46 |
   | Fusil | 0,26 | 0,48 | 2,31 / 3,00 |
   | Bullpup | 0,27 | 0,50 | 2,52 / 3,15 |
   | Escopeta | 0,27 | 0,52 | por cartucho (sin cambios) |
   | Francotirador | 0,42 | 0,62 | 3,05 / 3,96 |
   | Ametralladora | 0,45 | 0,72 | 3,57 / 4,28 (antes ~4,6 / 4,6) |

   Antes todas las clases apuntaban en ~0,18 s, sacaban igual de rápido y la recarga en vacío duraba lo mismo que la
   táctica. **No se ha tocado**: la dispersión (escopetas incluidas), el retroceso y su patrón, el balanceo al andar ni
   la respiración. No hay desalineación de miras.

## Tests y verificación
- Nuevos: `tests/hipframe.test.ts` (los objetivos se cumplen en pantalla a cualquier aspecto; las voluminosas se
  alejan sin mover la mano), `tests/vmpose.test.ts` (pistas ordenadas, empiezan y acaban en reposo, cargador en su
  sitio, giro máximo ≤ 14 rad/s con la duración real —el criterio anti «manos locas»—, escopeta por cartucho, tabla de
  tiempos). Siguen verdes: `anim`, `vmfit`, `hipsize`, `encuadre51`, `gunplay`, `poses`, `optic_ads`, `handhold` y `grip`.
  `npx tsc --noEmit` limpio. No se ha cambiado ningún valor esperado de un test existente.

## Lo que NO me convence (honesto)
- **Manos**: el brazo GLB da manos de bloques; en pistola el pulgar derecho asoma por encima de la empuñadura, y el
  agarre en C del revólver cruza los dedos en «X». En el modelo (`raw/pack16_brazos/brazo_fps.glb`) cambiaría:
  falanges redondeadas con más segmentos, palma más estrecha, pulgar con su eje en la base (hoy gira raro), y manga
  más fina y cónica hacia la muñeca, con la boca de la manga cerrada (cuando el antebrazo apunta a la cámara se ve un
  aro oscuro).
- Cuando la mano izquierda entra desde abajo con el cargador, la manga se ve grande unos fotogramas.
- La escopeta de tubo junta mucho las dos manos cerca de la empuñadura mientras carga.
- **ADS de la ametralladora 799A**: al apuntar, la tapa del cajón tapa la vista. Ya pasaba antes (con el ADS completo
  la pose es la misma que antes); es la línea de mira de ese modelo.
- **No verificado**: los nombres exactos de las notas del usuario (JPV-904, Ox 586, Krait…), porque buscarlos por
  nombre entre miles de semillas era lento. Sí están verificadas sus clases, con varias armas por clase, con y sin
  óptica. Tampoco se ha probado en GPU real ni con ratón y mando reales; los tiempos se han medido con paso fijo.
- Recargas especiales que siguen como estaban: escopeta basculante y revólver de portilla.

## Pendiente / decisiones del usuario
- **Puños en reposo y golpes**: sin tocar, a la espera de las referencias de Apex que pide el brief.
- **Vídeos y capturas de referencia**: se ha trabajado con los catálogos de `.delegaciones/`. Con los vídeos se podrían
  ajustar los tiempos fotograma a fotograma.
- **Retroceso**: propuesta, no aplicada porque la sensación actual gusta. Bajar un 20 % la patada por disparo de los
  subfusiles y subir la recuperación de las ametralladoras para que el spray sea más controlable. Decide el usuario.
