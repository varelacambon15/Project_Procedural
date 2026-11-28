# Project Procedural

Shooter en primera persona, low poly, donde todo es procedural:
mundo, enemigos, botín y, sobre todo, armas montadas a partir de piezas.

Diseño y decisiones: [`docs/DISENO.md`](docs/DISENO.md).

## Estado actual: Fase 1, Campo de Pruebas

Demo jugable (`index.html`): campo de tiro con muñecos con escudo, armadura y vida, cofre de armas
aleatorias, banco de trabajo para desmontar y personalizar, e inventario con 2 ranuras + mochila.
Las armas salen del generador modular (115 modelos de 5 packs).

También está el banco de armero independiente (`bench.html`) para ver armas generadas.

## Versiones de escritorio (.exe)

Cada versión se compila sola en GitHub Actions y se publica en **Releases** del repositorio:
`ProvingGrounds-<versión>-win-x64.exe` (portable, sin instalar) y una AppImage para Linux.
Para sacar una versión nueva basta con subir una etiqueta: `git tag v0.2.0 && git push origin v0.2.0`.
Dentro del juego, F11 alterna pantalla completa.

## Uso

```bash
npm install
npm run dev        # campo de pruebas en http://localhost:5173 (banco de armero en /bench.html)
npm test           # pruebas del generador
npm run build      # versión estática en dist/
npm run assets     # reconvierte los packs de raw/ a assets/weapons/*.glb (necesita Playwright)
```

El juego arranca en inglés; el idioma (English / Español) se cambia en el menú principal.

Controles del campo: WASD, ratón, clic izq./der. disparar/apuntar, R recargar, 1/2/Q cambiar arma,
F inspeccionar, E cofre/banco, Tab inventario. Con mando: sticks, RT/LT, Ⓧ recargar, Ⓨ cambiar, Ⓑ usar, View inventario;
en los menús el stick izquierdo mueve un cursor y Ⓐ hace clic.

## Estructura

```
src/weapons/     generador y banco de trabajo (lógica pura), montaje 3D y tipos
src/game/        campo de pruebas: entrada, jugador, arma, muñecos, mundo, inventario e interfaz
src/bench/       visor independiente del banco de armero
assets/weapons/  armas convertidas (.glb) + manifest.json + CREDITS.md
raw/             packs originales (fuente de la conversión)
tools/           conversión de packs y hoja de contacto
tests/           pruebas (Vitest)
demos/           prototipos iniciales de un solo archivo
```

## Convención de los modelos

Metros, `+X` hacia la boca del cañón, `+Y` arriba. Un `.glb` por arma con una malla por pieza,
nombrada por su rol (`body`, `slide`, `frame`, `barrel`, `magazine`, `scope`, `muzzle`).
Los puntos de anclaje de cada arma están en `assets/weapons/manifest.json`.
