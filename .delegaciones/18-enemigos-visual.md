# Encargo 18 — Enemigos: diseño visual y efectos
Agente: artist-3d.
## Objetivo (`src/game/dummies.ts`; no cambies lógica de IA, vida ni daño)
1. **Identidad visual por tipo**: líneas de paneles, emisivos de color por familia (visor, venas), siluetas ya existentes más legibles; élites y jefes con aura o marcas distintivas.
2. **Iluminación de contorno** (rim/fresnel) con un material compartido para que destaquen del fondo.
3. **Aparición**: efecto de materialización digital al spawnear (barrido de escaneo o disolución por clip plane), corto.
4. **Reacciones de impacto y muerte**: pulir las existentes (flash, píxeles) sin cambiar el desmembramiento.
5. Materiales compartidos y mallas fundidas donde se pueda (coste controlado).
6. **Prioridad normal:** **telegrafiado visual del ataque** (referencia en `.delegaciones/REFERENCIA_CODED_ARMS.md`): una anticipación legible antes de cada ataque (pose, destello o carga de unas décimas de segundo), usando los tiempos que ya existan. **No cambies tiempos de IA, daño ni vida**; si un tipo no tiene anticipación, añade solo el aviso visual en el instante en que empieza el ataque actual.
## Criterio
Hoja de enemigos por tipo antes/después y fotogramas de aparición y muerte. `tests/waves.test.ts` y los demás intactos.
