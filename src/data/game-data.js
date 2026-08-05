export const CLASSES={
  knight:{
    name:'Knight',es:'Caballero',
    tiers:['Escudero','Caballero','Caballero de Élite','Caballero Legendario'],
    desc:'Fuerza y voluntad. Resiste el antojo con el escudo en alto.',
    pal:{A:'#98A5B3',B:'#5E6873',C:'#C4553E'},
    px:[
      "................",
      ".......CC.......",
      ".......CC.......",
      "....AAAAAAAA....",
      "...ABBBBBBBBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "....A.SSSS.A....",
      "...AAAAAAAAAA...",
      "..SAABAABAABAS..",
      "..SAABAABAABAS..",
      "...AAAAAAAAAA...",
      "....BB....BB....",
      "....BB....BB....",
      "...OO......OO..."
    ],
    pas:[
      {lvl:1,icon:'pielhierro',name:'Piel de Hierro',d:'Ganas armadura cada 2 días de racha (en vez de 3).'},
      {lvl:5,icon:'yelmo',name:'Yelmo Templado',d:'Pasarte del límite hace −18 en vez de −25.'},
      {lvl:12,icon:'voluntad',name:'Voluntad de Acero',d:'Tras un día fallido amaneces al 85% de tu vida (en vez del 75%).'}
    ],
    act:[
      {lvl:2,id:'muro',icon:'muro',name:'Muro de Escudos',cost:30,d:'Los próximos 2 cigarros no hacen daño.'},
      {lvl:8,id:'grito',icon:'grito',name:'Grito de Guerra',cost:50,d:'+20 de vida al instante.'},
      {lvl:14,id:'bastion',icon:'bastion',name:'Último Bastión',cost:90,ulti:true,d:'Tu racha sobrevive al próximo día fallido. 1 uso por semana.'}
    ]
  },
  paladin:{
    name:'Paladin',es:'Arquero Sagrado',
    tiers:['Explorador','Paladín','Paladín Real','Paladín Divino'],
    desc:'Precisión sagrada. Cada flecha (cigarro) solo cuando de verdad toca.',
    pal:{A:'#7FA366',B:'#55703F',C:'#E8B44A',Y:'#8A6B47'},
    px:[
      "................",
      ".....AAAAAA.....",
      "....AAAAAAAA....",
      "...AABBBBBBAA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "....A.SSSS.A....",
      "...ACCCCCCCCA...",
      "..SAAAAAAAAS.Y..",
      "..SAAGAAGAAS.Y..",
      "...AAAAAAAA..Y..",
      "....BB..BB......",
      "....BB..BB......",
      "...OO....OO....."
    ],
    pas:[
      {lvl:1,icon:'ojohalcon',name:'Ojo del Halcón',d:'Los disparos perfectos dan +3 XP (en vez de +2).'},
      {lvl:5,icon:'flecha',name:'Flecha Bendita',d:'Cada disparo perfecto además cura +3 de vida.'},
      {lvl:12,icon:'punteria',name:'Puntería Divina',d:'El bonus por margen sube a +5 XP por cigarro (en vez de +4).'}
    ],
    act:[
      {lvl:2,id:'certero',icon:'certero',name:'Ojo Certero',cost:25,d:'Durante 1 hora, los disparos perfectos dan +5 XP.'},
      {lvl:8,id:'luz',icon:'luz',name:'Luz Sanadora',cost:40,d:'+15 de vida al instante.'},
      {lvl:14,id:'juicio',icon:'juicio',name:'Juicio Divino',cost:80,ulti:true,d:'Si hoy cierras cumpliendo, la XP del día ×2. 1 uso por semana.'}
    ]
  },
  sorcerer:{
    name:'Sorcerer',es:'Mago de la Muerte',
    tiers:['Aprendiz Oscuro','Hechicero','Nigromante','Archimago de la Muerte'],
    desc:'Drena la fuerza del vicio y la convierte en poder tuyo.',
    pal:{A:'#7E5FA8',B:'#4E3A6E',C:'#C4553E'},
    px:[
      ".......AA.......",
      "......AAAA......",
      ".....AAAAAA.....",
      "...AAAAAAAAAA...",
      "....BSSSSSSB....",
      "....BSSSSSSB....",
      "....BSSSSSSB....",
      "....BSSSSSSB....",
      ".....SSSS.......",
      "....AAAAAAAA....",
      "...SABBAABBAS...",
      "...SAAAAAAAAS...",
      "....AAAAAAAA....",
      "....AAAAAAAA....",
      "....AAAAAAAA....",
      "...OOOOOOOOOO..."
    ],
    pas:[
      {lvl:1,icon:'absorber',name:'Absorber Esencia',d:'Cada cigarro adelantado te quita −2 menos (drenas su fuerza).'},
      {lvl:5,icon:'cosecha',name:'Cosecha Oscura',d:'Batir tu mínimo histórico da +40 XP (en vez de +25).'},
      {lvl:12,icon:'filacteria',name:'Filacteria',d:'Maldición de Ceniza dura 3 horas (en vez de 2).'}
    ],
    act:[
      {lvl:2,id:'ceniza',icon:'ceniza',name:'Maldición de Ceniza',cost:30,d:'Durante 2 horas, cada disparo perfecto da el doble de maná (+20).'},
      {lvl:8,id:'peste',icon:'peste',name:'Peste al Antojo',cost:35,d:'Los cigarros de hoy hacen la mitad de daño.'},
      {lvl:14,id:'alma',icon:'alma',name:'Robar Alma',cost:40,ulti:true,d:'Convierte todo tu maná en vida (2 maná = 1 vida). Mínimo 40 de maná. 1 uso por semana.'}
    ]
  },
  druid:{
    name:'Druid',es:'Curandero',
    tiers:['Iniciado','Druida','Druida Ancestral','Avatar del Bosque'],
    desc:'Sana el cuerpo día a día y hace crecer algo nuevo donde había ceniza.',
    pal:{A:'#A8C46B',B:'#7A5C3E',C:'#C4553E'},
    px:[
      "................",
      "....C.AAAA.C....",
      "....AAAAAAAA....",
      "...AABBBBBBAA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "...ABSSSSSSBA...",
      "....A.SSSS.A....",
      "...BBBBBBBBBB...",
      "..SBBBBBBBBBBS..",
      "..SBBCBBBBCBBS..",
      "...BBBBBBBBBB...",
      "....BBBBBBBB....",
      "....BBBBBBBB....",
      "...OOOOOOOOOO..."
    ],
    pas:[
      {lvl:1,icon:'savia',name:'Savia Viva',d:'Regeneras +1 de vida cada 7 minutos (en vez de 10).'},
      {lvl:5,icon:'pocion',name:'Poción Mayor',d:'Completar las pastillas del día cura +20 (en vez de +15).'},
      {lvl:12,icon:'raices',name:'Raíces Profundas',d:'El primer cigarro adelantado de cada día no hace daño.'}
    ],
    act:[
      {lvl:2,id:'regen',icon:'regen',name:'Regeneración',cost:30,d:'Durante 2 horas regeneras vida al doble de velocidad.'},
      {lvl:8,id:'balsamo',icon:'balsamo',name:'Bálsamo',cost:40,d:'+15 de vida al instante.'},
      {lvl:14,id:'renacer',icon:'renacer',name:'Renacer',cost:90,ulti:true,d:'Esta noche amaneces a tu vida máxima pase lo que pase. 1 uso por semana.'}
    ]
  }
};

