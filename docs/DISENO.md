# Documento de diseño (borrador vivo)

Proyecto personal, de uso privado. Este documento recoge las decisiones tomadas hasta ahora.

## Visión

Shooter en primera persona, low poly, donde **todo es procedural**: mundo, enemigos, botín y,
sobre todo, las **armas**, de las que hay muchísimas variantes generadas a partir de piezas.

Se desarrolla en dos etapas que comparten el mismo núcleo:

1. **Modo hordas (incremental)**: partidas cortas en un mapa procedural pequeño, oleadas de
   enemigos, subir de nivel eligiendo mejoras, botín de armas y mejoras permanentes entre partidas.
2. **Mundo abierto**: el mismo núcleo sobre un mundo infinito por zonas (montañas, bosques, cuevas,
   asentamientos), con misiones y progresión.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Motor | Three.js + TypeScript + Vite, en el navegador |
| Cámara | Primera persona |
| Disparo | Apuntar y disparar el jugador (no automático) |
| Control | Teclado/ratón y mando a la vez, con capa de entrada abstracta |
| Menús | Navegación con cursor libre (ratón o stick del mando) |
| Huecos de arma | 2 |
| Ambientación | Post-apocalíptica (en estudio: mezcla de biomas con facciones) |
| Estilo visual | Low poly con forma, sin fotorrealismo; luz y postprocesado cuidados |
| Enemigos | Barra de vida flotante con nombre y nivel; capas de escudo/armadura/vida; números de daño |
| Fabricantes | **No hay**. La identidad del arma viene de sus piezas, rareza y efectos |
| Piezas | Extraíbles y montables en otras armas (banco de armero) |
| Rarezas | Común (blanco), Poco común (verde), Rara (azul), Épica (morado), Legendaria (naranja) |
| Nombres | Legendarias: nombre propio **en inglés**. Resto: designación técnica (`PV-45L SD Mk II`) |
| Aspecto de las armas | Lo más parecido a armas modernas: acabados reales (negro mate, FDE, oliva, gris), metal con reflejos, paletas apagadas. Los modelos realistas salen más a menudo |
| Mezcla de piezas | Cargadores y miras solo entre armas del mismo pack, para que el estilo encaje |

## Sistema de armas

Un arma = **tipo × piezas × rareza × efectos × variaciones**.

- **Piezas** por rol: `body`, `slide`, `frame`, `barrel`, `magazine`, `scope`, `muzzle` (accesorio de boca).
  Cada pieza aporta modificadores de estadísticas.
- **Puntos de anclaje** (sockets) calculados de la geometría: `muzzle`, `magazine`, `optic`, `slide`, `barrel`, `top`.
- **Estadísticas**: daño, cadencia, precisión, alcance, manejo, cargador.
- **Efectos**: elementales (fuego, corrosivo, eléctrico, radiación) y especiales (rebote, doble disparo,
  robo de vida, recarga de pánico…). Las legendarias tienen un efecto único.
- **Designación técnica**: serie (armazón) + calibre (corredera) + sufijos `L`/`C` (cañón largo/compacto),
  `SD` (silenciador) y `Mk II`/`Mk III` (rara/épica).

## Assets

Ver [`assets/weapons/CREDITS.md`](../assets/weapons/CREDITS.md). Los packs originales están en `raw/`
y se convierten con `npm run assets` a `.glb` normalizados:

- Metros; `+X` hacia la boca del cañón; `+Y` arriba.
- Un `.glb` por arma, con una malla por pieza nombrada por su rol.
- `assets/weapons/manifest.json` lista armas, piezas, sockets y dimensiones.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Generador de armas + banco de armero con cursor | En curso |
| 2 | Terreno procedural con biomas y vegetación | Pendiente |
| 3 | Movimiento de shooter + disparo con armas generadas | Pendiente |
| 4 | Enemigos, IA, barras de vida y botín | Pendiente |
| 5 | Modo hordas completo (oleadas, mejoras, progresión entre partidas) | Pendiente |
| 6 | Mundo abierto: asentamientos, cuevas, puntos de interés, misiones | Pendiente |
