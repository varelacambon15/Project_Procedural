# Encargo 17 — Atmósfera e iluminación del escenario por zonas
Agente: artist-3d.
## Objetivo
Sin añadir luces reales, da a cada zona una **atmósfera propia** (`src/game/world.ts`, `raid.ts`, `nightcity.ts`, `simtex.ts`, y `main.ts` para el cambio por zona):
1. **Volumetría falsa**: haces de luz (conos aditivos suaves) bajo lámparas y focos, motas de polvo (puntos instanciados) y niebla con gradiente vertical teñida por zona.
2. **Charcos o halos de luz** pintados en el suelo bajo cada lámpara (decals aditivos).
3. **Gradación por zona** (cambiando color de niebla y hemisferio, nunca el número de luces): hall limpio y claro, campo de tiro industrial cálido, sala de mando cian, incursiones oscuras con neón y paletas por tema.
4. Reflejos de suelo mejorados con el entorno (si existe del encargo 13) y reflejo de tiras emisivas.
5. **Prioridad normal:** sensación de **simulación holográfica** coherente por zona (ver `.delegaciones/REFERENCIA_CODED_ARMS.md`): parpadeo muy leve en elementos de simulación y gradación de color; nada que moleste ni cause mareo.
## Criterio
Capturas antes/después de hall, campo de tiro, sala de mando y una incursión de cada tema posible. Informe de coste.
