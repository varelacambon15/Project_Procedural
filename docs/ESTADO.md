# Estado del proyecto (para retomar en otro chat)

Léelo al empezar una conversación nueva: resume reglas, mapa del código y lo pendiente.

## Reglas fijas del diseño

- Enemigos solo con vida. Elementos: fuego, eléctrico y explosivo. Sin escudos, ranuras de inventario, audio
  procedural ni semillas.
- No tocar balance base, economía ni rarezas fuera de lo que se pida.
- Luces de color o sci-fi solo en legendarias (detalle de latón en gatillo o palanca, nunca boquillas de color).
- Sci-fi = "arma moderna de última generación": polímero, raíles, formas anguladas. Nada de celdas, aletas o pantallas.
- Armas nuevas = piezas que varían bases existentes, no modelos casi idénticos.
- No recrear juegos existentes. No editar CREDITS.md.
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
- Tests: si el contenedor va justo de memoria, `npx vitest run --minWorkers=1 --maxWorkers=2`.

## Pendiente

- Integrar packs nuevos (revólveres PSX, Semi Realistic convertidos a glb; aún no integrados).
- Seguir puliendo el realismo de las pistolas (detalle, biseles, texturas).
- Probar en juego las poses de mano en todas las armas (las capturas por software no permiten ver la recarga fluida).
- Probar en juego la economía nueva y ajustar `shop.json`.
