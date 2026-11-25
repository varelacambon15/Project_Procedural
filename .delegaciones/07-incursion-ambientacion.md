# Encargo 07 — Incursiones y hack: ambientación que cuente algo (visual)

Agente: coder. Ejecutor: ejecuta y reporta, no delegues. Raíz: la carpeta actual.

## Contexto
Las incursiones/hack se generan en `src/game/raidgen.ts` (puro, con temas `RAID_THEMES`: centro de datos, fundición, laberinto, arena, biolab; formas L/T/U/cruz; pasarelas)
y se construyen en `src/game/raid.ts` (~442 líneas; geometría fundida con `mergeStatic` de `src/game/merge.ts`; decoración de salas con estilo; suelos hexagonales/paneles de `simtex.ts`).
Pendiente de `docs/ESTADO.md` (Ronda 38): «incursiones: mobiliario que cuente algo, escombros y desgaste» e «iluminación por zonas».

## Objetivo
Por cada tema de `RAID_THEMES`, añade 4–6 elementos de ambientación con identidad propia (mallas simples, low poly, por código):
- centro de datos: racks con cables colgando, pasillos fríos con vallas, carros de mantenimiento;
- fundición: tuberías de vapor, cubas/crisoles con brillo, escombros y manchas de óxido;
- laberinto: paneles holográficos rotos, barreras tipo muro bajo, balizas;
- arena: gradas bajas, banderas/estandartes de neón, restos de combate;
- biolab: tubos de cultivo, camillas, cristales rotos.
Más: **escombros y desgaste** (cascotes, paneles caídos, grietas decal con `decal()`/polygonOffset como en world.ts) repartidos con semilla determinista
(mismo resultado para la misma semilla de incursión) y **variación de color de acento por zona** (sin luces reales: emisivos y halos pintados).

## Restricciones
- **Número de luces de la escena fijo** (no añadas luces reales). Mallas fundidas por material con `mergeStatic`; objetivo: las llamadas de dibujo de una incursión no deben subir más de ~15 % respecto a antes.
- No cambies la generación lógica (`raidgen.ts`: tamaños, conexiones, objetivos) ni el orden de las semillas: `tests/raid.test.ts` y `tests/hack.test.ts` siguen idénticos.
- Colisiones: los elementos decorativos no deben bloquear pasillos ni puertas; los volumétricos grandes necesitan collider coherente.
- Estilo: referencias del usuario = Coded Arms, System Shock, Metal Gear VR (paletas oscuras con neón, suelos hexagonales, paneles holográficos). Sin franjas naranjas cruzando puertas.
- Variedad real **por incursión**, no solo por sala (el usuario pidió variedad real por incursión; además, el reparto de temas podía quedar desequilibrado, con 4 de 6 iguales: comprueba que los temas salen repartidos).
- Sin dependencias, sin commit ni push. Archivos: `src/game/raid.ts` y, mejor, un módulo nuevo `src/game/raidprops.ts` que exporte las funciones por tema.

## Referencia de estilo (lee `.delegaciones/REFERENCIA_CODED_ARMS.md`)
**Prioridad normal (el usuario ve valor real en esta idea; debe quedar bien hecha y con coste controlado):** un efecto SUTIL de **materialización de la sala**: al abrir la puerta de una sala nueva (o al entrar), sus paredes y suelo aparecen con un barrido holográfico corto (≈0,6 s, emisivo/escaneo, sin luces reales), y los elementos de simulación pueden tener un parpadeo holográfico muy leve. Debe poder desactivarse en calidad Bajo.
## Criterio de aceptación
- Build y tests en verde; test nuevo (puro) de que el reparto de elementos es determinista por semilla y que ninguno cae sobre una puerta/pasillo (si la geometría lo permite).
- Capturas ANTES/DESPUÉS con Playwright, **fuera del repo**, en `C:\Github\_noche\capturas\07\` (una por tema si se puede lanzar cada tema; si no, di cuáles). Si Playwright no está disponible, dilo sin inventar.
- Informe: elementos añadidos por tema, coste en llamadas de dibujo y lo no comprobado.

## Verificación
```
npm run build
npx vitest run --minWorkers=1 --maxWorkers=2
```
