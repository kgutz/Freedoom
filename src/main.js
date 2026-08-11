import {
  BOSSES,
  BOSS_LORE,
  BOSS_SLUGS,
  CLASSES,
  classDataForJourney
} from './data/game-data.js';
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
  JOURNEY_MODE_REDUCTION,
  SMOKE_FREE_STATUS_PENDING,
  SMOKE_FREE_STATUS_SUCCESS,
  bossCountForJourney,
  controlledWeeklyLimitOf,
  isControlledMode,
  isControlledSmokingDay,
  isSmokeFreeMode,
  journeyConfigForDate,
  journeyDayDate,
  applyDueJourneyTransition,
  repairLegacyControlledTransitionStart,
  scheduleControlledJourneyTransition,
  journeyEvolutionUnlocked,
  smokeFreeStatusOf,
  usesSmokeFreeSkills
} from './domain/journey-mode-rules.js';
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
  RESET_CONFIRMATION_PHRASE,
  matchesResetConfirmation
} from './domain/reset-rules.js';
import {
  adjustHabitProgress,
  habitReward,
  nextHabitOrder,
  normalizeHabitInput,
  normalizeHabitState,
  reorderHabits
} from './domain/habit-rules.js';
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
  createDayEditorModel,
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
import { renderHabitsView } from './ui/habits-view.js';
import { bindBackupControls } from './ui/backup-controller.js';
import { createOnboardingController } from './ui/onboarding-controller.js';
import { bindNavigation } from './ui/navigation-controller.js';
import { showToast as renderToast } from './ui/toast.js';
import {
  DEFAULT_DAY_START_TIME,
  dayStartMinutes,
  timeLabel,
  timestampForLogicalDayTime
} from './domain/day-boundary-rules.js';

import {
  DAY_NAMES as DIAS,
  MONTH_NAMES as MESES,
  keyOf,
  minutesOf,
  parseKey
} from './domain/date-utils.js';
import {
  SPLASH_FADE_MS,
  SPLASH_MIN_VISIBLE_MS,
  waitForSplashAssets
} from './ui/splash-assets.js';

const APP_VERSION='133';
const RETURN_SPLASH_IDLE_MS=30*60*1000;

/* Datos iniciales que Kike apuntó a mano antes de tener la app */
const SEED={};
const SEED_V=3;

let state={
  config:{journeyMode:JOURNEY_MODE_REDUCTION, startDate:'2026-07-17', startLimit:20, wakeTime:'09:00', sleepTime:'23:00', dayStartTime:DEFAULT_DAY_START_TIME, pillsGoal:3, takesPills:true, tracksBeer:true},
  days:{},
  habits:{items:[],entries:{}},
  seeded:false,
  seededV:0,
  game:{cls:null},
  onboarded:false
};
let calCursor=currentDayDate();
let editingKey=null;
let saveTimer=null;
let returnSplashTimer=null;
let returnSplashPlaying=true;
let backgroundedAt=null;
let classChangeReturn=null;

document.getElementById('obVersion').textContent=`v${APP_VERSION}`;
document.getElementById('settingsVersion').textContent=`v${APP_VERSION}`;

async function revealReturnSplash({replay=false}={}){
  const loading=document.getElementById('loading');
  loading.style.display='flex';
  loading.classList.remove('exit','ready','replay');
  await waitForSplashAssets(loading);
  if(!returnSplashPlaying) return null;
  void loading.offsetWidth;
  loading.classList.add('ready');
  if(replay) loading.classList.add('replay');
  return performance.now();
}

const initialSplashReady=revealReturnSplash();

function finishReturnSplash(startedAt){
  clearTimeout(returnSplashTimer);
  const elapsed=startedAt===null?0:performance.now()-startedAt;
  returnSplashTimer=setTimeout(()=>{
    const loading=document.getElementById('loading');
    loading.classList.add('exit');
    returnSplashTimer=setTimeout(()=>{
      loading.style.display='none';
      loading.classList.remove('exit','ready','replay');
      returnSplashPlaying=false;
    },SPLASH_FADE_MS);
  },Math.max(0,SPLASH_MIN_VISIBLE_MS-elapsed));
}

async function finishInitialReturnSplash(){
  finishReturnSplash(await initialSplashReady);
}

async function playReturnSplash(){
  if(returnSplashPlaying||!state.onboarded||!(state.game&&state.game.cls)) return;
  returnSplashPlaying=true;
  finishReturnSplash(await revealReturnSplash({replay:true}));
}

/* ---------- utilidades de fecha ---------- */
function currentDayDate(now=new Date()){
  return journeyDayDate(state.config,now);
}
function todayKey(now=new Date()){
  return keyOf(currentDayDate(now));
}
function wakeTimeForDay(key=todayKey()){
  return (state.days[key]&&state.days[key].w)||state.config.wakeTime||'09:00';
}
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
function controlledWeekUsage(date=currentDayDate()){
  const week=Math.max(0,weekIndexOf(date));
  const [first,last]=weekRange(week);
  let used=0;
  for(let cursor=new Date(first);cursor<=last;cursor.setDate(cursor.getDate()+1)){
    const cursorConfig=journeyConfigForDate(state.config,cursor);
    if(isControlledSmokingDay(cursorConfig,cursor)){
      used+=Math.max(0,getDay(keyOf(cursor)).c||0);
    }
  }
  return used;
}
function controlledDayCompleted(key){
  const date=parseKey(key);
  const dateConfig=journeyConfigForDate(state.config,date);
  if(!isControlledMode(dateConfig)) return false;
  if(!isControlledSmokingDay(dateConfig,date)){
    return smokeFreeStatusOf(getDay(key))===SMOKE_FREE_STATUS_SUCCESS;
  }
  return controlledWeekUsage(date)<=controlledWeeklyLimitOf(dateConfig);
}
function applyPendingJourneyTransition(date=new Date()){
  const result=applyDueJourneyTransition(state.config,date);
  if(!result.applied) return false;
  state.config=result.config;
  scheduleSave({type:'journey:transition-applied',day:keyOf(date)});
  return true;
}
function repairJourneyTransitionHistory(){
  const result=repairLegacyControlledTransitionStart(state.config,state.days);
  if(!result.changed) return false;
  state.config=result.config;
  scheduleSave({
    type:result.repaired?'journey:transition-history-repaired':'journey:transition-history-checked'
  });
  return result.repaired;
}
function setDay(k,c,p,t,b,s,action){
  c=Math.max(0,c); p=Math.max(0,p);
  const prev=state.days[k];
  const last=(t!==undefined)? t : (prev? prev.t : undefined);
  const beers=(b!==undefined)? Math.max(0,b) : (prev? (prev.b||0) : 0);
  const shots=(s!==undefined)? Math.max(0,s) : (prev? (prev.s||0) : 0);
  const shotXp=prev? (prev.sx||0) : 0;
  const pillHealing=prev? prev.ph : undefined;
  const pillMana=prev? prev.pm : undefined;
  const dailyWake=prev? prev.w : undefined;
  const wakeEstimated=prev? prev.we : undefined;
  const smokeFreeStatus=prev? prev.sf : undefined;
  if(c===0&&p===0&&beers===0&&dailyWake===undefined&&smokeFreeStatus===undefined){delete state.days[k];}
  else{
    state.days[k]={c,p};
    if(last!==undefined) state.days[k].t=last;
    if(beers>0) state.days[k].b=beers;
    if(shots>0) state.days[k].s=shots;
    if(shotXp>0) state.days[k].sx=shotXp;
    if(pillHealing!==undefined) state.days[k].ph=pillHealing;
    if(pillMana!==undefined) state.days[k].pm=pillMana;
    if(dailyWake!==undefined) state.days[k].w=dailyWake;
    if(wakeEstimated) state.days[k].we=1;
    if(smokeFreeStatus!==undefined) state.days[k].sf=smokeFreeStatus;
  }
  scheduleSave(action); renderAll();
}

/* ---------- almacenamiento ---------- */
/* Adaptador: dentro de Claude usa window.storage; en GitHub Pages / PWA usa localStorage del navegador */
const store=createBrowserStore(window);
let storageHealth={state:'idle',revision:0,savedAt:0,title:'Comprobando guardado…',detail:'',warning:''};

