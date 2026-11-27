# Guiones de captura con Playwright (tareas 1, 2, 5 y 7)

Sirven para comprobar visualmente un cambio sin jugar: arrancan el juego, colocan enemigos u objetos con
`window.__game`, avanzan el tiempo **fotograma a fotograma** (`__game.debug.manual = true` y `__game.step(1/60)`;
así las capturas son fiables aunque el render por software vaya lento) y guardan PNG.

## Uso
1. Arranca el juego: `npm run dev` (puerto 5199) o `npx vite --port <puerto>`.
2. Lanza el guion (si Playwright no está en el proyecto, apunta `NODE_PATH` a donde esté instalado):
   ```bash
   URL=http://localhost:5199/ node tools/capture/enemigos_pelea.mjs salida 1280 720
   ```
3. **Mira las capturas tú mismo** (a 1280×720 y 960×470) antes de dar nada por bueno. Para hojas de contactos:
   `montage salida/*.png -tile 3x -geometry 640x360+2+2 hoja.jpg` (ImageMagick).

| Guion | Tarea / rama mínima | Qué captura |
|---|---|---|
| `enemigos.mjs <out> [w] [h]` | 2, `opus/enemigos` | Los tres enemigos nuevos, galope, salto con aviso, cura y carga del centinela |
| `enemigos_giro.mjs <out> <tipo> [dist] [cabeceo]` | 2 | Un enemigo girado 0/90/180/270° (orientación del modelo) |
| `enemigos_pelea.mjs <out> <w> <h>` | 2 | Pelea real en tres instantes; imprime estado y errores de consola |
| `fisicas.mjs <out>` | 1, `opus/rapier` | Ragdolls, desmembramiento, explosión entre cajas y coste con 20 ragdolls |
| `reticulas.mjs <out>` | 5, `opus/reticulas` | Retículas en una óptica holográfica |
| `sonidos.mjs` | 7, `opus/sonidos` | Cuenta los sonidos reproducidos al andar, saltar y disparar |

La herramienta de armas en primera persona (`vmcap.mjs`, con su `README.md`) está en la rama `opus/armas`.

## Trucos
- Sin interfaz: inyecta `body > *:not(canvas){visibility:hidden}` (lo hacen `enemigos_giro.mjs` y `fisicas.mjs`).
- Enemigo quieto para un retrato: `d = __game.waves.spawnAt(tipo, pos); d.chase = null;`.
- En la primera carga, el GLB tarda: espera ~3 s tras `__game` antes de crear enemigos (los guiones ya lo hacen).
