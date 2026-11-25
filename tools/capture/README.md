# Capturas secuenciales del arma en primera persona (tarea 13)

`vmcap.mjs` equipa armas REALES del generador (por clase, con y sin accesorios), ejecuta cada acción con un paso de
tiempo fijo y guarda fotogramas, anclas medidas y hojas de contactos. Es la herramienta de validación de la posición
de las armas y de sus animaciones: evaluar un solo fotograma por paso fue lo que dejó pasar las «manos locas».

## Uso
1. `npm run dev` (puerto 5199).
2. En otra terminal:
   ```bash
   node tools/capture/vmcap.mjs --classes pistol,revolver --actions idle,fire,draw,reload,reloadEmpty,inspect,ads
   ```
   Si Playwright está instalado fuera del proyecto, añade su carpeta a `NODE_PATH`.

Opciones: `--sizes 960x470,1280x720` (por defecto los dos), `--frames 16` (16 o más para evaluar una acción),
`--per 2` (armas por clase: una común sin óptica y otra con óptica), `--seeds pistol:52,rifle:24`, `--names "Ox 586"`,
`--crop 0.2,0.12,1,1` (zona de cada fotograma que se ve en la hoja), `--out <carpeta>`.

## Salida
- `<out>/<clase>/<arma>/<tamaño>/<acción>_NN.png`: los fotogramas.
- `<out>/<clase>/<arma>/<tamaño>/<acción>.json`: por fotograma, la empuñadura y la boca en pantalla (fracciones),
  la caja del arma, la fase de recarga, la distancia de encuadre y el grosor del modelo.
- `<out>/hojas/<clase>_<arma>_<acción>.png`: hoja de contactos con los dos tamaños en orden (el cuadrito magenta es el
  centro de la pantalla).

## Cómo funciona
El juego tiene un modo manual (`__game.debug.manual`): el bucle deja de avanzar solo y cada `__game.step(dt)` simula un
fotograma fijo; con `debug.noDraw` se simula sin dibujar (los pasos intermedios), y solo se dibuja el que se captura.