function savedAtLabel(timestamp){
  if(!timestamp) return '';
  return new Intl.DateTimeFormat('es-ES',{
    day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'
  }).format(new Date(timestamp));
}
function renderStorageHealth(){
  const box=document.getElementById('storageHealth');
  const title=document.getElementById('storageHealthTitle');
  const detail=document.getElementById('storageHealthDetail');
  const warning=document.getElementById('storageWarning');
  if(box){
    box.dataset.state=storageHealth.state;
    if(title) title.textContent=storageHealth.title;
    if(detail) detail.textContent=storageHealth.detail;
  }
  if(warning){
    warning.textContent=storageHealth.warning||'';
    warning.style.display=storageHealth.warning?'block':'none';
  }
}
function setStorageHealth(next){
  storageHealth={...storageHealth,...next};
  renderStorageHealth();
}
function handleSaveResult(result){
  if(result?.blocked){
    setStorageHealth({
      state:'error',
      revision:result.revision||storageHealth.revision,
      savedAt:result.savedAt||storageHealth.savedAt,
      title:'Pérdida de datos bloqueada',
      detail:'La copia con información sigue protegida',
      warning:'Freedoom detectó que la partida iba a volver casi a cero y no sustituyó tus copias. Cierra y abre la app para recuperar automáticamente la última partida completa.'
    });
    return;
  }
  if(!result||!Number.isFinite(result.revision)){
    setStorageHealth({
      state:'saved',title:'Guardado ✓',detail:'Partida guardada',warning:''
    });
    return;
  }
  const degraded=Boolean(result.degraded);
  setStorageHealth({
    state:degraded?'error':'saved',
    revision:result.revision,
    savedAt:result.savedAt,
    title:degraded?'Guardado con protección reducida':'Guardado ✓',
    detail:`Último guardado · ${savedAtLabel(result.savedAt)}`,
    warning:degraded
      ? 'Tus datos se han guardado, pero una de las copias de seguridad falló. Exporta una copia desde Ajustes.'
      : ''
  });
  Promise.resolve(result.mirrorPromise).catch(error=>{
    console.warn('No se pudo actualizar la copia IndexedDB',error);
  });
}

async function requestPersistentStorage(){
  try{
    if(navigator.storage&&typeof navigator.storage.persist==='function'){
      await navigator.storage.persist();
    }
  }catch(error){
    console.warn('El navegador no concedió almacenamiento persistente',error);
  }
}