/* Repertorio inicial para quien entra en Freedoom manteniéndose sin fumar.
   Conserva las identidades y el pixel art de cada clase, pero elimina efectos
   que dependen de cigarros, límites, margen o disparos perfectos. */
export const SMOKE_FREE_SKILLS={
  knight:{
    desc:'Fuerza y voluntad. Protege tu racha y resiste los golpes del camino.',
    pas:[
      {lvl:1,icon:'pielhierro',name:'Piel de Hierro',d:'Ganas armadura cada 2 días de racha (en vez de 3).'},
      {lvl:5,icon:'yelmo',name:'Yelmo Templado',d:'Si pierdes el combate semanal, el golpe baja al 20% de tu vida máxima (en vez del 30%).'},
      {lvl:12,icon:'voluntad',name:'Voluntad de Acero',d:'Tras un día fallido amaneces al 85% de tu vida (en vez del 75%).'}
    ],
    act:[
      {lvl:2,id:'muro',icon:'muro',name:'Muro de Escudos',cost:30,d:'Los próximos 2 golpes a tu vida quedan bloqueados, incluidos cerveza o castigo semanal.'},
      {lvl:8,id:'grito',icon:'grito',name:'Grito de Guerra',cost:50,d:'+20 de vida al instante.'},
      {lvl:14,id:'bastion',icon:'bastion',name:'Último Bastión',cost:90,ulti:true,d:'Tu racha sobrevive al próximo día fallido. 1 uso por semana.'}
    ]
  },
  paladin:{
    desc:'Precisión sagrada. Convierte cada día firme y cada buen hábito en progreso.',
    pas:[
      {lvl:1,icon:'ojohalcon',name:'Ojo del Halcón',d:'Cada día confirmado da 55 XP (en vez de 50).'},
      {lvl:5,icon:'flecha',name:'Flecha Bendita',d:'Confirmar un día sin fumar recupera +5 de vida.'},
      {lvl:12,icon:'punteria',name:'Puntería Divina',d:'Cada tercer día consecutivo confirmado concede +15 XP.'}
    ],
    act:[
      {lvl:2,id:'certero',icon:'certero',name:'Ojo Certero',cost:25,d:'Los próximos 2 hábitos completados obtienen un 50% más de XP, respetando los topes.'},
      {lvl:8,id:'luz',icon:'luz',name:'Luz Sanadora',cost:40,d:'+15 de vida al instante.'},
      {lvl:14,id:'juicio',icon:'juicio',name:'Juicio Divino',cost:80,ulti:true,d:'Si hoy confirmas que no fumaste, la XP del día ×2. 1 uso por semana.'}
    ]
  },
  sorcerer:{
    desc:'Drena la fuerza del antojo y alimenta su magia con disciplina y constancia.',
    pas:[
      {lvl:1,icon:'absorber',name:'Absorber Esencia',d:'El primer hábito completado cada día recupera +5 de maná.'},
      {lvl:5,icon:'cosecha',name:'Cosecha Oscura',d:'Cada 3 días consecutivos sin fumar obtienes +15 XP.'},
      {lvl:12,icon:'filacteria',name:'Filacteria',d:'Maldición de Ceniza dura 3 horas (en vez de 2).'}
    ],
    act:[
      {lvl:2,id:'ceniza',icon:'ceniza',name:'Maldición de Ceniza',cost:30,d:'Durante 2 horas, cada hábito completado recupera +10 de maná.'},
      {lvl:8,id:'peste',icon:'peste',name:'Peste al Antojo',cost:35,d:'Si hoy confirmas que no fumaste, obtienes +20 XP.'},
      {lvl:14,id:'alma',icon:'alma',name:'Robar Alma',cost:40,ulti:true,d:'Convierte todo tu maná en vida (2 maná = 1 vida). Mínimo 40 de maná. 1 uso por semana.'}
    ]
  },
  druid:{
    desc:'Sana el cuerpo y hace crecer una rutina nueva donde antes estaba el humo.',
    pas:[
      {lvl:1,icon:'savia',name:'Savia Viva',d:'Confirmar un día sin fumar recupera +8 de vida.'},
      {lvl:5,icon:'pocion',name:'Poción Mayor',d:'Completar las pastillas del día cura +20 (en vez de +15).'},
      {lvl:12,icon:'raices',name:'Raíces Profundas',d:'El primer hábito completado cada día recupera +5 de vida y +5 de maná.'}
    ],
    act:[
      {lvl:2,id:'regen',icon:'regen',name:'Regeneración',cost:30,d:'Durante 2 horas regeneras vida al doble de velocidad.'},
      {lvl:8,id:'balsamo',icon:'balsamo',name:'Bálsamo',cost:40,d:'+15 de vida al instante.'},
      {lvl:14,id:'renacer',icon:'renacer',name:'Renacer',cost:90,ulti:true,d:'Esta noche amaneces a tu vida máxima pase lo que pase. 1 uso por semana.'}
    ]
  }
};

