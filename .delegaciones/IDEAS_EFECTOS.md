# Ideas para ampliar el pool de efectos (22/11/2026)
Origen: búsqueda en internet (Destiny 2, Borderlands, Warframe, Outriders; los resultados fueron parciales) más conocimiento general del género. Son ideas ADAPTADAS con nombres propios, no copias. Hoy hay 46 efectos: 19 A (menores), 17 B (mayores/elementos) y 10 L (firmas legendarias). Cada uno cae en el sistema de eventos de `src/data/effects.json` (onShot, onHit, onCrit, onKill, onReload…) y se implementa en `recipes.ts` + `effects.ts`.
Dificultad: F = solo datos/receta; M = algo de código en el motor de efectos; D = mecánica nueva (afecta a otros sistemas).

## Tier A — menores (rara/épica/legendaria; coste 5–10 %)
1. **Eco de recarga** (F): tras una baja, la próxima recarga recupera 1 bala extra.
2. **Pulso de salto** (F): disparar en el aire da +10 % de precisión durante 1 s tras aterrizar.
3. **Mano derecha** (F): +12 % de daño si el arma está en el hueco principal y llevas otra equipada.
4. **Rastreador** (M): los impactos en la cabeza marcan al enemigo 3 s; las balas siguientes a una marca hacen +8 %.
5. **Cierre rápido** (F): el primer disparo tras recargar sale +20 % más rápido (menos retardo de arma).
6. **Parapeto** (M): agachado o pegado a cobertura, +10 % de daño y −15 % de retroceso.
7. **Aliento de combate** (M): 10 s en combate sin morir: +6 % de cadencia (se resetea al recibir daño).
8. **Cazador de élites** (F): +15 % contra enemigos con armadura o escudo.
9. **Recarga de oportunidad** (M): recargar con el cargador vacío es un 12 % más rápido.
10. **Residuo** (F): las bajas sueltan 1 % de carga de súper extra.
11. **Gatillo templado** (F): la ráfaga o el modo semiautomático cambia −10 % de retroceso acumulado.
12. **Reflejos** (M): al recibir daño, +12 % de cadencia durante 2 s.

## Tier B — mayores (épica/legendaria; coste 12–20 %)
13. **Munición perforante-térmica** (M): las balas dejan una marca de calor 2 s; el siguiente disparo a esa marca hace +35 %.
14. **Escarcha** (M): los impactos ralentizan al enemigo un 25 % (elemento nuevo «hielo/frío»; si no existe, requiere D).
15. **Cadena de bajas** (M): cada baja rápida (≤3 s) suma 1; al llegar a 3 el siguiente disparo es un rayo que salta entre 3 enemigos.
16. **Rebote de cargador** (M): los últimos 5 disparos del cargador rebotan una vez.
17. **Mina de bala** (M): cada 8.º disparo planta una mina en el impacto que detona tras 1,5 s.
18. **Doble recarga** (F): recargar con 0 balas recarga también tu arma secundaria.
19. **Ruptura** (M): los impactos reducen la armadura del enemigo 10 % (se apila hasta 3 veces, 4 s).
20. **Tiro de gracia** (F): +60 % de daño a enemigos con menos del 25 % de vida.
21. **Sobrecarga** (M): mantener el gatillo calienta el arma: +cadencia y se bloquea 1 s al llegar al máximo.
22. **Ventana de oportunidad** (M): tras esquivar o deslizarte, +25 % de daño durante 3 s.
23. **Lluvia ácida** (M): los impactos envenenan (daño por tiempo que se apila 3 veces).
24. **Pantalla de humo** (D): las bajas lanzan un pequeño humo que reduce la puntería enemiga en esa zona.

## Tier L — firmas legendarias (coste 20–30 %; una por arma)
26. **Sinfonía de plomo** (M): cada baja añade una «nota»; con 5, el arma dispara una ráfaga automática gratis de 10 balas.
27. **Marca de cazador** (M): el primer enemigo que dañas queda marcado; matarlo da una recarga completa y +30 % de daño 8 s.
28. **Cañón fantasma** (D): cada 7.º disparo lanza una réplica fantasma de la bala que atraviesa todo.
30. **Resonancia** (M): los impactos seguidos al mismo objetivo cargan un contador; al llenarse, onda de choque que daña y empuja.
31. **Tormenta de cristal** (M): los críticos fragmentan al enemigo y lanzan 4 esquirlas que atraviesan.
33. **Quiebre del tiempo** (D): tras 3 críticos seguidos, 2 s de ralentización del entorno (no del jugador).
34. **Ancla de gravedad** (D): cada 10.º disparo crea un pozo que atrae a los enemigos 2 s.

## Cómo elegir las primeras
**Regla del usuario (22/11):** los EFECTOS DE ARMA no curan, no reviven y no invocan drones ni aliados (descartadas: Segunda oportunidad, Aliado del vacío, Pacto de sangre). Curar, revivir e invocar sí pueden vivir en **súperes y equipamiento**. Única excepción pedida: un arma que, al recargarla, **flota y dispara hacia adelante unos 5 s antes de explotar** (ver 45).

