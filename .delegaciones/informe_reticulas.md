# Informe 29 — Inventario de retículas incluidas en los modelos de ópticas

Fecha: 2026-11-23 · Solo análisis: no se ha modificado `src/`, `assets/` ni `tests/`. Sin commit.

## 1. Qué se ha hecho

- Script `tools/audit-reticles.mjs` (Node, sin dependencias nuevas): lee el bloque JSON y el BIN de cada GLB y saca, por malla, triángulos, material (color base, emisivo, alpha, textura) y caja envolvente en metros.
- Fuentes inventariadas (todas las que referencia `assets/weapons/manifest.json`):
  - **39 ópticas del kit**: `k-att-*`, `k-optic-rear-*` y `k-ironsight-*` (slot `Sights_*`).
  - **3 accesorios de mira con GLB propio**: `q-acc-scope-1..3` (tipo `accessory`, rol `scope`).
  - **73 miras integradas en el GLB de un arma de pack** (nodo de rol `scope`): 36 son alza/punto de hierro, 18 son punto rojo/holo/visor/prisma/acog y 19 son miras de modelo de Cosmo/Pulidas sin metadatos `ownSight`.
  - **7 ópticas procedurales** de `src/weapons/accessories.ts` (`buildOptic`).
- Criterios de «candidata a retícula» que pide el encargo: nombre con `ret|reticle|dot|cross|mark|chevron|lens|glass`, material emisivo, malla plana (<1 mm) y pequeña (<3 cm), textura de punto. Añadidos como apoyo: color rojo/azul saturado (las variantes del pack usan rojo/azul) y **micro-piezas planas ≤9 mm junto al eje de la lente**.
- La última comprobación es la que ha localizado las retículas de verdad: las retículas de estos GLB no son mallas aparte, sino **grupos de quads/triángulos fundidos en la malla grande** del cuerpo (`kit#1`/`kit#3`). El script descompone cada malla en geometría conexa y busca esas micro-piezas.

## 2. Resultado en cifras

| grupo | ópticas | con retícula en el modelo | solo lente/vidrio | mira de hierro | sin candidata |
|---|---:|---:|---:|---:|---:|
| kit (`k-att-*`, `k-optic-*`, `k-ironsight-*`) | 39 | **10** | 25 | 4 | 0 |
| accesorios con GLB (`q-acc-scope-*`) | 3 | 0 | 3 | 0 | 0 |
| miras integradas en packs | 73 | 0 | 0 | 36 | 37 |
| **total con modelo** | **115** | **10** | **28** | **40** | **37** |

- **10 ópticas traen retícula dibujada en el modelo** (8,7 % de las 115). Son 5 modelos del kit en sus dos variantes de color, `east` (rojo) y `west` (azul):
  - `k-att-reddot-east/west` → punto.
  - `k-att-reflex-east/west` → punto.
  - `k-att-holographic-east/west` → aro + punto.
  - `k-att-magnified-east/west` → chevron (ACOG).
  - `k-att-scope-east/west` → cruz con marcas mil-dot.
- **28 solo llevan lente** (cristal transparente) y ninguna retícula modelada: las 25 del kit que no son `east/west`/hierro y los 3 `q-acc-scope-*`.
- **40 son miras de hierro** (4 `k-ironsight-*` + 36 armas de pack con `ownSight.kind = "alza"`): no dibujan retícula; el juego apunta por ellas.
- **37 no tienen nada**: las miras de Cosmo/Pulidas (19+1) y las miras integradas de pack con punto rojo/holo/visor/prisma (18) son un bloque oscuro de una sola malla, sin lente ni retícula.
- **7 ópticas no tienen modelo**: son procedurales (`acc:*`).

## 3. Las 10 ópticas con retícula propia

Todas pertenecen al mismo pack de 5 miras (variante roja `east`, azul `west`). La malla coloreada incluye también placas y aros decorativos; la retícula son las micro-piezas planas (grosor 0) que el script separa dentro de esa malla.

