# Auditoría de microcopy de reliquias

## Alcance

12 reliquias base y 30 fusiones activas, rangos 1–3. Ficha poseída, detalle histórico de colección y Forja comparten `src/ui/relic-effect-copy.js`. No se modifican mecánicas, valores, imágenes ni escalas del arte. Versión conservada: 2.28.51; sin publicación.

## Reglas reutilizables y antes/después

Los ejemplos de «antes» describen patrones, salvo las frases entre comillas.

| Antes | Después | Regla |
| --- | --- | --- |
| Descripción extensa con introducción y valor repetido | «Recupera 5% del Maná máximo por enemigo derrotado en Cacería.» | Resultado y cantidad primero; después el disparador. |
| Herencia y sinergia mezcladas en un párrafo, con potencia heredada repetida | Dos filas heredadas y una fila «Bonus de fusión» | Una unidad mecánica por fila; no repetir los mismos valores en otro bloque. |
| «Una vez por ciclo.» sin advertir la pérdida de Constancia | «Una vez por ciclo; el progreso se pierde al desequipar.» | No recortar consecuencias relevantes para una decisión. |
| Descripciones independientes según la vista | Misma función para ficha, histórico y Forja | Una única fuente de presentación; la herencia conserva su valor guardado. |
| Bonus porcentual ambiguo | «Suma 1 p. p. de Vampirismo…» | Distinguir puntos porcentuales de porcentaje relativo. Abreviatura con nombre accesible «puntos porcentuales». |
| Carga descrita sin separar duración, consumo y pérdida | Próxima Cacería, disparador, una carga, no acumulable, consumo al iniciar y pérdida cuando corresponde | Mantener ciclo de vida y límites explícitos; no extrapolar la pérdida a las fusiones 18/19. |
| Texto de fusión apretado junto al arte | Efectos a todo el ancho bajo la cabecera de Forja | Ajuste estructural mínimo para leer el copy, sin rediseñar el catálogo. |

Los nombres conservan el estilo dorado y subrayado aprobado, seguidos de descripción en flujo natural. No hay clic ni modal en las filas principales. El límite de 220 caracteres por descripción es una protección de regresión, no una excusa para omitir condiciones.

## Fidelidad a reglas existentes

- «Primer hábito con XP» no equivale al primer hábito completado: se conserva esa diferencia entre efectos antiguos y cargas nuevas.
- Constancia exige seis días consecutivos cumplidos y jefe derrotado; una activación por ciclo. La pérdida de progreso al desequipar se muestra tanto en la base como en cada fusión y rango afectados.
- Los bonus ligados a Constancia no prometen activarse solo por sumar días.
- Se preservan topes por enemigo/expedición, supervivencia, ausencia de resurrección, redondeo hacia abajo, exceso descartado y reinicio al cambiar de enemigo.
- Los valores heredados proceden del registro de la fusión, no de recalcularlos con su rango actual.

## Validación final

- 1008 pruebas correctas en 57 archivos. Incluyen 126 casos de catálogo/rango con igualdad de filas entre las tres vistas, estados de carga y tres pruebas específicas de pérdida de Constancia que recorren la base y todas sus fusiones.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; persiste el aviso conocido de bundle superior a 500 kB (506.73 kB). `app.js` regenerado por el build.
- `git diff --check`: correcto; avisos de conversión LF/CRLF no bloqueantes.
- Fixture local `tmp/relic-copy-review.html`: usa datos y renderizadores reales, sin persistir ni modificar partidas. No sustituye una prueba completa de navegación de la aplicación.
- 756 comprobaciones DOM: 42 reliquias × 3 rangos × 3 vistas × 2 anchos efectivos (1422 y 390 píxeles CSS). Cero desbordamientos horizontales, filas solapadas, textos inválidos, recortes por clamp/elipsis o botones fuera del contenido desplazable. Altura máxima del bloque de efectos: 261.57 píxeles CSS.
- La comprobación de clamp se corrigió para aceptar solo un valor numérico positivo de `-webkit-line-clamp`; una propiedad ausente ya no produce falsos positivos.
- Capturas finales revisadas de ficha, histórico y Forja en ambos anchos, con la fusión 22 de rango 3 (Constancia, Mirada y carga). Texto completo al desplazarse, sin solapes observados, cierre visible y botones de desequipar/fusionar alcanzables. Estado histórico no poseído correctamente deshabilitado. Vista temporal restaurada al terminar.

## Límites de la revisión

No se rediseñan botones ni efectos extras. Algunos controles conservan su altura previa, inferior al objetivo táctil recomendado de 44 píxeles; no se declara una auditoría integral de accesibilidad. No quedan pendientes dentro del alcance de esta tarea.

## Segunda pasada: bonus de fusión en lenguaje cotidiano

Esta revisión posterior cambia únicamente las 30 descripciones de bonus y sus pruebas. Las dos filas heredadas permanecen idénticas. No cambia CSS, mecánicas, cifras de juego ni persistencia. Los bonus usan ahora el orden **disparador → beneficio → límite o pérdida**, con una o dos frases. Se mantienen los mismos nombres completos de efectos para no obligar a interpretar abreviaciones como «Mirada» o «Escamas».

