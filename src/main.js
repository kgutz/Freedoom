import { BOSSES, BOSS_SLUGS, CLASSES } from './data/game-data.js';
import {
  calculateBossState,
  calculateGameStats
} from './domain/progression-rules.js';
import {
  limitForDate,
  limitForWeek,
  weekIndexFor,
  weekRangeFor
} from './domain/plan-rules.js';
import {
  BEER_DAMAGE,
  dailyRecovery,
  pillCompletionReward,
  regenerateHealth,
  weeklyBossPenalty
} from './domain/hero-rules.js';
import {
  evaluateSmoke,
  perfectShotRewards,
  smokeUndoEffects
} from './domain/smoking-rules.js';
import { castSpellEffect } from './domain/spell-rules.js';
import {
  STORAGE_KEY,
  createBrowserStore,
  exportBackup,
  importBackup,
  mergeState,
  parseState,
  serializeState
} from './storage/state-storage.js';
import {
  renderCalendarView,
  renderWeeksView
} from './ui/calendar-view.js';
import { renderChartView } from './ui/chart-view.js';

import {
  DAY_NAMES as DIAS,
  MONTH_NAMES as MESES,
  daysBetween,
  keyOf,
  minutesOf,
  mondayOf,
  parseKey,
  todayKey
} from './domain/date-utils.js';

const APP_VERSION='35';

/* Datos iniciales que Kike apuntó a mano antes de tener la app */
const SEED={};
const SEED_V=3;

let state={
  config:{startDate:'2026-07-17', startLimit:20, wakeTime:'09:00', sleepTime:'23:00', pillsGoal:3, takesPills:true, tracksBeer:true},
  days:{},
  seeded:false,
  seededV:0,
  game:{cls:null},
  onboarded:false
};
let calCursor=new Date();
let editingKey=null;
let saveTimer=null;

document.getElementById('obVersion').textContent=`v${APP_VERSION}`;
document.getElementById('settingsVersion').textContent=`v${APP_VERSION}`;

/* ---------- utilidades de fecha ---------- */
function weekIndexOf(d){ /* semana 0-based: la semana 1 empieza el día exacto de inicio del plan (cualquier día de la semana) */
  return weekIndexFor(state.config.startDate,d);
}
function weekRange(idx){
  return weekRangeFor(state.config.startDate,idx);
}
function limitOfWeek(idx){return limitForWeek(state.config.startLimit,idx);}
function limitOfDate(d){
  return limitForDate({
    startDate:state.config.startDate,
    startLimit:state.config.startLimit,
    date:d
  });
}
function getDay(k){return state.days[k]||{c:0,p:0};}
function setDay(k,c,p,t,b,s){
  c=Math.max(0,c); p=Math.max(0,p);
  const prev=state.days[k];
  const last=(t!==undefined)? t : (prev? prev.t : undefined);
  const beers=(b!==undefined)? Math.max(0,b) : (prev? (prev.b||0) : 0);
  const shots=(s!==undefined)? Math.max(0,s) : (prev? (prev.s||0) : 0);
  const shotXp=prev? (prev.sx||0) : 0;
  if(c===0&&p===0&&beers===0){delete state.days[k];}
  else{
    state.days[k]={c,p};
    if(last!==undefined) state.days[k].t=last;
    if(beers>0) state.days[k].b=beers;
    if(shots>0) state.days[k].s=shots;
    if(shotXp>0) state.days[k].sx=shotXp;
  }
  scheduleSave(); renderAll();
}

/* ---------- almacenamiento ---------- */
/* Adaptador: dentro de Claude usa window.storage; en GitHub Pages / PWA usa localStorage del navegador */
const store=createBrowserStore(window);

async function load(){
  try{
    const r=await store.get(STORAGE_KEY);
    if(r&&r.value){
      state=mergeState(state,parseState(r.value));
    }
  }catch(e){ /* primera vez: la clave no existe todavía */ }
  /* Cargar los días apuntados a mano; con versión, para que nuevos días
     semilla se apliquen aunque la instalación ya hubiera sembrado antes.
     Solo rellena días que no existan: nunca pisa datos reales. */
  if(state.seededV!==SEED_V){
    for(const k in SEED){
      if(!state.days[k]) state.days[k]=SEED[k];
    }
    state.seededV=SEED_V;
    state.seeded=true;
    scheduleSave();
  }
}
function scheduleSave(){
  /* en el móvil (localStorage) guarda al instante: si cierras la app justo después de un +, no se pierde */
  if(!store.usesExternalStorage){
    try{ store.set(STORAGE_KEY,serializeState(state)); }catch(e){ console.error('Error guardando',e); }
    return;
  }
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{ await store.set(STORAGE_KEY,serializeState(state)); }
    catch(e){ console.error('Error guardando',e); }
  },400);
}
/* al ocultar/cerrar la app, volcado final por si había un guardado pendiente */
window.addEventListener('pagehide',()=>{
  if(!store.usesExternalStorage){
    try{ store.set(STORAGE_KEY,serializeState(state)); }catch(e){}
  }
});

/* ---------- render ---------- */
function renderAll(){renderHoy();renderCal();renderWeeks();renderGraf();renderHero();renderSettings();}

function renderHoy(){
  const now=new Date(), tk=todayKey();
  const pc=document.getElementById('pillCard');
  if(pc) pc.style.display=(state.config.takesPills===false)?'none':'';
  const bc=document.getElementById('beerCounter');
  if(bc) bc.style.display=(state.config.tracksBeer===false)?'none':'';
  const diaAb=DIAS[now.getDay()].slice(0,3);
  const diaCap=diaAb.charAt(0).toUpperCase()+diaAb.slice(1);
  const mesAb=MESES[now.getMonth()].slice(0,3);
  const mesCap=mesAb.charAt(0).toUpperCase()+mesAb.slice(1);
  document.getElementById('fechaHoy').textContent=
    `${diaCap}, ${now.getDate()}/${mesCap}`;

  const wIdx=Math.max(0,weekIndexOf(now));
  const limit=limitOfWeek(wIdx);
  document.getElementById('semanaNum').textContent=wIdx+1;
  document.getElementById('limiteDia').textContent=limit;

  const d=getDay(tk);
  document.getElementById('cigHoy').textContent=d.c;
  document.getElementById('pillHoy').textContent=d.p;
  document.getElementById('beerHoy').textContent=d.b||0;
  /* nombre del héroe y barra de salud vinculada (misma info que en Héroe) */
  if(state.game && state.game.cls){
    ensureHero();
    const g=state.game;
    const nameEl=document.getElementById('hoyHeroName');
    if(nameEl) nameEl.textContent=g.name||CLASSES[g.cls].es;
    const clsEl=document.getElementById('hoyHeroCls');
    if(clsEl) clsEl.textContent=CLASSES[g.cls].name;
    const faceEl=document.getElementById('hoyFace');
    if(faceEl){
      /* usa hero_face/ si existe; si no, cae al sprite de cuerpo entero recortado */
      faceEl.innerHTML=`<img src="hero_face/${g.cls}_face.png" alt="" onerror="this.onerror=null;this.src='sprites/${g.cls}_happy.png';this.className='face-full'">`;
    }
    const st=gameStats();
    const maxHp=st.maxHp;
    const hpv=Math.max(0,Math.round(g.hp));
    const pctFill=Math.max(0,Math.min(100,(hpv/maxHp)*100));
    const fill=document.getElementById('hoyHpFill');
    const val=document.getElementById('hoyHpVal');
    if(fill){
      fill.style.width=pctFill+'%';
      let cls='hp-hi'; if(pctFill<=15)cls='hp-crit'; else if(pctFill<=40)cls='hp-low'; else if(pctFill<=70)cls='hp-mid';
      fill.className='stat-fill '+cls;
    }
    if(val) val.textContent=hpv+' / '+maxHp;
  }

  document.getElementById('hoyTotal').textContent=d.c;
  document.getElementById('hoyLimite').textContent=limit;

  /* tira de película: un fotograma por cada cigarro del límite de hoy */
  const strip=document.getElementById('filmstrip');
  strip.innerHTML='';
  const frames=Math.max(limit,d.c,1);
  for(let i=0;i<frames;i++){
    const f=document.createElement('div');
    f.className='frame'+(i<d.c ? (i<limit?' used':' over') : '');
    strip.appendChild(f);
  }
  renderPace(now,d.c,limit);

  const rest=document.getElementById('restantes');
  const left=limit-d.c;
  if(left>=0){
    rest.className='restantes';
    rest.innerHTML=`Llevas <b>${d.c}</b> de un máximo de <b>${limit}</b> — te quedan <b>${left}</b>`;
  }else{
    rest.className='restantes excedido';
    rest.innerHTML=`Hoy te has pasado <b>${-left}</b> del máximo de ${limit} — mañana empiezas de cero`;
  }
}

