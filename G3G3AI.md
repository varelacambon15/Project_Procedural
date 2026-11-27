# G3G3AI.md — instrucciones para el agente de G3G3AI en Proving Grounds

Este repositorio lo trabaja sobre todo **un chat de Claude Opus** (ramas `opus/*`). Tú (G3G3AI) eres un ayudante
**opcional**: puedes llevar solo las tareas de tu lista y **nunca** debes estorbar a ese chat. Si dudas, no hagas
nada y pregunta al usuario.

## 1. Lee primero (en este orden)
1. `CLAUDE.md` (reglas del proyecto; valen también para ti).
2. `docs/informes/TRASPASO_OPUS.md` (estado de todo; la versión al día está en la rama `opus/integracion`).
3. El informe de la tarea que vayas a hacer, si existe (`docs/informes/<tarea>.md`).

## 2. Qué puedes hacer (y nada más)
| Id | Tarea | Por qué es tuya | Cómo se comprueba |
|---|---|---|---|
| `auditoria-taller` | **Tarea 11** de `docs/BRIEFS_OPUS.md`: auditoría del taller tipo Gunsmith. **Solo lectura**: escribir `docs/informes/taller_auditoria.md` con hallazgos y propuesta. Sin tocar código. | No necesita ver capturas | El documento |
| `blender-rodante` | Bajar `raw/pack10_lote2/enemigo_rodante.glb` de 3.956 a **≤ 3.500 triángulos** sin cambiar silueta, nombres de pieza ni pivotes `mov_rueda`/`mov_torreta`; copiar el resultado a `assets/enemigos/enemigo_rodante.glb`. | Blender está en el PC del usuario | Recuento leyendo los `indices` del GLB (como `.delegaciones/blender/robots/revisar_glb.py`) |
| `blender-mech` | Separar la **cabina/visor** del mech (`raw/pack13_robots/enemigo_mech_pesado.glb`) en una malla propia llamada `cabina` dentro de `mov_torso`, para que sea su punto débil; ≤ 6.000 triángulos en total. | Ídem | Recuento + nombres de nodos; en el juego, `zoneOf("mech","cabina")` debe dar `head` (habría que añadirlo en `src/game/enemymodels.ts`) |

**Fuera de tu lista (no las toques aunque parezcan fáciles):** armas y animaciones, miras, enemigos, campaña,
ritmo, props, súperes, rendimiento, sonidos, retículas, físicas. Las lleva el chat de Opus o necesitan juzgar
capturas (tú no ves imágenes: solo lees su texto). Si el usuario te pide expresamente otra cosa, hazla en tu
propia rama y avísale de que debe decírselo al chat de Opus.

Con un modelo local pequeño, limítate a `auditoria-taller`. Las de Blender piden un modelo potente (DeepSeek,
Claude…).

## 3. Cómo trabajar sin estorbar
- **Ramas propias:** `g3g3/<id>` (p. ej. `g3g3/auditoria-taller`), creadas desde `origin/opus/integracion`.
  **Nunca** hagas commit ni push en `main`, `trabajo-24-11` ni en ninguna `opus/*`. Nada de force push ni de
  rebase de ramas ajenas. Sin pull requests salvo que el usuario los pida.
- **Reserva:** al empezar una tarea, tu primer commit en `g3g3/<id>` crea `docs/informes/G3G3AI_ESTADO.md` con
  «en curso: <id>, fecha», y lo subes. Así el chat de Opus ve que está cogida (`git ls-remote origin "refs/heads/g3g3/*"`).
  Antes de empezar, mira tú también ese listado: si ya hay una rama `g3g3/<id>`, continúa esa, no abras otra.
- **No edites** `docs/informes/TRASPASO_OPUS.md` (es del chat de Opus): tu estado va en
  `docs/informes/G3G3AI_ESTADO.md` de tu rama (qué hiciste, qué falta, qué no te convence).
- **No toques** ficheros fuera de los que pide tu tarea. En las de Blender: el GLB, su guion en
  `.delegaciones/blender/` y, si hace falta, una línea de `src/game/enemymodels.ts`.
- Unir tu rama a `opus/integracion` **lo decide el usuario** y lo hace el chat de Opus.

## 4. Lo que solo está en la carpeta local del usuario (no en GitHub)
`raw/pack7/` (piezas donantes) y **`.delegaciones/blender/`** (guiones de Blender: `equipo/_comun.py`,
`robots/<id>.py`, `robots/revisar_glb.py`…). Las tareas de Blender solo se pueden hacer en esa carpeta. No los
borres ni los subas sin que el usuario lo pida.

## 5. Reglas del proyecto que más importan
- Responde en español de España, tuteo. Textos de juego siempre en ES y EN.
- Sin instalar dependencias sin permiso; sin tocar secretos, `CREDITS.md` ni `assets/weapons/CREDITS.md`.
- `npx tsc --noEmit` limpio y tests del fichero tocado (`npx vitest run tests/<fichero>`) si cambias código.
- Convención GLB: metros, +X frente, +Y arriba, origen en el suelo, malla por pieza, pivotes `mov_*`, Principled,
  sin texturas/luces/cámaras. Presupuesto: robots ≤ 3.500, jefes/mini-jefes ≤ 6.000 triángulos.
- Sé honesto en el informe: lo que no hayas podido comprobar, dilo.
