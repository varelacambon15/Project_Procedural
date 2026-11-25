# Encargo 13 — Materiales PBR y entorno (reflejos y metal creíbles)
Agente: artist-3d.
## Objetivo
1. Añade un **mapa de entorno** (PMREM generado por código desde una escena o gradiente interior, p. ej. RoomEnvironment; NO es una luz) para que metal, polímero y suelos reflejen algo. Hoy los metales se ven planos.
2. Ajusta **metalness/roughness** coherentes por material en armas (`src/weapons/finish.ts`, `assembler.ts`) y en el mundo (`src/game/world.ts`, `nightcity.ts`, `simtex.ts`): acero con rugosidad variable, polímero mate, suelos con pulido, paneles con ligera reflectividad.
3. Variación de rugosidad con texturas procedurales pequeñas de canvas, cacheadas y compartidas (sin texturas pesadas).
4. Calidad según «Calidad gráfica» si ya existe (encargo 12); si no, un valor interno `ENV_INTENSITY` escalable.
## Restricciones propias
No cambies el diseño ni los colores de identidad (rarezas, brazos). No uses `MeshPhysicalMaterial` en masa (caro); solo donde aporte mucho (visores, cristales).
## Criterio
Hoja de armas (6 por tipo, mismas semillas) antes/después con `window.__bench.lotSheet` y capturas del hall. Sin saltos de rendimiento (informa).
