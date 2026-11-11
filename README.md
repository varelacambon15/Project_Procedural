# Project Procedural

Shooter en primera persona, low poly y post-apocalíptico, donde todo es procedural:
mundo, enemigos, botín y, sobre todo, armas montadas a partir de piezas.

Diseño y decisiones: [`docs/DISENO.md`](docs/DISENO.md).

## Estado actual: Fase 1, banco de armero

Generador de armas modulares con 86 modelos de 4 packs: rarezas por colores, efectos, estadísticas
derivadas de las piezas y designaciones técnicas (las legendarias tienen nombre propio).

## Uso

```bash
npm install
npm run dev        # banco de armero en http://localhost:5173
npm test           # pruebas del generador
npm run build      # versión estática en dist/
npm run assets     # reconvierte los packs de raw/ a assets/weapons/*.glb (necesita Playwright)
```

Controles del banco: `G` / Ⓐ genera otra arma, `D` / Ⓧ desmonta, LB/RB cambian de tipo.
Arrastrar gira el arma y la rueda acerca. Admite `?seed=123&type=rifle` en la URL.

## Estructura

```
src/weapons/     generador (lógica pura), montaje 3D y tipos
src/bench/       interfaz del banco de armero
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