function renderPace(now,smoked,limit){
  const clip=document.getElementById('paceClip');
  const grad=document.getElementById('paceGrad');
  const expectedEl=document.getElementById('paceExpected');
  const estado=document.getElementById('paceEstado');
  const info=document.getElementById('paceInfo');

  const wake=minutesOf(state.config.wakeTime||'09:00');
  const sleep=minutesOf(state.config.sleepTime||'23:00');
  const span=Math.max(60, sleep-wake); /* minutos despierto */
  const nowM=now.getHours()*60+now.getMinutes();
  const frac=Math.min(1, Math.max(0,(nowM-wake)/span)); /* fracción del día transcurrida */
  const expected=limit*frac; /* los que "tocarían" a esta hora */

  /* zona clara = hasta dónde deberías ir ahora */
  expectedEl.style.width=(frac*100)+'%';

  /* barra degradada: el gradiente ocupa el ancho total de la barra
     y el clip lo va destapando -> empieza verde, avanza a amarillo,
     naranja y acaba en rojo al acercarse al límite */
  const pct=Math.min(100,(limit>0? smoked/limit*100 : 100));
  clip.style.width=pct+'%';
  grad.style.width=(pct>0? (100/pct)*100 : 100)+'%';

  /* estado por color según el ritmo */
  let cls, txt;
  if(limit<=0){
    cls='r'; txt='Semana de 0';
  }else if(nowM<wake){
    if(smoked===0){cls='g'; txt='Tu día aún no empieza';}
    else{cls='o'; txt='Antes de hora';}
  }else if(smoked>=limit){
    cls='r'; txt=smoked>limit?'Límite superado':'Límite alcanzado';
  }else{
    const ratio=expected>0.3? smoked/expected : (smoked<=1? 0 : 2);
    if(ratio<=1.0){cls='g'; txt='Vas bien';}
    else if(ratio<=1.25){cls='y'; txt='Un poco por encima';}
    else if(ratio<=1.55){cls='o'; txt='Vas rápido';}
    else{cls='r'; txt='Vas muy rápido';}
  }
  estado.className='estado '+cls;
  estado.textContent=txt;

  /* info: ritmo objetivo y diferencia con lo esperado */
  const minPerCig=Math.round(span/Math.max(1,limit));
  const exp=Math.round(expected);
  let diffTxt='';
  if(nowM>=wake && nowM<=sleep && limit>0){
    const diff=smoked-exp;
    if(diff<0) diffTxt=` · vas <b>${-diff}</b> por debajo ✓`;
    else if(diff===0) diffTxt=' · justo en el ritmo';
    else diffTxt=` · vas <b>${diff}</b> por encima`;
  }
  info.innerHTML=`Ritmo objetivo: <b>1</b> cada <b>~${minPerCig} min</b><br>A esta hora tocarían <b>~${exp}</b>${diffTxt}`;

  /* aproximación del siguiente: reparte lo que queda entre el tiempo que queda */
  const rec=getDay(todayKey());
  const left=limit-smoked;
  const fmtH=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}`;
  let nextLine='';
  if(limit>0 && left<=0){
    nextLine='Límite de hoy completo — el siguiente, mañana';
  }else if(rec.t){
    const lt=new Date(rec.t);
    const lastM=lt.getHours()*60+lt.getMinutes();
    const window=sleep-lastM;
    const lastEd=`<span class="edit-time" data-edit-time="1">${fmtH(lastM)}</span>`;
    if(window>0){
      const interval=Math.max(10,Math.round(window/left));
      const nextM=lastM+interval;
      if(nextM<=nowM){
        nextLine=`Último: ${lastEd} · ya podría tocar el siguiente — tú decides`;
      }else{
        nextLine=`Último: ${lastEd} · el siguiente aprox. a las <b>~${fmtH(nextM)}</b>`;
      }
    }else{
      nextLine=`Último: ${lastEd} — ya fuera de tu horario, el siguiente mañana`;
    }
  }
  if(nextLine) info.innerHTML+=`<br>${nextLine}`;
}

function renderCal(){
  renderCalendarView({
    document,
    cursor:calCursor,
    now:new Date(),
    config:state.config,
    days:state.days,
    onDayClick:openModal
  });
}

function renderWeeks(){
  renderWeeksView({
    document,
    now:new Date(),
    config:state.config,
    days:state.days
  });
}

/* ---------- gráfica ---------- */
let grafMode='semana';
let grafWeek=null;   /* índice de semana del plan */
let grafMonth=new Date();

function renderGraf(){
  const now=new Date();
  const currIdx=Math.max(0,weekIndexOf(now));
  if(grafWeek===null) grafWeek=currIdx;
  renderChartView({
    document,
    mode:grafMode,
    weekIndex:grafWeek,
    month:grafMonth,
    now,
    config:state.config,
    records:state.days
  });
}

function renderSettings(){
  document.getElementById('cfgStart').value=state.config.startDate;
  document.getElementById('cfgLimit').value=state.config.startLimit;
  document.getElementById('cfgWake').value=state.config.wakeTime||'09:00';
  document.getElementById('cfgSleep').value=state.config.sleepTime||'23:00';
  document.getElementById('cfgPills').value=state.config.pillsGoal||3;
  const hn=document.getElementById('cfgHeroName');
  if(hn) hn.value=(state.game&&state.game.name)?state.game.name:'';
  const bYes=document.getElementById('beerYes'), bNo=document.getElementById('beerNo');
  if(bYes&&bNo){
    const on=(state.config.tracksBeer!==false);
    bYes.classList.toggle('active',on);
    bNo.classList.toggle('active',!on);
  }
}

/* ==================== RPG / TAMAGOTCHI ==================== */



/* --- sprite 8-bit --- */
function spriteSVG(clsId,mood,extraClass){
  /* estados con arte propio; el resto cae a 'happy' hasta que existan */
  const HAVE={knight:['happy'],paladin:['happy'],sorcerer:['happy'],druid:['happy']};
  const have=HAVE[clsId]||['happy'];
  const file=have.includes(mood)?mood:'happy';
  const hurt=(mood==='hurt')?' hurt':'';
  return `<img class="sprite-svg${hurt} ${extraClass||''}" src="sprites/${clsId}_${file}.png" alt="${clsId}" draggable="false">`;
}

function gameStats(){
  return calculateGameStats({
    now:new Date(),
    config:state.config,
    days:state.days,
    game:state.game
  });
}

function heroToday(){
  ensureHero();
  const g=state.game;
  const hp=g.hp===undefined?100:g.hp;
  const mx=heroMaxes().maxHp;
  const pct=(hp/mx)*100;
  const now=new Date();
  const c=getDay(todayKey()).c;
  const wake=minutesOf(state.config.wakeTime||'09:00');
  const nowM=now.getHours()*60+now.getMinutes();
  let mood;
  if(nowM<wake&&c===0) mood='sleep';
  else mood=pct>70?'happy':pct>40?'neutral':pct>15?'worried':'hurt';
  return {hp,mood};
}

function bossState(){
  const gs=gameStats();
  return calculateBossState({
    now:new Date(),
    config:state.config,
    days:state.days,
    bossesDown:gs.bossesDown
  });
}

/* topes dinámicos según clase y nivel */
function heroMaxes(){
  const stats=gameStats();
  return {maxHp:stats.maxHp,maxMp:stats.maxMp};
}
function capHp(v){ return Math.max(0,Math.min(heroMaxes().maxHp, v)); }
function capMp(v){ return Math.max(0,Math.min(heroMaxes().maxMp, v)); }

/* --- sistema de vida y maná por eventos --- */
/* --- modal de resultado semanal (jefe vencido o repetido) --- */
function renderWeekResultModal(){
  const g=state.game;
  const wr=g.weekResult; if(!wr) return;
  const gs=gameStats();
  const body=document.getElementById('weekResultModal');
  const bossImg=(num,slug)=>`<div class="boss-box" style="margin:14px auto"><img src="bosses/boss_${String(num).padStart(2,'0')}_${slug}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="boss-fallback" style="display:none">💀</span></div>`;

  if(wr.won){
    const beatenIdx=Math.max(0,gs.bossesDown-1);
    const beatenName=BOSSES[beatenIdx], beatenSlug=BOSS_SLUGS[beatenIdx];
    const nextIdx=Math.min(gs.bossesDown,BOSSES.length-1);
    const nextName=BOSSES[nextIdx], nextSlug=BOSS_SLUGS[nextIdx];
    body.innerHTML=`
      <div style="font-size:12px;color:var(--ok);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">¡Semana superada!</div>
      <h3 style="margin-bottom:2px">Has vencido a ${beatenName}</h3>
      ${bossImg(beatenIdx+1,beatenSlug)}
      <p class="hint" style="margin:0 0 18px">De puta madre — cumpliste al menos 4 de tus 7 días. Esta semana entra un rival nuevo.</p>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Te espera:</div>
      <h3 style="margin-bottom:2px">${nextName}</h3>
      ${bossImg(nextIdx+1,nextSlug)}
      <button class="ob-next" id="weekResultClose" style="margin-top:6px">Seguir adelante</button>
    `;
    document.getElementById('weekResultClose').addEventListener('click',()=>{
      document.getElementById('weekResultBg').classList.remove('show');
    });
  }else{
    const idx=Math.min(gs.bossesDown,BOSSES.length-1);
    const name=BOSSES[idx], slug=BOSS_SLUGS[idx];
    const lastLim=limitOfWeek(wr.weekIdx);
    const newWeekIdx=wr.weekIdx+1;
    body.innerHTML=`
      <div style="font-size:12px;color:var(--warn);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Semana difícil</div>
      <h3 style="margin-bottom:2px">${name} sigue en pie</h3>
      ${bossImg(idx+1,slug)}
      <p class="hint" style="margin:0 0 10px">No pasa nada — esta semana lo consigues. El jefe es el mismo hasta que sumes 4 de 7 días cumplidos.</p>
      <p class="hint" style="margin:0 0 18px">Por el golpe recibido, tu vida bajó un 30% y tu maná al 20% — se recupera con el tiempo.</p>
      <div class="ob-field" style="text-align:left;margin-bottom:14px">
        <label style="display:block;margin-bottom:8px">¿Quieres ajustar tu límite para esta semana, o seguir con la reducción automática de −1?</label>
        <div class="ob-toggle">
          <button class="ob-tg" data-wradjust="yes" id="wrYes">Sí, ajustar</button>
          <button class="ob-tg active" data-wradjust="no" id="wrNo">No, seguir automático</button>
        </div>
      </div>
      <div class="ob-field" id="wrLimitField" style="display:none;text-align:left">
        <label style="display:block;margin-bottom:8px">Cigarros al día esta semana</label>
        <input type="number" id="wrLimitInput" min="0" max="99" value="${lastLim}">
      </div>
      <button class="ob-next" id="weekResultClose" style="margin-top:6px">Continuar</button>
    `;
    document.getElementById('wrYes').addEventListener('click',()=>{
      document.getElementById('wrYes').classList.add('active');
      document.getElementById('wrNo').classList.remove('active');
      document.getElementById('wrLimitField').style.display='block';
    });
    document.getElementById('wrNo').addEventListener('click',()=>{
      document.getElementById('wrNo').classList.add('active');
      document.getElementById('wrYes').classList.remove('active');
      document.getElementById('wrLimitField').style.display='none';
    });
    document.getElementById('weekResultClose').addEventListener('click',()=>{
      const wantsAdjust=document.getElementById('wrYes').classList.contains('active');
      if(wantsAdjust){
        const v=parseInt(document.getElementById('wrLimitInput').value,10);
        if(!isNaN(v)&&v>=0){
          state.config.startLimit=v+newWeekIdx;
          scheduleSave();
        }
      }
      document.getElementById('weekResultBg').classList.remove('show');
      renderAll();
    });
  }
}

