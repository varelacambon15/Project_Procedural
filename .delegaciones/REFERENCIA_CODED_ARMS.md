# Referencia de diseño: Coded Arms (Konami, PSP, 2005)

Ficha propia a partir del análisis en vídeo de JarekTheGamingDragon (transcrito por el usuario). Es **inspiración de estilo y de estructura, no algo que recrear**: el juego es propio.
Las opiniones del reseñador NO son decisiones del usuario; el usuario decide.
**Uso: fuente de ideas con valor real (el usuario las considera relevantes). Prioridad normal, siempre dentro de los objetivos y restricciones de cada encargo.**

## Conclusiones del director
El juego es, en esencia, un sucesor espiritual de Coded Arms (simulación, sectores, botín aleatorio, jefes fijos, sector infinito). Lo que hace que Coded Arms se sienta «completo» son tres cosas:
1. **Presentación de simulación**: salas que se materializan, parpadeo holográfico. Nuestro punto más flojo y más barato de mejorar → es la firma visual del juego.
2. **Combate legible**: ataques telegrafiados y enfrentamientos con sentido (energía contra robots). Legibilidad = sensación triple A.
3. **Estructura de partida**: sectores temáticos con su propia facción, jefes diseñados y un tramo infinito. Nosotros ya lo tenemos a medias (hack por sectores, jefes, oleadas infinitas).
Y dos trampas a evitar: **rendimiento** (los 20 FPS fueron lo único gráfico que molestó) y **puntería** (dispersión al moverse y mala respuesta del stick).
Ideas de diseño que NO están en la cola de esta noche y requieren decisión del usuario: ventajas/debilidades elementales por familia enemiga con icono en el HUD; facción de enemigos asociada a cada tema de incursión; jefes diseñados por tema con presentación (nombre en pantalla y pausa de cámara); ayuda de apuntado configurable para mando; pequeña secuencia de introducción y cierre.

**Principio del usuario:** nuestro juego es distinto, mucho más pulido y modernizado; de Coded Arms se respetan y adaptan las ideas, no el aspecto ni las limitaciones técnicas de una PSP de 2005.

## Qué hace bien (y por qué nos interesa)
- **Estética de simulación holográfica**: entorno con ligero parpadeo/borrosidad de holograma, y **cada sala se materializa delante del jugador al abrir una puerta**. → ambientación de incursiones, hack y defensa.
- **Texturas detalladas, armas con buena respuesta, recargas fluidas, sonido contundente.** → animación y FX de armas.
- **Animaciones de enemigos legibles: permiten anticipar el ataque** (anticipación clara antes del golpe). → telegrafiado visual de los ataques.
- **Fuego muy logrado** (lanzallamas/napalm) y variedad de armas de energía (pulso cargable, haz continuo). → FX de fuego, eléctrico y energía.
- **Estructura**: tutorial → sectores por áreas (ciudad, base, ruinas) con enemigos distintos por área → jefes **no aleatorios**, grandes, con barra amplia y justos → «sector infinito» para seguir con el equipo. (Nuestro modo hack por sectores ya va en esa línea.)
- **Equipo de cabeza, pecho y piernas** + mejoras recogidas que suben nivel y daño del arma activa. (Ya tenemos armaduras y niveles.)
- Música variada y acorde con la realidad virtual.

## Qué critica (a evitar)
- **Techo de 20 FPS**: lo único gráfico que molesta; confirma que el rendimiento y la fluidez pesan mucho en la sensación de calidad.
- **FOV muy estrecho**: aceptable en una portátil, no en monitor. → ofrecer FOV ajustable en PC.
- **Puntería**: círculo grande de ayuda que no marca el impacto real y mucha **dispersión (bloom) al moverse**, que obliga a pararse; mala aceleración con stick analógico. → ojo con la dispersión al moverse y con la sensibilidad del mando (decide el usuario).
- Historia casi inexistente entre la intro y el final.
- Truco de **recargar y cambiar de arma al instante** (la primera queda recargada): es un exploit/mecánica a vigilar.

## Cómo se traduce en el trabajo de esta noche (sin cambiar reglas del usuario)
- Encargo 07 (incursiones): efecto sutil de **materialización de la sala** al abrir la puerta; parpadeo holográfico leve en elementos de simulación.
- Encargo 14 (FX): **fuego creíble** (llamas con sprites aditivos, brasas) y FX de energía (carga, haz continuo) acordes a los elementos fuego/eléctrico/explosivo ya existentes.
- Encargo 16 (animación): comprobar si cambiar de arma durante una recarga la completa al instante (solo informar) y añadir **ajuste de FOV** si no existe.
- Encargo 17 (atmósfera): sensación de simulación holográfica coherente por zona, sin luces reales nuevas.
- Encargo 18 (enemigos): **telegrafiar visualmente el ataque** (anticipación legible) sin tocar tiempos de IA, daño ni vida.
