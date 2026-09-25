# Seis fusiones del Ojo — implementación local

Ids fusion_20–25, recipe ids equivalentes. Cada receta hereda los dos efectos,
atributos de Cacería, afijos unidos y snapshots para desfusión. Ojo + Corazón
queda incompatible. Ningún valor de las reliquias base cambia.

| Fusión | Ingrediente además de Ojo | Bono R1/R2/R3 |
|---|---|---|
| Ojo del Recuerdo Velado | Lágrima | Primer hábito carga +2/3/5 pp para la primera Mirada de la próxima Cacería |
| Aguijón de la Duda Atrapada | Daga | Primera Mirada que reduce daño: +2/3/5 XP por expedición |
| Yelmo del Centinela Inmóvil | Yelmo | Constancia carga +5/7/10 pp para Mirada contra cada enemigo de la próxima expedición |
| Ampolla de la Tentación Vigilada | Frasco | Mirada que reduce daño recupera 1/2/3 Maná por enemigo |
| Colmillo de la Duda Ponzoñosa | Colmillo | Mirada que reduce daño recupera 1/2/3 Vida por enemigo |
| Collar del Acecho Silencioso | Collar | Tras reducir daño, siguiente ataque real al mismo enemigo: +1/2/3 pp de Vampirismo |

## Orden y persistencia

- Hereda Mirada sin cambiar su activación: primer ataque del héroe prepara la
  reducción del siguiente golpe enemigo que conecta. Una esquiva no la consume.
- Cargas 20/22: una como máximo, se consumen solo tras iniciar una Cacería válida.
  Los efectos se guardan en el snapshot de expedición; equipar después no altera
  retroactivamente el combate. Desequipar/reemplazar/desfusionar borra la
  carga aún no consumida. Registros diarios/semanales impiden recargar por refusión.
- El bono 20 llega a la primera Mirada que realmente se activa, aunque el primer
  enemigo muera antes de contraatacar. El 22 dura los tres encuentros.
- Los bonos de golpe requieren daño prevenido positivo. Vida/Maná se aplican
  después del golpe, hasta su máximo; no resucitan. Aguijón conserva la XP si
  el golpe reducido fue letal y la integra en recompensas normales, sin duplicar.
- Collar espera al siguiente ataque con daño real (físico/mágico); las esquivas
  no gastan el token. El token no cruza enemigos. La curación usa las centésimas
  existentes de Vampirismo; el sobre-daño no cura y el exceso no se acumula.
- Los campos ausentes de guardados antiguos equivalen a cero/sin carga. Las
  transacciones y recompensas históricas no se vuelven a aplicar.
- El informe muestra recuperación/XP del bonus de Mirada, incluida XP en derrota.

## Simulación

`node scripts/audit-eye-fusions.mjs 200`

518.400 expediciones: tres regiones × tres dificultades × cuatro clases × dos
repartos (todo ataque y equilibrado) × seis fusiones × tres rangos × dos variantes
× 200 semillas. Nivel mínimo de cada región/dificultad, Vida/Maná completos,
sin pociones ni afijos. Compara mismo equipo/atributos/herencia con y sin bonus;
20/22 siempre cargadas para probar el caso favorable. No mide frecuencia de carga.

Resultados agregados Difícil (24 escenarios, 4.800 semillas por variante):

| Bono | Rango | Victoria sin/con bonus | Daño medio sin/con bonus |
|---|---|---|---|
| Yelmo | 1 | 86,08% / 89,08% | 133,25 / 130,92 |
| Yelmo | 2 | 91,48% / 92,73% | 122,89 / 119,42 |
| Yelmo | 3 | 93,83% / 95,71% | 114,83 / 110,10 |
| Collar | 1 | 92,21% / 93,17% | 136,91 / 137,00 |
| Collar | 2 | 95,52% / 96,69% | 130,11 / 130,14 |
| Collar | 3 | 98,81% / 99,15% | 122,71 / 122,73 |

Más supervivencia puede aumentar ligeramente daño total contabilizado (se llega
a más rondas). No significa que Collar aumente el daño de cada golpe.
Máximo salto observado: +32,5 pp para Yelmo R1, Paladín ofensivo, Nuncabasta
Difícil. Es un umbral local de supervivencia, no una mejora uniforme; vigilar con
beta testers. El bonus del Collar R3 mejora como máximo 3 pp en un escenario.
No se detectaron inmunidad, activaciones infinitas ni acumulación de tokens.
Los porcentajes aprobados se conservan. Los redondeos de daño entero pueden
ocultar pequeñas mejoras; Ampolla no cambia victorias en esta batería con Maná
inicial completo. Escenarios de Maná escaso se cubren por pruebas unitarias,
no por esta batería estadística. No se probaron todas las segundas reliquias.

## Arte y UI

Se conservan los seis PNG fuente. Derivados WebP lossless a 1254×1254 con igualdad
de todos los bytes RGBA decodificados (incluido alfa). Script de conversión:
`python scripts/optimize-eye-fusions.py`. Total WebP ~4 MB, todavía son assets
de resolución alta; no se ha remuestreado ni alterado el pixel art.

Escala de dibujo localizada: 20/22/23/24/25 al88% (antes82%, +7,3% relativo);
21 permanece82%; Filo del Pulso Voraz17 al94% (-6%). Marcos y fondos intactos.
Verificación de fichas con renderer y CSS reales en escritorio/móvil390px,
comparación con vecinas y colección de la aplicación local.

## Estado

Suite completa: 755 pruebas en 54 archivos, typecheck, build y diff-check correctos.
Sin publicación ni incremento de versión. Bruma Fácil sigue costando1 de energía.
Se conservan Malla5/8/12, niveles1/5/11 y ajustes anteriores.
El build avisa de bundle >500KB; no es un error de compilación. La demo sigue
mostrando su aviso anterior de cuota de almacenamiento: no se han borrado datos.
