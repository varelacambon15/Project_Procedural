# Economía de la tienda (prompt 05-D) — propuesta [C]

Todos los números viven en `src/data/shop.json` (tienda) y `src/data/loot.json` (botín). La simulación está en
`src/game/economy.ts` y usa la misma lógica que el juego (botín, escaparate y cajas). Tú decides los ajustes finales.

## Tabla

| Concepto | Valor |
|---|---|
| Créditos iniciales | 150 |
| Ingreso por baja | pequeño 3 · normal 5 · grande 15 · jefe 40 |
| Ingreso por fin de oleada | 25 |
| Chatarra al desguazar | blanca 5 · verde 10 · azul 20 · morada 40 · legendaria 80 |
| Escaparate: precio base (nivel 8; +4 % por nivel) | blanca 45 · verde 120 · azul 420 · morada 1300 |
| Escaparate: composición | 2 × blanca/verde · 2 × verde/azul · 1 × azul/morada (nunca legendaria) |
| Escaparate: renovación | cada 15 min de tiempo de juego (se guarda) |
| Caja común | 140 · verde 70 % · azul 27 % · morada 3 % |
| Caja avanzada | 650 · azul 60 % · morada 36 % · legendaria 4 % · legendaria garantizada tras 15 sin salir |
| Sin armas | arma básica gratis en la tienda (nunca sin salida) |

## Suposiciones de la simulación

- 5 bajas por minuto (30 % pequeñas, 60 % normales, 10 % grandes) y una oleada cada 2,5 min.
- El jugador simulado mejora su mejor arma por la vía más barata que tenga a mano:
  - compra en el escaparate la mejor ranura que mejore la suya y pueda pagar;
  - si en el escaparate hay algo mejor que aún no puede pagar, ahorra para eso;
  - si no, abre caja común mientras su mejor arma es blanca o verde, y caja avanzada desde azul;
  - desguaza lo que sustituye y lo que no le sirve.
- Recoge todo lo que cae.
- 300 partidas de 1 h y 150 de 6 h (medianas, en minutos).

## Resultados

| Hito | Mediana (cualquier vía) | Escaparate | Caja | Botín |
|---|---|---|---|---|
| Primera compra | 0 min (con los créditos iniciales) | | | |
| Primera azul | 7,5 | rara vez la primera | 22,5 | 7,7 |
| Primera morada | 27 | rara vez la primera | 41 | 39 |
| Primera legendaria | 145 (≈ 2,4 h; 24 % la consigue en la 1.ª hora) | nunca (no está a la venta) | 220 | 342 |

| En 1 h (mediana) | |
|---|---|
| Compras (escaparate + cajas) | 4 (0 cajas comunes, 3 avanzadas) |
| Armas recogidas del suelo | 30 |
| Créditos ganados / gastados / ahorrados al final | 2570 / 2490 / 279 |

## Lo que no queda bien (honesto)

- **Morada algo pronto:** 27 min de mediana frente a tu horquilla de 30–45.
  - Para retrasarla: más escasa en el botín (`loot.json` → `epica`) o más cara la caja avanzada.
- **La caja común casi no se usa** con este jugador simulado: el botín da verdes y azules antes.
  - Para darle papel: bajarla a ~100 o subir su azul.
- **El escaparate rara vez es la primera vía** para azul o morada (el botín llega antes).
  - Se compra en él al principio (blancas y verdes) y de vez en cuando más tarde.
  - Si quieres que pese más: precios de azul y morada más bajos.
- **Botín:** he tenido que bajar los pesos de rareza (sobre todo morada y legendaria al acabar oleada y en enemigos
  grandes). Antes la legendaria llegaba en ~37 min.
  - La cantidad de armas que caen sigue dentro de la prueba del 04-B (unas 8 por cada 100 bajas, justo en el mínimo).
