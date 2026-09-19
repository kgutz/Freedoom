# Malla de Escamas de Brea — validación local

Nuevo principal: **Escamas protectoras**, reducción 5/8/12% en rangos 1/2/3.
Mantiene defensa +3/+4/+5; no añade ataque, reflejo ni condición de vida.

## Orden y compatibilidad

En Cacería: defensa y crítico → Ojo (si está pendiente) → Malla → vida perdida.
Malla: `max(1, floor(daño final previo * (100 - porcentaje) / 100))` para
golpes positivos. Esquivas y ceros que ya producía Ojo permanecen en cero.
Ejemplo rango 3 + Ojo 27%: 100 → 73 → 64, no 61 por suma de porcentajes.
El efecto se captura al iniciar la expedición y dura todos sus encuentros.
Expediciones antiguas sin el campo nuevo conservan su snapshot (reducción 0).
No se aplica a daños/penalizaciones semanales ni concede reembolso de Forja.
Las transacciones históricas no se borran ni se recalculan; los resultados nuevos
mantienen los campos de reembolso en cero por compatibilidad.

No hay recetas actuales que incluyan relic_09. El normalizador recalcula su
herencia desde el rango si se incorpora a una receta; descarta herencias de
Malla ajenas a la receta, evitando convertir antiguos 20/30/40 en protección.
No se han añadido recetas nuevas.

## Simulación reproducible

`node scripts/audit-malla-hunt.mjs 1000`

192.000 expediciones: semillas 1–1000, cuatro clases, repartos ofensivo (todos
los puntos a ataque) y equilibrado (ataque/defensa/constitución), Bruma Fácil
nivel 1, Medio 5, Difícil 11; 8 variantes (base, Ojo rango 3, cada rango de Malla
solo y combinado con Ojo). Vida/maná completos, sin pociones ni secundarios.
Se aísla el principal: mismos atributos en todas las variantes, sin sumar la
defensa del equipamiento. No son estimaciones de la progresión con equipo completo.

Ejemplos: victoria %, daño recibido medio por expedición.

| Caso equilibrado | Base | Malla R1 | Malla R2 | Malla R3 | Malla R3 + Ojo R3 |
|---|---|---|---|---|---|
| Paladín Fácil | 6,3%; 129,62 | 35,4%; 120,15 | 35,4%; 119,93 | 72%; 114,50 | 80,5%; 107,72 |
| Paladín Medio | 33,3%; 143,90 | 66,4%; 134,24 | 81,7%; 127,36 | 88,3%; 123,12 | 94,6%; 115,89 |
| Hechicero Difícil | 65,1%; 155,46 | 81,1%; 146,61 | 86,4%; 141,38 | 93,1%; 132,57 | 97,1%; 123,05 |

La sinergia es fuerte y alcanza el 100% en varias configuraciones que ya tenían
tasas altas sin equipo. No elimina globalmente el riesgo ni produce inmunidad.
El redondeo hacia abajo amplifica la reducción efectiva de golpes pequeños y
puede igualar rangos 1 y 2; conviene vigilarlo con feedback. Se conservan los
porcentajes aprobados. Estos ensayos de entrada no sustituyen una auditoría de
las otras regiones ni de todas las combinaciones de equipo.

## Verificación

Suite completa: 706 pruebas / 53 archivos. Typecheck, build y diff-check correctos.
Ficha real de Malla R1 revisada en la demo: defensa +3, nuevo nombre y texto 5%,
sin reembolso. El aviso previo de cuota de almacenamiento de la demo sigue
visible; no se han borrado datos para resolverlo.
Sin publicación ni incremento de versión. Bruma Fácil mantiene energía 1.
