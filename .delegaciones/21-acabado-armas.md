# Encargo 21 — Diseño del acabado de las armas (que parezcan armas de juego AAA)
Agente: artist-3d.
## Objetivo
Mejora el **diseño visual** de las armas generadas (`src/weapons/finish.ts`, `recipes.ts` + `src/data/recipes.json`, `accessories.ts`, `assembler.ts`), sin cambiar su forma, estadísticas ni rarezas:
1. **Desgaste**: bordes gastados y arañazos (roughness/color con texturas procedurales cacheadas), más en eras clásica y rústica, casi nada en moderna y sci-fi.
2. **Acabados con identidad por era**: anodizado, cerakote en 6–8 colores sobrios, polímero texturizado, madera barnizada, metal pavonado; combinaciones coherentes (no arcoíris).
3. **Detalles de marca**: grabados e inscripciones procedurales pequeñas en el cajón y el cañón (decals en texturas) y marca de rareza discreta.
4. **Legendarias**: venas luminosas actuales (`legendvein`) más refinadas y un único detalle de latón en gatillo o palanca; nada de boquillas de color ni luces reales.
5. Coherencia: estilos y texturas coherentes entre las piezas de un arma (regla del usuario).
## Criterio
Hojas por tipo antes/después con `window.__bench.lotSheet` (mismas semillas) en `C:\Github\_noche\capturas\21\`. Tests existentes intactos (`tests/recipes.test.ts`, `tests/accbank.test.ts`, `tests/generator.test.ts`).
