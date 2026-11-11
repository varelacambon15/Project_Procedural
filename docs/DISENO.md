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
| Comportamiento | Cada tipo tiene su perfil (subfusil = cadencia, revólver = potencia…) y variantes: pistola automática o pesada, subfusil táctico (lento), fusil de ráfagas o de tirador, escopeta de corredera, semi, automática o de dos cañones, francotirador de cerrojo, semi o antimaterial. El modelo decide la variante habitual (AA-12 automática, M16 por ráfagas, L115 de cerrojo) y la capacidad real del cargador, con un 30% de variantes distintas |
| Modos raros | Exclusivos de moradas y legendarias: el 45% de ellas sale con un modo de disparo poco habitual para su tipo: pistolas y revólveres automáticos o a ráfagas, francotiradores automáticos o a ráfagas, escopetas a ráfagas, subfusiles semiautomáticos, ametralladoras a ráfagas de 4-5, lanzacohetes en salva. Ráfagas de 2 a 5 disparos |
| Habilidades | Blanca: ninguna. Verde: mejores estadísticas. Azul: 1 habilidad moderada. Morada: 2. Legendaria: 2 + 1 especial (rebote, doble cañón, eco, carroñero, detonador, arco en cadena, frenesí, perforador) |
| Accesorios | Supresores, compensador, freno, apagallamas y miras (punto rojo, holográfica, 4x, 6x) generados por código a medida de cada arma |
| Animaciones | Procedurales estilo Destiny / MW: inercia, balanceo, sprint táctico, salto, retroceso, recarga con el cargador, corredera/cerrojo, sacar e inspeccionar. Más adelante, brazos animados |
| Interfaz | Retícula y cursor circular estilo Destiny. Inglés por defecto, español seleccionable |
| Plataformas | Web y escritorio (.exe vía Electron, publicado en Releases). Android posible más adelante con Capacitor |

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
| 1 | Campo de Pruebas: generador de armas, cofre, banco de trabajo, inventario y muñecos con barras de vida | En curso (demo jugable) |
| 2 | Terreno procedural con biomas y vegetación | Pendiente |
| 3 | Movimiento de shooter + disparo con armas generadas | Pendiente |
| 4 | Enemigos, IA, barras de vida y botín | Pendiente |
| 5 | Modo hordas completo (oleadas, mejoras, progresión entre partidas) | Pendiente |
| 6 | Mundo abierto: asentamientos, cuevas, puntos de interés, misiones | Pendiente |