| Antes | Después | Motivo |
| --- | --- | --- |
| «Gana 20 XP extra al completar Constancia. Una vez por ciclo.» | «Al completar Constancia, ganas 20 XP extra. Solo una vez por ciclo.» | Primero indica qué debe ocurrir. |
| «No acumulable; se consume al iniciar y se pierde al desequipar.» | «Solo guardas 1 carga: la gastas al entrar o la pierdes al desequipar.» | Sustituye vocabulario técnico por acciones reconocibles. |
| «Suma 1 p. p. de Vampirismo…» | «…mejoras Vampirismo del 3% al 4%…» | Muestra el antes y después real, sin confundir porcentaje relativo con puntos porcentuales. |
| «Una vez por enemigo; debes sobrevivir al golpe.» después del beneficio | «Si Mirada petrificante reduce un golpe y sobrevives, recuperas 1 de Maná. Solo una vez por enemigo.» | La supervivencia forma parte de la condición; el límite se lee aparte. |
| «Máximo: 2 por enemigo; redondeo hacia abajo. El exceso no se guarda.» | «Hasta 2 de Maná por enemigo; lo que sobre se pierde.» y «sin decimales» en el cálculo | Nombra el recurso y elimina jerga sin suprimir el límite ni el descarte. |

Los ejemplos numéricos ilustran el patrón, no fijan los valores de todos los rangos. Los aumentos «del X% al Y%» se calculan exclusivamente en presentación: X es la herencia guardada, Y suma el bonus del rango actual. Una prueba específica verifica fusiones de rango superior con herencias de rango 1. El estado preparado/vacío sigue separado del texto de la regla; no se promete una carga que no exista.

Validación de esta segunda pasada:

- 1113 pruebas correctas en 57 archivos; typecheck y build correctos. Aviso conocido de bundle >500 kB (507.15 kB). `git diff --check` correcto, con avisos LF/CRLF.
- 90 pruebas específicas de estilo (30 bonus × 3 rangos): disparador al inicio, sin jerga de puntos porcentuales/acumulación/redondeo, máximo dos frases. Longitud máxima observada: 212 caracteres; se conserva el límite de regresión de 220.
- 18 pruebas de cargas (6 fusiones × 3 rangos), cada una con estado preparado y vacío. Se mantienen consumo al entrar, una sola carga y pérdida al desequipar solo donde corresponde.
- 648 comprobaciones DOM: las 30 fusiones × 3 rangos × ficha/histórico/Forja × escritorio/móvil, más las seis fusiones con carga preparada en la misma matriz. Anchos efectivos: 1422 y 390 píxeles CSS. Cero overflow, truncado, filas solapadas, valores inválidos o botones fuera del contenido desplazable. Altura máxima del bloque completo: 261.57 píxeles CSS.
- Capturas revisadas tras la reescritura en las tres vistas, móvil y escritorio, incluyendo el bonus más largo (fusión 26) y porcentajes dinámicos/carga (fusión 22). El histórico no poseído no presenta acciones habilitadas de equipar. Se conserva el alcance de fixture local con renderizadores reales, no navegación E2E completa.

Sin pendientes, publicación ni incremento de versión en esta revisión.

## Tercera pasada: nombres compactos y detalle accesible

Reemplaza el patrón anterior de descripciones visibles. Principales y extras comparten `effectControlList` y un único diálogo nativo en `relic-effect-dialog.js`. La descripción exacta viaja escapada con el botón y se muestra como texto, sin duplicar las reglas de copy ni recalcular el histórico al pulsarlo.

- Lista natural: «Constancia, Maná de victoria y Bonus de fusión». Cada coma queda dentro del mismo grupo que el botón anterior, sin espacio ni separación al envolver. La conjunción acompaña al último nombre. Se permite envolver grupos completos; no hay scroll horizontal ni nombres truncados.
- Controles nativos subrayados, dorados, con foco visible y activación Enter/Espacio. Los objetivos tienen al menos 32 px de altura; cierre de 44 px.
- Diálogo centrado en pantalla; título, descripción y cierre centrados. Título y descripción asociados mediante ARIA. Foco inicial en cierre; Tab/Mayús+Tab contenidos; Escape, botón y pulsación exterior cierran solo el detalle. Se devuelve foco sin desplazar la ficha. Fondo nativo inerte, scroll de cuerpo y panel padre bloqueado y restaurado con sus valores previos. Una sola instancia.
- 864 comprobaciones de disposición: 42 reliquias, tres rangos, tres vistas y escritorio/390 px, más los estados preparados de las seis fusiones con carga. Cero overflow, truncado, valores inválidos o comas desprendidas.
- 372 aperturas reales en móvil recorren todos los rangos y reliquias, incluidos sus extras presentes: descripción exacta, centrado, foco inicial y devuelto, scroll bloqueado; cero incidencias. Revisión adicional de capturas en escritorio, ficha/histórico/Forja, base y fusión con cuatro extras; Enter/Espacio, Tab/Mayús+Tab, Escape y pulsación exterior comprobados.
- Pruebas unitarias del controlador cubren instancia única, escape de texto, descripción exacta, restauración de scroll/foco, disparador eliminado, teclado y cierre exterior.

La publicación posterior se prepara como v2.28.52 por autorización expresa, sin modificar Vampirismo ni otras mecánicas durante este rediseño.