| óptica | mira del juego | malla | micro-retícula (mm) | forma probable | doble retícula |
|---|---|---|---|---|---|
| `k-att-reddot-east` | dot | `kit#3` (rojo) | 3 piezas: 1,4×1,0 + 2×0,8 ×2 | punto | punto del modelo + punto de `#reddot` |
| `k-att-reddot-west` | dot | `kit#3` (azul) | 1 pieza: 1,8×1,8 | punto | igual |
| `k-att-reflex-east` | dot | `kit#3` (rojo) | 3 piezas: 2,8×1,9 + 4,1×1,5 ×2 | punto | igual |
| `k-att-reflex-west` | dot | `kit#1`, `kit#3` (azul) | 3 piezas: 3,7×3,7 ×2 + 3,6×3,6 | punto | igual |
| `k-att-holographic-east` | holo | `kit#3` (rojo) | 5 piezas: 1,0×0,8 + 3,1×3,1 ×4 | aro + punto (aro en 4 segmentos) | aro/punto del modelo + aro/punto de `#reddot[data-kind=holo]` |
| `k-att-holographic-west` | holo | `kit#3` (azul) | 2 piezas: 2,2×1,1 + aro 8,7×8,7 | aro + punto | igual |
| `k-att-magnified-east` | holo (ACOG 3x) | `kit#1`, `kit#3` (rojo) | 5 piezas: 3 marcas 2,3×0,7 + marca 7,3×0,9 + 3,0×2,3 | chevron (ACOG) | chevron del modelo + aro/punto holo del juego |
| `k-att-magnified-west` | holo (ACOG 3x) | `kit#1`, `kit#3` (azul) | 3 piezas: 6,6×1,2 + 4,6×3,9 + 1,0×1,0 | chevron (ACOG) | igual |
| `k-att-scope-east` | scope | `kit#1` (negro) | 13 piezas: 12 marcas 2,3×0,4 + punto 1,0×1,0 | cruz mil-dot | mil-dot del modelo + cruz y punto rojo de `#scope` a pantalla completa |
| `k-att-scope-west` | scope | `kit#1` (negro) | 21 piezas: 20 marcas 2,3×0,4 + punto 1,0×1,0 | cruz mil-dot | igual |

Notas:

- En `reddot/reflex` la retícula roja/azul va montada en la misma malla que una placa de base y adornos; por eso el tamaño de la malla (24–41 mm) no delata la retícula, pero las micro-piezas de 1–4 mm sí.
- En `scope` la retícula es **negra** (no coloreada) y está fundida en el cuerpo `kit#1`; un inventario por malla la habría perdido. Es la que más se solapa con la cruz del visor a pantalla completa del juego.
- La **ACOG del kit (`k-att-magnified-lacog4x`)** y las demás `l-p*`/`lp4*`/`lp5*` **no traen retícula**: solo cuerpo + lente. La retícula que se ve en ellas es únicamente la del juego.

## 4. Ópticas sin modelo (solo procedurales)

Son las de `src/weapons/accessories.ts`; las construye `buildOptic` (o `buildFrontSight`) por código:

| id | mira del juego | forma | mallas de retícula en el código | ¿retícula en el modelo? |
|---|---|---|---|---|
| `acc:reddot` | dot | punto | `dot`: `SphereGeometry` r = 1,2 mm, material `redDot` (`MeshBasic` 0xff3020) | sí (punto rojo) |
| `acc:holo` | holo | aro + punto | `dot`: `RingGeometry` 2,5–3,5 mm, material `redDot` | sí (aro rojo) |
| `acc:acog` | holo | chevron (ACOG) | ninguna; solo `lens` (`CircleGeometry`, `glass`) | no |
| `acc:acog-c` | holo | chevron (ACOG) | ninguna; solo `lens` | no |
| `acc:scope2` | holo | cruz / mil-dot | ninguna; solo `lens` | no |
| `acc:scope6` | scope | cruz / mil-dot | ninguna; solo `lens` | no |
| `acc:iron` | irons | alza + punto | `buildFrontSight` / modelos `iron/*` | no |

Observación: `acc:reddot` y `acc:holo` también dibujan su retícula en el modelo **y** el juego superpone `#reddot`; el solape es rojo sobre rojo y casi no se nota, pero es el mismo patrón que las 10 del kit. Los visores procedurales no dibujan retícula, así que no hay doble.

## 5. Catálogo de formas propuesto (10 líneas)