/* --- sistema de vida y maná por eventos --- */
function ensureHero(){
  if(!state.game) state.game={cls:null};
  const g=state.game;
  const now=Date.now();
  if(g.hp===undefined){const mx=heroMaxes();g.hp=mx.maxHp;g.mp=mx.maxMp;g.hpT=now;g.day=todayKey();scheduleSave();return;}
  if(g.mp===undefined) g.mp=heroMaxes().maxMp;
  g.buffs=g.buffs||{};
  let dirty=false;
  /* compatibilidad con partidas antiguas que aún no guardaban estas marcas */
  if(!g.day){g.day=todayKey();dirty=true;}
  if(!Number.isFinite(g.hpT)){g.hpT=now;dirty=true;}
  /* descanso nocturno */
  if(g.day!==todayKey()){
    const lim=limitOfDate(parseKey(g.day));
    const c=getDay(g.day).c;
    const lvl=gameStats().lvl;
    const mx=heroMaxes();
    const recovered=dailyRecovery({
      completedDay:c<=lim,
      currentMana:g.mp,
      maxHp:mx.maxHp,
      maxMp:mx.maxMp,
      classId:g.cls,
      level:lvl,
      rebirthActive:Boolean(g.buffs.renacer)
    });
    g.hp=recovered.hp;
    g.mp=recovered.mp;
    if(c>lim){
      if(g.buffs.bastion){                      /* Último Bastión (Knight) */
        (g.pardons=g.pardons||[]).push(g.day);
        g.buffs.bastion=false;
      }
    }
    g.buffs.renacer=false;
    g.buffs.pesteDay=null;
    g.day=todayKey(); g.hpT=now;
    g.cigDmg=[]; g.beerDmg=[];
    dirty=true;
  }
  /* penalización semanal del jefe: si una semana se cierra con menos de 4 días cumplidos (mayoría),
     el jefe no se vence — se repite la semana siguiente, y una sola vez se aplica el castigo */
  const curWk=Math.max(0,weekIndexOf(new Date()));
  if(g.lastWeekChecked===undefined) g.lastWeekChecked=curWk; /* primera vez visto: no penalizar retroactivamente */
  while(g.lastWeekChecked<curWk){
    const wIdx=g.lastWeekChecked;
    const wLim=limitOfWeek(wIdx);
    const [wa,wb]=weekRange(wIdx);
    let wHits=0;
    for(let d=new Date(wa);d<=wb;d.setDate(d.getDate()+1)){
      if(getDay(keyOf(d)).c<=wLim) wHits++;
    }
    if(wHits<4){
      const mx=heroMaxes();
      const penalty=weeklyBossPenalty({hp:g.hp,maxHp:mx.maxHp,maxMp:mx.maxMp});
      g.hp=penalty.hp;
      g.mp=penalty.mp;
    }
    g.weekResult={won:wHits>=4,weekIdx:wIdx};
    g.weekModalPending=true;
    dirty=true;
    g.lastWeekChecked++;
  }
  const regenerated=regenerateHealth({
    hp:g.hp,
    hpTimestamp:g.hpT,
    nowTimestamp:now,
    maxHp:heroMaxes().maxHp,
    classId:g.cls,
    regenerationActive:Boolean(g.buffs.regenUntil&&g.buffs.regenUntil>now)
  });
  if(regenerated.ticks>0){
    g.hp=regenerated.hp;
    g.hpT=regenerated.hpTimestamp;
    dirty=true;
  }
  if(dirty) scheduleSave();
}

