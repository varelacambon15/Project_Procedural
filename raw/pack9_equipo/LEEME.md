# Pack 9 — equipamiento como GLB listo para el juego (encargo 32)

Los 20 objetos de `assets/equipo/*.png` exportados a `raw/pack9_equipo/*.glb` desde sus
guiones de Blender, sin tocar los PNG aprobados ni `src/`. Todo el modelado es propio y
procedural (los guiones de `.delegaciones/blender/equipo/` con `_comun.py`).

## Convención del GLB

- **Metros reales** (1 unidad de Blender = 1 m), escala tal como se modeló cada objeto.
- **+X = frente**, **+Y arriba** en el GLB (glTF; en Blender es Z arriba). +Z completa el
  triedro a la derecha.
- **Origen**: centro de la base apoyada en el suelo (los guiones construyen centrados en
  x=y=0). En `orb`, `knife`, `chain` y `harpoon`, origen en el **centro del objeto**.
- **Una malla por pieza** con nombre en español (`tornillo_base_3`, `canon`, `losa`…).
- Materiales Principled simples: color base, metallic, roughness y emisión. El cristal y
  las energías translúcidas van con **alfa** (`alphaMode: BLEND`). **Sin texturas, sin
  imágenes, sin luces ni cámaras** (comprobado en el JSON del GLB: `images: 0`,
  `textures: 0`, `cameras: 0`, sin `KHR_lights_punctual`).
- **Piezas móviles** aparte con el pivote en su eje y nombre `mov_*`.

## Entregables

| id | triángulos | mallas | piezas móviles | X × Y × Z (m) | mayor lado (m) | GLB |
|---|---:|---:|---|---|---:|---:|
| `ammo` | 2.783 | 133 | — | 0,93 × 0,82 × 0,99 | 0,99 | 237 KB |
| `beacon` | 2.819 | 85 | — | 0,81 × 0,96 × 0,71 | 0,96 | 173 KB |
| `chain` | 3.000 | 221 | — | 0,44 × 0,42 × 0,57 | 0,57 | 328 KB |
| `chrono` | 2.876 | 175 | — | 1,08 × 0,93 × 0,82 | 1,08 | 334 KB |
| `decoy` | 2.803 | 89 | — | 0,28 × 0,57 × 0,28 | 0,57 | 182 KB |
| `dome` | 2.847 | 53 | `mov_anillo_nucleo_1`, `mov_anillo_nucleo_2` | 0,69 × 0,34 × 0,65 | 0,69 | 152 KB |
| `glitch` | 2.846 | 95 | — | 0,36 × 0,45 × 0,37 | 0,45 | 216 KB |
| `gravity` | 2.820 | 117 | — | 0,75 × 0,70 × 0,76 | 0,76 | 213 KB |
| `harpoon` | 2.837 | 70 | — | 0,63 × 0,50 × 0,25 | 0,63 | 172 KB |
| `hook` | 2.840 | 29 | — | 0,49 × 0,71 × 0,43 | 0,71 | 109 KB |
| `inject` | 2.787 | 83 | — | 0,67 × 0,65 × 0,82 | 0,82 | 189 KB |
| `jump` | 2.847 | 83 | — | 0,84 × 0,39 × 0,83 | 0,84 | 169 KB |
| `knife` | 2.832 | 41 | — | 0,27 × 0,71 × 0,13 | 0,71 | 122 KB |
| `mine` | 2.837 | 69 | — | 0,78 × 0,32 × 0,62 | 0,78 | 175 KB |
| `orb` | 2.840 | 85 | — | 0,61 × 0,86 × 0,61 | 0,86 | 175 KB |
| `shield` | 2.838 | 70 | — | 0,60 × 0,69 × 0,72 | 0,72 | 198 KB |
| `slowfield` | 2.934 | 91 | — | 0,72 × 0,78 × 0,80 | 0,80 | 184 KB |
| `teleport` | 2.860 | 105 | — | 0,97 × 0,81 × 0,97 | 0,97 | 209 KB |
| `thrust` | 2.828 | 118 | — | 0,93 × 0,64 × 0,54 | 0,93 | 212 KB |
| `turret` | 2.873 | 38 | `mov_torreta`, `mov_canones` | 0,78 × 0,52 × 0,60 | 0,78 | 162 KB |

Medidas leídas del JSON del GLB (POSITION `min/max` de cada primitiva con las
transformaciones de nodo aplicadas), no de la escena de Blender. Todos por debajo o igual
al tope de **3.000 triángulos**.

## Piezas móviles (pivote del nodo en el GLB)

| objeto | nodo | pivote (x, y, z) glTF | eje / uso |
|---|---|---|---|
| turret | `mov_torreta` | (0, 0,228, 0) | +Y (guiñada de la cabeza sobre la columna) |
| turret | `mov_canones` | (0,146, 0,298, 0) | Z (elevación de los cañones; **hijo** de `mov_torreta`) |
| dome | `mov_anillo_nucleo_1` | (0, 0,166, 0) | centro del anillo (giro propio) |
| dome | `mov_anillo_nucleo_2` | (0, 0,168, 0) | centro del anillo (giro propio) |

`mov_canones` cuelga de `mov_torreta`, así que hereda la guiñada. Escudo: ninguna pieza
móvil. El resto de objetos no tiene articulaciones: los aros de `orb`, `gravity` y
`slowfield` son parte de la coraza fija (se pueden girar animando el nodo completo).