Para ampliar rápido y con poco riesgo: todas las **F** (1, 2, 3, 5, 8, 10, 11, 18, 20) y las **M** de mayor efecto visible (4, 15, 17, 19, 26, 27). Las **D** (28, 33, 34) suman variedad pero tocan más sistemas: dejar para después.
Equilibrado: cada efecto nuevo con su coste de poder (`cost`) y comprobado con los tests de balance; sin luces reales; textos en español e inglés.

## Añadido: inspiración de Call of Duty: Infinite Warfare (22/11/2026)
Lo que se confirmó en las búsquedas: cada arma tiene 4 variantes (Común, Rara, Legendaria, Épica); un perk común aparece en todas, los de Rara y Legendaria son propios de su nivel, y los Épicos suelen ser únicos de cada variante (más dramáticos). Perks citados: Head Rush (bajas a la cabeza cargan el medidor), Trample (dobles bajas, bonus grande), Talon (bajas en el aire), Headhunter (baja a la cabeza rellena el cargador), Roll the Dice (un accesorio al azar al empezar), Vanish (tumbado, invisible a ciertas detecciones), Break Point (pasa a automática con menos retroceso, Épico), Atomiser Strike (ataque aéreo tras 25 bajas, Legendario) y Hunter Killer (Épico; solo conozco el nombre, el efecto de abajo es una adaptación). Idea de diseño útil: **los perks de mayor rareza son únicos y espectaculares; los de menor rareza son bonificaciones simples y repetibles.**

### Tier A (adaptados)
35. **Carga por cabeza** (F): las bajas a la cabeza dan un poco de carga de súper.
36. **Doblete** (F): dos bajas en menos de 2 s dan un bonus grande de carga de súper.
37. **Aéreo** (F): las bajas mientras saltas o caes suman carga de súper y +10 % de daño 2 s.
### Tier B
38. **Cabeza fría** (F): una baja a la cabeza rellena la mitad del cargador.
39. **Modo de ruptura** (M): al llenar un contador de impactos, el arma pasa a automática con menos retroceso durante 6 s (semiautomáticas y de ráfaga).
40. **Prueba de talla** (M): al empezar una incursión el arma gana 1 accesorio al azar de los compatibles (dura toda la incursión).
### Tier L
41. **Ataque orbital por racha** (M): cada 25 bajas con esta arma cae un ataque orbital (reutiliza el efecto de la súper «orbital»).
42. **Cazador-asesino** (M): las bajas lanzan 2 proyectiles buscadores (reutiliza «seekers») a los enemigos más cercanos.
43. **Sombra** (D): tumbado o agachado y quieto 2 s, los enemigos pierden de vista al jugador hasta que dispara; requiere IA de detección.
44. **Tirada del destino** (M): al equiparla, y cada vez que subes de nivel, el arma cambia su B al azar.

### Añadido a petición del usuario
45. **Recarga detonante** (D, legendaria): al recargar, el arma se suelta, flota delante de ti y dispara sola hacia adelante unos 5 s; después explota (daño de área). Tú recibes de inmediato una copia con el cargador lleno, así no te quedas sin arma. Por decidir: duración exacta (≈5 s), daño de la explosión, enfriamiento (p. ej. una vez cada 20–30 s) y si la copia conserva los efectos.

## Añadido: Borderlands 3 (Tediore y fabricantes) — 22/11/2026
Confirmado en las búsquedas: las armas Tediore se lanzan al recargar y explotan como granada; otras corren sobre sus propias patas disparando solas, describen un arco tipo bumerán y vuelven disparando en todas direcciones, o crean una esfera que persigue y estalla; una deja cuatro armas al explotar (descartada por la regla de no invocar). Jakobs: los críticos rebotan 3 balas al enemigo más cercano (Fingerbiter). Lo demás de esta sección es de conocimiento general del juego y NO está confirmado por la búsqueda.
La idea 45 «Recarga detonante» es la familia Tediore. Se propone como **un grupo de legendarias que sustituyen la recarga** (D; la recarga pasa a ser una acción de combate; la copia con cargador lleno te llega al instante; enfriamiento 20–30 s; el daño crece con las balas que quedaban en el cargador, como en Tediore):
46. **Lanzada** (D, L): el arma se lanza y explota como una granada al impacto (daño ∝ balas restantes).
47. **Patas** (D, L): el arma corre sola hacia adelante ~5 s disparando antes de explotar.
48. **Bumerán** (D, L): el arma describe un arco, dispara en todas direcciones y vuelve; explota al regresar o a los 5 s.
49. **Órbita** (D, L): la recarga lanza una esfera que persigue al enemigo más cercano y estalla.
### Gimmicks de fabricante adaptados (B/A)
50. **Rebote crítico** (M, B): los críticos rebotan 3 balas al enemigo más cercano (Jakobs; confirmado).
51. **Puntería creciente** (F, A): la precisión mejora mientras mantienes el fuego y se pierde al soltar (estilo Hyperion; no confirmado).
52. **Cargador creciente** (M, B): cada disparo seguido añade +1 al cargador hasta +100 %; se reinicia al recargar (estilo COV; no confirmado).
53. **Modo por apuntado** (M, B): sin apuntar dispara en ráfaga; apuntando, a tiro único de más daño (estilo Dahl; no confirmado).
54. **Conversión elemental** (M, B): al recargar el arma cambia de elemento (fuego, eléctrico, explosivo) en rotación (estilo Maliwan; ya hay «Dos mentes» alternando; esta lo generaliza).
