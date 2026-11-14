# Encargo para el chat que prepara los kits de armas

El kit de 39 armas (`kit_armas_39`) está muy bien: se integra casi automáticamente. **Mantened exactamente las mismas
convenciones** (metros, +X boca, +Y arriba, origen centrado en X/Z con base en Y = 0, normales con aristas vivas,
un material liso por pieza `mat_<pieza>`, sin texturas ni colores de vértice, < 6.000 triángulos, piezas con origen
en su punto de unión, `<arma>_ensamblada.glb` con un nodo por pieza y un nodo vacío por ancla, `manifest.json` por
arma y `catalogo.json` en la raíz). Lo nuevo y lo que hay que mejorar:

## 1. Miras (lo más importante ahora)

En el juego, **toda óptica apunta de verdad** (su centro queda en el centro de la pantalla) y las armas sin óptica
apuntan acercando el arma y haciendo zoom (estilo Black). Así que cada mira necesita:

- **Ancla `centro_lente`**: el punto por el que mira el ojo (centro del cristal/retícula, a la altura de la línea de
  mira). Es el dato clave: sin él no se puede alinear.
- **`aumento`** en el manifest (1 = punto rojo/holográfica, 1.5–4 = ACOG o similares, 4–12 = francotirador).
- **`tipo_mira`**: `punto_rojo`, `holografica`, `prisma`, `acog`, `visor`, `visor_largo`, `termica`… (texto libre,
  pero consistente).
- Origen de la pieza en su base (`raíl_superior`), como ahora.
- Que la mira no tape la vista por los lados más de lo normal (el cuerpo de la mira, no carcasas gigantes).
- Variedad pedida: 4–6 de punto rojo/holográficas (abiertas y de tubo), 3–4 de aumento medio (ACOG/prisma),
  3–4 de francotirador (corto, largo, con parasol), 1–2 especiales (térmica, doble con lupa abatible).

Para las armas que traen mira integrada (asa con alza, visor fijo), marcadlo en el manifest
(`mira_integrada: "alza"` o `"visor"`) y, si es visor, poned también su `centro_lente` y `aumento`.

## 2. Piezas sueltas para variedad (kits solo de piezas)

Además de armas completas, sirven mucho **piezas sueltas compatibles** con las anclas existentes, con su
`seccion_union_m`:
- Guardamanos (con raíles, ranuras tipo M-LOK, madera, perforados), en largos corto/medio/largo.
- Culatas macizas, de polímero, plegables gruesas y de madera (nada de varillas finas).
- Cargadores rectos, curvos y tambores (el tambor **orientado de frente**: disco en el plano XY, no de canto).
- Empuñaduras y agarres verticales.
- Bocachas: apagallamas, frenos, compensadores y supresores (origen en la cara que encaja en la boca).

## 3. Correcciones del kit actual

- `fusil_1`, `sniper_1`, `subfusil_7`: el "manguito" que rodea el cargador dentro del cuerpo; mejor quitarlo o
  hacerlo parte del cargador.
- En AK12, MGP7 y AR70 el ancla `pozo_cargador` queda dentro del cajón; mejor en la cara inferior del cajón.
- Los tambores de cargador deben verse de frente (disco visible desde el lateral del arma).

## 4. Datos útiles en el manifest (si es fácil)

- `boca` con el **diámetro** de la boca (para escalar bocachas).
- `raíl_inferior` en todas las que tengan sitio para un agarre o linterna.
- `era` sugerida (clásica, moderna, rústica, sci-fi) si el diseño la tiene clara.

## Entrega

Un `.zip` subido al repositorio (o a `raw/`), con la misma estructura que `kit_armas_39`. Si son solo piezas, una
carpeta por tipo (`miras/`, `guardamanos/`, `culatas/`, `cargadores/`, `bocachas/`) con un `manifest.json` por pieza.
