# Reliquias: fase 14–18 (v2.29.71)

Implementación de la propuesta visual aprobada. Se conservan las 15 reliquias y las 61 fusiones anteriores. Se añaden las bases 16–18 y 63 recetas para los jefes 14–18, sin contenido de los jefes 19 en adelante.

## Reglas

- Las nuevas fusiones heredan ambos efectos sin una tercera sinergia; suman los atributos de los ingredientes y conservan rangos, rareza y afijos con las reglas existentes.
- Se excluyen ingredientes de la misma familia principal en esta tanda. No se modifica la compatibilidad histórica ni la restricción de equipamiento del motor.
- Sello: descuento de 1/2/3 de maná en el primer hechizo de pago por enemigo, mínimo 1; se consume incluso al fallar. El coste actual habitual es 2, por lo que el descuento efectivo suele ser 1.
- Escama: exige pasar de más del 50% de vida a 50% o menos; protege el siguiente golpe conectado, no el que cruza el umbral. Empezar ya por debajo del umbral no la activa. Una vez por enemigo.
- Broche: el tercer impacto directo dañino activa el daño adicional una vez por enemigo. Ecos, marcas y otros efectos no incrementan el contador.
- Los atributos de cacería no cambian los puntos permanentes del personaje. El estado del equipo se captura al comenzar la cacería, de modo que reequipar no reinicia efectos durante ella.
- Recompensas 16–18: 295/310/325 monedas y 3 Sangres; se conserva la tasa de aparición, rarezas, forja y desfusión. No se toca el almacenamiento ni la configuración de nube.

## Mapa estable de recetas

Los identificadores F/P pertenecían al informe. Los identificadores del juego continúan después de fusion_62; no se reutiliza fusion_03.

| Juego | Informe | Reliquias | Nombre |
|---|---|---|---|
| fusion_63 | F01-14 | 1 + 14 | Corazón del Filo Espejado |
| fusion_64 | F02-14 | 2 + 14 | Lágrima del Filo Espejado |
| fusion_65 | F03-14 | 3 + 14 | Daga del Filo Espejado |
| fusion_66 | F04-14 | 4 + 14 | Yelmo del Filo Espejado |
| fusion_67 | F05-14 | 5 + 14 | Frasco del Filo Espejado |
| fusion_68 | F06-14 | 6 + 14 | Colmillo del Filo Espejado |
| fusion_69 | F07-14 | 7 + 14 | Collar del Filo Espejado |
| fusion_70 | F08-14 | 8 + 14 | Ojo del Filo Espejado |
| fusion_71 | F09-14 | 9 + 14 | Malla del Filo Espejado |
| fusion_72 | F10-14 | 10 + 14 | Calavera del Filo Espejado |
| fusion_73 | F11-14 | 11 + 14 | Gargantilla del Filo Espejado |
| fusion_74 | F12-14 | 12 + 14 | Puño del Filo Espejado |
| fusion_75 | F02-15 | 2 + 15 | Lágrima del Bastión Nocturno |
| fusion_76 | F03-15 | 3 + 15 | Daga del Bastión Nocturno |
| fusion_77 | F04-15 | 4 + 15 | Yelmo del Bastión Nocturno |
| fusion_78 | F05-15 | 5 + 15 | Frasco del Bastión Nocturno |
| fusion_79 | F06-15 | 6 + 15 | Colmillo del Bastión Nocturno |
| fusion_80 | F07-15 | 7 + 15 | Collar del Bastión Nocturno |
| fusion_81 | F10-15 | 10 + 15 | Calavera del Bastión Nocturno |
| fusion_82 | F11-15 | 11 + 15 | Gargantilla del Bastión Nocturno |
| fusion_83 | F12-15 | 12 + 15 | Puño del Bastión Nocturno |
| fusion_84 | F13-15 | 13 + 15 | Báculo del Bastión Nocturno |
| fusion_85 | F14-15 | 14 + 15 | Brazal del Bastión Nocturno |
| fusion_86 | F01-16 | 1 + 16 | Corazón de la Pausa Clara |
| fusion_87 | F03-16 | 3 + 16 | Daga de la Pausa Clara |
| fusion_88 | F04-16 | 4 + 16 | Yelmo de la Pausa Clara |
| fusion_89 | F06-16 | 6 + 16 | Colmillo de la Pausa Clara |
| fusion_90 | F07-16 | 7 + 16 | Collar de la Pausa Clara |
| fusion_91 | F08-16 | 8 + 16 | Ojo de la Pausa Clara |
| fusion_92 | F09-16 | 9 + 16 | Malla de la Pausa Clara |
| fusion_93 | F10-16 | 10 + 16 | Sello de la Llama Serena |
| fusion_94 | F11-16 | 11 + 16 | Gargantilla de la Pausa Clara |
| fusion_95 | F12-16 | 12 + 16 | Puño de la Pausa Clara |
| fusion_96 | F13-16 | 13 + 16 | Báculo del Eco Despierto |
| fusion_97 | F14-16 | 14 + 16 | Brazal de la Pausa Clara |
| fusion_98 | F15-16 | 15 + 16 | Hebilla de la Pausa Clara |
| fusion_99 | F02-17 | 2 + 17 | Lágrima de la Escama Libre |
| fusion_100 | F03-17 | 3 + 17 | Daga de la Escama Libre |
| fusion_101 | F04-17 | 4 + 17 | Yelmo de la Escama Libre |
| fusion_102 | F05-17 | 5 + 17 | Frasco de la Escama Libre |
| fusion_103 | F06-17 | 6 + 17 | Colmillo del Peso Perdido |
| fusion_104 | F07-17 | 7 + 17 | Collar de la Escama Libre |
| fusion_105 | F10-17 | 10 + 17 | Calavera de la Escama Libre |
| fusion_106 | F11-17 | 11 + 17 | Gargantilla de la Escama Libre |
| fusion_107 | F12-17 | 12 + 17 | Puño de la Escama Libre |
| fusion_108 | F13-17 | 13 + 17 | Báculo de la Escama Libre |
| fusion_109 | F14-17 | 14 + 17 | Brazal de la Escama Libre |
| fusion_110 | F16-17 | 16 + 17 | Sello de la Escama Serena |
| fusion_111 | F01-18 | 1 + 18 | Corazón de los Tres Juramentos |
| fusion_112 | F02-18 | 2 + 18 | Lágrima de los Tres Juramentos |
| fusion_113 | F03-18 | 3 + 18 | Daga de los Tres Juramentos |
| fusion_114 | F04-18 | 4 + 18 | Yelmo de los Tres Juramentos |
| fusion_115 | F05-18 | 5 + 18 | Frasco de los Tres Juramentos |
| fusion_116 | F06-18 | 6 + 18 | Colmillo de los Tres Juramentos |
| fusion_117 | F07-18 | 7 + 18 | Collar de los Tres Juramentos |
| fusion_118 | F08-18 | 8 + 18 | Ojo de los Tres Juramentos |
| fusion_119 | F09-18 | 9 + 18 | Malla de los Tres Juramentos |
| fusion_120 | F10-18 | 10 + 18 | Pacto de las Tres Cenizas |
| fusion_121 | F11-18 | 11 + 18 | Gargantilla de los Tres Juramentos |
| fusion_122 | F12-18 | 12 + 18 | Puño de los Tres Juramentos |
| fusion_123 | F15-18 | 15 + 18 | Hebilla de los Tres Juramentos |
| fusion_124 | F16-18 | 16 + 18 | Sello de los Tres Juramentos |
| fusion_125 | F17-18 | 17 + 18 | Escama de los Tres Juramentos |