## Desviaciones y decisiones

1. **Decimación fuerte (principal)**: los modelos estaban hechos para render (19.900–76.364
   triángulos); el tope de 3.000 obliga a reducirlos un 80–97 %. Se reparte el presupuesto
   en proporción al tamaño de cada pieza con un mínimo de 8–14 triángulos por pieza, y el
   último exceso se recorta de las mallas más grandes. Consecuencia: detalles pequeños
   (tornillos, muelles, llamas, eslabones, esquirlas) quedan muy simplificados; la cadena
   baja justo a 3.000 y sus eslabones son esquemáticos. La silueta y los materiales se
   conservan. La decimación se hace **después** del render: los PNG no cambian.
2. **Orientación a +X**: se gira el modelo antes de exportar. +90° (el frente estaba en
   −Y): `ammo`, `shield`, `inject`, `decoy`, `slowfield`, `teleport`, `turret`. −90° (la
   flecha apuntaba a +Y): `jump`. 180° (la tobera miraba a −X): `thrust`. Sin giro:
   `beacon`, `chain`, `chrono`, `dome`, `glitch`, `gravity`, `hook`, `mine`, `orb`
   (radiales o sin frente claro). `knife` y `harpoon` **conservan la pose de catálogo** de
   la ficha (erecto / diagonal) porque su origen va en el centro y no tienen base.
3. **Materiales**: el ruido de `variacion` (rugosidad procedural) se desconecta justo antes
   de exportar y queda el valor constante del material (si no, el GLB salía con roughness
   1,0). La transmisión (`KHR_materials_transmission`) se sustituye por **alfa 0,35** en
   `chrono`, `inject`, `orb`, `slowfield` y `teleport`, como pide el encargo ("el cristal
   con alfa"). El holograma de `decoy` usa un shader Mix propio que glTF no entiende: para
   el GLB se cambia por un Principled translúcido emisivo (`holo_decoy_glb`). La emisión va
   con `KHR_materials_emissive_strength`.
4. **Escala**: no se reescala nada; se respeta la escala modelada en cada guion. Algunos
   objetos son grandes para lo que representan (`chrono` 1,08 m, `ammo` 0,99 m de fondo con
   la tapa abierta): si el juego espera otra talla, escalar el nodo raíz.
5. **Origen**: los guiones construyen centrados en x=y=0 (convención de `_comun.py`), así
   que el origen se pone en (0, 0, z_mínima). En `knife`/`harpoon` los guiones recentran
   por caja y el origen va al centro (`centro=True`), igual que `orb` y `chain`.
6. **PNG intactos**: cada guion renderiza primero (a `EQUIPO_DIR`, una carpeta temporal) y
   exporta después, con selección de mallas: luces, cámara y plano de sombra no entran en
   el GLB. Los PNG de `assets/equipo/` no se han reescrito; la comparación píxel a píxel de
   los renders nuevos contra los aprobados da una diferencia media ≈ 6·10⁻⁵ (solo ruido del
   denoiser, con unos pocos píxeles aislados marcados).
7. **Sin animaciones, sockets ni colliders** en el GLB: solo pivotes. Los puntos de disparo
   (bocas de `turret`), el collider y los LOD se añaden en el motor.
8. **Extensiones glTF** usadas: `KHR_materials_emissive_strength` (emisión > 1),
   `KHR_materials_clearcoat` (barniz de las pinturas) y `KHR_materials_ior/specular` en el
   cristal del `chrono`. Si el runtime no las soporta, se pierde el extra de brillo, pero
   color, rugosidad y alfa se leen igual.

## Cómo se generó (para poder retomar)

`_comun.py` gana `exportar_glb(nombre, giro, moviles, padres, centro, limite, giratorios)` y
cada guion la llama **al final**, después de `C.foto()`. Sigue en `VERSION = "r1"` (los
guiones comprueban esa versión). No se tocó ningún PNG ni `src/`.

```
cd .delegaciones/blender/equipo
$env:EQUIPO_DIR="C:\...\tmp\equipo_png"     # los PNG van aquí, no a assets/
foreach ($id in "turret","shield","dome","orb","hook","mine","gravity","slowfield","jump",
                "beacon","knife","chain","harpoon","decoy","glitch","ammo","inject",
                "thrust","teleport","chrono") {
  & "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --python "$id.py"
}
```

Los `KeyError: 'mesh.knife_tool'` del addon Half_Knife al arrancar y al salir son ruido (no
afectan al resultado); Blender puede salir con código 1 por eso.

## Verificación hecha

- `python .delegaciones/blender/equipo/_verificar_glb.py` (parser propio del GLB, sin
  Blender): triángulos por primitiva, materiales y `alphaMode`, nombres de nodos,
  `mov_*` con su pivote, caja total con transformaciones de nodo y ausencia de imágenes,
  texturas, cámaras y luces. Resultado: **20/20 por debajo de 3.000 y 0 fallos**.
- `_verificar_glb.py <id>` da el detalle en JSON de un objeto.
- `_tabla_glb.py` reimprime esta tabla en Markdown desde los GLB.
- `_preview_glb.py` importa los GLB y renderiza una vista con suelo y ejes (+X rojo, +Y
  verde) en una carpeta temporal; revisados los 20 para comprobar orientación, apoyo en el
  suelo y legibilidad tras la decimación.
- Los 20 guiones se ejecutaron de principio a fin con su render; sin excepciones propias.