function heroArmor(){
  const per=(state.game&&state.game.cls==='knight')?2:3; /* Piel de Hierro */
  return Math.min(5,Math.floor(gameStats().streak/per));
}

function smokeDamage(){
  ensureHero();
  const g=state.game;
  const now=new Date();
  const lim=limitOfDate(now);
  const rec=getDay(todayKey());
  const wake=minutesOf(state.config.wakeTime||'09:00');
  const sleep=minutesOf(state.config.sleepTime||'23:00');
  const lvl=gameStats().lvl;
  const cls=g.cls;
  const result=evaluateSmoke({
    now,
    today:todayKey(),
    record:rec,
    limit:lim,
    wakeMinutes:wake,
    sleepMinutes:sleep,
    classId:cls,
    level:lvl,
    rootsDay:g.rootsDay,
    pestActive:Boolean(g.buffs&&g.buffs.pesteDay===todayKey()),
    armor:heroArmor(),
    shieldCharges:(g.buffs&&g.buffs.shield)||0
  });
  if(result.consumesRoots) g.rootsDay=todayKey();
  if(result.consumesShield) g.buffs.shield--;
  if(result.dmg>0) g.hp=Math.max(0,g.hp-result.dmg);
  let healed=0;
  if(result.healing>0){
    const hpBefore=g.hp;
    g.hp=capHp(g.hp+result.healing);
    healed=g.hp-hpBefore;
  }
  g.hpT=Date.now(); /* fumar reinicia el reloj de regeneración */
  scheduleSave();
  return {...result,healed};
}

/* --- lanzar hechizos --- */
function castSpell(id){
  ensureHero();
  const g=state.game;
  const st=gameStats();
  const C=CLASSES[g.cls]; if(!C) return;
  const sp=C.act.find(a=>a.id===id); if(!sp) return;
  const w=Math.max(0,weekIndexOf(new Date()));
  const now=Date.now();
  const result=castSpellEffect({
    game:g,
    spell:sp,
    level:st.lvl,
    currentWeek:w,
    today:todayKey(),
    nowTimestamp:now,
    maxHp:st.maxHp
  });
  if(!result.ok){
    if(result.reason==='level') showToast('Nivel '+result.requiredLevel+' necesario','dmg');
    else if(result.reason==='ultimate-used') showToast('Ya usada esta semana','dmg');
    else if(result.minimumMana) showToast('Necesitas al menos '+result.requiredMana+' 💧','dmg');
    else if(result.reason==='mana') showToast('Maná insuficiente ('+result.requiredMana+' 💧)','dmg');
    return;
  }
  state.game=result.game;
  switch(id){
    case 'alma': showToast('Robar Alma · −'+result.spentMana+' 💧 · +'+result.healing+' ♥','heal');break;
    case 'ceniza': showToast('☠ Maldición de Ceniza · −'+result.spentMana+' 💧','heal');break;
    case 'muro': showToast('🛡 Muro de Escudos · −'+result.spentMana+' 💧','heal');break;
    case 'grito': showToast('Grito de Guerra · −'+result.spentMana+' 💧 · +'+result.healing+' ♥','heal');break;
    case 'bastion': showToast('🏰 Último Bastión · −'+result.spentMana+' 💧','heal');break;
    case 'certero': showToast('🎯 Ojo Certero · −'+result.spentMana+' 💧','heal');break;
    case 'luz': showToast('Luz Sanadora · −'+result.spentMana+' 💧 · +'+result.healing+' ♥','heal');break;
    case 'juicio': showToast('⚖️ Juicio Divino · −'+result.spentMana+' 💧','heal');break;
    case 'peste': showToast('☠ Peste al Antojo · −'+result.spentMana+' 💧','heal');break;
    case 'regen': showToast('🌿 Regeneración · −'+result.spentMana+' 💧','heal');break;
    case 'balsamo': showToast('Bálsamo · −'+result.spentMana+' 💧 · +'+result.healing+' ♥','heal');break;
    case 'renacer': showToast('🌅 Renacer · −'+result.spentMana+' 💧','heal');break;
  }
  scheduleSave();
  renderHero();
}

function showToast(txt,type){
  const t=document.getElementById('toast');
  if(!t) return;
  t.textContent=txt;
  t.className='toast show '+(type||'');
  clearTimeout(t._h);
  t._h=setTimeout(()=>{t.className='toast';},2000);
}

