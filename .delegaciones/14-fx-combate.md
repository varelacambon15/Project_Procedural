# Encargo 14 — Efectos de combate (disparo, impacto, casquillos)
Agente: coder.
## Objetivo
Audita primero qué hay (partículas de `Dummy.react`, `src/game/gun.ts`, `tests/effects.test.ts`, `src/game/audio.ts`). Luego añade, todo con **pools o instancias** y sin luces reales:
1. **Fogonazo** de boca (planos cruzados aditivos, 1–2 fotogramas, rotación aleatoria; variantes por tipo, reducido con silenciador, escopeta más grande).
2. **Casquillos** expulsados con rebote y desaparición (instanciados, máx. N; desde el ancla de expulsión si existe o aproximada por tipo).
3. **Trazadoras** cortas en una de cada n balas.
4. **Impactos por material**: chispas en metal, polvo en hormigón, píxeles en carne (ya existe: unifica), con marcas pegadas (pool con tope).
5. **Hit marker** en la mira (normal, crítico, baja) e **indicador direccional de daño** al recibirlo; viñeta roja de vida baja (CSS ligera).
6. Humo fino en la boca tras ráfagas largas.
7. **Prioridad normal:** **fuego y energía** (referencia en `.delegaciones/REFERENCIA_CODED_ARMS.md`): llamas creíbles con sprites aditivos y brasas para el elemento fuego, y FX de carga y de haz continuo para el eléctrico/energía. Usa los elementos que ya existen (fuego, eléctrico, explosivo); no inventes mecánicas.
## Criterio
Test puro de los pools (no superan su tope; reciclan). Capturas de fogonazo, impactos y casquillos. Informe con topes y coste. En calidad Bajo los topes se reducen a la mitad.