1. `dot` — punto redondo 1–2 mm; cubre red dot y reflex.
2. `ring` — aro fino 8–9 mm sin punto; parte del retículo holográfico.
3. `ring-dot` — aro 8–9 mm + punto central 1–2 mm; holográfica.
4. `chevron` — chevron 3–5 mm; ACOG/magnified y `acc:acog`.
5. `chevron-bdc` — chevron + 3 marcas de caída; prisma/ACOG de 3 aumentos.
6. `cross` — cruz simple con hueco central; visor a pantalla completa y `acc:scope2/6`.
7. `cross-dot` — cruz + punto central 1 mm; visor con punto iluminado.
8. `mildot` — cruz + 12 marcas de 2,3 mm + punto 1 mm; `k-att-scope-east/west`.
9. `post` — poste vertical; punto de mira delantero de hierro.
10. `aperture` — alza de anillo/muesca; mira trasera de hierro.

El color no necesita id: el encargo lo fija al rojo del punto rojo del juego (`0xff3020`); las variantes `west` azules del modelo se sustituirían por ese rojo.

## 6. Limitaciones y notas

- El análisis es geométrico: detecta retículas planas y pequeñas junto a la lente. Una retícula **pintada en textura** solo se marcaría por «textura»; en los GLB actuales no hay ninguna textura de retícula (las texturas que aparecen son atlas de color del kit/Cosmo).
- Las miras integradas de los packs son un único bloque oscuro sin lente; se revisaron las más complejas (`x-mp9`, `x-fusil-1`, `x-subfusil-10`, `x-sniper-0`) y no tienen micro-piezas: no hay retícula modelada.
- Solo se auditan los GLB que usa el manifest; las fuentes de `raw/` y las carpetas de armas sin convertir no entran. La ACOG de `raw` también es una sola malla sin retícula.
- `manifest.iron` (13 juegos de alza/punto) son miras de hierro con modelos propios, no ópticas con retícula; quedan fuera de la tabla principal salvo los `k-ironsight-*` del kit.

## Anexo — Tabla por óptica