export function classDataForJourney(classId,{smokeFree=false}={}){
  const base=CLASSES[classId];
  if(!base) return null;
  const pack=smokeFree?SMOKE_FREE_SKILLS[classId]:null;
  return pack?{...base,...pack}:base;
}

export const BOSSES=[
  'El Gólem de Humo','Espectro Gris','Araña de Alquitrán','Caballero Ceniza',
  'Bruja del Antojo','Gusano de Nicotina','Sabueso del Mono','Gárgola Amarilla',
  'Wyvern de Brea','Nigromante del Mechero','Hidra de Tres Caladas','Titán de Cartón',
  'Sombra de la Sobremesa','Djinn del Mediodía','Minotauro Nocturno','Liche del Café',
  'Dragón Menguante','El Último Trío','Gemelos del Ocaso','El Solitario',
  'El Vacío — jefe final'
];

export const BOSS_SLUGS=[
  'golem','espectro','arana','caballero','bruja','gusano','sabueso','gargola',
  'wyvern','nigromante','hidra','titan','sombra','djinn','minotauro','liche',
  'dragon','trio','gemelos','solitario','vacio'
];

export const BOSS_LORE=[
  'Nació cuando el humo endurecido se mezcló con las piedras de una fábrica abandonada. Cada paso de su cuerpo de hollín deja el aire un poco más pesado.',
  'Flota por corredores cubiertos de niebla, alimentándose de los recuerdos de antiguos cigarros. Su figura gris se desvanece cuando alguien decide seguir adelante.',
  'Teje sus nidos con alquitrán caliente entre tuberías oxidadas. Sus patas negras convierten cada rincón en una trampa pegajosa difícil de abandonar.',
  'Bajo su armadura de metal quemado aún arden las brasas de incontables batallas. Custodia una fortaleza cubierta de ceniza donde nunca amanece del todo.',
  'Habita una cabaña rodeada de frascos y vapores dulces. Con sus pócimas transforma un pequeño antojo en una voz capaz de llenar todo el bosque.',
  'Excava túneles húmedos bajo raíces podridas, dejando un rastro amarillo y tóxico. Su enorme cuerpo representa la dependencia que intenta crecer en la oscuridad.',
  'Merodea por callejones vacíos siguiendo el olor de la ansiedad. Sus colmillos aparecen cuando el cuerpo reclama aquello que ya no necesita.',
  'Tallada en piedra amarillenta, vigila desde las cornisas de una ciudad cubierta de humo. Permanece inmóvil hasta que detecta una duda.',
  'Sus alas están cubiertas de brea y levantan una lluvia negra al volar. Anida sobre chimeneas antiguas, dominando un cielo que apenas deja pasar la luz.',
  'Recoge mecheros apagados en una cripta de ladrillo y los utiliza para despertar malos recuerdos. Su fuego no calienta: solo intenta devolver vida al pasado.',
  'Tres gargantas expulsan tres caladas distintas sobre un pantano oscuro. Para vencerla hay que resistir cada impulso sin perder de vista a las otras cabezas.',
  'Construido con capas de cartón húmedo y cajas abandonadas, bloquea el camino desde un almacén interminable. Parece frágil, pero cada capa esconde otra excusa.',
  'Aparece después de las comidas, alargando su silueta sobre mesas vacías. Se alimenta de rutinas antiguas y desaparece cuando la sobremesa encuentra un nuevo ritual.',
  'Duerme dentro del aire ardiente del mediodía. Cuando despierta, ofrece alivios rápidos que se convierten en cadenas de humo alrededor de quien lo escucha.',
  'Recorre un laberinto bajo la luna, guiado por el eco de los últimos cigarros del día. Sus cuernos marcan las paredes de cada noche superada.',
  'Gobierna una biblioteca impregnada de café y ceniza. Entre sus páginas conserva asociaciones antiguas y las pronuncia como si fueran hechizos inevitables.',
  'Sobrevuela montañas cada vez más pequeñas, perdiendo escamas con cada semana vencida. Su tamaño mengua al mismo ritmo que el poder de la dependencia.',
  'Tres figuras encapuchadas protegen los últimos restos de una costumbre casi derrotada. Atacan juntas porque por separado ya no conservan suficiente fuerza.',
  'Nacidos bajo el último resplandor del día, uno representa la costumbre y el otro la tentación. Solo pierden su coordinación cuando cae la noche sin fumar.',
  'Espera en una llanura silenciosa donde ya no quedan ejércitos que lo acompañen. Es el último hábito aislado, aferrado a un territorio que se ha quedado vacío.',
  'No tiene carne, piedra ni humo: es el espacio que queda cuando desaparece la dependencia. Atravesarlo significa aprender que ese vacío también puede llenarse de libertad.'
];

export const CLASS_GROWTH={
  knight:  {hp:8, mp:2},   /* tanque físico */
  paladin: {hp:5, mp:5},   /* híbrido equilibrado */
  sorcerer:{hp:2, mp:8},   /* mago puro */
  druid:   {hp:3, mp:7}    /* mago sanador */
};
