# Tarea 13 — Estado VALIDADO por el usuario (para quien releve)

Rama `opus/armas` (desde `trabajo-24-11`). Lee también `docs/informes/armas.md` (qué se hizo) y
`tools/capture/README.md` (cómo capturar). Este fichero recoge SOLO lo que el usuario ha revisado y su veredicto;
actualízalo cada vez que valide algo.

## Cómo se revisa con el usuario
- Se le enseñan parejas ANTES / AHORA a 1280×720 con la MISMA arma (mismas semillas: `pistol:94`, `revolver:59`,
  `smg:220`, `rifle:24`, `shotgun:304` y `shotgun:17`, `bullpup:52`, `lmg:87`, `sniper:409`), capturadas con
  `tools/capture/vmcap.mjs --seeds ... --actions idle --frames 1`.
- Va dando notas por imagen; lo aprobado no se vuelve a tocar.

## Dónde se ajusta el encuadre
`src/data/anim.json` → `classes.<clase>.frame`: `grip` (empuñadura en pantalla, fracciones), `depth` (distancia en m:
menos = más grande), `aim` [cabeceo, guiñada] en rad (dirección fija del cañón; si falta, se usa `muzzle`, la boca en
pantalla, que en armas largas tendía a «torcer» el arma), `bulk`/`depthMax` (las gruesas se alejan). Lo resuelve
`src/game/hipframe.ts`.

## Veredictos
| Elemento | Estado | Notas del usuario |
|---|---|---|
| Pistola (cadera) | ✅ VALIDADA | «La doy por buena». `aim [0.05,0.13]`, `grip [0.64,0.83]`, `depth 0.33`. |
| Fusil (cadera) | ✅ VALIDADO | «A mejor, más cerca y se ve bien». Sigue con `muzzle` (sin `aim`). No tocar. |
| Bullpup (cadera) | ✅ VALIDADO | «Muchísimo mejor así» (cañón al frente con `aim`). |
| Francotirador (cadera) | 🟡 casi | «Mejor, más centrado y cercano»; falta corregir el agarre del guardamanos. |
| Puños en reposo | 🟡 casi | Referencia del usuario: puños bajos y separados tipo Source/Apex. «Muy buena pinta». Último cambio: pulgares cerrados y dedos que ya no miran abajo (sin validar aún). La animación del golpe NO es necesaria («ignora la guardia»). |
| Dedos (agarre) | 🟡 mejorando | «Los dedos de agarre han mejorado». Pulgar con `thumbTurn` para rodear la empuñadura. |
| Revólver | 🔧 en curso | Pidió más cerca, centrado y un poco más grande (último: `depth 0.27`, sin validar). El índice de la izquierda asoma. |
| Subfusil | 🔧 en curso | Distancia: término medio entre la primera versión nueva (más cerca) y la original (último: `depth 0.37`). La mano izquierda debe agarrar «donde debe» (guardamanos/empuñadura vertical). |
| Ametralladora | 🔧 en curso | NO girarla: alejarla y CENTRARLA. Último: `aim [0.02,0.02]`, `grip [0.68,0.86]`, `depth 0.56` (sin validar). |
| Escopetas | ❌ hay que trabajarlas mucho | Mano izquierda atravesando el guardamanos o en la punta del tubo; posición que no convence. Hecho: sin pieza de empuñadura, la derecha va a la garganta de la culata (antes flotaba); la izquierda no pasa de 24 cm. |
| Recargas, inspección, sacar | ⏳ sin revisar | Hojas en `docs/informes/img/armas_*`. |
| Tiempos de manejo (`gunfeel.ts`) | ⏳ sin revisar | |

## Lecciones (no repetir)
- El cabeceo «de los vídeos» (~19° boca arriba) se ve «torcido hacia arriba» en el juego: armas casi rectas al frente.
- Fijar la boca en pantalla con armas de empuñadura adelantada (bullpup, escopeta) las inclina: usar `aim`.
- Para que se vea más arma: alejar y centrar, sin aumentar la convergencia (si no, «se tuerce»).
- Antes de enseñar nada: capturar a 1280×720 y MIRAR. Las capturas en las que la primera arma sale negra son un fallo
  del script (primer fotograma), no del juego: repetir.