function renderHero(){
  const box=document.getElementById('heroContent');
  if(!box) return;
  const cls=state.game&&state.game.cls;

  /* --- selección de clase --- */
  if(!cls||!CLASSES[cls]){
    let cards='';
    for(const id in CLASSES){
      const c=CLASSES[id];
      cards+=`<div class="cls-card" data-cls="${id}">
        ${spriteSVG(id,'happy')}
        <div class="cn">${c.name}</div>
        <div class="ce">${c.es}</div>
        <div class="cd">${c.desc}</div>
      </div>`;
    }
    box.innerHTML=`<div class="card">
      <h2>Elige tu clase</h2>
      <p class="hint" style="margin:0 0 14px">Tu héroe vive de tus datos: gana XP cada día que cumples, sube de nivel, y su salud refleja cómo llevas el día de hoy. Elige con cabeza — el camino son 21 semanas.</p>
      <div class="cls-grid">${cards}</div>
    </div>`;
    return;
  }

  const C=CLASSES[cls];
  const g=gameStats();
  const h=heroToday();
  const bs=bossState();
  const gm=state.game;
  const mp=gm.mp===undefined?0:gm.mp;
  const maxHp=g.maxHp, maxMp=g.maxMp;
  const hpv=Math.max(0,Math.round(h.hp));
  const mpv=Math.max(0,Math.round(mp));
  const hpPct=Math.max(0,Math.min(100,(hpv/maxHp)*100));
  const mpPct=Math.max(0,Math.min(100,(mpv/maxMp)*100));

  const hpCls=hpPct>70?'hp-hi':hpPct>40?'hp-mid':hpPct>15?'hp-low':'hp-crit';
  const auraCls=g.tier>0?('t'+(g.tier+1)):'';
  const zzz=h.mood==='sleep'?'<span class="sprite-zzz">z z</span>':'';

  /* chips de efectos activos */
  const bf=gm.buffs||{};
  const nowT=Date.now();
  const chips=[];
  if(bf.shield>0)chips.push('🛡×'+bf.shield);
  if(bf.certeroUntil>nowT)chips.push('🎯 '+Math.ceil((bf.certeroUntil-nowT)/60000)+'m');
  if(bf.cenizaUntil>nowT)chips.push('☠ '+Math.ceil((bf.cenizaUntil-nowT)/60000)+'m');
  if(bf.regenUntil>nowT)chips.push('🌿 '+Math.ceil((bf.regenUntil-nowT)/60000)+'m');
  if(bf.pesteDay===todayKey())chips.push('☠🍺 hoy');
  if(bf.bastion)chips.push('🏰 armado');
  if(bf.renacer)chips.push('🌅 esta noche');
  if((gm.judgmentDays||[]).includes(todayKey()))chips.push('⚖️ hoy');
  const chipsHtml=chips.length?`<div class="buff-row">${chips.map(c=>`<span class="buff">${c}</span>`).join('')}</div>`:'';

  const pips=bs.pips.map(p=>{
    const sym=p==='hit'?'✕':p==='fail'?'!':p==='today'?'●':'·';
    return `<div class="pip ${p}">${sym}</div>`;
  }).join('');
  let bState,bCls;
  if(bs.lost){bState='te ha vencido';bCls='lose';}
  else if(bs.won){bState='¡derrotado!';bCls='win';}
  else{bState='';bCls='curr';}

  /* iconos compactos: pasivas y activas en cuadraditos, con respaldo a inicial si falta el pixel art */
  const skillIcon=(a,type)=>{
    const on=g.lvl>=a.lvl;
    const ultiCls=a.ulti?' ulti':'';
    const src=`spells/${cls}_spells/${cls}_${type}_${a.icon}.png`;
    const fb=a.name.charAt(0);
    const openAttr=(type==='act')?`data-cast="${a.id}"`:`data-pas-name="${a.name}" data-pas-lvl="${a.lvl}"`;
    return `<div class="skill-box ${on?'on':'off'}${ultiCls}" ${openAttr}>
      <span class="sk-lv">Nv ${a.lvl}</span>
      <img src="${src}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="sk-fallback" style="display:none">${fb}</span>
    </div>`;
  };
  const pasIcons=C.pas.map(a=>skillIcon(a,'pas')).join('');
  const actIcons=C.act.map(a=>skillIcon(a,'act')).join('');

  box.innerHTML=`
    <div class="card">
      <div class="hero-top">
        <div class="sprite-box"><img class="sprite-bg" src="hero_background/${cls}_bg.png" alt=""><div class="sprite-aura ${auraCls}"></div>${spriteSVG(cls,h.mood)}${zzz}</div>
        <div class="hero-id">
          <div class="rango">${C.tiers[g.tier]}</div>
          <div class="nombre">${C.name}</div>
          <div class="nivel">Nivel ${g.lvl}</div>
          <div class="racha">Racha: <b>${g.streak}</b> día${g.streak===1?'':'s'} · Jefes: <b>${g.bossesDown}</b> · Armadura: <b>−${heroArmor()}</b><br>Disparos perfectos hoy: <b>${getDay(todayKey()).s||0}</b></div>
        </div>
      </div>
      ${chipsHtml}
      <div class="stat-bar">
        <div class="lbl"><span>SALUD</span><b>${hpv} / ${maxHp}</b></div>
        <div class="stat-track"><div class="stat-fill ${hpCls}" style="width:${hpPct}%"></div></div>
      </div>
      <div class="stat-bar">
        <div class="lbl"><span>MANÁ</span><b>${mpv} / ${maxMp}</b></div>
        <div class="stat-track"><div class="stat-fill mp" style="width:${mpPct}%"></div></div>
      </div>
      <div class="stat-bar">
        <div class="lbl"><span>EXPERIENCIA</span><b>${g.xp} / ${g.nextTh} XP</b></div>
        <div class="stat-track"><div class="stat-fill xp" style="width:${Math.round(g.prog*100)}%"></div></div>
      </div>
    </div>

    <div class="card">
      <div class="boss-top">
        <div class="boss-box">
          <img src="bosses/boss_${String(bs.bossNum).padStart(2,'0')}_${bs.slug}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="boss-fallback" style="display:none">💀</span>
        </div>
        <div class="boss-id">
          <div class="boss-head">
            <h2 style="margin:0">Jefe de la semana</h2>
          </div>
          <div class="boss-name">${bs.name}<small>máx ${bs.lim}/día · cada día cumplido es un golpe</small></div>
          <div class="pips">${pips}</div>
        </div>
      </div>
      <div class="boss-count">Jefes derrotados: <b>${g.bossesDown}</b> de <b>${state.config.startLimit+1}</b> · quedan <b>${(state.config.startLimit+1)-g.bossesDown-(bs.won?1:0)}</b> por delante</div>
    </div>

    <div class="card">
      <div class="skills-head">
        <h2 style="margin:0">Habilidades</h2>
        <button class="sk-info-btn" id="skInfoBtn" aria-label="Ver libro de habilidades">ⓘ</button>
      </div>
      <div class="sk-row-label">Pasivas</div>
      <div class="skill-row">${pasIcons}</div>
      <div class="sk-row-label acts">Activas</div>
      <div class="skill-row">${actIcons}</div>
    </div>`;

  window.__skillsCls=cls; /* para que el libro sepa qué clase pintar */
}