async function load(){
  try{
    const r=await store.get(STORAGE_KEY);
    if(r&&r.value){
      const saved=parseState(r.value);
      const legacyDayBoundary=!(saved.config&&saved.config.dayStartTime);
      state=mergeState(state,saved);
      setStorageHealth({
        state:'saved',
        revision:r.revision||0,
        savedAt:r.savedAt||0,
        title:r.recovered?'Partida recuperada automáticamente':'Guardado ✓',
        detail:r.savedAt?`Último guardado · ${savedAtLabel(r.savedAt)}`:'Partida compatible cargada',
        warning:r.recovered
          ? 'La copia principal no era la más reciente o estaba dañada. Freedoom recuperó la última copia válida.'
          : ''
      });
      if(legacyDayBoundary&&state.onboarded){
        const key=todayKey();
        const record=state.days[key]||{c:0,p:0};
        if(!record.w){
          state.days[key]={...record,w:state.config.wakeTime||'09:00'};
        }
        scheduleSave();
      }
    }
  }catch(e){
    console.error('Error cargando la partida',e);
    setStorageHealth({
      state:'error',title:'No se pudo cargar la partida',detail:e.message||'Error desconocido',
      warning:'Freedoom no pudo leer el guardado. No reinicies la app: revisa Copias de seguridad en el menú.'
    });
  }
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
function scheduleSave(action){
  if(action){
    try{ store.recordAction(action); }
    catch(error){ console.warn('No se pudo registrar la acción',error); }
  }
  setStorageHealth({state:'saving',title:'Guardando…',detail:'Verificando la partida',warning:''});
  /* en el móvil (localStorage) guarda al instante: si cierras la app justo después de un +, no se pierde */
  if(!store.usesExternalStorage){
    try{
      const result=store.set(STORAGE_KEY,serializeState(state));
      handleSaveResult(result);
    }catch(e){
      console.error('Error guardando',e);
      setStorageHealth({
        state:'error',title:'No se ha podido guardar',detail:e.message||'Error desconocido',
        warning:'El último cambio NO se ha guardado. No cierres la app; exporta una copia desde Ajustes y libera espacio en el dispositivo.'
      });
    }
    return;
  }
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{ handleSaveResult(await store.set(STORAGE_KEY,serializeState(state))); }
    catch(e){
      console.error('Error guardando',e);
      setStorageHealth({
        state:'error',title:'No se ha podido guardar',detail:e.message||'Error desconocido',
        warning:'El último cambio NO se ha guardado. No cierres la app y exporta una copia desde Ajustes.'
      });
    }
  },400);
}
/* La PWA guarda cada acción al instante; aquí solo anotamos cuándo se ocultó. */
window.addEventListener('pagehide',()=>{
  backgroundedAt=Date.now();
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
function renderAll(){applyPendingJourneyTransition();repairJourneyTransitionHistory();renderHoy();renderHabits();renderCal();renderWeeks();renderGraf();renderHero();renderSettings();renderStorageHealth();}

function renderHoy(){
  let stats=null;
  const intoxication=currentIntoxication();
  if(state.game && state.game.cls){
    ensureHero();
    stats=gameStats();
  }
  const now=new Date();
  renderTodayView({
    document,
    now,
    currentDate:currentDayDate(now),
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
    now:currentDayDate(),
    config:state.config,
    days:state.days,
    onDayClick:openModal
  });
  document.getElementById('calendarHint').textContent=isControlledMode(state.config)
    ? 'En días permitidos verás cuántos porros registraste. En los demás, ✓ significa que no fumaste, × que fumaste y · que sigue pendiente.'
    : isSmokeFreeMode(state.config)
      ? 'Toca un día para corregirlo. ✓ significa que te mantuviste sin fumar, × que fumaste y · que sigue pendiente.'
      : 'Toca un día para corregir sus cantidades. El número amarillo son cigarros (rojo si superó el límite de ese día) y 💊 las pastillas.';
}

function renderHabits(){
  const stats=state.game&&state.game.cls?gameStats():null;
  renderHabitsView({
    document,
    habitState:state.habits,
    date:currentDayDate(),
    planStartDate:state.config.startDate,
    game:state.game,
    stats,
    filter:habitViewFilter
  });
}

function renderWeeks(){
  renderWeeksView({
    document,
    now:currentDayDate(),
    config:state.config,
    days:state.days,
    onWeekClick:openWeekChart
  });
}

/* ---------- gráfica ---------- */
let grafMode='semana';
let grafWeek=null;   /* índice de semana del plan */
let grafMonth=currentDayDate();

function renderGraf(){
  const now=currentDayDate();
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
  document.getElementById('chartHint').textContent=isControlledMode(state.config)
    ? 'Cada barra muestra el consumo de ese día. Rojo indica que esa semana superó el máximo compartido.'
    : isSmokeFreeMode(state.config)
      ? 'Verde: días confirmados sin fumar. Rojo: días en los que fumaste. Los puntos permanecen pendientes.'
      : 'La línea discontinua es el límite diario de cada semana. Verde: tu mejor día. Rojo: días por encima del límite.';
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
    now:currentDayDate(),
    config:state.config,
    days:state.days,
    game:state.game,
    habits:state.habits,
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
    const bossCount=bossCountForJourney(state.config,BOSSES.length);
    const hasNextBoss=beatenIdx+1<bossCount;
    const nextIdx=Math.min(beatenIdx+1,bossCount-1);
    const nextName=BOSSES[nextIdx], nextSlug=BOSS_SLUGS[nextIdx];
    body.innerHTML=`
      <div style="font-size:12px;color:var(--ok);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">¡Semana superada!</div>
      <h3 style="margin-bottom:2px">Has vencido a ${beatenName}</h3>
      ${bossImg(beatenIdx+1,beatenSlug)}
      <p class="hint" style="margin:0 0 18px">De puta madre — le quitaste sus 150 puntos de vida. Esta semana entra un rival nuevo.</p>
      ${hasNextBoss
        ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Te espera:</div>
           <h3 style="margin-bottom:2px">${nextName}</h3>
           ${bossImg(nextIdx+1,nextSlug)}`
        : '<div class="boss-victory">✓ Has derrotado a todos los jefes de tu plan.</div>'}
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
    const smokeFreeMode=usesSmokeFreeSkills(state.config);
    const penaltyText=wr.penalty?.shielded
      ? 'Muro de Escudos bloqueó el golpe a tu vida; tu maná bajó al 20%.'
      : `Por el golpe recibido, tu vida bajó un ${Math.round((wr.penalty?.hpRate??0.3)*100)}% y tu maná al 20% — se recupera con el tiempo.`;
    const limitAdjustment=smokeFreeMode?'':`
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
      </div>`;
    body.innerHTML=`
      <div style="font-size:12px;color:var(--warn);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Semana difícil</div>
      <h3 style="margin-bottom:2px">${name} sigue en pie</h3>
      ${bossImg(idx+1,slug)}
      <p class="hint" style="margin:0 0 10px">No pasa nada — esta semana lo consigues. El jefe es el mismo, pero ha recuperado sus <b>150 HP</b>.</p>
      <p class="hint" style="margin:0 0 18px">${penaltyText}</p>
      ${limitAdjustment}
      <button class="ob-next" id="weekResultClose" style="margin-top:6px">Continuar</button>
    `;
    if(!smokeFreeMode){
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
    }
    document.getElementById('weekResultClose').addEventListener('click',()=>{
      const wantsAdjust=!smokeFreeMode&&document.getElementById('wrYes').classList.contains('active');
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
function registerDailyWakeEstimate(now=new Date()){
  const cutoff=dayStartMinutes(state.config.dayStartTime||DEFAULT_DAY_START_TIME);
  const currentMinutes=now.getHours()*60+now.getMinutes();
  if(currentMinutes<cutoff) return false;
  const key=todayKey(now);
  const record=state.days[key]||{c:0,p:0};
  if(record.w) return false;
  state.days[key]={...record,w:timeLabel(now),we:1};
  scheduleSave();
  return true;
}

function showPendingWeekResult(){
  if(state.game&&state.game.weekModalPending){
    renderWeekResultModal();
    document.getElementById('weekResultBg').classList.add('show');
    state.game.weekModalPending=false;
    scheduleSave();
  }
}

function syncBossCombat(nowDate=currentDayDate(),actualTimestamp=Date.now()){
  const g=state.game;
  if(!g||!g.cls) return null;
  let legacyBossesDown=0;
  if(!g.bossCombat){
    legacyBossesDown=calculateGameStats({
      now:nowDate,
      config:state.config,
      days:state.days,
      game:g,
      passiveMultiplier:currentIntoxication(actualTimestamp).passiveMultiplier
    }).bossesDown;
  }
  const previous=JSON.stringify(g.bossCombat||null);
  const previousEvolution=Boolean(g.evolutionUnlocked);
  const result=reconcileBossCombat({
    combat:g.bossCombat,
    now:nowDate,
    config:state.config,
    days:state.days,
    legacyBossesDown
  });
  g.bossCombat=result.combat;
  const totalBossesDown=
    Math.max(0,g.bossCombat.legacyBossesDown||0)+
    Math.max(0,g.bossCombat.defeated||0);
  g.evolutionUnlocked=journeyEvolutionUnlocked({
    config:state.config,
    bossesDown:totalBossesDown
  });
  for(const weekResult of result.weekResults){
    if(!weekResult.won){
      const mx=heroMaxes();
      const smokeFreeMode=usesSmokeFreeSkills(state.config);
      if(smokeFreeMode&&(g.buffs?.shield||0)>0){
        g.buffs.shield--;
        g.mp=Math.round(mx.maxMp*0.2);
        weekResult.penalty={shielded:true,hpRate:0,mpRate:0.2};
      }else{
        const lvl=gameStats().lvl;
        const knightReduction=smokeFreeMode&&g.cls==='knight'&&lvl>=5
          ? 0.1*currentIntoxication(actualTimestamp).passiveMultiplier
          : 0;
        const penalty=weeklyBossPenalty({
          hp:g.hp,
          maxHp:mx.maxHp,
          maxMp:mx.maxMp,
          damageRate:0.3-knightReduction
        });
        g.hp=penalty.hp;
        g.mp=penalty.mp;
        weekResult.penalty={shielded:false,hpRate:0.3-knightReduction,mpRate:0.2};
      }
    }
    g.weekResult=weekResult;
    g.weekModalPending=true;
  }
  if(previous!==JSON.stringify(g.bossCombat)||result.weekResults.length||previousEvolution!==g.evolutionUnlocked){
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
  /* Una partida antigua podía haber cambiado de fecha a medianoche. Durante
     la madrugada, al adoptar el nuevo corte, no debe aplicar descanso hacia atrás. */
  if(g.day>todayKey()){g.day=todayKey();dirty=true;}
  if(!Number.isFinite(g.hpT)){g.hpT=now;dirty=true;}
  /* descanso nocturno */
  if(g.day!==todayKey()){
    const lim=limitOfDate(parseKey(g.day));
    const previousDay=getDay(g.day);
    const c=previousDay.c;
    const lvl=gameStats().lvl;
    const mx=heroMaxes();
    const previousConfig=journeyConfigForDate(state.config,g.day);
    const completedDay=isSmokeFreeMode(previousConfig)
        ? smokeFreeStatusOf(previousDay)===SMOKE_FREE_STATUS_SUCCESS
        : isControlledMode(previousConfig)
          ? controlledDayCompleted(g.day)
          : c<=lim;
    const recovered=dailyRecovery({
      completedDay,
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
    if(!completedDay){
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
  syncBossCombat(currentDayDate(new Date(now)),now);
  const regenerated=regenerateHealth({
    hp:g.hp,
    hpTimestamp:g.hpT,
    nowTimestamp:now,
    maxHp:heroMaxes().maxHp,
    classId:g.cls,
    regenerationActive:Boolean(g.buffs.regenUntil&&g.buffs.regenUntil>now),
    passiveMultiplier:intoxication.passiveMultiplier,
    druidFastRegeneration:!usesSmokeFreeSkills(state.config)
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
  const key=todayKey(now);
  const lim=limitOfDate(currentDayDate(now));
  const rec=getDay(key);
  const wake=minutesOf(wakeTimeForDay(key));
  const sleep=minutesOf(state.config.sleepTime||'23:00');
  const lvl=gameStats().lvl;
  const cls=g.cls;
  const intoxication=currentIntoxication(now.getTime());
  const result=evaluateSmoke({
    now,
    today:key,
    record:rec,
    limit:lim,
    wakeMinutes:wake,
    sleepMinutes:sleep,
    classId:cls,
    level:lvl,
    rootsDay:g.rootsDay,
    pestActive:Boolean(g.buffs&&g.buffs.pesteDay===key),
    armor:heroArmor(),
    shieldCharges:(g.buffs&&g.buffs.shield)||0,
    passiveMultiplier:intoxication.passiveMultiplier,
    dayStartTime:state.config.dayStartTime||DEFAULT_DAY_START_TIME
  });
  if(result.consumesRoots) g.rootsDay=key;
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
  const C=classDataForJourney(g.cls,{smokeFree:usesSmokeFreeSkills(state.config)}); if(!C) return;
  const sp=C.act.find(a=>a.id===id); if(!sp) return;
  const w=Math.max(0,weekIndexOf(currentDayDate()));
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
    passiveMultiplier:intoxication.passiveMultiplier,
    smokeFreeMode:usesSmokeFreeSkills(state.config)
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
  const dayDate=currentDayDate(now);
  const dayKey=todayKey(now);
  const dailyConfig={...state.config,wakeTime:wakeTimeForDay(dayKey)};
  const stats=gameStats();
  const intoxication=currentIntoxication(now.getTime());
  const boss=calculateBossCombatStatus({
    combat:state.game.bossCombat,
    now:dayDate,
    config:state.config,
    days:state.days
  });
  renderHeroView({
    document,
    now,
    config:dailyConfig,
    days:state.days,
    game:state.game,
    stats,
    boss,
    armor:heroArmor(),
    intoxication,
    dayKey
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
    intoxication:currentIntoxication(),
    config:state.config
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
  const editorModel=createDayEditorModel({config:state.config,date:d});
  document.getElementById('mCigRow').style.display=editorModel.showCigarettes?'':'none';
  document.getElementById('mSmokeFreeRow').style.display=editorModel.showSmokeFreeStatus?'':'none';
  document.getElementById('mPillRow').style.display=editorModel.showPills?'':'none';
  document.getElementById('mBeerRow').style.display=editorModel.showBeers?'':'none';
  const statusEditor=document.getElementById('mSmokeFreeStatus');
  const status=smokeFreeStatusOf(rec);
  statusEditor.querySelectorAll('[data-modal-smoke-free]').forEach(button=>{
    button.classList.toggle('active',button.dataset.modalSmokeFree===status);
  });
  document.getElementById('modalBg').classList.add('show');
}
function closeModal(){
  const c=+document.getElementById('mCigVal').textContent;
  const p=+document.getElementById('mPillVal').textContent;
  const b=+document.getElementById('mCerVal').textContent;
  const editingDate=parseKey(editingKey);
  const editingConfig=journeyConfigForDate(state.config,editingDate);
  const editsConfirmation=isSmokeFreeMode(editingConfig)||(
    isControlledMode(editingConfig)&&
    !isControlledSmokingDay(editingConfig,editingDate)
  );
  if(editsConfirmation){
    const selected=document.querySelector('[data-modal-smoke-free].active');
    const record=state.days[editingKey]||{c:0,p:0};
    if(selected&&selected.dataset.modalSmokeFree!==SMOKE_FREE_STATUS_PENDING){
      state.days[editingKey]={...record,sf:selected.dataset.modalSmokeFree};
    }else if(record.sf!==undefined){
      delete record.sf;
      state.days[editingKey]=record;
    }
  }else if(isControlledMode(editingConfig)&&isControlledSmokingDay(editingConfig,editingDate)){
    const record=state.days[editingKey];
    if(record&&record.sf!==undefined){
      state.days[editingKey]={...record};
      delete state.days[editingKey].sf;
    }
  }
  setDay(editingKey,c,p,undefined,b,undefined,{type:'day:update',day:editingKey,cigarettes:c,pills:p,beers:b});
  document.getElementById('modalBg').classList.remove('show');
}

/* ---------- eventos ---------- */
function bump(id,delta,min=0){
  const el=document.getElementById(id);
  el.textContent=Math.max(min,+el.textContent+delta);
}
document.getElementById('addCig').addEventListener('click',()=>{
  if(isSmokeFreeMode(state.config)) return;
  registerDailyWakeEstimate();
  const k=todayKey(),d=getDay(k);
  if(isControlledMode(state.config)){
    const logicalToday=currentDayDate();
    if(!isControlledSmokingDay(state.config,logicalToday)) return;
    setDay(k,d.c+1,d.p,Date.now(),undefined,undefined,{
      type:'controlled:add',day:k,count:d.c+1
    });
    const used=controlledWeekUsage(logicalToday);
    const max=controlledWeeklyLimitOf(state.config);
    showToast(
      used<=max
        ? `Consumo semanal · ${used} de ${max}`
        : `Límite semanal superado · ${used} de ${max}`,
      used<=max?'heal':'dmg'
    );
    return;
  }
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
  setDay(k,d.c+1,d.p,Date.now(),undefined,(d.s||0)+(r.perfect?1:0),{
    type:'cigarette:add',day:k,count:d.c+1
  });
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
  if(isSmokeFreeMode(state.config)) return;
  const k=todayKey(),d=getDay(k);
  if(d.c<=0) return;
  if(isControlledMode(state.config)){
    if(!isControlledSmokingDay(state.config,currentDayDate())) return;
    setDay(k,d.c-1,d.p,undefined,undefined,undefined,{
      type:'controlled:remove',day:k,count:d.c-1
    });
    showToast(
      `Consumo corregido · ${controlledWeekUsage()} de ${controlledWeeklyLimitOf(state.config)}`,
      'heal'
    );
    return;
  }
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
  setDay(k,d.c-1,d.p,undefined,undefined,(d.s||0)-(wasPerfect?1:0),{
    type:'cigarette:remove',day:k,count:d.c-1
  });
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
  setDay(k,d.c,d.p+1,undefined,undefined,undefined,{type:'pill:add',day:k,count:d.p+1});
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
  setDay(k,d.c,d.p-1,undefined,undefined,undefined,{type:'pill:remove',day:k,count:d.p-1});
});
document.getElementById('addBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  ensureHero();
  const g=state.game;
  const added=addBeerIntoxication(g.intoxication||[],Date.now());
  g.intoxication=added.effects;
  const shielded=usesSmokeFreeSkills(state.config)&&(g.buffs?.shield||0)>0;
  if(shielded) g.buffs.shield--;
  const bd=shielded?0:BEER_DAMAGE;
  if(bd>0&&g.hp!==undefined) g.hp=Math.max(0,g.hp-bd);
  (g.beerDmg=g.beerDmg||[]).push({d:bd,i:added.effect.id,sh:shielded});
  scheduleSave();
  setDay(k,d.c,d.p,undefined,(d.b||0)+1,undefined,{
    type:'beer:add',day:k,count:(d.b||0)+1
  });
  showToast(shielded
    ? '🛡 Muro de Escudos bloqueó el daño · Borrachera '+added.status.level+'%'
    : '🍺 Borrachera '+added.status.level+'% · −'+bd+' de vida',
    shielded?'heal':'dmg'
  );
});
document.getElementById('subBeer').addEventListener('click',()=>{
  const k=todayKey(),d=getDay(k);
  if((d.b||0)<=0) return;
  ensureHero();
  const g=state.game;
  const arr=g.beerDmg;
  const beerEntry=(arr&&arr.length)?arr.pop():BEER_DAMAGE;
  const undo=beerUndoEffects(beerEntry);
  if(beerEntry&&typeof beerEntry==='object'&&beerEntry.sh){
    g.buffs=g.buffs||{};
    g.buffs.shield=(g.buffs.shield||0)+1;
  }
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
  setDay(k,d.c,d.p,undefined,(d.b||0)-1,undefined,{
    type:'beer:remove',day:k,count:(d.b||0)-1
  });
});

document.getElementById('mCigAdd').addEventListener('click',()=>bump('mCigVal',1));
document.getElementById('mCigSub').addEventListener('click',()=>bump('mCigVal',-1));
document.getElementById('mPillAdd').addEventListener('click',()=>bump('mPillVal',1));
document.getElementById('mPillSub').addEventListener('click',()=>bump('mPillVal',-1));
document.getElementById('mCerAdd').addEventListener('click',()=>bump('mCerVal',1));
document.getElementById('mCerSub').addEventListener('click',()=>bump('mCerVal',-1));
document.querySelectorAll('[data-modal-smoke-free]').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('[data-modal-smoke-free]').forEach(option=>option.classList.remove('active'));
    button.classList.add('active');
  });
});
function applySmokeFreeDayRewards(key,status){
  if(status!==SMOKE_FREE_STATUS_SUCCESS||!state.game?.cls) return '';
  ensureHero();
  const g=state.game;
  const rewards=g.smokeFreeRewards=g.smokeFreeRewards||{};
  rewards.healedDays=rewards.healedDays||[];
  if(rewards.healedDays.includes(key)) return '';
  const lvl=gameStats().lvl;
  const passive=currentIntoxication().passiveMultiplier;
  let healing=0;
  if(g.cls==='paladin'&&lvl>=5) healing=Math.max(0,Math.round(5*passive));
  else if(g.cls==='druid'&&lvl>=1) healing=Math.max(0,Math.round(8*passive));
  if(healing>0){
    const before=g.hp;
    g.hp=capHp(g.hp+healing);
    healing=g.hp-before;
  }
  rewards.healedDays.push(key);
  return healing>0?' · +'+healing+' ♥':'';
}
document.getElementById('smokeFreeCounter').addEventListener('click',event=>{
  const button=event.target.closest('[data-smoke-free-status]');
  const logicalToday=currentDayDate();
  const canConfirm=isSmokeFreeMode(state.config)||(
    isControlledMode(state.config)&&
    !isControlledSmokingDay(state.config,logicalToday)
  );
  if(!button||!canConfirm) return;
  const key=todayKey();
  const record=state.days[key]||{c:0,p:0};
  const status=button.dataset.smokeFreeStatus;
  if(status===SMOKE_FREE_STATUS_PENDING){
    const next={...record};
    delete next.sf;
    state.days[key]=next;
    showToast('El día vuelve a estar pendiente','heal');
  }else{
    state.days[key]={...record,sf:status};
    const rewardNotice=applySmokeFreeDayRewards(key,status);
    if(status!==SMOKE_FREE_STATUS_SUCCESS&&state.game){
      ensureHero();
      state.game.hpT=Date.now();
    }
    showToast(
      status===SMOKE_FREE_STATUS_SUCCESS
        ? (isControlledMode(state.config)
            ? '✓ Día completado · −25 HP al jefe · XP del día'
            : '✓ Día sin fumar · −25 HP al jefe · XP del día'+rewardNotice)
        : 'Día registrado. Mañana continúa tu camino.',
      status===SMOKE_FREE_STATUS_SUCCESS?'heal':'dmg'
    );
  }
  scheduleSave({type:'smoke-free:status',day:key,status});
  renderAll();
});
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
    const k=todayKey(), rec=getDay(k);
    const timestamp=timestampForLogicalDayTime({
      dayKey:k,
      time:v,
      dayStartTime:state.config.dayStartTime||DEFAULT_DAY_START_TIME
    });
    setDay(k,rec.c,rec.p,timestamp,undefined,undefined,{type:'cigarette:time',day:k,time:timestamp});
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
document.getElementById('cfgControlledWeeklyLimit').addEventListener('change',e=>{
  const v=parseInt(e.target.value,10);
  if(v>0){state.config.controlledWeeklyLimit=v;scheduleSave();renderAll();}
});
document.getElementById('journeyChangeOpen').addEventListener('click',()=>{
  document.querySelectorAll('[data-transition-controlled-day]').forEach(button=>{
    button.classList.toggle('active',[5,6,0].includes(Number(button.dataset.transitionControlledDay)));
  });
  document.getElementById('journeyTransitionLimit').value=3;
  document.getElementById('journeyChangeOpen').style.display='none';
  document.getElementById('journeyChangeForm').style.display='block';
});
document.getElementById('journeyChangeCancel').addEventListener('click',()=>{
  document.getElementById('journeyChangeForm').style.display='none';
  document.getElementById('journeyChangeOpen').style.display='';
});
document.querySelectorAll('[data-transition-controlled-day]').forEach(button=>{
  button.addEventListener('click',()=>{
    const active=document.querySelectorAll('[data-transition-controlled-day].active');
    if(button.classList.contains('active')&&active.length===1) return;
    button.classList.toggle('active');
  });
});
document.getElementById('journeyChangeConfirm').addEventListener('click',()=>{
  if(!isSmokeFreeMode(state.config)) return;
  const days=Array.from(
    document.querySelectorAll('[data-transition-controlled-day].active'),
    button=>Number(button.dataset.transitionControlledDay)
  );
  const limit=Math.max(1,parseInt(document.getElementById('journeyTransitionLimit').value,10)||3);
  const effectiveDate=keyOf(new Date());
  state.config=scheduleControlledJourneyTransition({
    config:state.config,
    effectiveDate,
    controlledDays:days,
    controlledWeeklyLimit:limit
  });
  scheduleSave({type:'journey:transition-scheduled',effectiveDate});
  renderAll();
  showToast('Consumo controlado activado desde hoy','heal');
});
document.getElementById('journeyChangeUndo').addEventListener('click',()=>{
  delete state.config.pendingJourneyTransition;
  scheduleSave({type:'journey:transition-cancelled'});
  renderAll();
  showToast('Cambio de camino cancelado','heal');
});
document.querySelectorAll('[data-settings-controlled-day]').forEach(button=>{
  button.addEventListener('click',()=>{
    const day=Number(button.dataset.settingsControlledDay);
    const selected=new Set(state.config.controlledDays||[5,6,0]);
    if(selected.has(day)&&selected.size>1) selected.delete(day);
    else selected.add(day);
    state.config.controlledDays=[...selected];
    scheduleSave();renderAll();
  });
});
document.getElementById('cfgDayStart').addEventListener('change',e=>{
  if(e.target.value){
    state.config.dayStartTime=e.target.value;
    lastDay=todayKey();
    registerDailyWakeEstimate();
    scheduleSave();
    renderAll();
  }
});
document.getElementById('todayWakeInput').addEventListener('change',e=>{
  if(!e.target.value) return;
  const key=todayKey();
  const record=state.days[key]||{c:0,p:0};
  state.days[key]={...record,w:e.target.value};
  delete state.days[key].we;
  scheduleSave();
  renderAll();
  showToast('Despertar de hoy actualizado · '+e.target.value,'heal');
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
  onOpenRecoveries:openRecoveryModal,
  onHabits:renderHabits,
  onCalendar:()=>{
    calCursor=currentDayDate();
    renderCal();
    renderWeeks();
  }
});
function switchView(viewId,buttonId){
  navigation.switchView(viewId,buttonId);
}

/* controles de la gráfica */
function showHistoryPanel(panel,weekIndex=null){
  const calendar=panel==='calendar';
  document.getElementById('calendarPanel').style.display=calendar?'block':'none';
  document.getElementById('chartPanel').style.display=calendar?'none':'block';
  document.getElementById('historyCalTab').classList.toggle('active',calendar);
  document.getElementById('historyGrafTab').classList.toggle('active',!calendar);
  document.getElementById('historyCalTab').setAttribute('aria-selected',String(calendar));
  document.getElementById('historyGrafTab').setAttribute('aria-selected',String(!calendar));
  if(!calendar){
    grafWeek=Number.isInteger(weekIndex)
      ? Math.max(0,weekIndex)
      : Math.max(0,weekIndexOf(currentDayDate()));
    grafMonth=currentDayDate();
    renderGraf();
  }
}
function openWeekChart(weekIndex){
  grafMode='semana';
  document.getElementById('segSem').classList.add('active');
  document.getElementById('segMes').classList.remove('active');
  showHistoryPanel('chart',weekIndex);
  document.querySelector('.history-tabs')?.scrollIntoView({behavior:'smooth',block:'start'});
}
document.getElementById('historyCalTab').addEventListener('click',()=>showHistoryPanel('calendar'));
document.getElementById('historyGrafTab').addEventListener('click',()=>showHistoryPanel('chart'));

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

/* ---------- recuperación del guardado ---------- */
function appendRecoverySection(list,{title,description,items}){
  if(!items.length) return;
  const section=document.createElement('section');
  section.className='recovery-section';
  const heading=document.createElement('div');
  heading.className='recovery-section-heading';
  const headingTitle=document.createElement('b');
  headingTitle.textContent=title;
  heading.append(headingTitle);
  if(description){
    const headingDescription=document.createElement('small');
    headingDescription.textContent=description;
    heading.append(headingDescription);
  }
  const rows=document.createElement('div');
  rows.className='recovery-group-rows';
  items.forEach(({recovery,label,detail,recommended=false})=>{
    const row=document.createElement('div');
    row.className='recovery-row';
    if(recommended) row.classList.add('recommended');
    const info=document.createElement('div');
    const name=document.createElement('b');
    name.textContent=label;
    const meta=document.createElement('small');
    meta.textContent=`${savedAtLabel(recovery.savedAt)} · ${detail}`;
    info.append(name,meta);
    const button=document.createElement('button');
    button.type='button';
    button.className='mini-btn';
    button.dataset.recoveryRevision=String(recovery.revision);
    button.dataset.recoverySource=recovery.source;
    button.dataset.recoveryLabel=label;
    button.textContent='Restaurar';
    row.append(info,button);
    rows.append(row);
  });
  section.append(heading,rows);
  list.append(section);
}
async function openRecoveryModal(){
  const modal=document.getElementById('recoveryBg');
  const list=document.getElementById('recoveryList');
  list.textContent='Buscando copias…';
  modal.classList.add('show');
  try{
    const recoveries=await store.listRecoveries(STORAGE_KEY);
    list.replaceChildren();
    if(!recoveries.length){
      const empty=document.createElement('p');
      empty.className='recovery-empty';
      empty.textContent='Todavía no hay copias automáticas disponibles.';
      list.append(empty);
      return;
    }
    const lastInformation=recoveries.find(recovery=>recovery.source==='last-info');
    const daily=recoveries.find(recovery=>recovery.source==='daily');
    const weekly=recoveries.find(recovery=>recovery.source==='weekly');
    appendRecoverySection(list,{
      title:'Recomendada',
      description:'La referencia más segura si tu partida desapareció.',
      items:lastInformation?[{
        recovery:lastInformation,
        label:'Última partida con información',
        detail:'Protegida contra regresiones',
        recommended:true
      }]:[]
    });
    appendRecoverySection(list,{
      title:'Copias protegidas',
      description:'Puntos de retorno separados por tiempo.',
      items:[
        daily&&{recovery:daily,label:'Copia diaria',detail:'Mejor estado guardado ese día'},
        weekly&&{recovery:weekly,label:'Copia semanal',detail:'Estado protegido de la semana'}
      ].filter(Boolean)
    });
  }catch(error){
    list.textContent='No se pudieron leer las copias: '+(error.message||'error desconocido');
  }
}
function closeRecoveryModal(){
  document.getElementById('recoveryBg').classList.remove('show');
}
document.getElementById('btnExport').addEventListener('click',closeRecoveryModal);
document.getElementById('btnImport').addEventListener('click',closeRecoveryModal);
document.getElementById('recoveryClose').addEventListener('click',closeRecoveryModal);
document.getElementById('recoveryBg').addEventListener('click',event=>{
  if(event.target.id==='recoveryBg') closeRecoveryModal();
});
document.getElementById('recoveryList').addEventListener('click',async event=>{
  const button=event.target.closest('[data-recovery-revision]');
  if(!button) return;
  const revision=Number(button.dataset.recoveryRevision);
  const source=button.dataset.recoverySource||null;
  const label=button.dataset.recoveryLabel||'esta partida';
  if(!confirm(`¿Restaurar “${label}”? La partida actual se conservará como otra copia.`)) return;
  button.disabled=true;
  try{
    const recovered=await store.recoveryState(revision,STORAGE_KEY,source);
    if(!recovered) throw new Error('La copia ya no está disponible');
    store.authorizeDestructiveSave('recovery');
    state=mergeState(state,recovered);
    scheduleSave({type:'recovery:restore',revision});
    closeRecoveryModal();
    renderAll();
    showToast('Partida recuperada · '+label,'heal');
  }catch(error){
    button.disabled=false;
    showToast('No se pudo recuperar: '+(error.message||'error desconocido'),'dmg');
  }
});

/* ---------- hábitos ---------- */
let editingHabitId=null;
let habitViewFilter='all';
let habitDraftDifficulty='easy';
let habitDraftFrequency='daily';
let habitDraftTarget=1;
let habitEditorCloseTimer=null;
let habitEditorViewportHeight=null;
let habitEditorResizeHandler=null;

function applySmokeFreeHabitRewards({result}){
  const g=state.game;
  if(!g||!g.cls||result.xpDelta<=0) return '';
  const key=todayKey();
  const lvl=gameStats().lvl;
  const passive=currentIntoxication().passiveMultiplier;
  const rewards=g.smokeFreeRewards=g.smokeFreeRewards||{};
  const notices=[];
  if(g.cls==='sorcerer'&&lvl>=1){
    rewards.sorcererHabitDays=rewards.sorcererHabitDays||[];
    if(!rewards.sorcererHabitDays.includes(key)){
      const mana=Math.max(0,Math.round(5*passive));
      g.mp=capMp((g.mp||0)+mana);
      rewards.sorcererHabitDays.push(key);
      if(mana>0) notices.push('+'+mana+' 💧');
    }
  }
  if(g.cls==='druid'&&lvl>=12){
    rewards.druidHabitDays=rewards.druidHabitDays||[];
    if(!rewards.druidHabitDays.includes(key)){
      const amount=Math.max(0,Math.round(5*passive));
      g.hp=capHp((g.hp||0)+amount);
      g.mp=capMp((g.mp||0)+amount);
      rewards.druidHabitDays.push(key);
      if(amount>0) notices.push('+'+amount+' ♥/💧');
    }
  }
  if(g.cls==='sorcerer'&&g.buffs?.cenizaUntil>Date.now()){
    const entryKey=`${result.entry.habitId}|${result.entry.periodKey}`;
    rewards.cenizaHabitEntries=rewards.cenizaHabitEntries||[];
    if(!rewards.cenizaHabitEntries.includes(entryKey)){
      g.mp=capMp((g.mp||0)+10);
      rewards.cenizaHabitEntries.push(entryKey);
      notices.push('+10 💧 Ceniza');
    }
  }
  return notices.length?' · '+notices.join(' · '):'';
}

function activeHabitById(id){
  return normalizeHabitState(state.habits).items.find(habit=>habit.id===id&&habit.active!==false);
}
function updateHabitEditor(){
  document.querySelectorAll('[data-habit-difficulty]').forEach(button=>{
    button.classList.toggle('active',button.dataset.habitDifficulty===habitDraftDifficulty);
  });
  document.querySelectorAll('[data-habit-frequency]').forEach(button=>{
    button.classList.toggle('active',button.dataset.habitFrequency===habitDraftFrequency);
  });
  document.getElementById('habitTargetValue').textContent=habitDraftTarget;
  document.getElementById('habitRewardPreview').textContent='+'+habitReward({
    difficulty:habitDraftDifficulty,
    frequency:habitDraftFrequency
  })+' XP';
}
function finishHabitEditorClose(){
  const modal=document.getElementById('habitModalBg');
  const mainNav=document.getElementById('mainNav');
  clearTimeout(habitEditorCloseTimer);
  habitEditorCloseTimer=null;
  if(habitEditorResizeHandler&&window.visualViewport){
    window.visualViewport.removeEventListener('resize',habitEditorResizeHandler);
  }
  habitEditorResizeHandler=null;
  habitEditorViewportHeight=null;
  mainNav.style.bottom='0px';
  void mainNav.offsetHeight;
  modal.classList.remove('show');
  document.body.classList.remove('habit-editor-open');
}
function closeHabitEditor(){
  const modal=document.getElementById('habitModalBg');
  if(habitEditorCloseTimer||habitEditorResizeHandler) return;
  const active=document.activeElement;
  const viewport=window.visualViewport;
  const keyboardOpen=Boolean(
    viewport&&habitEditorViewportHeight&&
    viewport.height<habitEditorViewportHeight-80
  );
  if(!keyboardOpen){
    if(active&&modal.contains(active)&&typeof active.blur==='function') active.blur();
    finishHabitEditorClose();
    return;
  }
  habitEditorResizeHandler=()=>{
    if(viewport.height>=habitEditorViewportHeight-40) finishHabitEditorClose();
  };
  viewport.addEventListener('resize',habitEditorResizeHandler);
  habitEditorCloseTimer=setTimeout(finishHabitEditorClose,800);
  if(active&&modal.contains(active)&&typeof active.blur==='function') active.blur();
  habitEditorResizeHandler();
}
function openHabitEditor(id=null){
  const habit=id?activeHabitById(id):null;
  editingHabitId=habit?habit.id:null;
  habitDraftDifficulty=habit?.difficulty||'easy';
  habitDraftFrequency=habit?.frequency||'daily';
  habitDraftTarget=habit?.target||1;
  document.getElementById('habitModalTitle').textContent=habit?'Editar hábito':'Nuevo hábito';
  document.getElementById('habitTitle').value=habit?.title||'';
  document.getElementById('habitNotes').value=habit?.notes||'';
  document.getElementById('habitDelete').style.display=habit?'block':'none';
  updateHabitEditor();
  if(habitEditorCloseTimer||habitEditorResizeHandler) finishHabitEditorClose();
  habitEditorViewportHeight=window.visualViewport?.height||window.innerHeight;
  document.body.classList.add('habit-editor-open');
  document.getElementById('habitModalBg').classList.add('show');
}
function saveHabitEditor(){
  const input=normalizeHabitInput({
    title:document.getElementById('habitTitle').value,
    notes:document.getElementById('habitNotes').value,
    difficulty:habitDraftDifficulty,
    frequency:habitDraftFrequency,
    target:habitDraftTarget
  });
  if(!input.title){
    showToast('Escribe un nombre para el hábito','dmg');
    return;
  }
  const normalized=normalizeHabitState(state.habits);
  const wasEditing=Boolean(editingHabitId);
  let savedHabitId=editingHabitId;
  if(editingHabitId){
    const existing=normalized.items.find(habit=>habit.id===editingHabitId);
    const changedFrequency=Boolean(existing&&existing.frequency!==input.frequency);
    const nextOrder=changedFrequency?nextHabitOrder(normalized,input.frequency):existing?.order;
    normalized.items=normalized.items.map(habit=>habit.id===editingHabitId
      ? {...habit,...input,...(changedFrequency?{order:nextOrder}:{}),updatedAt:Date.now()}
      : habit);
  }else{
    const id=globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function'
      ? globalThis.crypto.randomUUID()
      : 'habit-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    savedHabitId=id;
    normalized.items.push({
      id,
      ...input,
      active:true,
      order:nextHabitOrder(normalized,input.frequency),
      createdAt:Date.now(),
      updatedAt:Date.now()
    });
  }
  state.habits=normalized;
  scheduleSave({
    type:wasEditing?'habit:update':'habit:create',
    id:savedHabitId,
    title:input.title
  });
  closeHabitEditor();
  renderAll();
  showToast(wasEditing?'Hábito actualizado':'Hábito creado','heal');
}

document.getElementById('view-habits').addEventListener('click',event=>{
  const filter=event.target.closest('[data-habit-filter]');
  if(filter){
    habitViewFilter=filter.dataset.habitFilter;
    renderHabits();
    return;
  }
  if(event.target.closest('[data-open-settings]')){
    openAjustes();
    return;
  }
  if(event.target.closest('[data-add-habit]')){
    openHabitEditor();
    return;
  }
  const adjust=event.target.closest('[data-habit-delta]');
  if(adjust&&!adjust.disabled){
    const row=adjust.closest('[data-habit-id]');
    const habit=activeHabitById(row?.dataset.habitId);
    if(!habit) return;
    ensureHero();
    const smokeFreeMode=usesSmokeFreeSkills(state.config);
    const buffs=state.game.buffs||{};
    const focusActive=smokeFreeMode&&state.game.cls==='paladin'&&(buffs.habitFocusCharges||0)>0;
    const result=adjustHabitProgress({
      habitState:state.habits,
      habit,
      delta:parseInt(adjust.dataset.habitDelta,10),
      date:currentDayDate(),
      planStartDate:state.config.startDate,
      rewardMultiplier:focusActive?1.5:1
    });
    state.habits=result.habitState;
    let extraMessage='';
    if(result.xpDelta>0&&focusActive){
      buffs.habitFocusCharges=Math.max(0,buffs.habitFocusCharges-1);
      extraMessage=' · Ojo Certero';
    }
    const habitRewardNotice=result.xpDelta>0&&smokeFreeMode
      ? applySmokeFreeHabitRewards({result})
      : '';
    scheduleSave({
      type:'habit:progress',id:habit.id,count:result.entry.count,
      period:result.entry.periodKey||''
    });
    renderAll();
    if(result.xpDelta>0) showToast('Hábito completado · +'+result.xpDelta+' XP'+extraMessage+habitRewardNotice,'heal');
    else if(result.xpDelta<0) showToast('Progreso corregido · '+result.xpDelta+' XP','dmg');
    else if(result.completed) showToast('Límite de XP alcanzado','heal');
    return;
  }
  const edit=event.target.closest('[data-edit-habit]');
  if(edit) openHabitEditor(edit.dataset.editHabit);
});

const habitsView=document.getElementById('view-habits');
const habitsScrollArea=document.getElementById('scrollArea');
const HABIT_DRAG_HOLD_MS=450;
const HABIT_DRAG_MOVE_TOLERANCE=8;
let habitDrag=null;

function orderedHabitIds(group){
  return [...group.querySelectorAll('.habit-row')].map(row=>row.dataset.habitId);
}

function saveHabitOrder(group){
  const frequency=group?.dataset.habitGroup;
  if(!frequency) return;
  const ids=orderedHabitIds(group);
  state.habits=reorderHabits(state.habits,frequency,ids);
  scheduleSave({type:'habit:reorder',frequency,ids});
}

function finishHabitDrag(event,cancelled=false){
  if(!habitDrag||event.pointerId!==habitDrag.pointerId) return;
  const {row,group,list,handle,holdTimer,active,moved}=habitDrag;
  window.clearTimeout(holdTimer);
  try{handle.releasePointerCapture(event.pointerId);}catch{}
  handle.classList.remove('hold-pending');
  if(!active){
    habitDrag=null;
    return;
  }
  row.classList.remove('dragging');
  list.classList.remove('drag-active');
  document.body.classList.remove('habit-dragging');
  habitDrag=null;
  if(cancelled){
    renderHabits();
    return;
  }
  if(!moved) return;
  saveHabitOrder(group);
  renderHabits();
  showToast('Orden de hábitos guardado','heal');
}

habitsView.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-habit-drag]');
  if(!handle||(event.pointerType==='mouse'&&event.button!==0)) return;
  const row=handle.closest('.habit-row');
  const group=row?.closest('[data-habit-group]');
  const list=group?.querySelector('.habit-group-list');
  if(!row||!group||!list) return;
  event.preventDefault();
  if(habitDrag) return;
  habitDrag={
    pointerId:event.pointerId,row,group,list,handle,
    startX:event.clientX,startY:event.clientY,
    active:false,moved:false,holdTimer:null
  };
  try{handle.setPointerCapture(event.pointerId);}catch{}
  handle.classList.add('hold-pending');
  habitDrag.holdTimer=window.setTimeout(()=>{
    if(!habitDrag||habitDrag.pointerId!==event.pointerId) return;
    habitDrag.active=true;
    handle.classList.remove('hold-pending');
    row.classList.add('dragging');
    list.classList.add('drag-active');
    document.body.classList.add('habit-dragging');
    if(navigator.vibrate) navigator.vibrate(18);
  },HABIT_DRAG_HOLD_MS);
});

window.addEventListener('pointermove',event=>{
  if(!habitDrag||event.pointerId!==habitDrag.pointerId) return;
  if(!habitDrag.active){
    const movedEarly=Math.hypot(
      event.clientX-habitDrag.startX,
      event.clientY-habitDrag.startY
    )>HABIT_DRAG_MOVE_TOLERANCE;
    if(movedEarly){
      window.clearTimeout(habitDrag.holdTimer);
      habitDrag.handle.classList.remove('hold-pending');
      try{habitDrag.handle.releasePointerCapture(event.pointerId);}catch{}
      habitDrag=null;
    }
    return;
  }
  event.preventDefault();
  const {row,group,list}=habitDrag;
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.habit-row');
  if(target&&target!==row&&target.closest('[data-habit-group]')===group){
    const previousIndex=[...list.children].indexOf(row);
    const bounds=target.getBoundingClientRect();
    list.insertBefore(row,event.clientY<bounds.top+bounds.height/2?target:target.nextSibling);
    if([...list.children].indexOf(row)!==previousIndex) habitDrag.moved=true;
  }
  if(habitsScrollArea){
    const bounds=habitsScrollArea.getBoundingClientRect();
    if(event.clientY<bounds.top+70) habitsScrollArea.scrollBy(0,-8);
    else if(event.clientY>bounds.bottom-90) habitsScrollArea.scrollBy(0,8);
  }
},{passive:false});

window.addEventListener('pointerup',event=>finishHabitDrag(event));
window.addEventListener('pointercancel',event=>finishHabitDrag(event,true));

habitsView.addEventListener('keydown',event=>{
  const handle=event.target.closest('[data-habit-drag]');
  if(!handle||!['ArrowUp','ArrowDown'].includes(event.key)) return;
  const row=handle.closest('.habit-row');
  const group=row?.closest('[data-habit-group]');
  const list=group?.querySelector('.habit-group-list');
  if(!row||!group||!list) return;
  const sibling=event.key==='ArrowUp'?row.previousElementSibling:row.nextElementSibling;
  if(!sibling) return;
  event.preventDefault();
  if(event.key==='ArrowUp') list.insertBefore(row,sibling);
  else list.insertBefore(sibling,row);
  saveHabitOrder(group);
  renderHabits();
  const moved=[...habitsView.querySelectorAll('[data-habit-drag]')]
    .find(button=>button.closest('.habit-row')?.dataset.habitId===row.dataset.habitId);
  moved?.focus();
});
document.getElementById('habitCancel').addEventListener('click',closeHabitEditor);
document.getElementById('habitSave').addEventListener('click',saveHabitEditor);
document.getElementById('habitModalBg').addEventListener('click',event=>{
  if(event.target.id==='habitModalBg') closeHabitEditor();
});
document.getElementById('habitDifficulty').addEventListener('click',event=>{
  const button=event.target.closest('[data-habit-difficulty]');
  if(!button) return;
  habitDraftDifficulty=button.dataset.habitDifficulty;
  updateHabitEditor();
});
document.getElementById('habitFrequency').addEventListener('click',event=>{
  const button=event.target.closest('[data-habit-frequency]');
  if(!button) return;
  habitDraftFrequency=button.dataset.habitFrequency;
  updateHabitEditor();
});
document.getElementById('habitTargetSub').addEventListener('click',()=>{
  habitDraftTarget=Math.max(1,habitDraftTarget-1);
  updateHabitEditor();
});
document.getElementById('habitTargetAdd').addEventListener('click',()=>{
  habitDraftTarget=Math.min(20,habitDraftTarget+1);
  updateHabitEditor();
});
document.getElementById('habitDelete').addEventListener('click',()=>{
  if(!editingHabitId||!confirm('¿Eliminar este hábito? La XP que ya ganaste se conservará.')) return;
  const deletedHabitId=editingHabitId;
  const normalized=normalizeHabitState(state.habits);
  normalized.items=normalized.items.map(habit=>habit.id===editingHabitId
    ? {...habit,active:false,deletedAt:Date.now()}
    : habit);
  state.habits=normalized;
  scheduleSave({type:'habit:delete',id:deletedHabitId});
  closeHabitEditor();
  renderAll();
  showToast('Hábito eliminado','dmg');
});

/* elegir clase de héroe y lanzar hechizos */
document.getElementById('view-hero').addEventListener('click',e=>{
  if(e.target.closest('[data-scroll-skills]')){
    const skillsCard=document.getElementById('heroSkillsCard');
    const skillsTitle=document.getElementById('heroSkillsTitle');
    if(!skillsCard) return;
    skillsCard.classList.remove('skills-jump-highlight');
    void skillsCard.offsetWidth;
    skillsCard.classList.add('skills-jump-highlight');
    skillsCard.scrollIntoView({behavior:'smooth',block:'start'});
    window.setTimeout(()=>skillsTitle?.focus({preventScroll:true}),350);
    window.setTimeout(()=>skillsCard.classList.remove('skills-jump-highlight'),1200);
    return;
  }
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
    const destination=classChangeReturn||{viewId:'view-hoy',buttonId:'navHoy'};
    classChangeReturn=null;
    switchView(destination.viewId,destination.buttonId);
    renderAll();
  }
});

let selectedBossMedal=null;

async function fetchBossMedalFile(bossFile){
  let response=await fetch(`bosses/share/${bossFile}`);
  if(!response.ok) response=await fetch(`bosses/${bossFile}`);
  if(!response.ok) throw new Error('No se pudo cargar el medallón');
  return response.blob();
}

async function shareBossMedal(bossIndex,bossFile){
  const bossName=BOSSES[bossIndex];
  if(!bossName||!bossFile) return;
  const title=`Medallón de ${bossName}`;
  const text=`¡He derrotado a ${bossName} en Freedoom y he conseguido su medallón de victoria!`;
  try{
    const blob=await fetchBossMedalFile(bossFile);
    const file=new File([blob],bossFile,{type:blob.type||'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({title,text,files:[file]});
      return;
    }
    if(navigator.share){
      await navigator.share({title,text,url:location.href});
      return;
    }
    await navigator.clipboard.writeText(`${text} ${location.href}`);
    showToast('Logro copiado para compartir','heal');
  }catch(error){
    if(error&&error.name==='AbortError') return;
    try{
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast('Logro copiado para compartir','heal');
    }catch{
      showToast('No se pudo compartir el medallón','dmg');
    }
  }
}

function openBossMedalDetail(bossIndex,bossFile){
  const bossName=BOSSES[bossIndex];
  if(!bossName||!bossFile) return;
  const defeated=bossIndex<gameStats().bossesDown;
  selectedBossMedal={bossIndex,bossFile,defeated};
  const detail=document.getElementById('bossMedalDetail');
  const image=document.getElementById('bossMedalDetailImage');
  image.alt=bossName;
  image.dataset.fallback='';
  image.onerror=()=>{
    if(image.dataset.fallback) return;
    image.dataset.fallback='true';
    image.src=`bosses/${bossFile}`;
  };
  image.src=`bosses/share/${bossFile}`;
  document.getElementById('bossMedalDetailState').textContent=defeated?'MEDALLÓN CONSEGUIDO':'EN COMBATE';
  document.getElementById('bossMedalDetailName').textContent=bossName;
  document.getElementById('bossMedalDetailLore').textContent=BOSS_LORE[bossIndex]||'Un enemigo nacido del humo y de las viejas costumbres espera en el camino.';
  document.getElementById('bossMedalDetailLock').textContent=defeated?'':'Derrota a este jefe para conseguir, descargar y compartir su medallón.';
  document.getElementById('bossMedalDetailActions').hidden=!defeated;
  detail.classList.toggle('in-combat',!defeated);
  document.getElementById('sheetBossMedal').classList.add('show');
}

document.getElementById('sheetBossHistory').addEventListener('click',async e=>{
  const medal=e.target.closest('[data-open-boss-medal]');
  if(medal){
    openBossMedalDetail(parseInt(medal.dataset.openBossMedal,10),medal.dataset.bossFile);
    return;
  }
  const button=e.target.closest('[data-share-boss]');
  if(!button) return;
  await shareBossMedal(parseInt(button.dataset.shareBoss,10),button.dataset.shareFile);
});

document.getElementById('bossMedalShare').addEventListener('click',async()=>{
  if(!selectedBossMedal?.defeated) return;
  await shareBossMedal(selectedBossMedal.bossIndex,selectedBossMedal.bossFile);
});

document.getElementById('bossMedalDownload').addEventListener('click',async()=>{
  if(!selectedBossMedal?.defeated) return;
  const button=document.getElementById('bossMedalDownload');
  button.disabled=true;
  try{
    const blob=await fetchBossMedalFile(selectedBossMedal.bossFile);
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`medallon_${BOSS_SLUGS[selectedBossMedal.bossIndex]}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast('Medallón descargado','heal');
  }catch{
    showToast('No se pudo descargar el medallón','dmg');
  }finally{
    button.disabled=false;
  }
});

document.getElementById('cfgResetCls').addEventListener('click',()=>{
  classChangeReturn={
    viewId:document.querySelector('.view.active')?.id||'view-hoy',
    buttonId:document.querySelector('#mainNav button.active')?.id||'navHoy'
  };
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
    store.authorizeDestructiveSave('import');
    state=importedState;
    registerDailyWakeEstimate();
    scheduleSave();
    renderAll();
  },
  showToast
});

/* refresco cada minuto: mueve la marca "ahora" de la barra de ritmo y
   cambia de día a medianoche en controlado o a la hora configurada en los demás caminos */
let lastDay=todayKey();
function checkDay(){
  if(todayKey()!==lastDay){
    lastDay=todayKey();
    scheduleSave({type:'storage:daily-checkpoint',day:lastDay});
    renderAll();
    showPendingWeekResult();
  }
  else{renderHoy();renderHero();}
}
setInterval(checkDay,60000);
/* al volver la app de segundo plano (iOS la congela), refrescar al instante:
   si ya es otro día, los contadores vuelven a 0 sin esperar */
function resumeApp(){
  registerDailyWakeEstimate();
  checkDay();
}
function resumeAfterBackground(){
  const awayMs=backgroundedAt===null?0:Date.now()-backgroundedAt;
  backgroundedAt=null;
  if(awayMs>=RETURN_SPLASH_IDLE_MS) playReturnSplash();
  resumeApp();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    backgroundedAt=Date.now();
    return;
  }
  resumeAfterBackground();
});
window.addEventListener('pageshow',resumeAfterBackground);
window.addEventListener('focus',resumeApp);

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
    registerDailyWakeEstimate();
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

/* reiniciar app: frase deliberada + confirmación final */
const resetGuardBg=document.getElementById('resetGuardBg');
const resetGuardInput=document.getElementById('resetGuardInput');
const resetGuardContinue=document.getElementById('resetGuardContinue');
function closeResetGuard(){
  resetGuardBg.classList.remove('show');
  resetGuardInput.value='';
  resetGuardContinue.disabled=true;
}
function openResetGuard(){
  resetGuardInput.value='';
  resetGuardContinue.disabled=true;
  resetGuardBg.classList.add('show');
  window.setTimeout(()=>resetGuardInput.focus(),50);
}
function resetApp(){
  store.authorizeDestructiveSave('reset');
  state={
    config:{journeyMode:JOURNEY_MODE_REDUCTION, startDate:todayKey(), startLimit:20, wakeTime:'09:00', sleepTime:'23:00', dayStartTime:DEFAULT_DAY_START_TIME, pillsGoal:3, takesPills:true, tracksBeer:true},
    days:{}, habits:{items:[],entries:{}}, seeded:true, seededV:SEED_V, game:{cls:null}, onboarded:false
  };
  scheduleSave();
  document.getElementById('sheetSet').classList.remove('show');
  startOnboarding();
}
document.getElementById('btnReset').addEventListener('click',openResetGuard);
resetGuardInput.addEventListener('input',()=>{
  resetGuardContinue.disabled=!matchesResetConfirmation(resetGuardInput.value);
});
resetGuardInput.addEventListener('keydown',event=>{
  if(event.key==='Escape') closeResetGuard();
  if(event.key==='Enter'&&!resetGuardContinue.disabled) resetGuardContinue.click();
});
document.getElementById('resetGuardCancel').addEventListener('click',closeResetGuard);
resetGuardBg.addEventListener('click',event=>{
  if(event.target===resetGuardBg) closeResetGuard();
});
resetGuardContinue.addEventListener('click',()=>{
  if(!matchesResetConfirmation(resetGuardInput.value)) return;
  closeResetGuard();
  if(!confirm(`¿Reiniciar definitivamente? Se borrarán todos tus datos y volverás a la pantalla de bienvenida. Haz una copia de seguridad antes si quieres conservarlos. Frase verificada: ${RESET_CONFIRMATION_PHRASE}.`)) return;
  resetApp();
});

(async function(){
  await load();
  void requestPersistentStorage();
  /* primera vez (sin héroe elegido) -> onboarding cinematográfico */
  if(!state.onboarded || !(state.game && state.game.cls)){
    startOnboarding();
  }else{
    registerDailyWakeEstimate();
    document.getElementById('app').style.display='block';
    document.getElementById('mainNav').classList.add('show');
    renderAll();
    ensureHero();
    scheduleSave({type:'storage:checkpoint'});
    showPendingWeekResult();
    finishInitialReturnSplash();
  }
})();
