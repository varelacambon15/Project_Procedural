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
| Escaparate: precio base (nivel 8; +4 % por nivel) | blanca 45 · verde 120 · azul 420 · morada 1500 |
| Escaparate: composición | 2 × blanca/verde · 2 × verde/azul · 1 × azul/morada (nunca legendaria) |
| Escaparate: renovación | cada 15 min de tiempo de juego (se guarda) |
| Caja común | 120 · verde 68,5 % · azul 30 % · morada 1,5 % |
| Caja avanzada | 850 · azul 68 % · morada 28 % · legendaria 4 % · legendaria garantizada tras 15 sin salir |
| Sin armas | arma básica gratis en la tienda (nunca sin salida) |

## Suposiciones de la simulación

- 5 bajas por minuto (30 % pequeñas, 60 % normales, 10 % grandes) y una oleada cada 2,5 min.
- El jugador simulado mejora su mejor arma por la vía más barata que tenga a mano:
  - compra en el escaparate la mejor ranura que mejore la suya y pueda pagar;
  - si en el escaparate hay algo mejor que aún no puede pagar, ahorra para eso;
  - si no, abre caja común mientras su mejor arma es blanca o verde, y caja avanzada desde azul;
  - con blanca o verde, prefiere la caja común a ahorrar si sale más barata por mejora esperada
    (precio ÷ probabilidad de azul o más) que la ranura del escaparate;
  - desguaza lo que sustituye y lo que no le sirve.
- Recoge todo lo que cae.
- 300 partidas de 1 h y 150 de 6 h (medianas, en minutos).

## Resultados

| Hito | Mediana (cualquier vía) | Escaparate | Caja | Botín |
|---|---|---|---|---|
| Primera compra | 0 min (con los créditos iniciales) | | | |
| Primera azul | 4,7 | rara vez la primera | 10 | 9,4 |
| Primera morada | 30 | rara vez la primera | más de 60 | 40 |
| Primera legendaria | ≈ 2,5 h (20 % la consigue en la 1.ª hora) | nunca (no está a la venta) | | |

| En 1 h (mediana) | |
|---|---|
| Compras (escaparate + cajas) | 4 (1 caja común, 2 avanzadas) |
| Armas recogidas del suelo | 30 |
| Créditos ahorrados al final | ≈ 640 |

## Ajuste de la ronda 07

- **Morada en 30 min** (antes 27): caja avanzada a 850 con algo menos de morada (28 %) y morada del escaparate a 1500.
- **La caja común tiene papel:** más barata (120) y con más azul (30 %). Es la apuesta barata del principio: sale
  más a cuenta por mejora esperada que ahorrar para la azul del escaparate. La primera azul llega hacia los 5 min.
- El botín no se ha tocado (sigue en ~8 armas por cada 100 bajas).

## Lo que sigue sin quedar del todo bien (honesto)

- **El escaparate rara vez es la primera vía** para azul o morada (el botín y las cajas llegan antes).
  - Se compra en él al principio (blancas y verdes) y de vez en cuando más tarde.
  - Si quieres que pese más: precios de azul y morada más bajos.
- **Créditos ahorrados (~640 al acabar la hora):** el jugador simulado guarda para la caja avanzada; si en juego
  sobra dinero, se puede abaratar algo la caja avanzada o subir la morada del escaparate a la venta.
