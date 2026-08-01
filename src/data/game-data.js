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

export const CLASS_GROWTH={
  knight:  {hp:8, mp:2},   /* tanque físico */
  paladin: {hp:5, mp:5},   /* híbrido equilibrado */
  sorcerer:{hp:2, mp:8},   /* mago puro */
  druid:   {hp:3, mp:7}    /* mago sanador */
};