/* --- libro de habilidades: detalle completo de las 6 de la clase actual --- */
function renderSkillsSheet(){
  ensureHero();
  const gm=state.game;
  const cls=gm.cls; if(!cls) return;
  const C=CLASSES[cls];
  const g=gameStats();

  const iconTag=(a,type)=>{
    const src=`spells/${cls}_spells/${cls}_${type}_${a.icon}.png`;
    const fb=a.name.charAt(0);
    return `<div class="abil-ico"><img src="${src}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="sk-fallback" style="display:none">${fb}</span></div>`;
  };

  const pasHtml=C.pas.map(a=>{
    const on=g.lvl>=a.lvl;
    return `<div class="abil ${on?'on':'off'}">
      ${iconTag(a,'pas')}
      <div style="flex:1">
        <span class="lv" style="float:right">Nv ${a.lvl}</span>
        <div class="an">${a.name}${on?' · <span style="color:var(--ok);font-size:11px">activa</span>':''}</div>
        <div class="ad">${a.d}</div>
      </div>
    </div>`;
  }).join('');

  const actHtml=C.act.map(a=>{
    const on=g.lvl>=a.lvl;
    return `<div class="abil ${on?'on':'off'}">
      ${iconTag(a,'act')}
      <div style="flex:1">
        <span class="lv" style="float:right">Nv ${a.lvl}</span>
        <div class="an">${a.name}${a.ulti?' <span style="color:var(--kodak);font-size:10px">ULTI</span>':''}</div>
        <div class="ad">${a.d}</div>
        <div class="ad-cost">Coste: ${a.cost} 💧</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('skillsBody').innerHTML=`
    <div class="grim-cls-tag" style="margin-top:0">Pasivas — ${C.es}</div>
    ${pasHtml}
    <div class="grim-cls-tag">Hechizos — ${C.es}</div>
    ${actHtml}
  `;
}

/* ==================== fin RPG ==================== */

/* ---------- modal ---------- */
function openModal(k){
  editingKey=k;
  const d=parseKey(k), rec=getDay(k);
  document.getElementById('modalTitle').textContent=
    `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  document.getElementById('mCigVal').textContent=rec.c;
  document.getElementById('mPillVal').textContent=rec.p;
  document.getElementById('mCerVal').textContent=rec.b||0;
  document.getElementById('modalBg').classList.add('show');
}
function closeModal(){
  const c=+document.getElementById('mCigVal').textContent;
  const p=+document.getElementById('mPillVal').textContent;
  const b=+document.getElementById('mCerVal').textContent;
  setDay(editingKey,c,p,undefined,b);
  document.getElementById('modalBg').classList.remove('show');
}

/* ---------- eventos ---------- */
function bump(id,delta,min=0){
  const el=document.getElementById(id);
  el.textContent=Math.max(min,+el.textContent+delta);
}
document.getElementById('addCig').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  const r=smokeDamage();
  const rewards=perfectShotRewards({
    perfect:r.perfect,
    classId:state.game.cls,
    marksmanActive:Boolean(state.game.buffs&&state.game.buffs.certeroUntil>Date.now()),
    ashCurseActive:Boolean(state.game.buffs&&state.game.buffs.cenizaUntil>Date.now())
  });
  if(rewards.mana>0) state.game.mp=capMp((state.game.mp||0)+rewards.mana);
  (state.game.cigDmg=state.game.cigDmg||[]).push({
    d:r.dmg,
    p:r.perfect,
    x:rewards.xp,
    m:rewards.mana,
    h:r.healed,
    r:r.consumesRoots,
    sh:r.consumesShield
  });
  setDay(k,d.c+1,d.p,Date.now(),undefined,(d.s||0)+(r.perfect?1:0));
  if(rewards.xp>0&&state.days[k]){
    state.days[k].sx=(state.days[k].sx||0)+rewards.xp;
    scheduleSave(); renderHero();
  }
  if(r.shielded) showToast('🛡 Escudo absorbió el golpe','heal');
  else if(r.dmg>0) showToast('⚔ −'+r.dmg+' de vida','dmg');
  else if(r.perfect) showToast('Disparo perfecto · +'+rewards.xp+' XP · +'+rewards.mana+' 💧','heal');
  else showToast('En ritmo · sin daño ♥','heal');
});
document.getElementById('subCig').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if(d.c<=0) return;
  ensureHero();
  const arr=state.game.cigDmg;
  let wasPerfect=false, exX=0;
  if(arr&&arr.length){
    const undo=smokeUndoEffects(arr.pop());
    wasPerfect=undo.perfect;
    exX=undo.xp;
    if(undo.damage>0&&state.game.hp!==undefined){
      state.game.hp=capHp(state.game.hp+undo.damage);
      showToast('Corregido · +'+undo.damage+' de vida ♥','heal');
    }
    if(undo.healing>0&&state.game.hp!==undefined){
      state.game.hp=Math.max(0,state.game.hp-undo.healing);
    }
    if(undo.mana>0) state.game.mp=Math.max(0,(state.game.mp||0)-undo.mana);
    if(undo.restoreRoots&&state.game.rootsDay===k) state.game.rootsDay=null;
    if(undo.restoreShield){
      state.game.buffs=state.game.buffs||{};
      state.game.buffs.shield=(state.game.buffs.shield||0)+1;
    }
    scheduleSave();
  }
  setDay(k,d.c-1,d.p,undefined,undefined,(d.s||0)-(wasPerfect?1:0));
  if(exX>0&&state.days[k]){
    state.days[k].sx=Math.max(0,(state.days[k].sx||0)-exX);
    scheduleSave(); renderHero();
  }
});
document.getElementById('addPill').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  ensureHero();
  const goal=state.config.pillsGoal||3;
  if(d.p+1===goal&&state.game.hp!==undefined){
    const st=gameStats();
    const reward=pillCompletionReward({classId:state.game.cls,level:st.lvl});
    state.game.hp=capHp(state.game.hp+reward.healing);
    state.game.mp=capMp((state.game.mp||0)+reward.mana);
    scheduleSave();
    showToast('Pastillas completas · +'+reward.healing+' ♥ · +'+reward.mana+' 💧','heal');
  }
  setDay(k,d.c,d.p+1);
});
document.getElementById('subPill').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if(d.p<=0) return;
  ensureHero();
  const goal=state.config.pillsGoal||3;
  if(d.p===goal&&state.game.hp!==undefined){
    const st=gameStats();
    const reward=pillCompletionReward({classId:state.game.cls,level:st.lvl});
    state.game.hp=Math.max(0,state.game.hp-reward.healing);
    state.game.mp=Math.max(0,(state.game.mp||0)-reward.mana);
    scheduleSave();
    showToast('Poción retirada −'+reward.healing,'dmg');
  }
  setDay(k,d.c,d.p-1);
});
document.getElementById('addBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  ensureHero();
  const g=state.game;
  const bd=BEER_DAMAGE;                                      /* daño fijo; los poderes ya no dependen de la cerveza */
  if(bd>0&&g.hp!==undefined) g.hp=Math.max(0,g.hp-bd);
  (g.beerDmg=g.beerDmg||[]).push(bd);
  scheduleSave();
  setDay(k,d.c,d.p,undefined,(d.b||0)+1);
  showToast('🍺 −'+bd+' de vida','dmg');
});
document.getElementById('subBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if((d.b||0)<=0) return;
  ensureHero();
  const g=state.game;
  const arr=g.beerDmg;
  const bd=(arr&&arr.length)?arr.pop():BEER_DAMAGE;
  if(bd>0&&g.hp!==undefined){
    g.hp=capHp(g.hp+bd);
    showToast('Corregido · +'+bd+' de vida ♥','heal');
  }
  scheduleSave();
  setDay(k,d.c,d.p,undefined,(d.b||0)-1);
});

document.getElementById('mCigAdd').addEventListener('click',()=>bump('mCigVal',1));
document.getElementById('mCigSub').addEventListener('click',()=>bump('mCigVal',-1));
document.getElementById('mPillAdd').addEventListener('click',()=>bump('mPillVal',1));
document.getElementById('mPillSub').addEventListener('click',()=>bump('mPillVal',-1));
document.getElementById('mCerAdd').addEventListener('click',()=>bump('mCerVal',1));
document.getElementById('mCerSub').addEventListener('click',()=>bump('mCerVal',-1));
document.getElementById('modalClose').addEventListener('click',closeModal);
document.getElementById('modalBg').addEventListener('click',e=>{if(e.target.id==='modalBg')closeModal();});

