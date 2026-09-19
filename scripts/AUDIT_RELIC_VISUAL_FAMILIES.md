# Auditoría de escala por familias visuales — 2026-09-19

Revisión local sobre 2.28.51, sin publicación. Sustituye el criterio de promedio global por comparación de siluetas dentro de cada familia. Los porcentajes son ancho y alto del lienzo de imagen respecto al contenedor; no equivalen al porcentaje de superficie opaca. Se conservan proporciones, desplazamientos anteriores, marcos, fondos, animaciones y archivos de arte.

## Catálogo completo y anclas

42 piezas únicas: 12 bases y 30 fusiones activas. `fusion_03` no pertenece al catálogo activo. La clasificación es visual, no una modificación de `equipmentType`.

| Familia y ancla | Miembros y escala final |
| --- | --- |
| Colmillos — Colmillo del Antojo Roto (`fusion_16`) | `relic_06` 100%; `fusion_11` 100%; `fusion_14` 96%; `fusion_16` 100%; `fusion_24` 84%; `fusion_30` 86% |
| Yelmos — Yelmo del Espectro (`fusion_13`) | `relic_04` 104%; `fusion_02` 104%; `fusion_05` 100%; `fusion_13` 100%; `fusion_15` 100%; `fusion_19` 86%; `fusion_22` 88%; `fusion_28` 92% |
| Armaduras — Malla de Escamas de Brea (`relic_09`) | `relic_09` calc(100% - 8px); `fusion_26` 92% |
| Collares y joyas — Collar de la Ansiedad Rota (`relic_07`) | `relic_07` 100%; `relic_11` 100%; `fusion_08` 100%; `fusion_25` 80%; `fusion_31` 80% |
| Ojos, lágrimas y talismanes oculares — Lágrima de Espectro (`relic_02`) | `relic_02` 100%; `relic_08` calc(100% - 5px); `fusion_07` 100%; `fusion_20` 88% |
| Recipientes — Frasco del Antojo Roto (`relic_05`) | `relic_05` calc(104% + 3px); `fusion_10` 105%; `fusion_23` 82%; `fusion_29` 90% |
| Hojas y dagas — Daga de Alquitrán (`relic_03`) | `relic_03` 100%; `fusion_04` calc(100% - 7px); `fusion_12` 96%; `fusion_17` 94%; `fusion_21` 82%; `fusion_27` 96% |
| Corazones y talismanes — Corazón de Hollín (`relic_01`) | `relic_01` calc(100% + 9px); `fusion_01` 100%; `fusion_06` 100%; `fusion_09` 100% |
| Siluetas singulares, sin ancla común forzada | `relic_10` calc(100% - 2px); `relic_12` calc(100% - 3px); `fusion_18` 78% |

La Mandíbula se compara con colmillos por su forma dental; el Anillo con joyería; la Brújula con talismanes oculares; Filo del Corazón y Nudo con corazones por el arte mostrado. La Garra no se fuerza a la caja de una daga larga. El Yelmo Vencedor es la excepción explícita: conserva el 100% y su silueta más ancha por los cuernos. No se pretende igualar ancho y alto simultáneamente en siluetas distintas.

## Cambios de esta segunda pasada

Respecto al cierre de la auditoría global anterior:

| ID | Antes | Final | Motivo |
| --- | --- | --- | --- |
| relic_04 | calc(100% - 2px) | 104% | Yelmo base algo menor que el ancla |
| relic_06 | calc(100% - 5px) | 100% | Colmillo base menor que sus fusiones |
| fusion_02 | 100% | 104% | Acercar yelmo estrecho al ancla |
| fusion_14 | 100% | 96% | Contener la mandíbula ancha |
| fusion_23 | 88% | 82% | Ampolla demasiado alta frente al frasco |
| fusion_24 | 88% | 84% | Reducir colmillo largo y brillante |
| fusion_25 | 88% | 80% | Collar ancho frente a collar base |
| fusion_26 | 96% | 92% | Reducción ligera solicitada; armadura ancla |
| fusion_27 | 100% | 96% | Reducción explícita conservadora del 4% |
| fusion_28 | 96% | 92% | Igualar presencia con otros yelmos |
| fusion_29 | 100% | 90% | Reducción solicitada, afinada con recipientes |
| fusion_30 | 96% | 86% | Reducción solicitada, afinada con colmillos |
| fusion_31 | 93% | 80% | Normalizar collar ancho con su familia |

Las otras 29 piezas conservan sus escalas de la auditoría previa. Las reducciones de Redoma, Colmillo y collares son mayores que la propuesta inicial de 4–5% porque la ampliación posterior del encargo exigió comparar familias, no únicamente vecinos globales.

## Validación

- Vista auxiliar `tmp/relic-catalog-review.html`, opción «Por familias», usando el componente real `relicArt` y clases reales de colección, detalle, equipadas y forja. No cambia partidas.
- Inspección visual de las 42 piezas agrupadas, en escritorio y móvil, en los cuatro contextos. Las siluetas siguen reconocibles en colección/equipadas; sin recortes visibles. No es una prueba de navegación integral por todas las pantallas reales.
- 42 IDs distintos verificados en cada contexto. 336 comprobaciones geométricas: 42 × 4 contextos × 2 anchuras (1422 y 390 CSS px).
- Límites de silueta medidos con alpha >= 16. Margen mínimo: colección 4,03px; detalle 6,56px; equipadas 3,95px; forja 7,38px escritorio / 6,30px móvil. Ninguna silueta toca el marco.
- Sin desbordamiento horizontal en los ocho casos. La cabecera de la herramienta auxiliar ahora envuelve sus controles en móvil; no se cambió el diseño de la aplicación para ello.
- Las capturas largas del navegador pueden repetir franjas por composición; el DOM contiene 42 piezas únicas, sin duplicados.
- `npm test`: 867/867, 56 archivos. `npm run typecheck`: correcto. `npm run build`: correcto, aviso conocido de bundle >500kB. `git diff --check`: correcto, solo avisos LF/CRLF.
- Los archivos de arte se verifican contra los hashes SHA256 de antes de la normalización; no se modifican.
- No se incrementa versión ni se publica.