| id | grupo | mira del juego | retícula propia | malla(s) | forma probable |
|---|---|---|---|---|---|
| q-acc-scope-1 | acc | scope | no (solo lente) | — | cruz / mil-dot |
| q-acc-scope-2 | acc | scope | no (solo lente) | — | cruz / mil-dot |
| q-acc-scope-3 | acc | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-holographic-east | kit | holo | sí (5 micro-piezas) | kit#3 | aro + punto |
| k-att-holographic-lholocaja | kit | holo | no (solo lente) | — | aro + punto |
| k-att-holographic-lholocompacta | kit | holo | no (solo lente) | — | aro + punto |
| k-att-holographic-west | kit | holo | sí (2 micro-piezas) | kit#3 | aro + punto |
| k-att-magnified-east | kit | holo | sí (5 micro-piezas) | kit#1, kit#3 | chevron (ACOG) |
| k-att-magnified-lacog4x | kit | holo | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-lacogcompacto3x | kit | holo | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-lp4mgg33 | kit | holo | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-lprisma2x | kit | holo | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-lprisma3xconpunto | kit | holo | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-ltermica | kit | scope | no (solo lente) | — | chevron (ACOG) |
| k-att-magnified-west | kit | holo | sí (3 micro-piezas) | kit#1, kit#3 | chevron (ACOG) |
| k-att-reddot-east | kit | dot | sí (3 micro-piezas) | kit#3 | punto |
| k-att-reddot-lp4prcajasmg | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lp4prminiqb | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lp5mikitholo | kit | dot | no (solo lente) | — | aro + punto |
| k-att-reddot-lp5prmg338 | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lprabiertocompacto | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lprabiertogrande | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lprtubo30 | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lprtuboalto | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-lpuntorojolupa | kit | dot | no (solo lente) | — | punto |
| k-att-reddot-west | kit | dot | sí (1 micro-pieza) | kit#3 | punto |
| k-att-reflex-east | kit | dot | sí (3 micro-piezas) | kit#3 | punto |
| k-att-reflex-west | kit | dot | sí (3 micro-piezas) | kit#1, kit#3 | punto |
| k-att-scope-east | kit | scope | sí (13 micro-piezas) | kit#1 | cruz / mil-dot |
| k-att-scope-lp4tem82 | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-lp5mikittelescopica | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-lvisorcorto4x | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-lvisorlargo10x | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-lvisormedio8x | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-lvisorparasol12x | kit | scope | no (solo lente) | — | cruz / mil-dot |
| k-att-scope-west | kit | scope | sí (21 micro-piezas) | kit#1 | cruz / mil-dot |
| k-ironsight-front-556barrel-01 | kit | irons | no (hierro) | kit#2 | alza + punto |
| k-ironsight-front-welded-01 | kit | irons | no (hierro) | kit#2 | alza + punto |
| k-ironsight-rear-rail-01 | kit | irons | no (hierro) | kit#1 | alza + punto |
| k-ironsight-rear-welded-01 | kit | irons | no (hierro) | kit#1, kit#2 | alza + punto |
| k-optic-rear-rail-01 | kit | holo | no (solo lente) | — | otra |
| k-optic-rear-rail-02 | kit | dot | no (solo lente) | — | otra |
| c-flamethrower | pack | — | no | — | otra (mira de modelo) |
| c-pistol-5 | pack | — | no | — | otra (mira de modelo) |
| c-rifle-1 | pack | — | no | — | otra (mira de modelo) |
| c-rifle-2 | pack | — | no | — | otra (mira de modelo) |
| c-rifle-4 | pack | — | no | — | otra (mira de modelo) |
| c-rifle-5 | pack | — | no | — | otra (mira de modelo) |
| c-rifle-7 | pack | — | no | — | otra (mira de modelo) |
| c-smg-1 | pack | — | no | — | otra (mira de modelo) |
| c-smg-10 | pack | — | no | — | otra (mira de modelo) |
| c-smg-2 | pack | — | no | — | otra (mira de modelo) |
| c-smg-5 | pack | — | no | — | otra (mira de modelo) |
| c-smg-6 | pack | — | no | — | otra (mira de modelo) |
| c-smg-7 | pack | — | no | — | otra (mira de modelo) |
| c-smg-8 | pack | — | no | — | otra (mira de modelo) |
| c-sniper-0 | pack | — | no | — | otra (mira de modelo) |
| c-sniper-1 | pack | — | no | — | otra (mira de modelo) |
| c-sniper-2 | pack | — | no | — | otra (mira de modelo) |
| u-bullpup-b | pack | — | no | — | otra (mira de modelo) |
| u-fusil-a | pack | — | no | — | otra (mira de modelo) |
| x-ak12 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-ar70 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-arx-160 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-fusil-1 | pack | holo (holografica) | no | — | aro + punto |
| x-fusil-2 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-fusil-4 | pack | holo (holografica) | no | — | aro + punto |
| x-fusil-5 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-fusil-6 | pack | scope (visor) | no | — | cruz / mil-dot |
| x-fusil-7 | pack | holo (holografica) | no | — | aro + punto |
| x-lev-12 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-mgp7 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-mp9 | pack | dot (punto_rojo) | no | — | punto |
| x-p2-dv-762 | pack | scope (visor) | no | — | cruz / mil-dot |
| x-p2-ls-556 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p2-rb-454 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p2-rd-556 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p2-sg-226 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p2-sr-1216 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p2-vk-45 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p3-gl-18s | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p3-m4a4 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-apb | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-cp33 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-cz75 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-evo3 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-g36c | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-hk45 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-m82 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-m9 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-mk23 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-mosin | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-vector | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p4-welrod | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p5-lpm1 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-p5-lpm4 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-pistol-1 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-pistol-3 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-pistol-5 | pack | scope (visor) | no | — | cruz / mil-dot |
| x-rev-h | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-smg-w | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-smg45 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-sniper-0 | pack | scope (visor) | no | — | cruz / mil-dot |
| x-sniper-1 | pack | scope (visor) | no | — | cruz / mil-dot |
| x-sniper-2 | pack | scope (visor_largo) | no | — | cruz / mil-dot |
| x-subfusil-1 | pack | holo (prisma) | no | — | chevron/prisma |
| x-subfusil-10 | pack | holo (acog) | no | — | chevron (ACOG) |
| x-subfusil-2 | pack | dot (punto_rojo) | no | — | punto |
| x-subfusil-5 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
| x-subfusil-6 | pack | holo (holografica) | no | — | aro + punto |
| x-subfusil-7 | pack | dot (punto_rojo) | no | — | punto |
| x-subfusil-8 | pack | dot (punto_rojo) | no | — | punto |
| x-subfusil-9 | pack | holo (holografica) | no | — | aro + punto |
| x-tar-21 | pack | dot (punto_rojo) | no | — | punto |
| x-zc57 | pack | irons (alza) | no (hierro) | — | alza + punto (hierro) |
