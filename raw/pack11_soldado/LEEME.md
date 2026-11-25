# Pack 11 — soldado ciber: cuerpo base modular + biblioteca de piezas (encargos 40 y 44)

Soldado humanoide de **1,80 m** con seis piezas articuladas y **once piezas intercambiables**,
pensado para sustituir los muñecos de primitivas de `src/game/dummies.ts` (basic, gunner, sniper,
medic, commander, glitch, caster, elite, guardian…) con un solo diseño base que se recolorea por
código y se viste con la biblioteca. La **segunda pasada** (encargo 44) rehízo anatomía, silueta,
armadura y cascos: extremidades cónicas y articuladas, hombros más anchos que la cadera, manos
con dedos, botas con suela, placas superpuestas, correas, cartucheras y cableado, y cascos con
calota, nuca, mentonera y visera. Diseño propio, modelado por código con
`.delegaciones/blender/equipo/_comun.py` (VERSION `r1`, **sin modificar**).

## Convención

- Metros reales. **+X = frente**, **+Y arriba** en el GLB (`+Z` arriba en Blender).
- Origen del cuerpo en el suelo, entre los pies (`min.y = 0`; alto total 1,800 m).
- Lado izquierdo del soldado = **−Z** en el GLB (era `+Y` en Blender); derecho = `+Z`.
  Por eso `mov_brazo_izq` tiene el pivote en `z = −0,215` y `mov_pierna_izq` en `z = −0,105`.
- Una malla por pieza articulada. Las piezas de la biblioteca son **un solo GLB con una sola
  malla** y el origen en su punto de anclaje (nodo con traslación 0,0,0; la geometría va
  desplazada alrededor del ancla).
- Materiales Principled con **nombre de ranura fijo**: `mat_traje`, `mat_oscuro`,
  `mat_chaleco`, `mat_visor` (emisivo) y `mat_acento`. Sin texturas, imágenes, cámaras ni luces.
- **Topes comprobados leyendo los `indices` de cada primitiva del GLB** (no la escena de
  Blender): cuerpo base **3.988 / 4.000** triángulos; cada pieza **≤ 688 / 700**.

## Cuerpo base (`soldado_base.glb`, 3.988 triángulos, 1,800 m de alto)

Los siete nodos son **raíces independientes** en el GLB (no hay jerarquía): el juego puede girar
cada uno sobre su pivote sin acumular transformaciones. `pelvis` es la única pieza fija.

| malla | triángulos | pivote en el GLB (x, y, z) | qué incluye |
|---|---:|---|---|
| `mov_torso` | 820 | (0, 1,035, 0) — cintura | caja torácica en elipsoide, abdomen cónico, faja, cinturón, peto con alas, esternón, correas y hebillas, bolsillos, yugo, tirantes, collar con puertos, espaldar con puertos y cable |
| `mov_cabeza` | 616 | (0, 1,505, 0) — cuello | cuello, calota, media cáscara inferior, aro, visor enmarcado, mandíbula con rejilla, carrilleras, auriculares, cresta, raíles, antena y puerto craneal |
| `mov_brazo_izq` | 460 | (0, 1,425, −0,215) — hombro | deltoides, brazo y antebrazo cónicos, placa de brazo, codo, guarda, muñeca, guante con cuatro dedos y pulgar, nudera, luz y cable |
| `mov_brazo_der` | 460 | (0, 1,425, +0,215) — hombro | ídem, espejado |
| `mov_pierna_izq` | 608 | (0, 0,905, −0,105) — cadera | muslo cónico, placa, correa y bolsa, rodilla con rodillera, espinilla con gemelo, espinillera y luz, pistón con abrazaderas, tobillo, bota con suela, puntera y talón |
| `mov_pierna_der` | 608 | (0, 0,905, +0,105) — cadera | ídem, espejado |
| `pelvis` | 416 | — (raíz, estática) | pelvis, cinturón con hebilla, entrepierna, fundas laterales y trasera, discos y placas de cadera, luz |

Materiales usados: los cinco. Caja del cuerpo: **0,372 m de fondo × 1,800 de alto × 0,725 de
ancho** (el ancho incluye los brazos y los deltoides), con el mínimo en y = 0,000. La postura
abre las manos a ±0,31 m y los pies a ±0,14 m, con una ligera flexión de codo y rodilla.

### Elementos de detalle del cuerpo (más de 15 distintos)

Visor emisivo con ceja y montantes; mandíbula con rejilla; auriculares con aro; cresta y
raíles del casco; antena con punta emisiva; protector de nuca; puerto craneal y sensores;
peto de placas con alas laterales; esternón; correas con hebillas; bolsillos de pecho con
solapa; faja abdominal con costillas y cinturón; cartucheras laterales y funda trasera; discos
y placas de cadera; hombreras superpuestas; yugo y tirantes; collar con puertos; cableado y
puertos de espalda con aros; cables de antebrazo; placas de brazo, codo y guarda; guantes con
cuatro dedos y pulgar; placa, correa y bolsa del muslo; rodillera; espinillera con luz; pistón
con abrazaderas; botas con suela, puntera, talón y caña; tornillería.

## Biblioteca de piezas (11 GLB, una malla cada uno, ≤ 700 triángulos)

