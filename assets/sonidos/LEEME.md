# Pack de sonidos (por tipo de arma)

Formato: OGG Vorbis mono 44,1 kHz (3 MB en total). Todo se describe en `manifest.json`; las rutas son relativas a esta carpeta.

## Estructura de `manifest.json`
- `tipos.<tipo_juego>` para pistol, revolver, smg, rifle, shotgun, sniper, lmg y crossbow:
  - `disparo`: varias muestras; elegir una al azar en cada tiro.
  - `silenciado`: usar si hay bocacha de tipo silenciador montada.
  - `grave`: capa de graves; mezclar ~0,5 junto al disparo.
  - `lejano`: eco de distancia; solo para disparos de enemigos o lejanos.
  - `seco`: gatillo sin munición (`empty`).
  - `recarga`: variantes `{id, pasos:[{evento, archivo, en}]}`. `en` es la fracción (0–1) del tiempo de recarga en la que suena cada paso. Elegir una variante al azar por arma y fijarla a su `id`/semilla.
  - `accion`: sonidos de corredera, cerrojo (`cerrojo`), bombeo (`bombeo`) o martillo, para el ciclo entre disparos según el campo `accion` del arma.
  - `volumen_sugerido`: ganancia relativa entre tipos (los archivos están igualados de pico).
- `efectos`: casquillo, zoom de mira, apuntar, sacar arma, explosiones, humo, aturdidora, granadas, melee y recogida de objetos.
- `scifi_storm_psr`: disparos con carga y apagado, para armas de la era Sci-fi realista.

## Uso recomendado
Variación de tono ±4 % y de volumen ±10 % en cada disparo. La cadencia automática debe cortar el disparo anterior (fade corto) y no solapar colas largas.
Los tipos `launcher` y `flamethrower` quedan fuera por ahora.
