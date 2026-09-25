# Fusiones de la Malla — diseño y contrato de implementación

Estado: implementado y validado localmente. Valores iniciales conservados tras
simulación; ver AUDIT_MALLA_FUSIONS.md. No publicado.
Se heredan íntegros los dos efectos, atributos, afijos y snapshots de ingredientes.
Escamas protectoras conserva 5/8/12% (R1/R2/R3). Cada pareja añade un solo bono.
No se permiten Malla+Corazón ni Malla+Ojo: misma familia funcional defensiva.

| ID / pareja con Malla | Nombre | Bono nuevo R1/R2/R3 |
|---|---|---|
| 26 / Lágrima | Manto de la Lluvia Olvidada | Primer hábito carga una reserva de 2/3/4 puntos: evita 1 punto adicional por golpe positivo, hasta agotar la reserva en la próxima Cacería. Nunca baja un golpe de 1. |
| 27 / Daga | Hoja del Nido Enlutado | Vencer a un enemigo tras evitar al menos 5 de daño con Escamas concede 1/2/3 XP. Una vez por enemigo (máximo 3/6/9 por expedición). |
| 28 / Yelmo | Yelmo del Cielo Carbonizado | Completar Constancia carga +1/2/3 puntos porcentuales de Escamas durante la próxima Cacería. |
| 29 / Frasco | Redoma de la Lluvia Cautiva | Convierte el 20% del daño evitado por Escamas en Maná, hasta 2/3/4 por enemigo. |
| 30 / Colmillo | Colmillo de la Raíz Acorazada | Convierte el 15% del daño evitado por Escamas en Vida, hasta 1/2/3 por enemigo. |
| 31 / Collar | Collar del Rastreador de Brea | Tras evitar 5 de daño con Escamas, +1/2/3 puntos porcentuales de Vampirismo durante el resto de ese combate. Una activación por enemigo. |

## Lore y dirección de arte

- **26**: el Espectro recuerda los cigarros bajo el cielo negro de la Wyvern; su
  niebla se condensa en un manto que permite seguir avanzando bajo la lluvia de
  brea. Un único manto corto de escamas azul-negras, hombros protectores y gran
  cierre de lágrima pálida; ribetes espectrales contenidos, no una escena.
- **27**: las telarañas entre tuberías se trenzan con las escamas del nido de las
  chimeneas. Daga ancha y robusta, hoja de escamas solapadas, nervio de hierro
  oxidado, canales de alquitrán y pequeño núcleo granate en la guarda. Sin patas
  finísimas ni armadura pegada a una daga.
- **28**: las brasas del Caballero sobreviven a la lluvia negra. Yelmo funcional
  cerrado, casco y cubrenuca de escamas de Wyvern, visor naranja estrecho y
  remaches de bronce quemado. Silueta compacta, sin ojos mágicos del Ojo.
- **29**: la lluvia de brea se destila en los frascos de la Bruja; la coraza
  contiene los vapores dulces. Una redoma ancha de vidrio violeta protegida por
  una jaula de escamas azul-negras, cuello corto, tapón ámbar; líquido visible.
- **30**: las raíces del Gusano alcanzan los cimientos de las chimeneas; las
  escamas encapsulan el rastro tóxico. Un colmillo curvo grande amarillo marfil,
  raíz envuelta por escamas como un casquillo protector, canal amarillo verdoso
  en el hueso. Un objeto, sin raíces o humo sueltos fuera de la silueta.
- **31**: el Sabueso aprende a resistir la lluvia negra sin perseguir el antiguo
  impulso. Collar grueso de cuero reforzado con escamas solapadas azul-negras,
  hebilla de hierro y cadena rota corta y gruesa. Sin ojos ni múltiples objetos.

## Contrato de seguridad mecánica

Cargas 26/28: solo equipada al producirse el evento, máximo una, se consume solo
al iniciar una Cacería válida; desequipar/reemplazar/desfusionar la borra. Los
registros diarios/semanales existentes impiden recargar mediante refusión.
Los efectos quedan en el snapshot del inicio; cambiar equipo no reescribe hunts.
Reserva 26 comparte presupuesto entre los tres enemigos; no se regenera.
Mitigación se calcula tras defensa/críticos/Mirada, nunca reduce un golpe positivo
por debajo de 1. Solo el daño realmente evitado cuenta, no esquivas ni sobre-daño.
Conversiones 29/30 se calculan acumulando enteros y tomando floor(total*%/100).
Se consumen los puntos generados incluso a recursos llenos: no se almacena
sobrecuración. Se aplican después del daño y solo si se sobrevive; no resucitan.
Contadores y topes se reinician por enemigo; el collar no lleva activación a otro.
No se ejecutan fuera de Cacería ni cambian efectos de jefes semanales.

## Prompt común (imagegen integrado; una llamada por arte)

Use case: stylized-concept. Asset type: Freedoom inventory relic icon.
Images 1 and 2 are ingredient design references, image 3 is pixel-art finish
reference only, NOT an edit target. Make one new structurally integrated,
functional object described by the corresponding direction above. Dark fantasy
chunky pixel art, hard square pixel clusters, limited shaded palette, bold dark
outline, no smooth painting or antialiasing. Complete object centered on genuinely
transparent background with real alpha, approximately 10% uniform safe margin.
Readable at 64px. No frame, text, watermark, scenery, floor, cast shadow, floating
particles, collage, extra objects or clipped tips. Preserve original references.

Each generation combines this common prompt with its numbered direction above;
final paths: public/relics/fusion_26..31_<slug>_source.png and lossless .webp.

Se usó imagegen integrado, sin CLI. Las primeras variantes de 28/29 dibujaron
cuadrículas opacas; se rechazaron por inspección del canal alfa y se regeneraron
desde las referencias originales, insistiendo en PNG transparente real. La
edición intermedia del yelmo tampoco se aceptó. No se hizo extracción artificial
por color ni se retocaron referencias. Las seis finales se inspeccionaron a tamaño
grande y dentro de los iconos reales de la interfaz.

Fuentes generadas seleccionadas (directorio generated_images de esta tarea):
- 26: exec-6c32eb3d-e8b4-4309-a85c-2e51103dd2da.png
- 27: exec-108406c7-b00f-4f38-ad17-a810aa19b004.png
- 28: exec-14c6bb57-7a74-40d1-9954-5b5f7fe0ec4e.png
- 29: exec-55f5ec96-344d-4325-8ecb-c821905e6f33.png
- 30: exec-f98b2363-c736-427f-8235-c7947142f9e5.png
- 31: exec-0244cbca-95aa-4f35-a030-083adde66955.png