/* editar la hora del último cigarro */
document.getElementById('paceInfo').addEventListener('click',e=>{
  if(e.target.dataset && e.target.dataset.editTime){
    const rec=getDay(todayKey());
    if(!rec.t) return;
    const lt=new Date(rec.t);
    document.getElementById('lastTimeInput').value=
      `${String(lt.getHours()).padStart(2,'0')}:${String(lt.getMinutes()).padStart(2,'0')}`;
    document.getElementById('timeModalBg').classList.add('show');
  }
});
document.getElementById('timeModalSave').addEventListener('click',()=>{
  const v=document.getElementById('lastTimeInput').value;
  if(v){
    const [h,m]=v.split(':').map(Number);
    const d=new Date(); d.setHours(h,m,0,0);
    const k=todayKey(), rec=getDay(k);
    setDay(k,rec.c,rec.p,d.getTime());
  }
  document.getElementById('timeModalBg').classList.remove('show');
});
document.getElementById('timeModalBg').addEventListener('click',e=>{
  if(e.target.id==='timeModalBg')document.getElementById('timeModalBg').classList.remove('show');
});

document.getElementById('calPrev').addEventListener('click',()=>{calCursor.setMonth(calCursor.getMonth()-1);renderCal();});
document.getElementById('calNext').addEventListener('click',()=>{calCursor.setMonth(calCursor.getMonth()+1);renderCal();});

document.getElementById('cfgStart').addEventListener('change',e=>{
  if(e.target.value){state.config.startDate=e.target.value;scheduleSave();renderAll();}
});
document.getElementById('cfgLimit').addEventListener('change',e=>{
  const v=parseInt(e.target.value,10);
  if(v>0){state.config.startLimit=v;scheduleSave();renderAll();}
});
document.getElementById('cfgWake').addEventListener('change',e=>{
  if(e.target.value){state.config.wakeTime=e.target.value;scheduleSave();renderAll();}
});
document.getElementById('cfgSleep').addEventListener('change',e=>{
  if(e.target.value){state.config.sleepTime=e.target.value;scheduleSave();renderAll();}
});
document.getElementById('cfgPills').addEventListener('change',e=>{
  const v=parseInt(e.target.value,10);
  if(v>0){state.config.pillsGoal=v;scheduleSave();renderAll();}
});
document.getElementById('cfgHeroName').addEventListener('change',e=>{
  const nm=e.target.value.trim();
  if(state.game){
    state.game.name=nm||(state.game.cls?CLASSES[state.game.cls].es:'');
    scheduleSave();renderAll();
  }
});
document.getElementById('beerYes').addEventListener('click',()=>{
  state.config.tracksBeer=true;scheduleSave();renderSettings();renderHoy();
});
document.getElementById('beerNo').addEventListener('click',()=>{
  state.config.tracksBeer=false;scheduleSave();renderSettings();renderHoy();
});