| pieza | triángulos | ancla (origen local) | se monta en el cuerpo | materiales |
|---|---:|---|---|---|
| `casco_ligero` | 600 | centro de la abertura inferior (cuello) | `(0, 0, 1,590)` sobre `mov_cabeza` | chaleco, oscuro, visor, acento |
| `casco_pesado` | 656 | ídem | ídem | chaleco, oscuro, visor, acento |
| `casco_comando` | 676 | ídem | ídem | chaleco, oscuro, visor, acento |
| `casco_francotirador` | 688 | ídem | ídem | chaleco, oscuro, visor, acento |
| `peto_ligero` | 396 | cara interior `x = 0`, borde inferior `z = 0` | `(0,135, 0, 1,140)` sobre `mov_torso` | los cinco |
| `peto_pesado` | 628 | ídem | ídem | los cinco |
| `peto_medico` | 508 | ídem | ídem | los cinco |
| `hombreras` | 368 | centro entre las dos, borde inferior | `(0, 0, 1,425)` sobre `mov_torso` | los cinco |
| `mochila_comunicaciones` | 616 | plano de montaje `x = 0`, borde inferior | `(−0,135, 0, 1,120)` sobre `mov_torso` | los cinco |
| `mochila_medica` | 576 | ídem | ídem | chaleco, oscuro, visor, acento |
| `escudo_guardian` | 452 | borde inferior central, cara interior `x = 0` | delante del antebrazo izquierdo (no va en el cuerpo base) | los cinco |

Los cuatro cascos comparten una **calota elipsoidal + media cáscara inferior redondeada** que
les da forma de casco (no una masa con placas): llevan aro, protector de nuca, mentonera, visor
fino enmarcado y cresta/raíles/antena o mira según la variante. Los petos son placas
ensambladas con alas, placas superiores e inferiores, correas y cartucheras. Las hombreras son
tres placas solapadas con canto, remache y emblema. Las mochilas llevan tapas, correas,
hebillas, paneles, antenas o tanques. El escudo se mantiene del encargo 40 (ventana emisiva,
asa y brazal). Al colocar cada pieza en el ancla indicada encaja sin corregir geometría.

## Variantes montadas (base + piezas de la biblioteca)

| GLB | piezas añadidas | triángulos | alto |
|---|---|---:|---:|
| `soldado_pesado.glb` | `casco_pesado` + `peto_pesado` + `hombreras` | 5.640 | 1,841 m |
| `soldado_francotirador.glb` | `casco_francotirador` + `peto_ligero` + `mochila_comunicaciones` | 5.688 | 1,853 m |
| `soldado_comandante.glb` | `casco_comando` + `peto_ligero` + `hombreras` | 5.428 | 1,817 m |

Las tres conservan los seis nodos `mov_*` con sus pivotes. Las piezas añadidas van
**emparentadas** a `mov_cabeza` o `mov_torso` (el casco a la cabeza; peto, hombreras y mochila
al torso), así que acompañan la animación; siguen siendo mallas hijas con nombre propio y se
pueden quitar sin reexportar. Son **composiciones de demostración**: su total es la suma del
cuerpo base (3.988) más las piezas, por eso supera 4.000 aunque cada componente respeta su
tope; no están pensadas para 20 instancias simultáneas. El alto supera 1,800 m por la cresta
o la mira del casco montado.

## Paletas del juego (`paletas.json`)

Nueve paletas con las cuatro ranuras `traje`, `oscuro`, `chaleco` y `visor` para `basic`,
`gunner`, `sniper`, `medic`, `commander`, `glitch`, `caster`, `elite` y `guardian`. Los valores
salen de `src/game/dummies.ts`: `medic`, `commander` y `glitch` usan su `paint` explícito; el
visor sale de `VISOR` o del tono por defecto `0xff3a1e`. En las oleadas, los tipos sin `paint`
(`basic`, `gunner`, `sniper`, `caster`, `elite`, `guardian`) reciben colores **aleatorios** de
`randomLook` (`SUITS`, tonos `dark` y `vest`): las paletas de `paletas.json` son una combinación
representativa de esos conjuntos, no un color fijo del juego. `mat_acento` no está en las
paletas: es el naranja de detalle del diseño. Los nombres de ranura de los 15 GLB se comprueban
en `verificar.py` y siguen siendo los cinco (`mat_traje`, `mat_oscuro`, `mat_chaleco`,
`mat_visor`, `mat_acento`).

## Cómo se generó y se comprueba

Guiones en `.delegaciones/blender/soldado/`: `_soldado.py` (constructor y materiales),
`soldado_base.py`, `piezas.py`, `variantes.py` y `verificar.py`.

```
blender.exe -b --python .delegaciones/blender/soldado/soldado_base.py
blender.exe -b --python .delegaciones/blender/soldado/piezas.py
blender.exe -b --python .delegaciones/blender/soldado/variantes.py
python .delegaciones/blender/soldado/verificar.py
```

`verificar.py` comprueba por JSON: topes (base 4.000, piezas 700), ausencia de imágenes,
texturas, cámaras y luces, las cinco ranuras de material y los seis pivotes `mov_*` en su
posición exacta. Resultado actual: **FALLOS 0**. Se generan **16 PNG**: el cuerpo base
(**640 × 320**, RGBA 8 bits, fondo transparente, vista tres cuartos frontal desde
`az = 114°`, `alto = 0,90`: el soldado ocupa ~90 % del alto), `soldado_base_busto.png`
(**560 × 560**, primer plano de torso y casco con las mismas luces), las once piezas
(**640 × 320**) y las tres variantes (**640 × 320**, mismo encuadre cerrado). Todos los PNG
salen de `_comun.py` (`C.foto`; el busto usa `C.estudio`/`C.camara` sin plano de suelo), así
que comparten luces y acabado.

Pendiente para integrarlo en el juego: repintar por nombre de material (las paletas son la
referencia), colgar el arma y el escudo de huesos/sockets, clips de animación por pieza,
colliders por zona (cabeza/torso/extremidades) y LOD. El cuerpo base no lleva arma: el fusil
sigue siendo una pieza aparte del juego.
