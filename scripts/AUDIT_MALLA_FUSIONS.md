# Auditoría de las seis fusiones de Malla

## Resultado

Implementadas fusion_26–31 y fusion_recipe_26–31. Conceptos, nombres, lore,
materiales, prompts y valores: DESIGN_MALLA_FUSIONS.md. Todas heredan ambos
ingredientes; se conservan atributos, efectos, afijos y snapshots de desfusión.
Malla+Corazón y Malla+Ojo quedan explícitamente incompatibles. No se han cambiado
las estadísticas de enemigos ni los efectos base. Sin publicación o versión nueva.

## Simulación reproducible

`node scripts/audit-malla-fusions.mjs 100`

1.123.200 expediciones válidas en la batería final: seis fusiones × tres rangos ×
tres dificultades × tres regiones × cuatro clases × dos repartos × dos estados
de maná × dos variantes × cien semillas, más las segundas reliquias de rango3.
Repartos: 3 puntos/nivel en ataque físico o mágico según clase, o 1/nivel en
ataque, defensa y constitución. Niveles mínimos de cada dificultad/región;
Vida completa y Maná al100% o10%. Se verifican los ratios del snapshot al iniciar.
Equipamiento heredado y atributos incluidos, sin pociones ni afijos. Cargas
26/28 siempre listas: representa su caso más favorable, no frecuencia de uso.
R3 prueba además cada base de Cacería 05/06/07/08 no incluida en la receta, una
segunda reliquia a la vez. Ojo puede equiparse como segunda pieza según las
reglas actuales; lo prohibido aquí es fusionarlo directamente con Malla.

Se compara el mismo equipo y semilla con el bono nuevo apagado/encendido.
La primera corrida de diagnóstico duplicó Maná completo por pasar un argumento
incorrecto al simulador; NO sustenta estos resultados. Se corrigió la entrada y
se repitió íntegramente la batería con comprobación explícita del snapshot.

### Rango3, Difícil: agregado de regiones/clases/repartos/maná/segundas piezas

| Fusión | Victorias sin / con bono | Daño recibido medio sin / con |
|---|---|---|
| Manto26 | 96,88% / 97,18% | 104,80 / 101,24 |
| Hoja27 | 96,78% / 96,78% | 104,09 / 104,09 |
| Yelmo28 | 97,10% / 97,57% | 92,25 / 89,66 |
| Redoma29 | 97,51% / 97,51% | 100,66 / 100,66 |
| Colmillo30 | 98,48% / 98,53% | 101,67 / 101,67 |
| Collar31 | 99,38% / 99,55% | 102,34 / 102,34 |

Manto/Hoja/Yelmo:24.000 semillas por variante y fila; otros:19.200.
La XP de Hoja no modifica victorias, como corresponde. Su bonus medio R3 en
Difícil fue3,60XP (máximo9). Redoma recuperó2,28Maná medio por expedición y
Colmillo1,42Vida; sus topes son por enemigo, no recursos infinitos.

### Riesgos y decisión de balance

- Se mantienen los valores conservadores iniciales. No hubo violaciones de
  topes o recursos; pruebas explícitas cubren mínimo de daño, no resurrección y
  combinaciones con Ojo. R3 Yelmo alcanza15% de reducción sostenida, no inmunidad.
- Mayor salto local: RedomaR1, Paladín equilibrado, Bruma Fácil, Maná10%, +25pp.
  No es una mejora global de25pp: agregado Fácil98,44→98,98%. El Maná extra
  cruza el umbral de un ataque eficaz en ese caso específico. Vigilar en beta.
- MantoR2 mostró +16pp local en Búnker Difícil/Paladín ofensivo; agregado
  Difícil91,19→92,48%. El presupuesto máximo sigue siendo3 puntos evitados.
- CollarR3 tiene victorias muy altas YA sin bono. En Fácil/Medio llega100% con
  y sin bono en esta matriz. Son piezas avanzadas R3 enfrentadas al nivel mínimo
  de acceso; esto no demuestra que la progresión real de esas zonas sea trivial.
  No se nerfea equipo heredado ni otras zonas fuera del encargo. Para revisar
  ese balance haría falta acordar nivel/equipamiento objetivo de cada zona.
- No se simularon todas las rarezas/afijos ni pociones o atributos arbitrarios.
  Semillas100 por escenario: útil para regresión, no garantía estadística exacta.

## Persistencia y seguridad

- Cargas26/28 se normalizan solo si la pieza está equipada. El evento debe
  ocurrir equipada; no recarga por repetir hábito/ciclo ni por refusión.
- Una salida inválida no consume; una salida válida guarda los efectos y
  consume la carga mediante el flujo existente. Desequipar/reemplazar/desfusionar
  borra la carga. Cambiar equipo no altera el snapshot activo.
- Reserva26 evita como máximo1 adicional por golpe y comparte presupuesto
  entre enemigos. No reduce a cero. El daño de reserva no cuenta otra vez como
  daño evitado por Escamas para fabricar recursos.
- Conversiones usan floor del daño acumulado, con tope por enemigo. Los puntos
  generados se gastan incluso con recursos llenos; no se guardan para después.
  Curación tras daño, solo vivo. Collar activa después del umbral y no traslada
  su activación al siguiente enemigo (las centésimas normales de Vampirismo
  conservan el comportamiento existente).
- XP solo por enemigo vencido que cumpla el umbral; va en el botín normal y no
  vuelve a cobrarse al resolver la misma expedición. No cambia jefes semanales.
- Guardados viejos: campos ausentes son cero; el antiguo40% de reembolso de
  Forja nunca se interpreta como protección. Normalización recalcula5/8/12.

## Arte e interfaz

Finales en public/relics, con PNG fuente hermano `_source.png`:

- fusion_26_manto_lluvia_olvidada.webp
- fusion_27_hoja_nido_enlutado.webp
- fusion_28_yelmo_cielo_carbonizado.webp
- fusion_29_redoma_lluvia_cautiva.webp
- fusion_30_colmillo_raiz_acorazada.webp
- fusion_31_collar_rastreador_brea.webp

1254×1254, RGBA genuino; WebP lossless exacto (igualdad de todos los bytes RGBA),
sin remuestreo. Total3.791.508 bytes en WebP (~3,62MiB). Script
`python scripts/optimize-malla-fusions.py`. Margen mínimo visible63px; siluetas
completas, sin bordes cortados ni falsos fondos de transparencia.

Verificadas seis fichas con renderer/CSS reales en fixture aislado sin guardar
partidas: tmp/malla-fusions-review.html. Escritorio y móvil390px CSS efectivos,
seis títulos sin desbordamiento,18filas de efectos,30imágenes cargadas y dentro
de sus contenedores. Colección/equipadas/forja/tienda comprobadas usando el
componente compartido y sus contenedores. Tienda no vende estas fusiones: solo
se verifica la compatibilidad visual del componente, sin añadir nuevas ofertas.
Algunas capturas largas cosidas repetían bandas; comprobación de DOM y capturas
de viewport no muestran elementos duplicados. Sin cambios en CSS ni en Aguijón.
Informe de Cacería muestra BONUS DE ESCAMAS con recuperación, reserva, XP o
Vampirismo activado; XP no se suma dos veces por el texto informativo.

## Verificación final

808 pruebas /55archivos correctos, incluidos46 tests nuevos de dominio y6 de
fichas más1 del informe. Typecheck, build y git diff --check correctos.
Build conserva aviso no bloqueante de bundle>500kB (510,60kB; gzip149,44kB).
Versión2.28.51 intacta, sin GitHub. Cambios previos conservados.
