import { BOSSES, BOSS_SLUGS, CLASSES } from './data/game-data.js';
import { calculateGameStats } from './domain/progression-rules.js';
import {
  calculateBossCombatStatus,
  reconcileBossCombat
} from './domain/boss-combat-rules.js';
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
  addBeerIntoxication,
  beerUndoEffects,
  intoxicationStatus,
  removeBeerIntoxication,
  scalePassiveUpgrade
} from './domain/intoxication-rules.js';
import {
  STORAGE_KEY,
  createBrowserStore,
  mergeState,
  parseState,
  serializeState
} from './storage/state-storage.js';
import {
  renderCalendarView,
  renderWeeksView
} from './ui/calendar-view.js';
import { renderChartView } from './ui/chart-view.js';
import { renderTodayView } from './ui/today-view.js';
import {
  renderHeroView,
  renderSkillsView,
  spriteImage
} from './ui/hero-view.js';
import { renderSettingsView } from './ui/settings-view.js';
import { bindBackupControls } from './ui/backup-controller.js';
import { createOnboardingController } from './ui/onboarding-controller.js';
import { bindNavigation } from './ui/navigation-controller.js';
import { showToast as renderToast } from './ui/toast.js';

import {
  DAY_NAMES as DIAS,
  MONTH_NAMES as MESES,
  keyOf,
  minutesOf,
  parseKey,
  todayKey
} from './domain/date-utils.js';