const views={navHoy:'view-hoy',navHero:'view-hero',navCal:'view-cal',navGraf:'view-graf'};
function switchView(vid,btnId){
  document.querySelectorAll('nav button, .gear-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(vid).classList.add('active');
  document.getElementById(btnId).classList.add('active');
  window.scrollTo(0,0);
  document.getElementById('scrollArea').scrollTop=0;
}
Object.keys(views).forEach(nid=>{
  document.getElementById(nid).addEventListener('click',()=>{
    switchView(views[nid],nid);
    if(nid==='navCal'){calCursor=new Date();renderCal();renderWeeks();}
    if(nid==='navGraf'){grafWeek=Math.max(0,weekIndexOf(new Date()));grafMonth=new Date();renderGraf();}
  });
});

/* menú hamburguesa: abre hojas superpuestas */
function openAjustes(){
  renderSettings();
  document.getElementById('sheetSet').classList.add('show');
}
document.getElementById('view-hoy').addEventListener('click',e=>{
  if(e.target.closest('.hoy-face')) openAjustes();
});
document.getElementById('navMenu').addEventListener('click',()=>{
  document.getElementById('menuBg').classList.add('show');
});
document.getElementById('menuAjustes').addEventListener('click',()=>{
  document.getElementById('menuBg').classList.remove('show');
  openAjustes();
});
document.getElementById('menuInstr').addEventListener('click',()=>{
  document.getElementById('menuBg').classList.remove('show');
  document.getElementById('sheetInstr').classList.add('show');
});
document.getElementById('menuBg').addEventListener('click',e=>{
  if(e.target.id==='menuBg')e.target.classList.remove('show');
});
document.querySelectorAll('.sheet-close').forEach(b=>{
  b.addEventListener('click',()=>{
    document.getElementById(b.dataset.sheet).classList.remove('show');
  });
});
document.querySelectorAll('.sheet-bg').forEach(s=>{
  s.addEventListener('click',e=>{
    if(e.target===s)s.classList.remove('show');
  });
});

/* controles de la gráfica */
document.getElementById('segSem').addEventListener('click',()=>{
  grafMode='semana';
  document.getElementById('segSem').classList.add('active');
  document.getElementById('segMes').classList.remove('active');
  renderGraf();
});
document.getElementById('segMes').addEventListener('click',()=>{
  grafMode='mes';
  document.getElementById('segMes').classList.add('active');
  document.getElementById('segSem').classList.remove('active');
  renderGraf();
});
document.getElementById('grafPrev').addEventListener('click',()=>{
  if(grafMode==='semana'){if(grafWeek>0){grafWeek--;renderGraf();}}
  else{grafMonth.setMonth(grafMonth.getMonth()-1);renderGraf();}
});
document.getElementById('grafNext').addEventListener('click',()=>{
  if(grafMode==='semana'){grafWeek++;renderGraf();}
  else{grafMonth.setMonth(grafMonth.getMonth()+1);renderGraf();}
});

/* elegir clase de héroe y lanzar hechizos */
document.getElementById('view-hero').addEventListener('click',e=>{
  if(e.target.closest('.sprite-box')){
    openAjustes();
    return;
  }
  const cast=e.target.closest('[data-cast]');
  if(cast&&!cast.disabled){
    castSpell(cast.dataset.cast);
    return;
  }
  const pasTap=e.target.closest('[data-pas-name]');
  if(pasTap){
    const lvl=parseInt(pasTap.dataset.pasLvl,10);
    const name=pasTap.dataset.pasName;
    const curLvl=gameStats().lvl;
    if(curLvl>=lvl) showToast(name+' · activa','heal');
    else showToast('Nivel '+lvl+' necesario','dmg');
    return;
  }
  if(e.target.closest('#skInfoBtn')){
    renderSkillsSheet();
    document.getElementById('sheetSkills').classList.add('show');
    return;
  }
  const card=e.target.closest('[data-cls]');
  if(card){
    const hadHero=(state.game.hp!==undefined);
    state.game.cls=card.dataset.cls;
    if(hadHero){
      state.game.buffs={};              /* los efectos de la clase anterior ya no aplican */
      state.game.hp=capHp(state.game.hp);   /* se conserva el valor, topado al nuevo máximo */
      state.game.mp=capMp(state.game.mp);
    }
    scheduleSave();
    renderHoy();
    renderHero();
  }
});
document.getElementById('cfgResetCls').addEventListener('click',()=>{
  state.game.cls=null;
  scheduleSave();
  document.getElementById('sheetSet').classList.remove('show');
  switchView('view-hero','navHero');
  renderHero();
});

/* copia de seguridad: exportar / importar */
let backupMode='export';
document.getElementById('btnExport').addEventListener('click',async()=>{
  const data=exportBackup(state);
  try{
    await navigator.clipboard.writeText(data);
    showToast('Datos copiados al portapapeles ✓','heal');
  }catch(e){
    backupMode='export';
    document.getElementById('backupTitle').textContent='Exportar datos';
    const ta=document.getElementById('backupText');
    ta.value=data; ta.readOnly=true;
    document.getElementById('backupAction').textContent='Cerrar';
    document.getElementById('backupBg').classList.add('show');
    ta.focus(); ta.select();
  }
});
document.getElementById('btnImport').addEventListener('click',()=>{
  backupMode='import';
  document.getElementById('backupTitle').textContent='Importar datos';
  const ta=document.getElementById('backupText');
  ta.value=''; ta.readOnly=false;
  document.getElementById('backupAction').textContent='Importar';
  document.getElementById('backupBg').classList.add('show');
});
document.getElementById('backupAction').addEventListener('click',()=>{
  if(backupMode==='import'){
    try{
      state=importBackup(state,document.getElementById('backupText').value);
      scheduleSave();
      renderAll();
      showToast('Datos importados ✓','heal');
    }catch(e){
      showToast('No se pudo leer la copia','dmg');
      return;
    }
  }
  document.getElementById('backupBg').classList.remove('show');
});
document.getElementById('backupBg').addEventListener('click',e=>{
  if(e.target.id==='backupBg')e.target.classList.remove('show');
});

/* refresco cada minuto: mueve la marca "ahora" de la barra de ritmo
   y resetea todo al pasar la medianoche (nuevo día, nuevo límite si toca semana nueva) */
let lastDay=todayKey();
function checkDay(){
  if(todayKey()!==lastDay){lastDay=todayKey();renderAll();}
  else{renderHoy();}
}
setInterval(checkDay,60000);
/* al volver la app de segundo plano (iOS la congela), refrescar al instante:
   si ya es otro día, los contadores vuelven a 0 sin esperar */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
window.addEventListener('pageshow',checkDay);
window.addEventListener('focus',checkDay);

/* ---------- init ---------- */
/* ---------- onboarding ---------- */
let obPillsYes=true;
function renderObHeroes(){
  let cards='';
  for(const id in CLASSES){
    const c=CLASSES[id];
    cards+=`<div class="cls-card" data-obcls="${id}">
      ${spriteSVG(id,'happy')}
      <div class="cn">${c.name}</div>
      <div class="ce">${c.es}</div>
      <div class="cd">${c.desc}</div>
    </div>`;
  }
  document.getElementById('obClsGrid').innerHTML=cards;
}
function showStep(n){
  document.querySelectorAll('.ob-step').forEach(s=>s.classList.remove('active'));
  document.getElementById('ob'+n).classList.add('active');
  document.getElementById('onboard').scrollTop=0;
}
function startOnboarding(){
  document.getElementById('loading').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('mainNav').classList.remove('show');
  const ob=document.getElementById('onboard');
  ob.style.display='flex';
  // fecha por defecto = hoy
  document.getElementById('obStart2').value=todayKey();
  renderObHeroes();
  showStep(1);
}
function finishOnboarding(clsId){
  state.config.startDate=document.getElementById('obStart2').value||todayKey();
  state.config.startLimit=parseInt(document.getElementById('obLimit').value,10)||20;
  state.config.wakeTime=document.getElementById('obWake').value||'09:00';
  state.config.sleepTime=document.getElementById('obSleep').value||'23:00';
  if(obPillsYes){
    state.config.takesPills=true;
    state.config.pillsGoal=parseInt(document.getElementById('obPills').value,10)||3;
  }else{
    state.config.takesPills=false;
    state.config.pillsGoal=0;
  }
  state.config.tracksBeer=obBeerYes;
  const nm=document.getElementById('obName').value.trim();
  state.game={cls:clsId, name:nm||CLASSES[clsId].es};
  state.onboarded=true;
  ensureHero();
  scheduleSave();
  document.getElementById('onboard').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('mainNav').classList.add('show');
  switchView('view-hoy','navHoy');
  renderAll();
}
document.getElementById('onboard').addEventListener('click',()=>{
  if(document.getElementById('ob1').classList.contains('active')) showStep(2);
});
document.querySelectorAll('[data-ob-back]').forEach(b=>{
  b.addEventListener('click',()=>showStep(Number(b.dataset.obBack)));
});
let obBeerYes=true;
document.querySelectorAll('.ob-tg').forEach(b=>{
  b.addEventListener('click',()=>{
    const group=b.dataset.pills!==undefined?'pills':'beer';
    const attr=group==='pills'?'pills':'beer';
    b.parentElement.querySelectorAll('.ob-tg').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if(group==='pills'){
      obPillsYes=(b.dataset.pills==='yes');
      document.getElementById('obPillsQty').style.display=obPillsYes?'block':'none';
    }else{
      obBeerYes=(b.dataset.beer==='yes');
    }
  });
});
document.getElementById('obToHero').addEventListener('click',()=>showStep(3));
let obChosenCls=null;
document.getElementById('obClsGrid').addEventListener('click',e=>{
  const card=e.target.closest('[data-obcls]');
  if(card){
    obChosenCls=card.dataset.obcls;
    const c=CLASSES[obChosenCls];
    document.getElementById('obHeroPreview').innerHTML=spriteSVG(obChosenCls,'happy');
    document.getElementById('obName').value='';
    document.getElementById('obName').placeholder=c.es+'…';
    showStep(4);
  }
});
document.getElementById('obFinish').addEventListener('click',()=>{
  finishOnboarding(obChosenCls||'knight');
});

/* reiniciar app */
document.getElementById('btnReset').addEventListener('click',()=>{
  if(!confirm('¿Reiniciar la app? Se borrarán todos tus datos y volverás a la pantalla de bienvenida. Haz una copia de seguridad antes si quieres conservarlos.')) return;
  state={
    config:{startDate:todayKey(), startLimit:20, wakeTime:'09:00', sleepTime:'23:00', pillsGoal:3, takesPills:true},
    days:{}, seeded:true, seededV:SEED_V, game:{cls:null}, onboarded:false
  };
  scheduleSave();
  document.getElementById('sheetSet').classList.remove('show');
  startOnboarding();
});

(async function(){
  await load();
  document.getElementById('loading').style.display='none';
  /* primera vez (sin héroe elegido) -> onboarding cinematográfico */
  if(!state.onboarded || !(state.game && state.game.cls)){
    startOnboarding();
  }else{
    document.getElementById('app').style.display='block';
    document.getElementById('mainNav').classList.add('show');
    renderAll();
    ensureHero();
    if(state.game&&state.game.weekModalPending){
      renderWeekResultModal();
      document.getElementById('weekResultBg').classList.add('show');
      state.game.weekModalPending=false;
      scheduleSave();
    }
  }
})();
