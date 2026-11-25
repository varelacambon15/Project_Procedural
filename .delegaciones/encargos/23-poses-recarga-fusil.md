
## ACTUALIZACIÓN (23/11/2026) — usa los datos nuevos y varía
- Fuente adicional con el mismo formato: `.delegaciones/herramientas/poses/poses_lowpoly_iw.json` (38 modelos). Para fusiles usa `lowpolyak`, `lowpolyscarh`, `lowpolyhk416`, `lowpolyfal` (secuencia `reload_empty` y `reload`); toma 3–4 recorridos distintos, no uno.
- **Nada de copiar tal cual:** `poses.json` guarda recorridos normalizados y `handPathAt` aplica una VARIACIÓN determinista por arma (semilla del id del arma): duración ±8 %, amplitud del recorrido ±10 %, desplazamiento del punto de agarre ±1,5 cm, y mezcla (interpolación) entre dos recorridos fuente con peso por semilla. Test: dos armas distintas de la misma clase no dan exactamente el mismo recorrido, y la misma arma siempre da el mismo.
- No toques ficheros de Blender/`assets/equipo`/`raw`. Ejecuta de verdad y escribe los archivos; no te quedes en leer.