const APP_VERSION='48';

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
  const pillHealing=prev? prev.ph : undefined;
  const pillMana=prev? prev.pm : undefined;
  if(c===0&&p===0&&beers===0){delete state.days[k];}
  else{
    state.days[k]={c,p};
    if(last!==undefined) state.days[k].t=last;
    if(beers>0) state.days[k].b=beers;
    if(shots>0) state.days[k].s=shots;
    if(shotXp>0) state.days[k].sx=shotXp;
    if(pillHealing!==undefined) state.days[k].ph=pillHealing;
    if(pillMana!==undefined) state.days[k].pm=pillMana;
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

function currentIntoxication(nowTimestamp=Date.now()){
  if(!state.game) return intoxicationStatus([],nowTimestamp);
  const previous=state.game.intoxication||[];
  const status=intoxicationStatus(previous,nowTimestamp);
  if(status.effects.length!==previous.length){
    state.game.intoxication=status.effects;
    scheduleSave();
  }
  return status;
}

/* ---------- render ---------- */
function renderAll(){renderHoy();renderCal();renderWeeks();renderGraf();renderHero();renderSettings();}

function renderHoy(){
  let stats=null;
  const intoxication=currentIntoxication();
  if(state.game && state.game.cls){
    ensureHero();
    stats=gameStats();
  }
  renderTodayView({
    document,
    now:new Date(),
    config:state.config,
    days:state.days,
    game:state.game,
    stats,
    intoxication
  });
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
  renderSettingsView({
    document,
    config:state.config,
    game:state.game
  });
}

/* ==================== RPG / TAMAGOTCHI ==================== */



function gameStats(){
  const intoxication=currentIntoxication();
  return calculateGameStats({
    now:new Date(),
    config:state.config,
    days:state.days,
    game:state.game,
    passiveMultiplier:intoxication.passiveMultiplier
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
  const body=document.getElementById('weekResultModal');
  const bossImg=(num,slug)=>`<div class="boss-box" style="margin:14px auto"><img src="bosses/boss_${String(num).padStart(2,'0')}_${slug}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="boss-fallback" style="display:none">💀</span></div>`;

  if(wr.won){
    const beatenIdx=Number.isFinite(wr.bossIndex)
      ? Math.max(0,wr.bossIndex)
      : Math.max(0,gameStats().bossesDown-1);
    const beatenName=BOSSES[beatenIdx], beatenSlug=BOSS_SLUGS[beatenIdx];
    const nextIdx=Math.min(beatenIdx+1,BOSSES.length-1);
    const nextName=BOSSES[nextIdx], nextSlug=BOSS_SLUGS[nextIdx];
    body.innerHTML=`
      <div style="font-size:12px;color:var(--ok);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">¡Semana superada!</div>
      <h3 style="margin-bottom:2px">Has vencido a ${beatenName}</h3>
      ${bossImg(beatenIdx+1,beatenSlug)}
      <p class="hint" style="margin:0 0 18px">De puta madre — le quitaste sus 150 puntos de vida. Esta semana entra un rival nuevo.</p>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Te espera:</div>
      <h3 style="margin-bottom:2px">${nextName}</h3>
      ${bossImg(nextIdx+1,nextSlug)}
      <button class="ob-next" id="weekResultClose" style="margin-top:6px">Seguir adelante</button>
    `;
    document.getElementById('weekResultClose').addEventListener('click',()=>{
      document.getElementById('weekResultBg').classList.remove('show');
    });
  }else{
    const idx=Number.isFinite(wr.bossIndex)
      ? Math.min(wr.bossIndex,BOSSES.length-1)
      : Math.min(gameStats().bossesDown,BOSSES.length-1);
    const name=BOSSES[idx], slug=BOSS_SLUGS[idx];
    const lastLim=limitOfWeek(wr.weekIdx);
    const newWeekIdx=wr.weekIdx+1;
    body.innerHTML=`
      <div style="font-size:12px;color:var(--warn);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Semana difícil</div>
      <h3 style="margin-bottom:2px">${name} sigue en pie</h3>
      ${bossImg(idx+1,slug)}
      <p class="hint" style="margin:0 0 10px">No pasa nada — esta semana lo consigues. El jefe es el mismo, pero ha recuperado sus <b>150 HP</b>.</p>
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

function showPendingWeekResult(){
  if(state.game&&state.game.weekModalPending){
    renderWeekResultModal();
    document.getElementById('weekResultBg').classList.add('show');
    state.game.weekModalPending=false;
    scheduleSave();
  }
}

function syncBossCombat(nowDate=new Date()){
  const g=state.game;
  if(!g||!g.cls) return null;
  let legacyBossesDown=0;
  if(!g.bossCombat){
    legacyBossesDown=calculateGameStats({
      now:nowDate,
      config:state.config,
      days:state.days,
      game:g,
      passiveMultiplier:currentIntoxication(nowDate.getTime()).passiveMultiplier
    }).bossesDown;
  }
  const previous=JSON.stringify(g.bossCombat||null);
  const result=reconcileBossCombat({
    combat:g.bossCombat,
    now:nowDate,
    config:state.config,
    days:state.days,
    legacyBossesDown
  });
  g.bossCombat=result.combat;
  for(const weekResult of result.weekResults){
    if(!weekResult.won){
      const mx=heroMaxes();
      const penalty=weeklyBossPenalty({
        hp:g.hp,
        maxHp:mx.maxHp,
        maxMp:mx.maxMp
      });
      g.hp=penalty.hp;
      g.mp=penalty.mp;
    }
    g.weekResult=weekResult;
    g.weekModalPending=true;
  }
  if(previous!==JSON.stringify(g.bossCombat)||result.weekResults.length){
    scheduleSave();
  }
  return result.status;
}

/* --- sistema de vida y maná por eventos --- */
function ensureHero(){
  if(!state.game) state.game={cls:null};
  const g=state.game;
  const now=Date.now();
  const intoxication=currentIntoxication(now);
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
      rebirthActive:Boolean(g.buffs.renacer),
      passiveMultiplier:intoxication.passiveMultiplier
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
  syncBossCombat(new Date(now));
  const regenerated=regenerateHealth({
    hp:g.hp,
    hpTimestamp:g.hpT,
    nowTimestamp:now,
    maxHp:heroMaxes().maxHp,
    classId:g.cls,
    regenerationActive:Boolean(g.buffs.regenUntil&&g.buffs.regenUntil>now),
    passiveMultiplier:intoxication.passiveMultiplier
  });
  if(regenerated.ticks>0){
    g.hp=regenerated.hp;
    g.hpT=regenerated.hpTimestamp;
    dirty=true;
  }
  if(dirty) scheduleSave();
}

function heroArmor(){
  const streak=gameStats().streak;
  const baseArmor=Math.min(5,Math.floor(streak/3));
  if(state.game&&state.game.cls==='knight'){
    const upgradedArmor=Math.min(5,Math.floor(streak/2)); /* Piel de Hierro */
    return scalePassiveUpgrade(
      baseArmor,
      upgradedArmor,
      currentIntoxication().passiveMultiplier
    );
  }
  return baseArmor;
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
  const intoxication=currentIntoxication(now.getTime());
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
    shieldCharges:(g.buffs&&g.buffs.shield)||0,
    passiveMultiplier:intoxication.passiveMultiplier
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
  const intoxication=currentIntoxication(now);
  const result=castSpellEffect({
    game:g,
    spell:sp,
    level:st.lvl,
    currentWeek:w,
    today:todayKey(),
    nowTimestamp:now,
    maxHp:st.maxHp,
    activeFailureChance:intoxication.activeFailureChance,
    passiveMultiplier:intoxication.passiveMultiplier
  });
  if(!result.ok){
    if(result.reason==='level') showToast('Nivel '+result.requiredLevel+' necesario','dmg');
    else if(result.reason==='ultimate-used') showToast('Ya usada esta semana','dmg');
    else if(result.minimumMana) showToast('Necesitas al menos '+result.requiredMana+' 💧','dmg');
    else if(result.reason==='mana') showToast('Maná insuficiente ('+result.requiredMana+' 💧)','dmg');
    else if(result.reason==='intoxicated'){
      state.game=result.game;
      scheduleSave();
      renderHero();
      renderHoy();
      showToast('🍺 La habilidad falló · −'+result.spentMana+' 💧','dmg');
    }
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
  renderToast(document,txt,type);
}

function renderHero(){
  const cls=state.game&&state.game.cls;
  if(!cls||!CLASSES[cls]){
    renderHeroView({
      document,
      now:new Date(),
      config:state.config,
      days:state.days,
      game:state.game,
      stats:null,
      boss:null,
      armor:0
    });
    return;
  }
  ensureHero();
  const now=new Date();
  const stats=gameStats();
  const intoxication=currentIntoxication(now.getTime());
  const boss=calculateBossCombatStatus({
    combat:state.game.bossCombat,
    now,
    config:state.config,
    days:state.days
  });
  renderHeroView({
    document,
    now,
    config:state.config,
    days:state.days,
    game:state.game,
    stats,
    boss,
    armor:heroArmor(),
    intoxication
  });
}

/* --- libro de habilidades: detalle completo de las 6 de la clase actual --- */
function renderSkillsSheet(){
  ensureHero();
  const cls=state.game&&state.game.cls;
  if(!cls) return;
  renderSkillsView({
    document,
    classId:cls,
    level:gameStats().lvl,
    intoxication:currentIntoxication()
  });
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
    ashCurseActive:Boolean(state.game.buffs&&state.game.buffs.cenizaUntil>Date.now()),
    passiveMultiplier:currentIntoxication().passiveMultiplier
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
  if(r.shielded) showToast('🛡 Escudo absorbió el ataque del jefe','heal');
  else if(r.dmg>0) showToast('⚔ El jefe ataca · −'+r.dmg+' de vida','dmg');
  else if(r.perfect) showToast('Disparo perfecto · −'+(d.s<3?1:0)+' jefe · +'+rewards.xp+' XP · +'+rewards.mana+' 💧','heal');
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
    const reward=pillCompletionReward({
      classId:state.game.cls,
      level:st.lvl,
      passiveMultiplier:currentIntoxication().passiveMultiplier
    });
    const hpBefore=state.game.hp;
    const mpBefore=state.game.mp||0;
    state.game.hp=capHp(hpBefore+reward.healing);
    state.game.mp=capMp(mpBefore+reward.mana);
    d.ph=state.game.hp-hpBefore;
    d.pm=state.game.mp-mpBefore;
    scheduleSave();
    showToast('Pastillas completas · +'+d.ph+' ♥ · +'+d.pm+' 💧','heal');
  }
  setDay(k,d.c,d.p+1);
});
document.getElementById('subPill').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if(d.p<=0) return;
  ensureHero();
  const goal=state.config.pillsGoal||3;
  if(d.p===goal&&state.game.hp!==undefined){
    const appliedHealing=Math.max(0,d.ph||0);
    const appliedMana=Math.max(0,d.pm||0);
    state.game.hp=Math.max(0,state.game.hp-appliedHealing);
    state.game.mp=Math.max(0,(state.game.mp||0)-appliedMana);
    delete d.ph;
    delete d.pm;
    scheduleSave();
    showToast('Poción retirada −'+appliedHealing+' ♥ · −'+appliedMana+' 💧','dmg');
  }
  setDay(k,d.c,d.p-1);
});
document.getElementById('addBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  ensureHero();
  const g=state.game;
  const added=addBeerIntoxication(g.intoxication||[],Date.now());
  g.intoxication=added.effects;
  const bd=BEER_DAMAGE;                                      /* daño fijo; los poderes ya no dependen de la cerveza */
  if(bd>0&&g.hp!==undefined) g.hp=Math.max(0,g.hp-bd);
  (g.beerDmg=g.beerDmg||[]).push({d:bd,i:added.effect.id});
  scheduleSave();
  setDay(k,d.c,d.p,undefined,(d.b||0)+1);
  showToast(
    '🍺 Borrachera '+added.status.level+'% · −'+bd+' de vida',
    'dmg'
  );
});
document.getElementById('subBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if((d.b||0)<=0) return;
  ensureHero();
  const g=state.game;
  const arr=g.beerDmg;
  const undo=beerUndoEffects(
    (arr&&arr.length)?arr.pop():BEER_DAMAGE
  );
  g.intoxication=removeBeerIntoxication(
    g.intoxication||[],
    undo.intoxicationEffectId,
    Date.now()
  );
  if(undo.damage>0&&g.hp!==undefined){
    g.hp=capHp(g.hp+undo.damage);
    showToast('Corregido · +'+undo.damage+' de vida ♥','heal');
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

function openAjustes(){
  renderSettings();
  document.getElementById('sheetSet').classList.add('show');
}
const navigation=bindNavigation({
  document,
  window,
  onOpenSettings:openAjustes,
  onCalendar:()=>{
    calCursor=new Date();
    renderCal();
    renderWeeks();
  },
  onChart:()=>{
    grafWeek=Math.max(0,weekIndexOf(new Date()));
    grafMonth=new Date();
    renderGraf();
  }
});
function switchView(viewId,buttonId){
  navigation.switchView(viewId,buttonId);
}

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
  if(e.target.closest('#bossInfoBtn')){
    document.getElementById('sheetBossHistory').classList.add('show');
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
bindBackupControls({
  document,
  navigator,
  getState:()=>state,
  onImported:(importedState)=>{
    state=importedState;
    scheduleSave();
    renderAll();
  },
  showToast
});

/* refresco cada minuto: mueve la marca "ahora" de la barra de ritmo
   y resetea todo al pasar la medianoche (nuevo día, nuevo límite si toca semana nueva) */
let lastDay=todayKey();
function checkDay(){
  if(todayKey()!==lastDay){lastDay=todayKey();renderAll();showPendingWeekResult();}
  else{renderHoy();renderHero();}
}
setInterval(checkDay,60000);
/* al volver la app de segundo plano (iOS la congela), refrescar al instante:
   si ya es otro día, los contadores vuelven a 0 sin esperar */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
window.addEventListener('pageshow',checkDay);
window.addEventListener('focus',checkDay);

/* ---------- init ---------- */
/* ---------- onboarding ---------- */
const onboarding=createOnboardingController({
  document,
  todayKey,
  spriteImage,
  onFinish:(result)=>{
    state.config={...state.config,...result.config};
    state.game=result.game;
    state.onboarded=result.onboarded;
    ensureHero();
    scheduleSave();
    document.getElementById('onboard').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('mainNav').classList.add('show');
    switchView('view-hoy','navHoy');
    renderAll();
  }
});
function startOnboarding(){
  onboarding.start();
}

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
    showPendingWeekResult();
  }
})();
