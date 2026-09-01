import {
  BOSSES,
  BOSS_LORE,
  BOSS_SLUGS,
  CLASSES,
  classDataForJourney
} from './data/game-data.js';
import { calculateGameStats } from './domain/progression-rules.js';
import { deathExperiencePenalty } from './domain/death-rules.js';
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
  SMOKE_FREE_STATUS_SMOKED,
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
import { allocateAttributePoint, attributeSheet, resetAttributeAllocation } from './domain/attribute-rules.js';
import {
  HUNT_DIFFICULTIES,
  HUNT_REGIONS,
  grantHabitHuntEnergy,
  huntDropRules,
  huntDifficultyMinLevel,
  syncHabitSetHuntEnergy,
  revokeHabitHuntEnergy,
  pveHeroStats,
  normalizeHuntState,
  resolveHunt,
  startHunt,
} from './domain/pve-combat-rules.js';
import {
  evaluateSmoke,
  perfectShotRewards,
  smokeUndoEffects
} from './domain/smoking-rules.js';
import {
  LEVEL_EIGHT_COOLDOWN_MS,
  castSpellEffect,
  completeLevelEightHabitChallenge,
  levelEightSpellAvailability,
  levelTwoSpellAvailability,
  ultimateHabitReward,
  ultimateSpellAvailability,
} from './domain/spell-rules.js';
import {
  acknowledgeLootNotice,
  activateRelicConstancy,
  advancePeriodicManaRecovery,
  attemptForge,
  awardFusionAllHabitsXp,
  availableDailyEffectSources,
  canActivateFusionDaily,
  createForgeSeed,
  defuseRelic,
  emptyLootState,
  equipRelic,
  ensureShopRotation,
  equippedRelicBonuses,
  forgePreview,
  getDefusionPreview,
  getForgeFusionPreview,
  grantBossRewards,
  fuseRelics,
  initializeForgeSeed,
  markDailyEffectSources,
  markFusionDaily,
  normalizeLootState,
  payClassChange,
  pendingLootNotice,
  purchaseShopRelic,
  shopOffers,
  syncRelicConstancy,
  unequipRelic
} from './domain/loot-rules.js';
import {
  FUSION_RELIC_DEFINITIONS,
  RELIC_DEFINITIONS,
  relicDefinition,
  relicRankEffect
} from './data/loot-data.js';
import {
  RESET_CONFIRMATION_PHRASE,
  matchesResetConfirmation
} from './domain/reset-rules.js';
import {
  adjustHabitProgress,
  applyHabitCoinRewards,
  habitCoinReward,
  habitEntryFor,
  habitProgressCoinSchedule,
  habitProgressXpSchedule,
  habitReward,
  nextHabitOrder,
  normalizeHabitInput,
  normalizeHabitState,
  reorderHabits
} from './domain/habit-rules.js';
import {
  adjustTodoProgress,
  archiveTodo,
  nextTodoOrder,
  normalizeTodoInput,
  normalizeTodoState,
  reorderTodos,
} from './domain/todo-rules.js';
import {
  consumePreparedBlood,
  normalizePotionState,
  potionBloodChance,
  potionFortuneBonusUsage,
  purchasePotion,
  reconcilePotionHabitBonus,
  usePotion
} from './domain/potion-rules.js';
import { POTION_BAG_SLOT_LIMIT, POTION_BY_ID } from './data/potion-data.js';
import {
  addBeerIntoxication,
  beerUndoEffects,
  intoxicationStatus,
  removeBeerIntoxication,
  scalePassiveUpgrade
} from './domain/intoxication-rules.js';
import {
  claimPioneerReward,
  migratePioneerRewardEligibility,
  shouldOfferPioneerReward,
} from './domain/pioneer-reward-rules.js';
import {
  claimBetaTesterReward,
  pendingBetaTesterReward,
} from './domain/beta-tester-reward-rules.js';
import { OUTFIT_DEFINITIONS, isOutfitUnlocked } from './data/outfit-data.js';
import { FRAME_DEFINITIONS, isFrameUnlocked } from './data/frame-data.js';
import {
  acknowledgeFiberCatchupNotice,
  bossFiberBase,
  grantBossFiberReward,
  pendingFiberCatchupNotice,
  paintFrame,
  reconcileHistoricalBossFibers,
  weaveOutfit,
} from './domain/outfit-rules.js';
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
  createHeroModel,
  didHeroLevelUp,
  renderHeroView,
  renderSkillsView,
  spriteImage
} from './ui/hero-view.js';
import { renderSettingsView } from './ui/settings-view.js';
import { renderHabitsView } from './ui/habits-view.js';
import { huntResultRewardsMarkup, huntResultSummaryMarkup, renderHuntMonsterDetail, renderHuntView, updateHuntCountdown } from './ui/hunt-view.js';
import { renderCharacterSheet } from './ui/character-sheet-view.js';
import {
  closeForgeInfoOutside,
  forgeResultMarkup,
  defusionResultMarkup,
  inventoryReferenceOffset,
  nextFusionSelection,
  renderForgeView,
  renderForgeRelicPicker,
  fusionResultMarkup,
  renderCollectionView,
  renderInventoryView,
  renderLootNotice,
  renderOutfitSelector,
  renderPotionDetail,
  renderRelicEffectInfo,
  renderRelicDetail,
  renderShopView
} from './ui/inventory-view.js';
import { bindBackupControls } from './ui/backup-controller.js';
import { createRecoveryModeController } from './ui/recovery-mode-controller.js';
import { commitLootOperation } from './ui/persisted-loot-operation.js';
import { createOnboardingController } from './ui/onboarding-controller.js';
import { bindNavigation, showSheet } from './ui/navigation-controller.js';
import { showToast as renderToast } from './ui/toast.js';
import { scheduleStartupPreload } from './ui/startup-render-scheduler.js';
import {
  createImagePreloader,
  scheduleImagePreloadPhases,
  startupImagePhases,
} from './ui/startup-image-preloader.js';
import { resourceIcon, setTextWithResourceIcons } from './ui/resource-icons.js';
import { habitRewardToast } from './ui/habit-feedback.js';
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

const APP_VERSION='2.28.3';
const INVENTORY_SHORTCUT_HINT_KEY='freedoom:inventory-shortcut-seen:v2';
const INVENTORY_SHORTCUT_SURFACES=['today','habits','hero'];
const FORCE_INVENTORY_SHORTCUT_HINT=new URLSearchParams(location.search).get('demoInventoryShortcut')==='1';
const dismissedInventoryShortcutHints=new Set();
const AUREO_NOTICE_KEY='freedoom:aureo-notice-seen:v1';
const AUREO_NOTICE_TARGETS=['outfits','weave','backgrounds'];
const FEATURE_DISCOVERY_KEY='freedoom:feature-discovery-seen:v1';
const FEATURE_DISCOVERY_TARGETS=['character-entry','character-bag','character-bag-market','inventory-market','character-hero','character-backgrounds','nav-habits','hunt-tab','hero-energy'];
const RETURN_SPLASH_IDLE_MS=30*60*1000;
const LOCAL_DEMO_HOST=location.hostname==='127.0.0.1'||location.hostname==='localhost';
const LOCAL_DEMO_PARAMS=new URLSearchParams(location.search);
const LOCAL_PROGRESSION_UPDATE_PREVIEW=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('previewProgressionUpdate')==='1';
const LOCAL_DEATH_PREVIEW=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('previewDeath')==='1';
const LOCAL_DEMO_PROFILE=LOCAL_DEMO_HOST?LOCAL_DEMO_PARAMS.get('demoProfile')||'':'';
const LOCAL_DEMO_REDUCTION_14=LOCAL_DEMO_HOST&&LOCAL_DEMO_PROFILE==='reduction-14';
const LOCAL_DEMO_ALL_OUTFITS=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('demoAllOutfits')==='1';
const LOCAL_DEMO_QUIET=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('demoQuiet')==='1';
const LOCAL_DEMO_HABIT_PAIR=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('demoHabitPair')==='1';
const LOCAL_DEMO_LEVEL=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.has('demoLevel')
  ? Math.max(1,Math.min(100,parseInt(LOCAL_DEMO_PARAMS.get('demoLevel')||'1',10)||1))
  : null;
const LOCAL_DEMO_FIBER_OUTFIT=LOCAL_DEMO_HOST&&LOCAL_DEMO_PROFILE==='fiber-outfit';
const LOCAL_PIONEER_REWARD_PREVIEW=LOCAL_DEMO_HOST&&(
  LOCAL_DEMO_PROFILE==='control'||LOCAL_DEMO_PARAMS.get('previewPioneerReward')==='1'
)&&!LOCAL_DEMO_ALL_OUTFITS&&!['2','3'].includes(LOCAL_DEMO_PARAMS.get('previewBetaTesterReward'));
const LOCAL_BETA_TESTER_REWARD_PREVIEW_ID=LOCAL_DEMO_HOST?LOCAL_DEMO_PARAMS.get('previewBetaTesterReward'):'';
const LOCAL_BETA_TESTER_REWARD_PREVIEW=['2','3'].includes(LOCAL_BETA_TESTER_REWARD_PREVIEW_ID);
const LOCAL_DEMO_PALADIN_EFFECTS=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('demoPaladinEffects')==='1';
const LOCAL_DEMO_SHOP=LOCAL_DEMO_HOST?LOCAL_DEMO_PARAMS.get('demoShop')||'':'';
const LOCAL_DEMO_FUSIONS=LOCAL_DEMO_HOST&&(LOCAL_DEMO_PARAMS.get('demoFusions')==='1'||LOCAL_DEMO_PROFILE==='control');
const LOCAL_DEMO_CONSTANCY=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.has('demoConstancy')
  ? Math.max(0,Math.min(6,parseInt(LOCAL_DEMO_PARAMS.get('demoConstancy')||'0',10)||0))
  : null;
const LOCAL_LOOT_NOTICE_PREVIEW=LOCAL_DEMO_HOST&&LOCAL_DEMO_PARAMS.get('previewLootNotice')==='1';
const LOCAL_DEMO_MIGRATION=LOCAL_DEMO_HOST
  ? Math.max(0,Math.min(6,parseInt(LOCAL_DEMO_PARAMS.get('demoLootMigration')||'0',10)||0))
  : 0;
const LOCAL_DEMO_BOSS_INK_CATCHUP=LOCAL_DEMO_HOST
  ? Math.max(0,Math.min(12,parseInt(LOCAL_DEMO_PARAMS.get('previewBossInkCatchup')||'0',10)||0))
  : 0;
const LOCAL_DEMO_BOSSES=LOCAL_DEMO_HOST
  ? LOCAL_DEMO_BOSS_INK_CATCHUP||LOCAL_DEMO_MIGRATION||Math.max(0,Math.min(12,parseInt(LOCAL_DEMO_PARAMS.get('demoBosses')||'0',10)||0))||(LOCAL_DEMO_FIBER_OUTFIT?2:0)||(LOCAL_DEMO_FUSIONS?12:0)||(LOCAL_DEMO_CONSTANCY!==null?4:0)||(LOCAL_DEMO_SHOP?1:0)||(LOCAL_DEMO_PALADIN_EFFECTS?1:0)||(LOCAL_DEMO_REDUCTION_14?1:0)
  : 0;
const ACTIVE_STORAGE_KEY=LOCAL_DEMO_BOSSES
  ? LOCAL_DEMO_PALADIN_EFFECTS
    ? `${STORAGE_KEY}:demo-paladin-effects-v3`
    : LOCAL_DEMO_FIBER_OUTFIT
    ? `${STORAGE_KEY}:demo-fiber-outfit-v1`
    : LOCAL_DEMO_PROFILE==='control'
    ? `${STORAGE_KEY}:demo-control-complete-v2${LOCAL_DEMO_LEVEL?`-level-${LOCAL_DEMO_LEVEL}`:''}${LOCAL_DEMO_ALL_OUTFITS?'-all-outfits':''}${LOCAL_PROGRESSION_UPDATE_PREVIEW?'-progression-preview-v2':''}${LOCAL_DEMO_HABIT_PAIR?'-habit-pair-v1':''}`
    : LOCAL_DEMO_REDUCTION_14
    ? `${STORAGE_KEY}:demo-reduction-14-v3`
    : LOCAL_DEMO_FUSIONS
    ? `${STORAGE_KEY}:demo-fusions-v2`
    : LOCAL_DEMO_CONSTANCY!==null
    ? `${STORAGE_KEY}:demo-constancy-${LOCAL_DEMO_CONSTANCY}-v1`
    : LOCAL_DEMO_SHOP
    ? `${STORAGE_KEY}:demo-shop-${LOCAL_DEMO_SHOP}-v1`
    : LOCAL_DEMO_BOSS_INK_CATCHUP
    ? `${STORAGE_KEY}:demo-boss-ink-catchup-${LOCAL_DEMO_BOSS_INK_CATCHUP}-v3`
    : LOCAL_DEMO_MIGRATION
    ? `${STORAGE_KEY}:demo-loot-migration-${LOCAL_DEMO_MIGRATION}${LOCAL_LOOT_NOTICE_PREVIEW?'-preview':''}-v2`
    : `${STORAGE_KEY}:demo-bosses-${LOCAL_DEMO_BOSSES}-rarities-v3`
  : STORAGE_KEY;

/* Datos iniciales que Kike apuntó a mano antes de tener la app */
const SEED={};
const SEED_V=3;

let state={
  config:{journeyMode:JOURNEY_MODE_REDUCTION, startDate:'2026-07-17', startLimit:20, wakeTime:'09:00', sleepTime:'23:00', dayStartTime:DEFAULT_DAY_START_TIME, pillsGoal:3, takesPills:true, tracksBeer:true},
  days:{},
  habits:{items:[],entries:{}},
  todos:{items:[]},
  seeded:false,
  seededV:0,
  game:{cls:null},
  onboarded:false,
  ...emptyLootState()
};
let calCursor=currentDayDate();
let editingKey=null;
let saveTimer=null;
let returnSplashTimer=null;
let returnSplashPlaying=true;
let backgroundedAt=null;
let classChangeReturn=null;
let pendingClassChange=null;
let selectedClassChange=null;
let initializeLocalDemo=false;
let observedHeroLevel=null;
let pendingHeroLevelUp=false;
let pendingSkillCast=null;
let selectedOutfitDraft=null;
let outfitSelectorSection='owned';
let outfitSelectorContext='collection';
let pioneerRewardTimer=null;
let pioneerRewardOpening=false;
let betaTesterRewardTimer=null;
let betaTesterRewardOpening=false;
let fiberCatchupTimer=null;
let fiberCatchupOpening=false;
let progressionUpdateTimer=null;
let progressionUpdateOpening=false;
const PROGRESSION_UPDATE_NOTICE_ID='attributes-hunt-v1';

document.getElementById('obVersion').textContent=`v${APP_VERSION}`;
document.getElementById('settingsVersion').textContent=`v${APP_VERSION}`;
const recoveryModeController=createRecoveryModeController({
  logo:document.querySelector('.settings-footer .set-logo'),
  emergencySection:document.getElementById('emergencyRecoverySection'),
  showToast
});

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
      warning:'Freedom detectó que la partida iba a volver casi a cero y no sustituyó tus copias. Cierra y abre la app para recuperar automáticamente la última partida completa.'
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
    let r=LOCAL_DEMO_PALADIN_EFFECTS
      ? await store.get(STORAGE_KEY)
      : LOCAL_DEMO_FIBER_OUTFIT||LOCAL_DEMO_FUSIONS||LOCAL_DEMO_CONSTANCY!==null
        ? null
        : await store.get(ACTIVE_STORAGE_KEY);
    if(LOCAL_DEMO_PALADIN_EFFECTS) initializeLocalDemo=true;
    if(!r&&LOCAL_DEMO_BOSSES){
      if(!LOCAL_DEMO_FIBER_OUTFIT&&!LOCAL_DEMO_FUSIONS&&LOCAL_DEMO_CONSTANCY===null) r=await store.get(STORAGE_KEY);
      initializeLocalDemo=true;
    }
    if(r&&r.value){
      const saved=parseState(r.value);
      const legacyDayBoundary=!(saved.config&&saved.config.dayStartTime);
      state=mergeState(state,saved);
      state={...state,...initializeForgeSeed(state)};
      const pioneerMigration=migratePioneerRewardEligibility(state,{existingProfile:true});
      state=pioneerMigration.state;
      const huntBeforeMigration=state.game?.hunt;
      const normalizedHunt=huntBeforeMigration
        ? normalizeHuntState(huntBeforeMigration,Date.now(),huntBaseEnergyForToday(new Date()))
        : null;
      const huntEnergyMigrationChanged=Boolean(normalizedHunt)&&(
        huntBeforeMigration.energyCapacityVersion!==normalizedHunt.energyCapacityVersion||
        huntBeforeMigration.bonusEnergyLedgerVersion!==normalizedHunt.bonusEnergyLedgerVersion||
        Number(huntBeforeMigration.energy)!==normalizedHunt.energy||
        Number(huntBeforeMigration.bonusEnergyEarned)!==normalizedHunt.bonusEnergyEarned||
        Number(huntBeforeMigration.bonusEnergyRemaining)!==normalizedHunt.bonusEnergyRemaining||
        Number(huntBeforeMigration.rewardEnergyRemaining||0)!==normalizedHunt.rewardEnergyRemaining
      );
      if(normalizedHunt) state.game.hunt=normalizedHunt;
      setStorageHealth({
        state:'saved',
        revision:r.revision||0,
        savedAt:r.savedAt||0,
        title:r.recovered?'Partida recuperada automáticamente':'Guardado ✓',
        detail:r.savedAt?`Último guardado · ${savedAtLabel(r.savedAt)}`:'Partida compatible cargada',
        warning:r.recovered
          ? 'La copia principal no era la más reciente o estaba dañada. Freedom recuperó la última copia válida.'
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
      else if(pioneerMigration.changed||huntEnergyMigrationChanged){
        scheduleSave({type:huntEnergyMigrationChanged?'hunt:energy-ledger-migrated':'reward:pioneer-eligibility-migrated'});
      }
    }
  }catch(e){
    console.error('Error cargando la partida',e);
    setStorageHealth({
      state:'error',title:'No se pudo cargar la partida',detail:e.message||'Error desconocido',
      warning:'Freedom no pudo leer el guardado. No reinicies la app: revisa Copias de seguridad en el menú.'
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
  if(LOCAL_LOOT_NOTICE_PREVIEW) initializeLocalDemo=true;
  if(initializeLocalDemo) prepareLocalBossDemo();
}
function scheduleSave(action){
  if(action){
    try{ store.recordAction(action,ACTIVE_STORAGE_KEY); }
    catch(error){ console.warn('No se pudo registrar la acción',error); }
  }
  setStorageHealth({state:'saving',title:'Guardando…',detail:'Verificando la partida',warning:''});
  /* en el móvil (localStorage) guarda al instante: si cierras la app justo después de un +, no se pierde */
  if(!store.usesExternalStorage){
    try{
      const result=store.set(ACTIVE_STORAGE_KEY,serializeState(state));
      handleSaveResult(result);
    }catch(e){
      console.error('Error guardando',e);
      setStorageHealth({
        state:'error',title:'No se ha podido guardar',detail:e.message||'Error desconocido',
        warning:'El último cambio NO se ha guardado. No cierres la app; libera espacio en el dispositivo y revisa Copias de seguridad.'
      });
    }
    return;
  }
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{ handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state))); }
    catch(e){
      console.error('Error guardando',e);
      setStorageHealth({
        state:'error',title:'No se ha podido guardar',detail:e.message||'Error desconocido',
        warning:'El último cambio NO se ha guardado. No cierres la app y revisa Copias de seguridad.'
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
function renderAll(){applyPendingJourneyTransition();repairJourneyTransitionHistory();renderHoy();renderHabits();renderCal();renderWeeks();renderGraf();renderHero();renderHunt();renderSettings();renderStorageHealth();queueLootNotice();}
function renderStartupPrimary(){
  applyPendingJourneyTransition();
  repairJourneyTransitionHistory();
  renderHoy();
  renderStorageHealth();
  queueLootNotice();
}
function previousDayExceededConsumptionLimit(now=new Date()){
  const previousDate=currentDayDate(now);
  previousDate.setDate(previousDate.getDate()-1);
  const previousKey=keyOf(previousDate);
  const previousConfig=journeyConfigForDate(state.config,previousDate);
  const record=getDay(previousKey);
  if(isSmokeFreeMode(previousConfig)){
    return smokeFreeStatusOf(record)===SMOKE_FREE_STATUS_SMOKED;
  }
  if(isControlledMode(previousConfig)){
    if(!isControlledSmokingDay(previousConfig,previousDate)){
      return smokeFreeStatusOf(record)===SMOKE_FREE_STATUS_SMOKED;
    }
    const week=Math.max(0,weekIndexOf(previousDate));
    const [first]=weekRange(week);
    let used=0;
    for(let cursor=new Date(first);cursor<=previousDate;cursor.setDate(cursor.getDate()+1)){
      const cursorConfig=journeyConfigForDate(state.config,cursor);
      if(isControlledSmokingDay(cursorConfig,cursor)) used+=Math.max(0,getDay(keyOf(cursor)).c||0);
    }
    return used>controlledWeeklyLimitOf(previousConfig);
  }
  return Math.max(0,record.c||0)>limitOfDate(previousDate);
}
function huntBaseEnergyForToday(now=new Date()){
  return previousDayExceededConsumptionLimit(now)?2:10;
}
function preloadStartupViews(){
  const imagePreloader=createImagePreloader({window,concurrency:2});
  scheduleImagePreloadPhases({
    window,
    phases:startupImagePhases(state.game),
    preloader:imagePreloader
  });
  scheduleStartupPreload({
    window,
    renderSecondary:()=>{
      renderHabits();
      renderHero();
      renderHunt();
      renderSettings();
    },
    afterSecondary:()=>scheduleSave({type:'storage:checkpoint'}),
    renderHeavy:()=>{
      renderCal();
      renderWeeks();
      renderGraf();
    }
  });
}

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
    ? 'En días permitidos verás cuántos cigarros registraste. En los demás, ✓ significa que no fumaste, × que fumaste y · que sigue pendiente.'
    : isSmokeFreeMode(state.config)
      ? 'Toca un día para corregirlo. ✓ significa que te mantuviste sin fumar, × que fumaste y · que sigue pendiente.'
      : 'Toca un día para corregir sus cantidades. El número amarillo son cigarros (rojo si superó el límite de ese día) y 💊 las pastillas.';
}

function renderHabits(){
  const stats=state.game&&state.game.cls?gameStats():null;
  const intoxication=currentIntoxication();
  renderHabitsView({
    document,
    habitState:state.habits,
    todoState:state.todos,
    date:currentDayDate(),
    planStartDate:state.config.startDate,
    game:state.game,
    stats,
    intoxication,
    filter:habitViewFilter,
    section:habitViewSection
  });
  const huntContent=document.getElementById('huntContent');
  if(huntContent){
    huntContent.hidden=habitViewSection!=='hunt';
    if(habitViewSection==='hunt') renderHunt();
  }
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

function applyLootSlices(result){
  state.economy=result.economy;
  state.loot=result.loot;
  state.inventory=result.inventory;
  state.forge=result.forge;
  state.shop=result.shop;
}

function prepareLocalBossDemo(){
  if(!LOCAL_DEMO_BOSSES) return;
  initializeLocalDemo=false;
  if(LOCAL_DEMO_REDUCTION_14){
    state.config={
      ...state.config,
      journeyMode:JOURNEY_MODE_REDUCTION,
      startDate:todayKey(),
      startLimit:14
    };
    state.days={};
  }else{
    state.config={
      ...state.config,
      startLimit:Math.max(6,Number(state.config?.startLimit)||20)
    };
  }
  state.onboarded=true;
  state.game={
    ...(state.game||{}),
    cls:state.game?.cls||'paladin',
    name:state.game?.name||'Héroe de prueba',
    hp:Number.isFinite(state.game?.hp)?state.game.hp:115,
    mp:Number.isFinite(state.game?.mp)?state.game.mp:90,
    buffs:{...(state.game?.buffs||{})},
    day:todayKey()
  };
  if(LOCAL_BETA_TESTER_REWARD_PREVIEW_ID==='3'){
    const ownedFrames={...(state.game.frames?.owned||{})};
    const claimedRewards={...(state.game.betaTesterRewards?.claimed||{})};
    delete ownedFrames['welder-beta'];
    delete claimedRewards['pioneer-beta-reward-v3'];
    state.game={
      ...state.game,
      frame:'original',
      frames:{...(state.game.frames||{}),owned:ownedFrames},
      betaTesterRewards:{...(state.game.betaTesterRewards||{}),claimed:claimedRewards},
    };
  }
  if(LOCAL_DEMO_REDUCTION_14){
    state.game={
      ...state.game,
      cls:'paladin',
      name:'Reducción · 14 al día',
      bonusXp:35*49*49,
      cigDmg:[],
      intoxication:[],
      buffs:{},
      day:todayKey()
    };
    const demoMaxes=heroMaxes();
    state.game.hp=demoMaxes.maxHp;
    state.game.mp=demoMaxes.maxMp;
  }
  if(LOCAL_DEMO_FIBER_OUTFIT){
    state.game={
      ...state.game,
      outfit:'original',
      outfits:{owned:{}},
    };
  }
  const currentWeek=Math.max(0,weekIndexOf(currentDayDate()));
  state.game.bossCombat={
    version:2,
    startedWeek:currentWeek,
    legacyBossesDown:LOCAL_DEMO_BOSSES,
    defeated:0,
    bossIndex:LOCAL_DEMO_BOSSES,
    week:currentWeek,
    hpAtWeekStart:150,
    victoryRecorded:false,
    spellHits:[],
    history:Array.from({length:LOCAL_DEMO_BOSSES},(_,index)=>({
      week:index,bossIndex:index,won:true,damage:150,remainingHp:0
    }))
  };
  Object.assign(state,emptyLootState());
  state.economy.arcaneFibers=LOCAL_DEMO_FIBER_OUTFIT?0:8;
  if(LOCAL_DEMO_BOSS_INK_CATCHUP){
    const settledBossCount=21;
    state.economy.arcaneFibers=8;
    for(let bossIndex=0;bossIndex<settledBossCount;bossIndex+=1){
      const base=bossFiberBase(bossIndex);
      const cycleId=`week-${bossIndex}:boss-${bossIndex}`;
      state.loot.bossFiberOutcomes[cycleId]={
        cycleId,bossIndex,base,bonus:0,granted:base,
        resolvedAt:Date.now()-((settledBossCount-bossIndex)*86400000),
        notifiedAt:Date.now()
      };
    }
    scheduleSave({type:'demo:boss-ink-catchup',count:LOCAL_DEMO_BOSS_INK_CATCHUP});
    return;
  }
  if(LOCAL_DEMO_MIGRATION){
    scheduleSave({type:'demo:loot-migration',count:LOCAL_DEMO_MIGRATION});
    return;
  }
  if(LOCAL_LOOT_NOTICE_PREVIEW){
    const previousBosses=Math.max(0,LOCAL_DEMO_BOSSES-1);
    if(previousBosses>0){
      applyLootSlices(grantBossRewards({
        state,
        bossesDown:previousBosses,
        source:'retroactive',
        seed:`local-demo-${previousBosses}`,
        nowTimestamp:Date.now()-1
      }));
    }
    applyLootSlices(grantBossRewards({
      state,
      bossesDown:LOCAL_DEMO_BOSSES,
      source:'victory',
      seed:`local-preview-victory-${LOCAL_DEMO_BOSSES}`,
      dropRandom:()=>0,
      bloodRandom:()=>1,
      relicBloodRandom:()=>1,
      nowTimestamp:Date.now()
    }));
  }else{
    applyLootSlices(grantBossRewards({
      state,
      bossesDown:LOCAL_DEMO_BOSSES,
      source:'retroactive',
      seed:`local-demo-${LOCAL_DEMO_BOSSES}`,
      nowTimestamp:Date.now()
    }));
  }
  const demoRelics=state.inventory.relics;
  if(LOCAL_DEMO_FUSIONS){
    const nowTimestamp=Date.now();
    RELIC_DEFINITIONS.filter(definition=>definition.bossIndex>=6).forEach((definition,index)=>{
      const record={
        unlocked:true,rarity:'rare',rank:1,affixes:[],
        obtainedAt:nowTimestamp+index,bossIndex:definition.bossIndex,rewardId:definition.rewardId
      };
      demoRelics[definition.id]=record;
      state.inventory.collection[definition.id]={
        discoveredAt:nowTimestamp+index,kind:'base',lastOwnedRecord:{...record}
      };
    });
  }
  if(demoRelics.relic_01) Object.assign(demoRelics.relic_01,{rarity:'rare',affixes:[]});
  if(demoRelics.relic_02) Object.assign(demoRelics.relic_02,{rarity:'legendary',affixes:['arcane']});
  if(demoRelics.relic_03) Object.assign(demoRelics.relic_03,{rarity:'mythic',affixes:['discipline','fortune']});
  if(demoRelics.relic_04) Object.assign(demoRelics.relic_04,{rarity:'legendary',affixes:['vitality']});
  if(LOCAL_DEMO_FUSIONS){
    const nowTimestamp=Date.now();
    const demoFusionStyles={
      fusion_01:{rarity:'rare',affixes:[]},
      fusion_02:{rarity:'legendary',affixes:['vitality']},
      fusion_04:{rarity:'legendary',affixes:['fortune']},
      fusion_06:{rarity:'legendary',affixes:['vitality']},
      fusion_07:{rarity:'legendary',affixes:['arcane']},
      fusion_08:{rarity:'mythic',affixes:['arcane','discipline']}
    };
    FUSION_RELIC_DEFINITIONS.forEach((definition,index)=>{
      const ingredientSnapshots=Object.fromEntries(definition.ingredientIds.map(id=>[
        id,{
          rarity:demoRelics[id]?.rarity||'rare',
          rank:demoRelics[id]?.rank||1,
          affixes:[...(demoRelics[id]?.affixes||[])],
          effectValue:relicRankEffect(id,demoRelics[id]?.rank||1)
        }
      ]));
      const record={
        unlocked:true,
        kind:'fusion',
        recipeId:definition.recipeId,
        rarity:demoFusionStyles[definition.id].rarity,
        rank:1,
        affixes:[...demoFusionStyles[definition.id].affixes],
        obtainedAt:nowTimestamp+index,
        ingredientSnapshots,
        inheritedEffects:Object.fromEntries(
          Object.entries(ingredientSnapshots).map(([id,snapshot])=>[id,snapshot.effectValue])
        )
      };
      state.inventory.relics[definition.id]=record;
      state.inventory.collection[definition.id]={
        discoveredAt:nowTimestamp+index,
        kind:'fusion',
        lastOwnedRecord:record
      };
    });
    state.forge.fusion.discoveredRecipes=FUSION_RELIC_DEFINITIONS.map(({recipeId})=>recipeId);
    applyLootSlices(normalizeLootState(state));
    state.economy.coins=999;
    state.economy.bossBlood=20;
  }
  if(LOCAL_DEMO_SHOP==='failed'&&demoRelics.relic_01){
    const failedRelic={...demoRelics.relic_01,affixes:[...demoRelics.relic_01.affixes]};
    delete demoRelics.relic_01;
    state.loot.bossRelicOutcomes.boss_reward_01={
      status:'failed',relicId:'relic_01',resolvedAt:Date.now(),source:'demo',relic:failedRelic
    };
    state.economy.coins=250;
    state.economy.bossBlood=2;
    applyLootSlices(ensureShopRotation(state,Date.now()));
  }
  state.inventory.equipped=(LOCAL_DEMO_FUSIONS
    ? ['fusion_06','relic_02']
    : LOCAL_DEMO_CONSTANCY!==null
    ? ['relic_04','relic_01']
    : ['relic_01','relic_03'])
    .filter(id=>state.inventory.relics[id]);
  state.loot.notices=state.loot.notices.map((notice,index,notices)=>({
    ...notice,
    acknowledged:LOCAL_LOOT_NOTICE_PREVIEW
      ? index!==notices.length-1
      : true
  }));
  state.loot.migrationComplete=true;
  if(LOCAL_DEMO_PALADIN_EFFECTS){
    const now=Date.now();
    state.config={...state.config,journeyMode:JOURNEY_MODE_REDUCTION};
    state.game={
      ...state.game,
      cls:'paladin',
      name:'Paladín de prueba',
      hp:100,
      mp:100,
      bonusXp:100000,
      intoxication:[{
        id:'demo-beer-curse',
        potency:25,
        startedAt:now,
        expiresAt:now+41*60_000
      }],
      buffs:{certeroUntil:now+60*60_000},
      judgmentDays:[]
    };
    const demoMaxes=heroMaxes();
    state.game.hp=demoMaxes.maxHp;
    state.game.mp=demoMaxes.maxMp;
    state.economy={...state.economy,bossBlood:99,coins:999};
  }
  if(LOCAL_DEMO_PROFILE==='control'){
    state.config={
      ...state.config,
      journeyMode:'controlled',
      controlledDays:[5,6,0],
      controlledWeeklyLimit:6,
      startLimit:20
    };
    state.game={
      ...state.game,
      cls:LOCAL_DEMO_ALL_OUTFITS?'sorcerer':'paladin',
      name:LOCAL_DEMO_LEVEL?`Héroe de prueba · Nv ${LOCAL_DEMO_LEVEL}`:'Héroe de control',
      bonusXp:LOCAL_DEMO_LEVEL?35*(LOCAL_DEMO_LEVEL-1)*(LOCAL_DEMO_LEVEL-1):250000,
      buffs:{},
      day:todayKey()
    };
    if(LOCAL_PROGRESSION_UPDATE_PREVIEW&&LOCAL_DEMO_LEVEL){
      state.config={...state.config,startDate:todayKey()};
      state.days={};
      state.habits={items:[],entries:{}};
      state.game={
        ...state.game,
        bossCombat:null,
        bonusXp:35*(LOCAL_DEMO_LEVEL-1)*(LOCAL_DEMO_LEVEL-1)
      };
      state.inventory.dailyActivations={};
    }
    if(LOCAL_DEMO_ALL_OUTFITS){
      const acquiredAt=Date.now();
      state.game={
        ...state.game,
        outfit:'arcane-weave-01',
        pioneerReward:{
          ...(state.game.pioneerReward||{}),
          claimedAt:state.game.pioneerReward?.claimedAt||acquiredAt,
          outfitId:'beta-tester'
        },
        outfits:{
          ...(state.game.outfits||{}),
          owned:{
            ...(state.game.outfits?.owned||{}),
            'beta-tester':{acquiredAt,source:'demo'},
            'arcane-weave-01':{acquiredAt,source:'demo'}
          }
        },
        frame:'beta-tester',
        frames:{
          ...(state.game.frames||{}),
          owned:{
            ...(state.game.frames?.owned||{}),
            'beta-tester':{acquiredAt,source:'demo'}
          }
        }
      };
    }
    const demoMaxes=heroMaxes();
    state.game.hp=demoMaxes.maxHp;
    state.game.mp=demoMaxes.maxMp;
    state.economy={...state.economy,coins:9999,bossBlood:99};
    if(!LOCAL_PROGRESSION_UPDATE_PREVIEW&&!normalizeHabitState(state.habits).items.some(habit=>habit.active!==false)){
      const now=Date.now();
      state.habits={items:[
        {id:'demo-water',title:'Beber agua',difficulty:'easy',frequency:'daily',target:1,repeatable:false,active:true,order:0,createdAt:now,updatedAt:now},
        {id:'demo-walk',title:'Caminar 20 minutos',difficulty:'medium',frequency:'daily',target:1,repeatable:false,active:true,order:1,createdAt:now+1,updatedAt:now+1},
        {id:'demo-breathe',title:'Respirar antes del antojo',difficulty:'hard',frequency:'daily',target:1,repeatable:false,active:true,order:2,createdAt:now+2,updatedAt:now+2},
        {id:'demo-read',title:'Leer 10 minutos',difficulty:'medium',frequency:'daily',target:1,repeatable:false,active:true,order:3,createdAt:now+3,updatedAt:now+3}
      ],entries:{}};
    }
    if(LOCAL_DEMO_HABIT_PAIR){
      const now=Date.now();
      state.habits={items:[
        {id:'demo-repeatable-water',title:'Beber 3 vasos de agua',difficulty:'medium',frequency:'daily',target:3,repeatable:true,active:true,order:0,createdAt:now,updatedAt:now},
        {id:'demo-single-read',title:'Leer 10 minutos',difficulty:'medium',frequency:'daily',target:1,repeatable:false,active:true,order:1,createdAt:now+1,updatedAt:now+1}
      ],entries:{}};
      state.game={
        ...state.game,
        powerProgress:{},
        buffs:{}
      };
    }
  }
  scheduleSave({type:'demo:bosses',count:LOCAL_DEMO_BOSSES});
}

function relicBonuses(){
  return equippedRelicBonuses(state);
}

function storedRelicXp(){
  const legacyEntries=state.habits?.entries||{};
  const relicXp=Object.entries(state.inventory?.dailyActivations||{})
    .filter(([key,value])=>(
      key.startsWith('relic_06:')||key.includes(':relic_06:')||
      key.startsWith('relic_07:')||key.includes(':relic_07:')||
      key.includes(':synergy-xp:')||
      ((key.startsWith('relic_11:')||key.includes(':relic_11:'))&&
        !legacyEntries[`relic_11|d:${key.split(':').pop()}`])
    )&&Number(value)>0)
    .reduce((total,[,value])=>total+Number(value),0);
  const fusionXp=Object.entries(state.forge?.fusion?.dailyActivations||{})
    .filter(([key,value])=>key.startsWith('fusion_04:all-habits:')&&
      !legacyEntries[`fusion_04|d:${key.split(':').pop()}`]&&Number(value)>0)
    .reduce((total,[,value])=>total+Number(value),0);
  return relicXp+fusionXp;
}

function lootMigrationSeed(){
  return [
    state.config?.startDate||'',
    state.game?.name||'',
    state.game?.cls||'',
  ].join('|');
}

function totalBossesDown(){
  const combat=state.game?.bossCombat;
  return Math.max(0,combat?.legacyBossesDown||0)+
    Math.max(0,combat?.defeated||0);
}

function syncLootRewards(source,earlyVictoryBonuses=[]){
  if(!state.game?.cls) return [];
  const before=JSON.stringify({
    economy:state.economy,loot:state.loot,
    inventory:state.inventory,forge:state.forge
  });
  const potionBloodChanceByRewardId=Object.fromEntries(RELIC_DEFINITIONS.map(definition=>[
    definition.rewardId,potionBloodChance(state.inventory?.potions,definition.rewardId)
  ]));
  const result=grantBossRewards({
    state,
    bossesDown:totalBossesDown(),
    source,
    seed:lootMigrationSeed(),
    earlyVictoryBonuses,
    potionBloodChanceByRewardId,
    nowTimestamp:Date.now()
  });
  if(result.rewards.length){
    let arcaneFibers=0;
    let arcaneInks=0;
    for(const reward of result.rewards){
      const pendingEntry=Object.entries(result.loot.bossFiberOutcomes||{}).find(([,outcome])=>
        outcome?.bossIndex===reward.bossIndex&&!outcome?.notifiedAt
      );
      if(!pendingEntry) continue;
      const [cycleId,outcome]=pendingEntry;
      arcaneFibers+=Math.max(0,Number(outcome.granted)||0);
      arcaneInks+=Math.max(0,Number(outcome.arcaneInks)||0);
      result.loot.bossFiberOutcomes[cycleId]={...outcome,notifiedAt:Date.now()};
    }
    const notice=result.loot.notices[result.loot.notices.length-1];
    if(notice&&arcaneFibers>0) notice.arcaneFibers=arcaneFibers;
    if(notice&&arcaneInks>0) notice.arcaneInks=arcaneInks;
  }
  applyLootSlices(result);
  if(source==='victory'&&result.rewards.length){
    state.inventory=consumePreparedBlood(state.inventory,result.rewards.map(reward=>reward.rewardId));
  }
  const after=JSON.stringify({
    economy:state.economy,loot:state.loot,
    inventory:state.inventory,forge:state.forge
  });
  if(before!==after){
    scheduleSave({
      type:source==='retroactive'?'loot:migrated':'loot:boss-reward',
      rewards:result.rewards.map(reward=>reward.rewardId)
    });
  }
  return result.rewards;
}

function recoverMana(amount){
  if(amount<=0) return 0;
  const bonusPercent=relicBonuses().manaRecoveryPercentBonus;
  const bonus=bonusPercent>0
    ? Math.max(1,Math.round(heroMaxes().maxMp*bonusPercent/100))
    : 0;
  const before=state.game.mp||0;
  state.game.mp=capMp(before+amount+bonus);
  return state.game.mp-before;
}

function syncPeriodicRelicMana(now=Date.now(),notify=false){
  if(!state.game?.cls) return 0;
  const previousTimer=JSON.stringify(state.inventory?.periodicEffects?.manaRecovery||null);
  const result=advancePeriodicManaRecovery({
    state,
    nowTimestamp:now,
    maxMana:heroMaxes().maxMp,
    currentMana:state.game.mp||0
  });
  applyLootSlices(result);
  state.game.mp=result.mana;
  const timerChanged=previousTimer!==JSON.stringify(state.inventory?.periodicEffects?.manaRecovery||null);
  if(result.manaRecovered>0&&result.sourceIds.includes('fusion_08')&&
      collarRecoverySourcesForKey(todayKey()).some(source=>source.relicId==='fusion_08')){
    state.inventory.dailyActivations[`fusion_08:mana-recovered:${todayKey()}`]=true;
  }
  if(timerChanged||result.manaRecovered>0){
    scheduleSave({type:'relic:periodic-mana',recovered:result.manaRecovered,ticks:result.ticks});
  }
  if(notify&&result.manaRecovered>0){
    const sourceName=result.sourceIds.length===1
      ? relicDefinition(result.sourceIds[0])?.name||'Reliquia'
      : 'Reliquias de Maná';
    showToast(`${sourceName} · +${result.manaRecovered} Maná`,'heal');
  }
  return result.manaRecovered;
}

function applyFirstDamageRelic(damage,key=todayKey()){
  const sources=availableDailyEffectSources(state,'relic_01',key);
  if(damage<=0||!sources.length){
    return {damage,reduction:0,activationKey:null};
  }
  const reduction=Math.min(damage,sources.reduce((total,source)=>total+source.value,0));
  applyLootSlices(markDailyEffectSources(state,'relic_01',key,sources,true));
  if(reduction>0&&sources.some(source=>source.relicId==='fusion_06')&&
      collarRecoverySourcesForKey(key).some(source=>source.relicId==='fusion_06')){
    state.inventory.dailyActivations[`fusion_06:shield-used:${key}`]=true;
  }
  return {damage:Math.max(0,damage-reduction),reduction,activationKey:sources.map(source=>source.relicId)};
}

function previousDayFailedForKey(key){
  const previousDate=parseKey(key);
  previousDate.setDate(previousDate.getDate()-1);
  return smokeFreeStatusOf(getDay(keyOf(previousDate)))===SMOKE_FREE_STATUS_SMOKED;
}

function collarRecoveryWeekKey(key){
  return `week-${Math.max(0,weekIndexOf(parseKey(key)))}`;
}

function collarRecoverySourcesForKey(key){
  return previousDayFailedForKey(key)
    ? availableDailyEffectSources(state,'relic_07',collarRecoveryWeekKey(key))
    : [];
}

function fusionSynergyXp(fusionId){
  const relic=state.inventory?.relics?.[fusionId];
  const values=relicDefinition(fusionId)?.synergy?.values||{};
  const rank=Math.max(1,Math.min(3,Number(relic?.rank)||1));
  return Math.max(0,Number(values[rank])||0);
}

function restoreRelicActivation(activationKey){
  if(!activationKey||!state.inventory?.dailyActivations) return;
  if(Array.isArray(activationKey)){
    activationKey.forEach(sourceId=>{
      const key=sourceId==='relic_01'?`relic_01:${todayKey()}`:`${sourceId}:relic_01:${todayKey()}`;
      delete state.inventory.dailyActivations[key];
      if(sourceId==='fusion_06') delete state.inventory.dailyActivations[`fusion_06:shield-used:${todayKey()}`];
    });
    return;
  }
  delete state.inventory.dailyActivations[activationKey];
}

function awardRelicDayXp(key){
  const sources=availableDailyEffectSources(state,'relic_06',key);
  let amount=sources.reduce((total,source)=>total+source.value,0);
  sources.forEach(source=>{
    applyLootSlices(markDailyEffectSources(state,'relic_06',key,[source],source.value));
  });
  if(previousDayFailedForKey(key)){
    const weekKey=collarRecoveryWeekKey(key);
    const recoverySources=availableDailyEffectSources(state,'relic_07',weekKey);
    recoverySources.forEach(source=>{
      amount+=source.value;
      let synergyXp=0;
      if(source.relicId==='fusion_06'&&state.inventory.dailyActivations[`fusion_06:shield-used:${key}`]) synergyXp=fusionSynergyXp('fusion_06');
      if(source.relicId==='fusion_07'&&state.inventory.dailyActivations[`fusion_07:mana-used:${key}`]) synergyXp=fusionSynergyXp('fusion_07');
      if(source.relicId==='fusion_08'&&state.inventory.dailyActivations[`fusion_08:mana-recovered:${key}`]) synergyXp=fusionSynergyXp('fusion_08');
      if(synergyXp>0){
        amount+=synergyXp;
        state.inventory.dailyActivations[`${source.relicId}:synergy-xp:${key}`]=synergyXp;
      }
      applyLootSlices(markDailyEffectSources(state,'relic_07',weekKey,[source],source.value));
    });
  }
  return amount;
}

function revokeRelicDayXp(key){
  let amount=0;
  Object.entries(state.inventory?.dailyActivations||{}).forEach(([activationKey,value])=>{
    if((activationKey===`relic_06:${key}`||activationKey.endsWith(`:relic_06:${key}`))&&Number(value)>0){
      amount+=Number(value);
      delete state.inventory.dailyActivations[activationKey];
    }
  });
  const weekKey=`week-${Math.max(0,weekIndexOf(parseKey(key)))}`;
  Object.keys(state.inventory?.dailyActivations||{}).forEach(activationKey=>{
    if(activationKey===`relic_07:${weekKey}`||activationKey.endsWith(`:relic_07:${weekKey}`)){
      amount+=Number(state.inventory.dailyActivations[activationKey])||0;
      delete state.inventory.dailyActivations[activationKey];
    }
  });
  for(const fusionId of ['fusion_06','fusion_07','fusion_08']){
    const synergyKey=`${fusionId}:synergy-xp:${key}`;
    amount+=Number(state.inventory?.dailyActivations?.[synergyKey])||0;
    delete state.inventory.dailyActivations[synergyKey];
  }
  return amount;
}

function completedDayForKey(key){
  const date=parseKey(key);
  const dateConfig=journeyConfigForDate(state.config,date);
  if(isSmokeFreeMode(dateConfig)){
    return smokeFreeStatusOf(getDay(key))===SMOKE_FREE_STATUS_SUCCESS;
  }
  if(isControlledMode(dateConfig)) return controlledDayCompleted(key);
  return getDay(key).c<=limitOfDate(date);
}



function gameStats(){
  const intoxication=currentIntoxication();
  const bonuses=relicBonuses();
  return calculateGameStats({
    now:currentDayDate(),
    config:state.config,
    days:state.days,
    game:state.game,
    habits:state.habits,
    passiveMultiplier:intoxication.passiveMultiplier,
    relicXp:storedRelicXp(),
    relicBonuses:bonuses
  });
}

/* topes dinámicos según clase y nivel */
function heroMaxes(){
  const stats=gameStats();
  return {maxHp:stats.maxHp,maxMp:stats.maxMp};
}
function capHp(v){ return Math.max(0,Math.min(heroMaxes().maxHp, v)); }
function capMp(v){ return Math.max(0,Math.min(heroMaxes().maxMp, v)); }

let pendingPostDeathHuntReport=null;

function renderDeathModal(notice=state.game?.deathNotice){
  if(!notice) return;
  const protectedXp=Boolean(notice.protected)||!notice.xpLost;
  const levelChanged=notice.levelAfter<notice.levelBefore;
  document.getElementById('deathCause').textContent=notice.cause||'Las fuerzas de tu héroe se agotaron.';
  document.getElementById('deathXpLoss').textContent=protectedXp?'XP PROTEGIDA':`−${notice.xpLost} XP`;
  document.getElementById('deathXpCopy').textContent=protectedXp
    ? 'Los niveles 1–4 están protegidos frente a la pérdida de experiencia.'
    : `Has perdido el ${notice.lossPercent||10}% de la experiencia necesaria para completar este nivel.`;
  const levelRow=document.getElementById('deathLevelChange');
  levelRow.hidden=!levelChanged;
  if(levelChanged){
    document.getElementById('deathLevelBefore').textContent=notice.levelBefore;
    document.getElementById('deathLevelAfter').textContent=notice.levelAfter;
  }
  document.getElementById('deathPenalty').classList.toggle('is-protected',protectedXp);
}

function showPendingDeathModal(){
  const g=state.game;
  if(!g?.deathModalPending||!g.deathNotice) return false;
  renderDeathModal(g.deathNotice);
  document.getElementById('deathBg').classList.add('show');
  return true;
}

function triggerHeroDeath({cause,source='unknown',open=true}={}){
  const g=state.game;
  if(!g?.cls||Number(g.hp)>0) return null;
  const before=gameStats();
  const penalty=deathExperiencePenalty({xp:before.xp,level:before.lvl});
  g.xpDeathPenalty=Math.max(0,Number(g.xpDeathPenalty)||0)+penalty.xpLost;
  const after=gameStats();
  g.hp=after.maxHp;
  g.mp=after.maxMp;
  g.hpT=Date.now();
  g.deathNotice={
    id:`death:${Date.now()}:${source}`,
    at:Date.now(),
    source,
    cause:cause||'Las fuerzas de tu héroe se agotaron.',
    xpLost:penalty.xpLost,
    lossPercent:penalty.lossPercent,
    protected:penalty.protected,
    levelBefore:penalty.levelBefore,
    levelAfter:after.lvl,
    maxHp:after.maxHp,
    maxMp:after.maxMp,
  };
  g.deathModalPending=true;
  scheduleSave({
    type:'hero:death',
    source,
    xpLost:penalty.xpLost,
    levelBefore:penalty.levelBefore,
    levelAfter:after.lvl,
  });
  if(open) showPendingDeathModal();
  return g.deathNotice;
}

function prepareLocalDeathPreview(){
  if(!LOCAL_DEATH_PREVIEW||!state.game?.cls) return;
  const stats=gameStats();
  const penalty=deathExperiencePenalty({xp:stats.xp,level:stats.lvl});
  state.game.deathNotice={
    id:'death:local-preview',at:Date.now(),source:'preview',
    cause:'Madre del Cultivo derrotó a tu héroe en la Cacería.',
    xpLost:penalty.xpLost,lossPercent:penalty.lossPercent,protected:penalty.protected,
    levelBefore:penalty.levelBefore,levelAfter:penalty.levelAfter,
    maxHp:stats.maxHp,maxMp:stats.maxMp
  };
  state.game.deathModalPending=true;
  state.game.hp=stats.maxHp;
  state.game.mp=stats.maxMp;
}

/* --- sistema de vida y maná por eventos --- */
/* --- modal de resultado semanal (jefe vencido o repetido) --- */
function renderWeekResultModal(){
  const g=state.game;
  const wr=g.weekResult; if(!wr) return;
  const body=document.getElementById('weekResultModal');
  const bossImg=(num,slug)=>`<div class="boss-box" style="margin:14px auto"><img src="bosses/boss_${String(num).padStart(2,'0')}_${slug}.webp" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="boss-fallback" style="display:none">💀</span></div>`;

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
      queueLootNotice();
    });
  }else{
    const idx=Number.isFinite(wr.bossIndex)
      ? Math.min(wr.bossIndex,BOSSES.length-1)
      : Math.min(gameStats().bossesDown,BOSSES.length-1);
    const name=BOSSES[idx], slug=BOSS_SLUGS[idx];
    const lastLim=limitOfWeek(wr.weekIdx);
    const newWeekIdx=wr.weekIdx+1;
    const smokeFreeMode=usesSmokeFreeSkills(state.config);
    const hpDamage=Math.max(0,Number(wr.penalty?.hpDamage)||0);
    const manaLost=Math.max(0,Number(wr.penalty?.manaLost)||0);
    const penaltyText=wr.penalty?.shielded
      ? `Muro de Escudos bloqueó el golpe a tu vida${manaLost?`, pero perdiste ${manaLost} de maná`:''}.`
      : `El jefe te devolvió el golpe: <b>−${hpDamage} HP</b>${manaLost?` y <b>−${manaLost} de maná</b>`:''}. Se recuperan con el tiempo.`;
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
  state={...state,...normalizeLootState(state)};
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

let earlyVictoryNoticeOpening=false;
async function showPendingEarlyVictoryNotice(){
  const earlyVictory=state.game?.bossCombat?.earlyVictory;
  if(earlyVictoryNoticeOpening||!earlyVictory?.noticePending) return;
  if(document.getElementById('weekResultBg').classList.contains('show')) return;
  if(document.getElementById('lootNoticeBg').classList.contains('show')) return;
  earlyVictoryNoticeOpening=true;
  earlyVictory.noticePending=false;
  try{
    handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));
    document.getElementById('earlyVictoryBg').classList.add('show');
  }catch(error){
    earlyVictory.noticePending=true;
    console.error('No se pudo guardar la Victoria Anticipada antes del aviso',error);
    showToast('No se guardó el aviso de victoria','dmg');
  }finally{earlyVictoryNoticeOpening=false;}
}
function queueEarlyVictoryNotice(){
  window.setTimeout(()=>void showPendingEarlyVictoryNotice(),0);
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
  const previousConstancy=JSON.stringify({
    constancy:state.inventory?.constancy||null,
    activations:state.inventory?.weeklyActivations||{},
    bonusXp:g.bonusXp||0
  });
  const result=reconcileBossCombat({
    combat:g.bossCombat,
    now:nowDate,
    config:state.config,
    days:state.days,
    legacyBossesDown,
    criticalChance:pveHeroStats({
      classId:g.cls,
      level:gameStats().lvl,
      allocation:g.attributes
    }).criticalChance
  });
  g.bossCombat=result.combat;
  const totalBossesDown=
    Math.max(0,g.bossCombat.legacyBossesDown||0)+
    Math.max(0,g.bossCombat.defeated||0);
  g.evolutionUnlocked=journeyEvolutionUnlocked({
    config:state.config,
    bossesDown:totalBossesDown
  });
  let constancyXp=0;
  const applyConstancyVictory=({week,bossIndex,pips})=>{
    const cycleId=`week-${week}:boss-${bossIndex}`;
    const reward=activateRelicConstancy({
      state,
      cycleId,
      outcomes:pips,
      bossWon:true,
      nowTimestamp:actualTimestamp
    });
    applyLootSlices(reward);
    if(reward.activated){
      g.bonusXp=(g.bonusXp||0)+reward.xp;
      constancyXp+=reward.xp;
    }
    applyLootSlices(grantBossFiberReward({
      state,
      cycleId,
      bossIndex,
      nowTimestamp:actualTimestamp
    }));
  };
  for(const weekResult of result.weekResults){
    if(weekResult.won){
      applyConstancyVictory({
        week:weekResult.weekIdx,
        bossIndex:weekResult.bossIndex,
        pips:weekResult.pips||[]
      });
    }
  }
  if(result.newlyDefeated){
    applyConstancyVictory({
      week:result.status.w,
      bossIndex:result.status.bossIndex,
      pips:result.status.pips||[]
    });
  }
  const activeCycleId=`week-${result.status.w}:boss-${result.status.bossIndex}`;
  applyLootSlices(syncRelicConstancy(state,{
    cycleId:activeCycleId,
    outcomes:result.status.pips||[],
    nowTimestamp:actualTimestamp
  }));
  const earlyVictoryBonuses=[
    ...result.weekResults
      .filter(weekResult=>weekResult.won&&weekResult.earlyVictory)
      .map(weekResult=>weekResult.earlyVictory),
    ...(result.earlyVictory?[result.earlyVictory]:[])
  ];
  syncLootRewards(
    state.loot?.migrationComplete===true?'victory':'retroactive',
    earlyVictoryBonuses
  );
  for(const weekResult of result.weekResults){
    if(!weekResult.won){
      const mx=heroMaxes();
      const smokeFreeMode=usesSmokeFreeSkills(state.config);
      const hpBefore=Math.max(0,Number(g.hp)||0);
      const mpBefore=Math.max(0,Number(g.mp)||0);
      if(smokeFreeMode&&(g.buffs?.shield||0)>0){
        g.buffs.shield--;
        g.mp=Math.round(mx.maxMp*0.2);
        weekResult.penalty={
          shielded:true,
          hpRate:0,
          mpRate:0.2,
          hpBefore,
          hpAfter:g.hp,
          hpDamage:0,
          mpBefore,
          mpAfter:g.mp,
          manaLost:Math.max(0,mpBefore-g.mp)
        };
      }else{
        const lvl=gameStats().lvl;
        const knightReduction=smokeFreeMode&&g.cls==='knight'&&lvl>=5
          ? 0.1*currentIntoxication(actualTimestamp).passiveMultiplier
          : 0;
        const damageRate=Math.max(
          0,
          0.3-knightReduction
        );
        const penalty=weeklyBossPenalty({
          hp:g.hp,
          maxHp:mx.maxHp,
          maxMp:mx.maxMp,
          damageRate
        });
        g.hp=penalty.hp;
        g.mp=penalty.mp;
        weekResult.penalty={
          shielded:false,
          hpRate:damageRate,
          mpRate:0.2,
          hpBefore,
          hpAfter:g.hp,
          hpDamage:Math.max(0,hpBefore-g.hp),
          mpBefore,
          mpAfter:g.mp,
          manaLost:Math.max(0,mpBefore-g.mp)
        };
      }
    }
    if(g.hp<=0){
      const bossIndex=Number.isFinite(weekResult.bossIndex)
        ? Math.max(0,weekResult.bossIndex)
        : Math.max(0,gameStats().bossesDown);
      triggerHeroDeath({
        cause:`${BOSSES[bossIndex]||'El jefe semanal'} venció a tu héroe al cerrar la semana.`,
        source:'weekly-boss',
        open:false
      });
    }
    const storedBattle=[...(g.bossCombat?.history||[])].reverse().find(entry=>(
      entry?.week===weekResult.weekIdx&&entry?.bossIndex===weekResult.bossIndex
    ));
    if(storedBattle){
      storedBattle.heroDamage=Math.max(0,Number(weekResult.damage)||0);
      storedBattle.bossDamage=Math.max(0,Number(weekResult.penalty?.hpDamage)||0);
      storedBattle.manaDamage=Math.max(0,Number(weekResult.penalty?.manaLost)||0);
      storedBattle.shielded=Boolean(weekResult.penalty?.shielded);
    }
    g.weekResult=weekResult;
    g.weekModalPending=true;
  }
  const constancyChanged=previousConstancy!==JSON.stringify({
    constancy:state.inventory?.constancy||null,
    activations:state.inventory?.weeklyActivations||{},
    bonusXp:g.bonusXp||0
  });
  if(previous!==JSON.stringify(g.bossCombat)||result.weekResults.length||previousEvolution!==g.evolutionUnlocked||constancyChanged){
    scheduleSave();
  }
  if(constancyXp>0){
    showToast(`🔥 CONSTANCIA COMPLETADA · 6/6 · +${constancyXp} XP`,'heal');
  }
  if(g.bossCombat.earlyVictory?.noticePending) queueEarlyVictoryNotice();
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
  if(g.buffs.balm){
    const balm=g.buffs.balm;
    const duration=Math.max(1,(balm.until||now)-(balm.startedAt||now));
    const fraction=Math.max(0,Math.min(1,(Math.min(now,balm.until||now)-(balm.startedAt||now))/duration));
    const total=Math.max(0,Number(balm.remaining)||0);
    const shouldApply=Math.floor(total*fraction);
    const already=Math.max(0,Number(balm.applied)||0);
    if(shouldApply>already){
      g.hp=capHp((g.hp||0)+(shouldApply-already));
      balm.applied=shouldApply;
      dirty=true;
    }
    if(now>=(balm.until||0)){
      delete g.buffs.balm;
      dirty=true;
    }
  }
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
    if(completedDay){
      awardRelicDayXp(g.day);
      applyClassDayRewards(g.day,true);
    }
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
  const effectiveMaxHp=heroMaxes().maxHp;
  if(g.hp>effectiveMaxHp){
    g.hp=effectiveMaxHp;
    dirty=true;
  }
  const regenerated=regenerateHealth({
    hp:g.hp,
    hpTimestamp:g.hpT,
    nowTimestamp:now,
    maxHp:heroMaxes().maxHp,
    classId:g.cls,
    regenerationActive:Boolean(g.buffs.regenUntil&&g.buffs.regenUntil>now),
    passiveMultiplier:intoxication.passiveMultiplier,
    druidFastRegeneration:!usesSmokeFreeSkills(state.config),
    additiveMinutesReduction:relicBonuses().regenerationMinutesReduction
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

function recordBossCounterattack({
  damage=0,
  key=todayKey(),
  kind='smoke',
  shielded=false,
  unit='HP',
  id=null
}={}){
  const combat=state.game?.bossCombat;
  if(!combat) return null;
  combat.exchangeLog=Array.isArray(combat.exchangeLog)?combat.exchangeLog:[];
  const eventId=id||`boss-hit:${combat.week}:${key}:${Date.now()}:${combat.exchangeLog.length}`;
  const entry={
    id:eventId,
    week:combat.week,
    bossIndex:combat.bossIndex,
    key,
    at:new Date().toISOString(),
    direction:'incoming',
    kind,
    damage:Math.max(0,Number(damage)||0),
    shielded:Boolean(shielded),
    unit
  };
  const previousIndex=combat.exchangeLog.findIndex(item=>item?.id===eventId);
  if(previousIndex>=0) combat.exchangeLog[previousIndex]=entry;
  else combat.exchangeLog.push(entry);
  combat.exchangeLog=combat.exchangeLog.slice(-80);
  return eventId;
}

function removeBossCounterattack(eventId){
  const combat=state.game?.bossCombat;
  if(!combat||!eventId||!Array.isArray(combat.exchangeLog)) return;
  combat.exchangeLog=combat.exchangeLog.filter(entry=>entry?.id!==eventId);
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
  const relicDamage=applyFirstDamageRelic(result.dmg,key);
  result.dmg=relicDamage.damage;
  result.relicReduction=relicDamage.reduction;
  result.relicActivationKey=relicDamage.activationKey;
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
function pendingDailyHabits(){
  const normalized=normalizeHabitState(state.habits);
  const periodKey=`d:${todayKey()}`;
  return normalized.items.filter(habit=>{
    if(habit.active===false||habit.frequency!=='daily') return false;
    const count=Math.max(0,Number(normalized.entries[`${habit.id}|${periodKey}`]?.count)||0);
    return count<Math.max(1,Number(habit.target)||1);
  });
  if(result.dmg>0&&g.buffs?.knightGuard?.day===key){
    result.dmg=Math.max(0,result.dmg-Math.max(0,Number(g.buffs.knightGuard.amount)||0));
    delete g.buffs.knightGuard;
  }
}

function closeSkillHabitPicker(){
  document.getElementById('skillHabitPickerBg').classList.remove('show');
}

function closeSkillConfirmation(){
  document.getElementById('skillConfirmBg').classList.remove('show');
}

function resetSkillConfirmation(){
  document.getElementById('skillConfirmKicker').textContent='CONFIRMAR HABILIDAD';
  document.getElementById('skillConfirmCancel').style.display='';
  document.getElementById('skillConfirmAccept').textContent='ACTIVAR';
  document.getElementById('skillConfirmActions').classList.remove('skill-confirm-info-actions');
}

function openUsedSkillModal(spell,{weekly=false,message=''}={}){
  resetSkillConfirmation();
  document.getElementById('skillConfirmKicker').textContent='HABILIDAD NO DISPONIBLE';
  document.getElementById('skillConfirmTitle').textContent=spell.name;
  document.getElementById('skillConfirmBody').innerHTML=`<div class="skill-confirm-unavailable">${message||(weekly
    ? 'Ya usaste esta habilidad esta semana. Volverá a activarse al comenzar la próxima semana.'
    : 'Ya usaste esta habilidad dos veces hoy. Volverá a activarse mañana al despertar.')}</div>`;
  document.getElementById('skillConfirmCancel').style.display='none';
  document.getElementById('skillConfirmAccept').textContent='ENTENDIDO';
  document.getElementById('skillConfirmActions').classList.add('skill-confirm-info-actions');
  pendingSkillCast={mode:'used-info'};
  document.getElementById('skillConfirmBg').classList.add('show');
}

function skillSelectionLimit(spell){
  if(spell.ulti) return {min:3,max:3};
  return {min:2,max:2};
}

function renderSkillHabitPicker(){
  if(!pendingSkillCast) return;
  const {spell,available,selected}=pendingSkillCast;
  const limit=skillSelectionLimit(spell);
  document.getElementById('skillHabitPickerTitle').textContent=spell.name;
  document.getElementById('skillHabitPickerIntro').textContent=spell.ulti
    ? 'Selecciona tres hábitos diarios pendientes.'
    : limit.max===1
    ? 'Selecciona un hábito diario pendiente.'
    : limit.max===3
      ? 'Selecciona entre dos y tres hábitos diarios pendientes.'
      : 'Selecciona dos hábitos diarios pendientes.';
  document.getElementById('skillHabitPickerList').innerHTML=available.map(habit=>{
    const isSelected=selected.includes(habit.id);
    const difficulty=habit.difficulty==='hard'?'Difícil':habit.difficulty==='medium'?'Media':'Fácil';
    return `<button type="button" class="skill-habit-option${isSelected?' selected':''}" data-skill-habit="${habit.id}" aria-pressed="${isSelected}">
      <span class="skill-habit-option-mark">${isSelected?'✓':'·'}</span>
      <span class="skill-habit-option-copy"><b>${habit.title}</b><small>${difficulty} · hábito diario</small></span>
      <span class="skill-habit-option-xp">+5 XP</span>
    </button>`;
  }).join('');
  const ready=selected.length>=limit.min&&selected.length<=limit.max;
  const count=document.getElementById('skillHabitPickerCount');
  count.textContent=`${selected.length} de ${limit.max} seleccionados`;
  count.classList.toggle('ready',ready);
  document.getElementById('skillHabitPickerContinue').disabled=!ready;
}

function openSkillHabitPicker(spell){
  const available=pendingDailyHabits();
  const limit=skillSelectionLimit(spell);
  if(available.length<limit.min){
    showToast(`Faltan ${limit.min} hábitos diarios`,'dmg');
    return;
  }
  pendingSkillCast={spell,available,selected:[]};
  renderSkillHabitPicker();
  document.getElementById('skillHabitPickerBg').classList.add('show');
}

function openSkillConfirmation(spell,selectedHabitIds=[],targetHabitId=null){
  resetSkillConfirmation();
  document.getElementById('skillConfirmTitle').textContent=`¿Activar ${spell.name}?`;
  document.getElementById('skillConfirmBody').innerHTML=`
    <div class="skill-confirm-cost"><span>Coste de maná</span><b>${spell.cost} 💧</b></div>`;
  pendingSkillCast={spell,selectedHabitIds,targetHabitId,confirmed:true};
  document.getElementById('skillConfirmBg').classList.add('show');
}

function weakestPendingHabit(){
  const candidates=pendingDailyHabits();
  return [...candidates].sort((a,b)=>{
    const weight={easy:1,medium:2,hard:3};
    return (weight[b.difficulty]||1)-(weight[a.difficulty]||1);
  })[0]||null;
}

function applyFilacteria(spentMana){
  const g=state.game;
  if(g?.cls!=='sorcerer'||gameStats().lvl<12||spentMana<=0) return '';
  const rewards=g.powerProgress=g.powerProgress||{};
  const week=Math.max(0,weekIndexOf(currentDayDate()));
  const progressKey=`filacteria-mana:${week}`;
  const usesKey=`filacteria-uses:${week}`;
  rewards[progressKey]=(Number(rewards[progressKey])||0)+spentMana;
  rewards[usesKey]=Number(rewards[usesKey])||0;
  let activations=0;
  while(rewards[progressKey]>=50&&rewards[usesKey]<2){
    rewards[progressKey]-=50;
    rewards[usesKey]+=1;
    state.economy.coins+=2;
    const sacrifice=Math.max(1,Math.round(heroMaxes().maxHp*0.15));
    g.hp=Math.max(1,(g.hp||1)-sacrifice);
    activations+=1;
  }
  return activations?` · Filacteria ×${activations} · +${activations*2} 🪙`:'';
}

function castSpell(id,options={}){
  ensureHero();
  const g=state.game;
  const st=gameStats();
  const C=classDataForJourney(g.cls,{smokeFree:usesSmokeFreeSkills(state.config)}); if(!C) return;
  const sp=C.act.find(a=>a.id===id); if(!sp) return;
  if(st.lvl<sp.lvl){
    showToast('Nivel '+sp.lvl+' necesario','dmg');
    return;
  }
  const w=Math.max(0,weekIndexOf(currentDayDate()));
  const spellDayKey=todayKey();
  reconcileStoredLevelEightHabitChallenge();
  if(sp.lvl===2&&!sp.ulti){
    const availability=levelTwoSpellAvailability({game:g,spellId:sp.id,nowTimestamp:Date.now()});
    if(availability.cooldownRemainingMs>0) return;
  }
  if(sp.ulti&&sp.modern){
    const availability=ultimateSpellAvailability({game:g,currentWeek:w,today:spellDayKey});
    if(availability.dailyExhausted){
      return;
    }
    if(availability.exhausted){
      openUsedSkillModal(sp,{weekly:true,message:'Ya usaste esta definitiva dos veces esta semana. Volverá a activarse al comenzar la próxima semana.'});
      return;
    }
    if(availability.challengeActive){
      openUsedSkillModal(sp,{message:'Completa primero el reto de la definitiva que ya tienes activo.'});
      return;
    }
  }
  if(sp.ulti&&!sp.modern&&g.ultiW===w){
    openUsedSkillModal(sp,{weekly:true});
    return;
  }
  if(sp.lvl===8&&!sp.ulti){
    const availability=levelEightSpellAvailability({game:g,spellId:sp.id,today:spellDayKey,nowTimestamp:Date.now()});
    if(availability.exhausted){
      return;
    }
    if(availability.challengeActive){
      openUsedSkillModal(sp,{message:'Completa primero el reto de hábitos que ya tienes activo.'});
      return;
    }
    if(availability.cooldownRemainingMs>0){
      return;
    }
  }
  if(sp.autoHabitChallenge&&!options.confirmed){
    if(pendingDailyHabits().length<2){
      showToast('Faltan 2 hábitos diarios','dmg');
      return;
    }
    openSkillConfirmation(sp);
    return;
  }
  if(sp.habitChallenge&&!options.confirmed){
    openSkillHabitPicker(sp);
    return;
  }
  if(sp.modern&&sp.id==='alma'&&!options.confirmed){
    openSkillHabitPicker(sp);
    return;
  }
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
    maxMp:st.maxMp,
    activeFailureChance:intoxication.activeFailureChance,
    passiveMultiplier:intoxication.passiveMultiplier,
    smokeFreeMode:usesSmokeFreeSkills(state.config),
    selectedHabitIds:options.selectedHabitIds||[],
    targetHabitId:options.targetHabitId||null
  });
  if(!result.ok){
    if(result.reason==='level') showToast('Nivel '+result.requiredLevel+' necesario','dmg');
    else if(result.reason==='ultimate-daily-used') return;
    else if(result.reason==='ultimate-used') showToast(sp.modern?'Ya usada dos veces esta semana':'Ya usada esta semana','dmg');
    else if(result.reason==='ultimate-active') showToast('Completa la definitiva activa','dmg');
    else if(result.reason==='challenge-used') showToast('Esta habilidad ya se usó dos veces hoy','dmg');
    else if(result.reason==='challenge-active') showToast('Completa primero el reto activo','dmg');
    else if(result.reason==='challenge-cooldown') showToast(`Podrás volver a usarla en ${Math.max(1,Math.ceil(result.cooldownRemainingMs/1000))} s`,'dmg');
    else if(result.reason==='spell-cooldown') return;
    else if(result.reason==='habits') showToast('Faltan hábitos diarios','dmg');
    else if(result.reason==='health') showToast('Vida insuficiente para pagar el sacrificio','dmg');
    else if(result.reason==='charges') showToast(`Último Bastión · ${result.charges}/6 cargas`,'dmg');
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
  const filacteriaNotice=applyFilacteria(result.spentMana||0);
  switch(id){
    case 'alma': showToast('Robar Alma · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'ceniza': showToast('☠ Maldición de Ceniza · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'muro': showToast('🛡 Muro de Escudos · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'grito': showToast('Grito de Guerra · −'+result.spentMana+' 💧 · +'+result.healing+' ♥'+filacteriaNotice,'heal');break;
    case 'bastion': showToast('🏰 Último Bastión · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'certero': showToast('🎯 Ojo Certero · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'luz': showToast('Luz Sanadora · −'+result.spentMana+' 💧 · +'+result.healing+' ♥'+filacteriaNotice,'heal');break;
    case 'juicio': showToast('⚖️ Juicio Divino · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'peste': showToast('☠ Drenaje del Antojo · −'+result.spentMana+' 💧 · +'+result.healing+' ♥'+filacteriaNotice,'heal');break;
    case 'regen': showToast('🌿 Regeneración · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
    case 'balsamo': showToast('Bálsamo · −'+result.spentMana+' 💧 · +'+result.healing+' ♥'+filacteriaNotice,'heal');break;
    case 'renacer': showToast('🌅 Renacer · −'+result.spentMana+' 💧'+filacteriaNotice,'heal');break;
  }
  scheduleSave();
  renderHero();
  requestAnimationFrame(()=>{
    const slot=document.querySelector(`#view-hero .hero-skill-hotbar [data-cast="${id}"]`);
    slot?.classList.add('cast-confirm');
    const manaBar=document.querySelector('#view-hero [data-hero-stat="mana"]');
    manaBar?.classList.add('stat-cast-feedback','mana-feedback');
    const hpBar=result.healing>0
      ? document.querySelector('#view-hero [data-hero-stat="hp"]')
      : null;
    hpBar?.classList.add('stat-cast-feedback','hp-feedback');
    setTimeout(()=>{
      slot?.classList.remove('cast-confirm');
      manaBar?.classList.remove('stat-cast-feedback','mana-feedback');
      hpBar?.classList.remove('stat-cast-feedback','hp-feedback');
    },950);
  });
}

function showToast(txt,type){
  renderToast(document,txt,type);
}

function flashHeroStatFeedback(stat){
  requestAnimationFrame(()=>{
    const key=stat==='hp'?'hp':'mana';
    const className=stat==='hp'?'hp-feedback':'mana-feedback';
    const bar=document.querySelector(`#view-hero [data-hero-stat="${key}"]`);
    bar?.classList.add('stat-cast-feedback',className);
    setTimeout(()=>bar?.classList.remove('stat-cast-feedback',className),950);
  });
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
      armor:0,
      lootState:state,
      classChange:Boolean(pendingClassChange),
      currentClass:pendingClassChange?.fromClass||null
    });
    return;
  }
  ensureHero();
  const now=new Date();
  const dayDate=currentDayDate(now);
  const dayKey=todayKey(now);
  const dailyConfig={...state.config,wakeTime:wakeTimeForDay(dayKey)};
  const stats=gameStats();
  if(didHeroLevelUp(observedHeroLevel,stats.lvl)) pendingHeroLevelUp=true;
  observedHeroLevel=stats.lvl;
  const heroViewActive=document.getElementById('view-hero')?.classList.contains('active');
  const levelUp=pendingHeroLevelUp&&heroViewActive;
  if(levelUp) pendingHeroLevelUp=false;
  const intoxication=currentIntoxication(now.getTime());
  const boss=calculateBossCombatStatus({
    combat:state.game.bossCombat,
    now:dayDate,
    config:state.config,
    days:state.days
  });
  const hunt=normalizeHuntState(state.game.hunt,now.getTime(),huntBaseEnergyForToday(now));
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
    dayKey,
    lootState:state,
    huntEnergy:hunt.energy,
    huntEnergyMax:hunt.baseEnergy,
    huntEnergyBonus:hunt.bonusEnergyRemaining+hunt.rewardEnergyRemaining,
    levelUp
  });
}

let lootNoticeOpening=false;
let activeLootNoticeId=null;
let forgeLocked=false;
let pendingForgeAttempt=null;
let shopLocked=false;
let pendingShopPurchase=null;
let shopViewSection='map';
let forgeFromCity=false;
let selectedForgeRelicId=null;
let forgeMode='upgrade';
let fusionLeftId=null;
let fusionRightId=null;
let fusionErrorId=null;
let forgePickerTarget=null;
let pendingFusion=null;
let pendingDefusionRelicId=null;
let pendingActiveRelicTap=null;
let pendingFusionSlotTap=null;
const ACTIVE_RELIC_DOUBLE_TAP_MS=375;
const EQUIPMENT_TYPE_NAMES={
  heart:'corazones',spirit:'reliquias espirituales',dagger:'dagas',helmet:'yelmos',
  vessel:'recipientes mágicos',fang:'colmillos'
};
const EFFECT_FAMILY_NAMES={experience:'de Experiencia',coins:'de Oro',forge:'de Forja',bosses:'de Jefes'};
function equipFailureMessage(result){
  if(result?.reason==='fusion-equipped-conflict'){
    return 'Solo puedes equipar una reliquia fusionada a la vez.';
  }
  if(result?.reason==='effect-family-conflict'){
    return `No puedes equipar dos reliquias ${EFFECT_FAMILY_NAMES[result.effectFamily]||'de la misma familia'}`;
  }
  if(result?.reason==='equipment-type-conflict'){
    return `No puedes equipar dos ${EQUIPMENT_TYPE_NAMES[result.equipmentType]||'reliquias del mismo tipo'}`;
  }
  if(result?.reason==='already-equipped') return 'Esa reliquia ya está equipada';
  return 'No hay un espacio libre para esa reliquia';
}
function confirmConstancyLoss(result, action='Desequipar'){
  const definition=relicDefinition(result?.relicId);
  const name=definition?.name||'el Yelmo';
  return confirm(`¿${action} ${name}?\n\nPerderás tu carga de Constancia actual (${result.charge}/${result.maxCharge||6}).`);
}
function forgeRenderOptions(){
  return {mode:forgeMode,fusionLeftId,fusionRightId,fusionErrorId,cityEntry:forgeFromCity};
}
function shopRenderOptions(){return {...potionViewOptions(),section:shopViewSection};}
function clearFusionFeedback(){ fusionErrorId=null; }
function positionInventorySheetFromForge(){
  const overlay=document.getElementById('sheetInventory');
  const sheet=overlay?.querySelector('.inventory-sheet');
  const bagBody=document.getElementById('bagBody');
  const inventoryBody=document.getElementById('inventoryBody');
  const collectionBody=document.getElementById('collectionBody');
  const forgeBody=document.getElementById('forgeBody');
  const shopBody=document.getElementById('shopBody');
  const mainNav=document.getElementById('mainNav');
  if(!overlay?.classList.contains('show')||!sheet||!bagBody||!inventoryBody||!collectionBody||!forgeBody||!shopBody) return;
  if(sheet.classList.contains('inventory-shop-destination')&&!forgeBody.hidden){
    const currentMode=forgeMode;
    renderForgeView(document,state,selectedForgeRelicId,{...forgeRenderOptions(),mode:'defusion'});
    const viewportHeight=window.visualViewport?.height||window.innerHeight;
    const availableHeight=Math.max(0,viewportHeight-48);
    const defusionHeight=Math.min(availableHeight,forgeBody.getBoundingClientRect().height);
    const referenceOffset=Math.max(0,Math.floor((availableHeight-defusionHeight)/2));
    sheet.style.setProperty('--forge-reference-offset',`${referenceOffset}px`);
    renderForgeView(document,state,selectedForgeRelicId,{...forgeRenderOptions(),mode:currentMode});
    return;
  }
  sheet.style.removeProperty('--forge-reference-offset');
  if(sheet.classList.contains('inventory-shop-active')){
    overlay.style.setProperty('--inventory-nav-clearance','0px');
    overlay.style.setProperty('--inventory-panel-offset','0px');
    return;
  }
  const hiddenStates=[bagBody.hidden,forgeBody.hidden,shopBody.hidden];
  renderForgeView(document,state,selectedForgeRelicId,{...forgeRenderOptions(),mode:'upgrade'});
  bagBody.hidden=true;
  forgeBody.hidden=false;
  shopBody.hidden=true;
  sheet.classList.add('measuring-forge-reference');
  const overlayStyle=getComputedStyle(overlay);
  const viewportHeight=Math.min(overlay.clientHeight,window.visualViewport?.height||overlay.clientHeight);
  const navClearance=mainNav?.classList.contains('show')?mainNav.getBoundingClientRect().height:0;
  const availableHeight=Math.max(0,viewportHeight-
    (parseFloat(overlayStyle.paddingTop)||0)-(parseFloat(overlayStyle.paddingBottom)||0)-navClearance);
  const upgradeReferenceHeight=sheet.scrollHeight;
  renderForgeView(document,state,selectedForgeRelicId,{...forgeRenderOptions(),mode:'fusion'});
  const fusionReferenceHeight=sheet.scrollHeight;
  renderForgeView(document,state,selectedForgeRelicId,{...forgeRenderOptions(),mode:'defusion'});
  const defusionReferenceHeight=sheet.scrollHeight;
  const referenceHeight=Math.max(upgradeReferenceHeight,fusionReferenceHeight,defusionReferenceHeight);
  overlay.style.setProperty('--inventory-nav-clearance',`${navClearance}px`);
  overlay.style.setProperty('--inventory-panel-offset',
    `${inventoryReferenceOffset(availableHeight,referenceHeight)}px`);
  sheet.classList.remove('measuring-forge-reference');
  [bagBody.hidden,forgeBody.hidden,shopBody.hidden]=hiddenStates;
  if(!hiddenStates[1]){
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
  }
}
function showInventoryPanel(panel='inventory',scrollToEquipped=false){
  if(panel==='inventory') panel='bag';
  if(panel==='collection') panel='bag';
  if(panel!=='forge') clearFusionFeedback();
  const bagSelected=panel==='bag';
  const forgeSelected=panel==='forge';
  const shopSelected=panel==='shop';
  const inventoryBody=document.getElementById('inventoryBody');
  const collectionBody=document.getElementById('collectionBody');
  const bagBody=document.getElementById('bagBody');
  const forgeBody=document.getElementById('forgeBody');
  const shopBody=document.getElementById('shopBody');
  const bagTab=document.getElementById('bagTab');
  const shopTab=document.getElementById('shopTab');
  const inventoryOverlay=document.getElementById('sheetInventory');
  const inventorySheet=inventoryOverlay?.querySelector('.inventory-sheet');
  const inventoryTabs=inventorySheet?.querySelector('.inventory-tabs');
  const inventoryTitle=inventorySheet?.querySelector('.sheet-head h3');
  const inventoryReturnCharacter=document.getElementById('inventoryReturnCharacter');
  const shopExperience=shopSelected||(forgeSelected&&forgeFromCity);
  const shopMapExpanded=shopSelected&&shopViewSection==='map';
  if(inventoryReturnCharacter) inventoryReturnCharacter.hidden=!shopExperience||shopMapExpanded;
  bagBody.hidden=!(bagSelected||shopMapExpanded);
  forgeBody.hidden=!forgeSelected;
  shopBody.hidden=!shopSelected;
  bagTab.classList.toggle('active',bagSelected);
  shopTab.classList.toggle('active',shopExperience);
  bagTab.setAttribute('aria-selected',String(bagSelected));
  shopTab.setAttribute('aria-selected',String(shopExperience));
  if(inventoryTabs) inventoryTabs.hidden=shopExperience&&!shopMapExpanded;
  if(inventoryTitle) inventoryTitle.textContent=shopExperience&&!shopMapExpanded?'Tienda':'Inventario';
  inventoryOverlay?.classList.remove('inventory-shop-expanded');
  inventorySheet?.classList.remove('inventory-shop-active');
  inventorySheet?.classList.toggle('inventory-shop-map-overlay',shopMapExpanded);
  inventorySheet?.classList.toggle('inventory-shop-destination',shopExperience&&!shopMapExpanded);
  if(bagSelected){
    renderInventoryView(document,state,potionViewOptions());
    renderCollectionView(document,state);
  }else if(forgeSelected){
    selectedForgeRelicId=renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
  }else{
    const before=JSON.stringify(state.shop);
    applyLootSlices(ensureShopRotation(state,Date.now()));
    if(before!==JSON.stringify(state.shop)) scheduleSave({type:'shop:rotation'});
    renderShopView(document,state,Date.now(),shopRenderOptions());
  }
  positionInventorySheetFromForge();
}
function openInventory(panel='bag'){
  selectedForgeRelicId=null;
  fusionLeftId=null;
  fusionRightId=null;
  clearFusionFeedback();
  forgePickerTarget=null;
  if(panel==='collection') panel='bag';
  const targetBody=document.getElementById('bagBody');
  if(targetBody) targetBody.scrollTop=0;
  showInventoryPanel(panel);
  showSheet(document,'sheetInventory');
  positionInventorySheetFromForge();
  requestAnimationFrame(()=>{
    const refreshedBody=document.getElementById('bagBody');
    if(refreshedBody) refreshedBody.scrollTop=0;
  });
}

function openCharacterSheet(){
  if(!state.game?.cls) return;
  dismissFeatureDiscovery('character-entry');
  ensureHero();
  renderCurrentCharacterSheet();
  showSheet(document,'sheetCharacter');
}

function renderCurrentCharacterSheet(){
  if(!state.game?.cls) return;
  ensureHero();
  const now=new Date();
  const dayDate=currentDayDate(now);
  const dayKey=todayKey(now);
  const stats=gameStats();
  const intoxication=currentIntoxication(now.getTime());
  const heroModel=createHeroModel({
    now,
    config:{...state.config,wakeTime:wakeTimeForDay(dayKey)},
    days:state.days,
    game:state.game,
    stats,
    boss:calculateBossCombatStatus({combat:state.game.bossCombat,now:dayDate,config:state.config,days:state.days}),
    armor:heroArmor(),
    intoxication,
    dayKey,
  });
  renderCharacterSheet({document,state,stats,heroModel});
}

function renderHunt(){
  const game=state.game||{};
  const stats=game.cls?gameStats():null;
  if(game.cls){
    const nowTimestamp=Date.now();
    const normalized=normalizeHuntState(game.hunt,nowTimestamp,huntBaseEnergyForToday(new Date(nowTimestamp)));
    if(JSON.stringify(normalized)!==JSON.stringify(game.hunt||null)){
      game.hunt=normalized;
      scheduleSave();
    }
  }
  renderHuntView({document,game,stats,intoxication:currentIntoxication(),nowTimestamp:Date.now()});
}
function unequipInventoryRelic(relicId){
  let result=unequipRelic(state,relicId);
  if(result.reason==='constancy-confirmation-required'){
    if(!confirmConstancyLoss(result)) return false;
    result=unequipRelic(state,relicId,{confirmConstancyReset:true});
  }
  if(!result.ok) return false;
  applyLootSlices(result); capHeroAfterEquipmentChange(); syncPeriodicRelicMana();
  scheduleSave({type:'loot:unequip',relicId});
  document.getElementById('sheetRelicDetail').classList.remove('show');
  showSheet(document,'sheetInventory');
  showInventoryPanel('collection',true); renderHero();
  showToast('Reliquia desequipada','heal');
  return true;
}
function handleActiveRelicTap(relicId){
  const now=Date.now();
  if(pendingActiveRelicTap?.relicId===relicId&&now-pendingActiveRelicTap.at<=ACTIVE_RELIC_DOUBLE_TAP_MS){
    clearTimeout(pendingActiveRelicTap.timer);
    pendingActiveRelicTap=null;
    unequipInventoryRelic(relicId);
    return;
  }
  if(pendingActiveRelicTap) clearTimeout(pendingActiveRelicTap.timer);
  const pending={relicId,at:now,timer:null};
  pending.timer=setTimeout(()=>{
    if(pendingActiveRelicTap!==pending) return;
    pendingActiveRelicTap=null;
    if(document.getElementById('sheetInventory')?.classList.contains('show')) openRelicDetail(relicId);
  },ACTIVE_RELIC_DOUBLE_TAP_MS);
  pendingActiveRelicTap=pending;
}
function openFusionSlotPicker(slot){
  forgePickerTarget={mode:'fusion',slot};
  renderForgeRelicPicker(document,state,{...forgePickerTarget,leftId:fusionLeftId,rightId:fusionRightId});
  document.getElementById('forgeRelicPickerBg').classList.add('show');
}
function handleFilledFusionSlotTap(slot){
  const now=Date.now();
  if(pendingFusionSlotTap?.slot===slot&&now-pendingFusionSlotTap.at<=ACTIVE_RELIC_DOUBLE_TAP_MS){
    clearTimeout(pendingFusionSlotTap.timer);
    pendingFusionSlotTap=null;
    if(slot==='right') fusionRightId=null;
    else fusionLeftId=null;
    clearFusionFeedback();
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  if(pendingFusionSlotTap) clearTimeout(pendingFusionSlotTap.timer);
  const pending={slot,at:now,timer:null};
  pending.timer=setTimeout(()=>{
    if(pendingFusionSlotTap!==pending) return;
    pendingFusionSlotTap=null;
    if(document.getElementById('sheetInventory')?.classList.contains('show')) openFusionSlotPicker(slot);
  },ACTIVE_RELIC_DOUBLE_TAP_MS);
  pendingFusionSlotTap=pending;
}
function inventoryShortcutHintClass(surface){
  return `inventory-shortcut-unseen-${surface}`;
}
function aureoNoticeClass(target){
  return `aureo-notice-${target}-unseen`;
}
function aureoNoticeSeen(target){
  try{ return localStorage.getItem(`${AUREO_NOTICE_KEY}:${target}`)==='1'; }catch{}
  return false;
}
function syncAureoNotices(){
  AUREO_NOTICE_TARGETS.forEach(target=>{
    document.documentElement.classList.toggle(aureoNoticeClass(target),!aureoNoticeSeen(target));
  });
}
function dismissAureoNotice(target){
  if(!AUREO_NOTICE_TARGETS.includes(target)) return;
  try{ localStorage.setItem(`${AUREO_NOTICE_KEY}:${target}`,'1'); }catch{}
  document.documentElement.classList.remove(aureoNoticeClass(target));
}
function featureDiscoveryClass(target){return `feature-discovery-${target}-unseen`;}
function featureDiscoverySeen(target){
  try{return localStorage.getItem(`${FEATURE_DISCOVERY_KEY}:${target}`)==='1';}catch{}
  return false;
}
function syncFeatureDiscovery(){
  FEATURE_DISCOVERY_TARGETS.forEach(target=>{
    document.documentElement.classList.toggle(featureDiscoveryClass(target),!featureDiscoverySeen(target));
  });
}
function dismissFeatureDiscovery(target){
  if(!FEATURE_DISCOVERY_TARGETS.includes(target)) return;
  try{localStorage.setItem(`${FEATURE_DISCOVERY_KEY}:${target}`,'1');}catch{}
  document.documentElement.classList.remove(featureDiscoveryClass(target));
}
function dismissDiscoveryNoticesFromClick(target){
  if(!target?.closest) return;
  if(target.closest('[data-open-character-sheet]')){
    dismissFeatureDiscovery('character-entry');
    const surface={
      'view-hoy':'today',
      'view-habits':'habits',
      'view-hero':'hero'
    }[target.closest('.view')?.id];
    if(surface) dismissInventoryShortcutHint(surface);
  }
  if(target.closest('[data-character-bag]')){
    dismissFeatureDiscovery('character-bag');
    dismissFeatureDiscovery('character-bag-market');
  }
  if(target.closest('#shopTab')) dismissFeatureDiscovery('inventory-market');
  if(target.closest('[data-character-outfit]')){
    dismissFeatureDiscovery('character-hero');
    dismissFeatureDiscovery('character-backgrounds');
  }
  if(target.closest('#navHabits')) dismissFeatureDiscovery('nav-habits');
  if(target.closest('[data-habit-section="hunt"]')) dismissFeatureDiscovery('hunt-tab');
  if(target.closest('[data-open-hunt-from-hero]')){
    dismissFeatureDiscovery('hero-energy');
    dismissFeatureDiscovery('hunt-tab');
  }
  if(target.closest('[data-open-outfits]')) dismissAureoNotice('outfits');
  if(target.closest('[data-outfit-section="weave"]')) dismissAureoNotice('weave');
  if(target.closest('[data-outfit-section="frames"]')) dismissAureoNotice('backgrounds');
}
function inventoryShortcutHintSeen(surface){
  if(FORCE_INVENTORY_SHORTCUT_HINT&&!dismissedInventoryShortcutHints.has(surface)) return false;
  try{ return localStorage.getItem(`${INVENTORY_SHORTCUT_HINT_KEY}:${surface}`)==='1'; }catch{}
  return false;
}
function syncInventoryShortcutHint(){
  INVENTORY_SHORTCUT_SURFACES.forEach(surface=>{
    document.documentElement.classList.toggle(inventoryShortcutHintClass(surface),!inventoryShortcutHintSeen(surface));
  });
}
function dismissInventoryShortcutHint(surface){
  if(!INVENTORY_SHORTCUT_SURFACES.includes(surface)) return;
  dismissedInventoryShortcutHints.add(surface);
  try{ localStorage.setItem(`${INVENTORY_SHORTCUT_HINT_KEY}:${surface}`,'1'); }catch{}
  document.documentElement.classList.remove(inventoryShortcutHintClass(surface));
}
function restartInventoryShortcutHint(surface){
  if(!INVENTORY_SHORTCUT_SURFACES.includes(surface)||inventoryShortcutHintSeen(surface)) return;
  const className=inventoryShortcutHintClass(surface);
  document.documentElement.classList.remove(className);
  void document.documentElement.offsetWidth;
  document.documentElement.classList.add(className);
}
function openInventoryFromShortcut(){
  dismissInventoryShortcutHint('today');
  openInventory();
}
syncInventoryShortcutHint();
syncAureoNotices();
syncFeatureDiscovery();
document.addEventListener('click',event=>dismissDiscoveryNoticesFromClick(event.target),true);
let inventoryPositionFrame=0;
function scheduleInventorySheetPosition(){
  if(!document.getElementById('sheetInventory')?.classList.contains('show')) return;
  cancelAnimationFrame(inventoryPositionFrame);
  inventoryPositionFrame=requestAnimationFrame(positionInventorySheetFromForge);
}
window.addEventListener('resize',scheduleInventorySheetPosition);
window.visualViewport?.addEventListener('resize',scheduleInventorySheetPosition);
function openRelicDetail(relicId){
  if(!renderRelicDetail(document,state,relicId)) return;
  showSheet(document,'sheetRelicDetail');
}
async function showPendingLootNotice(){
  if(lootNoticeOpening||document.getElementById('lootNoticeBg').classList.contains('show')) return;
  if(document.getElementById('weekResultBg').classList.contains('show')) return;
  const notice=pendingLootNotice(state);
  if(!notice) return;
  lootNoticeOpening=true;
  try{
    handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));
    renderLootNotice(document,state,notice);
    activeLootNoticeId=notice.id;
    document.getElementById('lootNoticeBg').classList.add('show');
  }catch(error){
    console.error('No se pudo guardar el botín antes del aviso',error);
    showToast('No se pudo asegurar el guardado del botín','dmg');
  }finally{lootNoticeOpening=false;}
}
function queueLootNotice(){
  window.setTimeout(()=>void showPendingLootNotice(),0);
}
function resetPioneerRewardModal(){
  const thanks=document.getElementById('pioneerRewardThanks');
  const reveal=document.getElementById('pioneerRewardReveal');
  const accept=document.getElementById('pioneerRewardAccept');
  if(thanks) thanks.hidden=false;
  if(reveal) reveal.hidden=true;
  if(accept) accept.disabled=false;
}
function shouldDisplayPioneerReward(){
  return shouldOfferPioneerReward(state)||Boolean(
    LOCAL_PIONEER_REWARD_PREVIEW&&state.onboarded&&state.game?.cls
  );
}
function showPendingPioneerReward(){
  pioneerRewardTimer=null;
  if(pioneerRewardOpening||!shouldDisplayPioneerReward()) return;
  if(returnSplashPlaying||document.querySelector('.modal-bg.show:not(#pioneerRewardBg)')){
    pioneerRewardTimer=window.setTimeout(showPendingPioneerReward,500);
    return;
  }
  pioneerRewardOpening=true;
  resetPioneerRewardModal();
  const classId=state.game?.cls||'knight';
  const outfitImage=document.getElementById('pioneerRewardOutfitImage');
  if(outfitImage) outfitImage.src=`outfits/beta-tester/${classId}_happy.webp`;
  document.getElementById('pioneerRewardBg')?.classList.add('show');
  pioneerRewardOpening=false;
}
function queuePioneerReward(delay=SPLASH_MIN_VISIBLE_MS+SPLASH_FADE_MS+120){
  clearTimeout(pioneerRewardTimer);
  if(!shouldDisplayPioneerReward()) return;
  pioneerRewardTimer=window.setTimeout(showPendingPioneerReward,delay);
}
function resetBetaTesterRewardModal(){
  const thanks=document.getElementById('betaTesterRewardThanks');
  const reveal=document.getElementById('betaTesterRewardReveal');
  const accept=document.getElementById('betaTesterRewardAccept');
  if(thanks) thanks.hidden=false;
  if(reveal) reveal.hidden=true;
  if(accept) accept.disabled=false;
}
function pendingDisplayBetaTesterReward(){
  if(LOCAL_BETA_TESTER_REWARD_PREVIEW_ID==='3'&&state.onboarded&&state.game?.cls){
    return {id:'pioneer-beta-reward-v3',title:'El color de los pioneros',intro:'Tu huella ya forma parte de Freedom. Recibe recursos para descubrir la Tinta Arcana y el Santuario del Crisol.',coins:192,arcaneFibers:0,arcaneInks:20,energy:0,frameId:'welder-beta',grantsFrame:false};
  }
  const pending=pendingBetaTesterReward(state);
  if(pending) return pending;
  if(!LOCAL_BETA_TESTER_REWARD_PREVIEW||!state.onboarded||!state.game?.cls) return null;
  return {id:'pioneer-beta-reward-v3',title:'El color de los pioneros',intro:'Tu huella ya forma parte de Freedom. Recibe recursos para descubrir la Tinta Arcana y el Santuario del Crisol.',coins:192,arcaneFibers:0,arcaneInks:20,energy:0,frameId:'welder-beta',grantsFrame:false};
}
function showPendingBetaTesterReward(){
  betaTesterRewardTimer=null;
  const reward=pendingDisplayBetaTesterReward();
  if(betaTesterRewardOpening||!reward) return;
  if(returnSplashPlaying||document.querySelector('.modal-bg.show:not(#betaTesterRewardBg)')){
    betaTesterRewardTimer=window.setTimeout(showPendingBetaTesterReward,500);
    return;
  }
  if(LOCAL_BETA_TESTER_REWARD_PREVIEW_ID==='3'){
    const ownedFrames={...(state.game?.frames?.owned||{})};
    delete ownedFrames['welder-beta'];
    state.game={...state.game,frame:'original',frames:{...(state.game?.frames||{}),owned:ownedFrames}};
  }
  betaTesterRewardOpening=true;
  resetBetaTesterRewardModal();
  const title=document.getElementById('betaTesterRewardTitle');
  const intro=document.getElementById('betaTesterRewardIntro');
  const heroImage=document.getElementById('betaTesterRewardHeroImage');
  const isThirdReward=reward.id==='pioneer-beta-reward-v3';
  if(title) title.textContent=reward.title;
  if(intro) intro.textContent=reward.intro;
  const kicker=document.getElementById('betaTesterRewardKicker');
  const revealTitle=document.getElementById('betaTesterRewardRevealTitle');
  const frameImage=document.getElementById('betaTesterRewardFrameImage');
  const frameName=document.getElementById('betaTesterRewardFrameName');
  const frameCard=document.getElementById('betaTesterRewardFrameCard');
  if(kicker) kicker.textContent=`RECOMPENSA BETA TESTER · ${isThirdReward?'03':'02'}`;
  if(revealTitle) revealTitle.textContent=reward.title;
  if(frameImage) frameImage.src=isThirdReward?'hero_background/welder_beta_forge.webp':'hero_background/beta_tester_bg_final.webp';
  if(frameName) frameName.textContent=isThirdReward?'Santuario del Crisol':'Corazón de Freedom';
  if(frameCard) frameCard.hidden=isThirdReward;
  const frameStatus=document.getElementById('betaTesterRewardFrameStatus');
  if(frameStatus) frameStatus.textContent=isThirdReward?'FONDO CONMEMORATIVO · TIEMPO LIMITADO':'FONDO EXCLUSIVO';
  if(heroImage) heroImage.src=`outfits/${isThirdReward?'welder-beta':'beta-tester'}/${state.game?.cls||'knight'}_happy.webp`;
  [['betaTesterRewardCoins',reward.coins],['betaTesterRewardFibers',reward.arcaneFibers],['betaTesterRewardEnergy',reward.energy],['betaTesterRewardInks',reward.arcaneInks]].forEach(([id,amount])=>{
    const item=document.getElementById(id);
    if(item) item.hidden=!Number(amount);
  });
  [['betaTesterRewardCoinsAmount',reward.coins],['betaTesterRewardFibersAmount',reward.arcaneFibers],['betaTesterRewardEnergyAmount',reward.energy],['betaTesterRewardInksAmount',reward.arcaneInks]].forEach(([id,amount])=>{
    const value=document.getElementById(id); if(value) value.textContent=`+${Number(amount)||0}`;
  });
  document.querySelector('.beta-tester-reward-items')?.classList.toggle('beta-tester-reward-items--third',isThirdReward);
  const inkSource=document.getElementById('betaTesterRewardInkSource');
  if(inkSource) inkSource.hidden=!Number(reward.arcaneInks);
  document.getElementById('betaTesterRewardBg')?.classList.add('show');
  betaTesterRewardOpening=false;
}
function queueBetaTesterReward(delay=SPLASH_MIN_VISIBLE_MS+SPLASH_FADE_MS+220){
  clearTimeout(betaTesterRewardTimer);
  if(!pendingDisplayBetaTesterReward()) return;
  betaTesterRewardTimer=window.setTimeout(showPendingBetaTesterReward,delay);
}
async function showPendingFiberCatchup(){
  fiberCatchupTimer=null;
  const notice=pendingFiberCatchupNotice(state);
  if(fiberCatchupOpening||!notice) return;
  if(returnSplashPlaying||document.querySelector('.modal-bg.show:not(#fiberCatchupBg)')){
    fiberCatchupTimer=window.setTimeout(()=>void showPendingFiberCatchup(),500);
    return;
  }
  fiberCatchupOpening=true;
  try{
    handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));
    const amount=document.getElementById('fiberCatchupAmount');
    const fiberItem=document.getElementById('fiberCatchupFiberItem');
    const inkAmount=document.getElementById('fiberCatchupInkAmount');
    const inkItem=document.getElementById('fiberCatchupInkItem');
    const message=document.getElementById('fiberCatchupMessage');
    if(amount) amount.textContent=`+${notice.arcaneFibers}`;
    if(fiberItem) fiberItem.hidden=!notice.arcaneFibers;
    if(inkAmount) inkAmount.textContent=`+${notice.arcaneInks}`;
    if(inkItem) inkItem.hidden=!notice.arcaneInks;
    if(message) message.textContent=notice.bossCount===1
      ? 'Hemos reconocido un jefe que ya habías derrotado y recuperado su recompensa.'
      : `Hemos reconocido ${notice.bossCount} jefes que ya habías derrotado y recuperado sus recompensas.`;
    document.getElementById('fiberCatchupBg')?.classList.add('show');
  }catch(error){
    console.error('No se pudo asegurar la entrega retroactiva de recursos',error);
    fiberCatchupTimer=window.setTimeout(()=>void showPendingFiberCatchup(),1000);
  }finally{fiberCatchupOpening=false;}
}
function queueFiberCatchup(delay=SPLASH_MIN_VISIBLE_MS+SPLASH_FADE_MS+120){
  clearTimeout(fiberCatchupTimer);
  if(!pendingFiberCatchupNotice(state)) return;
  fiberCatchupTimer=window.setTimeout(()=>void showPendingFiberCatchup(),delay);
}
function progressionUpdateAcknowledged(){
  return Boolean(state.game?.updateNotices?.[PROGRESSION_UPDATE_NOTICE_ID]?.acknowledgedAt);
}
function shouldDisplayProgressionUpdate(){
  if(LOCAL_PROGRESSION_UPDATE_PREVIEW) return Boolean(state.onboarded&&state.game?.cls);
  return Boolean(state.onboarded&&state.game?.cls&&!progressionUpdateAcknowledged());
}
function showPendingProgressionUpdate(){
  progressionUpdateTimer=null;
  if(progressionUpdateOpening||!shouldDisplayProgressionUpdate()) return;
  if(returnSplashPlaying||document.querySelector('.modal-bg.show:not(#progressionUpdateBg)')){
    progressionUpdateTimer=window.setTimeout(showPendingProgressionUpdate,500);
    return;
  }
  progressionUpdateOpening=true;
  const stats=gameStats();
  const sheet=attributeSheet({classId:state.game.cls,level:stats.lvl,allocation:state.game.attributes});
  const hunt=normalizeHuntState(state.game.hunt,Date.now(),huntBaseEnergyForToday(new Date()));
  document.getElementById('progressionUpdateLevel').textContent=`NIVEL ${stats.lvl}`;
  document.getElementById('progressionUpdatePoints').textContent=String(sheet.availablePoints);
  document.getElementById('progressionUpdateEnergy').textContent=`${hunt.energy}/${hunt.baseEnergy+hunt.bonusEnergyEarned}`;
  document.getElementById('progressionUpdateBg')?.classList.add('show');
  progressionUpdateOpening=false;
}
function queueProgressionUpdate(delay=SPLASH_MIN_VISIBLE_MS+SPLASH_FADE_MS+120){
  clearTimeout(progressionUpdateTimer);
  if(!shouldDisplayProgressionUpdate()) return;
  progressionUpdateTimer=window.setTimeout(showPendingProgressionUpdate,delay);
}
function acknowledgeActiveLootNotice(){
  if(!activeLootNoticeId) return;
  applyLootSlices(acknowledgeLootNotice(state,activeLootNoticeId));
  activeLootNoticeId=null;
  document.getElementById('lootNoticeBg').classList.remove('show');
  scheduleSave({type:'loot:notice-acknowledged'});
}
function capHeroAfterEquipmentChange(){
  if(!state.game?.cls) return;
  state.game.hp=capHp(state.game.hp||0);
  state.game.mp=capMp(state.game.mp||0);
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

function showHeroSkillsPanel(){
  const bookBody=document.getElementById('skillsBody');
  renderSkillsSheet();
  bookBody.scrollTop=0;
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
  if(editingKey<todayKey()){
    if(completedDayForKey(editingKey)){
      awardRelicDayXp(editingKey);
      applyClassDayRewards(editingKey,true);
    }
    else revokeRelicDayXp(editingKey);
    scheduleSave({type:'relic:historical-day-sync',day:editingKey});
    renderAll();
  }
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
  const recoveredMana=rewards.mana>0?recoverMana(rewards.mana):0;
  (state.game.cigDmg=state.game.cigDmg||[]).push({
    d:r.dmg,
    p:r.perfect,
    x:rewards.xp,
    m:recoveredMana,
    h:r.healed,
    r:r.consumesRoots,
    sh:r.consumesShield,
    lr:r.relicReduction||0,
    la:r.relicActivationKey||null,
    bl:r.dmg>0||r.shielded
      ? recordBossCounterattack({
          damage:r.dmg,
          key:k,
          kind:'smoke',
          shielded:r.shielded
        })
      : null
  });
  setDay(k,d.c+1,d.p,Date.now(),undefined,(d.s||0)+(r.perfect?1:0),{
    type:'cigarette:add',day:k,count:d.c+1
  });
  if(rewards.xp>0&&state.days[k]){
    state.days[k].sx=(state.days[k].sx||0)+rewards.xp;
    scheduleSave(); renderHero();
  }
  const death=triggerHeroDeath({
    cause:'El jefe semanal contraatacó al fumar.',
    source:'boss-counterattack'
  });
  if(death) showToast('Tu héroe ha caído','dmg');
  else if(r.shielded) showToast('🛡 Escudo absorbió el ataque del jefe','heal');
  else if(r.dmg>0) showToast('⚔ El jefe ataca · −'+r.dmg+' de vida','dmg');
  else if(r.perfect) showToast('🎯 −'+(d.s<3?1:0)+' jefe · +'+rewards.xp+' XP · +'+recoveredMana+' 💧','heal');
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
    const damageEntry=arr.pop();
    const undo=smokeUndoEffects(damageEntry);
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
    restoreRelicActivation(damageEntry?.la);
    removeBossCounterattack(damageEntry?.bl);
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
    const maxes=heroMaxes();
    const reward=pillCompletionReward({
      maxHp:maxes.maxHp,
      maxMp:maxes.maxMp
    });
    const hpBefore=state.game.hp;
    const mpBefore=state.game.mp||0;
    state.game.hp=capHp(hpBefore+reward.healing);
    recoverMana(reward.mana);
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
  const relicDamage=shielded
    ? {damage:0,reduction:0,activationKey:null}
    : applyFirstDamageRelic(BEER_DAMAGE,k);
  const bd=relicDamage.damage;
  if(bd>0&&g.hp!==undefined) g.hp=Math.max(0,g.hp-bd);
  (g.beerDmg=g.beerDmg||[]).push({
    d:bd,i:added.effect.id,sh:shielded,
    lr:relicDamage.reduction,la:relicDamage.activationKey
  });
  scheduleSave();
  setDay(k,d.c,d.p,undefined,(d.b||0)+1,undefined,{
    type:'beer:add',day:k,count:(d.b||0)+1
  });
  const death=triggerHeroDeath({
    cause:'El alcohol agotó las fuerzas de tu héroe.',
    source:'alcohol'
  });
  if(death) showToast('Tu héroe ha caído','dmg');
  else showToast(shielded
    ? '🛡 Daño bloqueado · Borrachera '+added.status.level+'%'
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
  restoreRelicActivation(beerEntry?.la);
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
function completedDailyHabitCount(key){
  const normalized=normalizeHabitState(state.habits);
  const periodKey=`d:${key}`;
  return normalized.items.filter(habit=>{
    if(habit.active===false||habit.frequency!=='daily') return false;
    const count=Math.max(0,Number(normalized.entries[`${habit.id}|${periodKey}`]?.count)||0);
    return count>=Math.max(1,Number(habit.target)||1);
  }).length;
}

function applyClassDayRewards(key,completed){
  const g=state.game;
  if(!g?.cls) return '';
  const lvl=gameStats().lvl;
  const rewards=g.powerProgress=g.powerProgress||{};
  rewards.dayRewards=rewards.dayRewards||{};
  if(rewards.dayRewards[key]) return '';
  if(!completed) return '';
  const week=Math.max(0,weekIndexOf(parseKey(key)));
  const habitCount=completedDailyHabitCount(key);
  const {maxHp}=heroMaxes();
  const notice=[];
  const record={xp:0,coins:0};
  if(g.cls==='knight'){
    if(lvl>=5&&heroArmor()>=1){
      const usedKey=`knight-xp:${week}`;
      const used=Number(rewards[usedKey])||0;
      if(used<5){ rewards[usedKey]=used+1; record.xp+=4; }
    }
    if(lvl>=12&&habitCount>=3){
      const usedKey=`knight-coins:${week}`;
      const used=Number(rewards[usedKey])||0;
      if(used<4){ rewards[usedKey]=used+1; record.coins+=1; }
    }
  }else if(g.cls==='paladin'){
    const before=g.hp;
    g.hp=capHp(g.hp+Math.max(1,Math.round(maxHp*0.05)));
    if(g.hp>before) notice.push(`+${g.hp-before} ♥ Flecha Bendita`);
    if(lvl>=5&&habitCount>=2){
      const usedKey=`paladin-xp:${week}`;
      const used=Number(rewards[usedKey])||0;
      if(used<5){ rewards[usedKey]=used+1; record.xp+=4; }
    }
    if(lvl>=12){
      const daysKey=`paladin-days:${week}`;
      const days=rewards[daysKey]=[...new Set([...(rewards[daysKey]||[]),key])].sort();
      if(days.length===3||days.length===5) record.coins+=2;
    }
  }else if(g.cls==='druid'){
    const before=g.hp;
    g.hp=capHp(g.hp+Math.max(1,Math.round(maxHp*0.08)));
    if(g.hp>before) notice.push(`+${g.hp-before} ♥ Savia Viva`);
    if(lvl>=12){
      const dateConfig=journeyConfigForDate(state.config,parseKey(key));
      const day=getDay(key);
      const tracksPills=dateConfig.takesPills!==false;
      const tracksBeer=dateConfig.tracksBeer!==false;
      const pillsOk=!tracksPills||(day.p||0)>=(dateConfig.pillsGoal||3);
      const beerOk=!tracksBeer||(day.b||0)===0;
      const usedKey=`druid-coins:${week}`;
      const used=Number(rewards[usedKey])||0;
      if((tracksPills||tracksBeer)&&pillsOk&&beerOk&&used<4){
        rewards[usedKey]=used+1;
        record.coins+=1;
      }
    }
  }
  const judgment=rewards.judgment;
  if(g.cls==='paladin'&&judgment&&judgment.day===key&&!judgment.rewarded&&
      judgment.completedIds.length===judgment.habitIds.length){
    judgment.rewarded=true;
    record.xp+=5;
  }
  if(record.xp){ g.bonusXp=(g.bonusXp||0)+record.xp; notice.push(`+${record.xp} XP`); }
  if(record.coins){ state.economy.coins+=record.coins; notice.push(`+${record.coins} 🪙`); }
  rewards.dayRewards[key]=record;
  return notice.length?' · '+notice.join(' · '):'';
}

function applySmokeFreeDayRewards(key,status){
  if(status!==SMOKE_FREE_STATUS_SUCCESS||!state.game?.cls) return '';
  ensureHero();
  const g=state.game;
  const rewards=g.smokeFreeRewards=g.smokeFreeRewards||{};
  rewards.healedDays=rewards.healedDays||[];
  if(rewards.healedDays.includes(key)) return '';
  const relicXp=awardRelicDayXp(key);
  rewards.healedDays.push(key);
  const classNotice=applyClassDayRewards(key,true);
  return classNotice+
    (relicXp>0?' · +'+relicXp+' XP reliquia':'');
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
  const controlledFailureLogId=`controlled-failure:${key}`;
  if(status===SMOKE_FREE_STATUS_PENDING){
    const next={...record};
    delete next.sf;
    state.days[key]=next;
    removeBossCounterattack(controlledFailureLogId);
    revokeRelicDayXp(key);
    showToast('El día vuelve a estar pendiente','heal');
  }else{
    const maxHpBefore=heroMaxes().maxHp;
    state.days[key]={...record,sf:status};
    const rewardNotice=applySmokeFreeDayRewards(key,status);
    if(status!==SMOKE_FREE_STATUS_SUCCESS&&state.game){
      revokeRelicDayXp(key);
      ensureHero();
      state.game.hpT=Date.now();
    }
    const forbiddenControlledSmoke=isControlledMode(state.config)
      && !isControlledSmokingDay(state.config,logicalToday)
      && status===SMOKE_FREE_STATUS_SMOKED;
    if(forbiddenControlledSmoke&&state.game){
      ensureHero();
      state.game.hp=Math.min(state.game.hp,heroMaxes().maxHp);
      state.game.hpT=Date.now();
      if(record.sf!==SMOKE_FREE_STATUS_SMOKED){
        recordBossCounterattack({
          id:controlledFailureLogId,
          damage:Math.max(0,maxHpBefore-heroMaxes().maxHp),
          key,
          kind:'controlled-failure',
          unit:'VIDA MÁX.'
        });
      }
    }else{
      removeBossCounterattack(controlledFailureLogId);
    }
    showToast(
      status===SMOKE_FREE_STATUS_SUCCESS
        ? (isControlledMode(state.config)
            ? '✓ Día · −25 HP jefe · XP'
            : '✓ Sin fumar · −25 HP jefe · XP'+rewardNotice)
        : forbiddenControlledSmoke
          ? 'Fallo · −15% vida máx. · mañana 2/10 energía'
          : 'Día registrado · continúa mañana',
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
  showSheet(document,'sheetSet');
}
const navigation=bindNavigation({
  document,
  window,
  onOpenSettings:openAjustes,
  onOpenInventory:openInventoryFromShortcut,
  onOpenCharacterSheet:openCharacterSheet,
  onOpenRecoveries:openRecoveryModal,
  onHabits:renderHabits,
  onCalendar:()=>{
    calCursor=currentDayDate();
    renderCal();
    renderWeeks();
  }
});
document.getElementById('navHero').addEventListener('click',()=>{
  renderHero();
});
Object.entries({navHoy:'today',navHabits:'habits',navHero:'hero'}).forEach(([id,surface])=>{
  document.getElementById(id)?.addEventListener('click',()=>{
    restartInventoryShortcutHint(surface);
    if(id==='navHabits') dismissFeatureDiscovery('nav-habits');
  });
});
function switchView(viewId,buttonId){
  navigation.switchView(viewId,buttonId);
  const surface={
    'view-hoy':'today',
    'view-habits':'habits',
    'view-hero':'hero'
  }[viewId];
  if(surface) restartInventoryShortcutHint(surface);
}

let pendingHuntDifficultyId=null;
let pendingHuntRegionId=null;
let pendingHuntAutoUsePotions=true;

function huntPotentialRewardsMarkup(difficulty,region){
  const dropRules=huntDropRules(region?.id,difficulty?.id);
  const fiberMax=Math.max(0,Number(dropRules?.fiberAmount?.[1])||0);
  const inkMax=Math.max(0,Number(dropRules?.inkAmount?.[1])||0);
  const rewardMultiplier=Math.max(1,Number(region?.rewardMultiplier)||1);
  const xp=Math.round(difficulty.xp*rewardMultiplier);
  const gold=difficulty.gold.map(value=>Math.round(value*rewardMultiplier));
  return [
    `✦ ${xp} XP`,
    `${resourceIcon('coin')} ${gold[0]}–${gold[1]}`,
    fiberMax?`${resourceIcon('arcane-fiber')} 0–${fiberMax}`:'',
    inkMax?`${resourceIcon('arcane-ink')} 0–${inkMax}`:'',
    difficulty.id==='hard'?`${resourceIcon('boss-blood')} 0–1`:'',
  ].filter(Boolean).join(' · ');
}

function openHuntResultModal(report){
  const region=HUNT_REGIONS[report?.regionId]||HUNT_REGIONS['fields-of-mist'];
  const won=Boolean(report?.won);
  const defeatedEnemies=Math.max(0,Number(report?.defeatedEnemies)||0);
  const partial=!won&&defeatedEnemies>0;
  const recoveredHp=Math.max(0,Number(report?.recovery?.hp)||0);
  const recoveredMana=Math.max(0,Number(report?.recovery?.mana)||0);
  document.getElementById('huntResultTitle').textContent=won?'Cacería superada':partial?'Avance parcial':'Cacería fallida';
  document.getElementById('huntResultMessage').textContent=won
    ? `${region.victoryMessage}. Tu héroe recupera ${recoveredHp} de vida y ${recoveredMana} de maná antes de regresar con el botín.`
    : partial
      ? `Tu héroe tuvo que retirarse tras vencer ${defeatedEnemies}/3 enemigos. Conserva su botín y recupera ${recoveredHp} de vida${recoveredMana>0?` y ${recoveredMana} de maná`:''} antes de regresar.`
      : 'Tu héroe tuvo que retirarse sin derrotar enemigos. No obtiene recuperación de salida.';
  document.getElementById('huntResultSummary').innerHTML=huntResultSummaryMarkup(report);
  document.getElementById('huntResultRewards').innerHTML=huntResultRewardsMarkup(report?.rewards);
  document.getElementById('huntResultBg').classList.add('show');
}

function closeHuntConfirmation(){
  pendingHuntDifficultyId=null;
  pendingHuntRegionId=null;
  pendingHuntAutoUsePotions=true;
  document.getElementById('huntConfirmBg').classList.remove('show');
}

function openHuntConfirmation(difficultyId,regionId='fields-of-mist'){
  const difficulty=HUNT_DIFFICULTIES[difficultyId];
  const region=HUNT_REGIONS[regionId];
  if(!difficulty||!region) return;
  const hunt=normalizeHuntState(state.game.hunt,Date.now());
  const heroLevel=gameStats().lvl;
  if(hunt.active){showToast('Ya hay una cacería en curso','bad');return;}
  const requiredLevel=huntDifficultyMinLevel(region.id,difficulty.id);
  if(heroLevel<requiredLevel){showToast(`Necesitas nivel ${requiredLevel}`,'bad');return;}
  if(hunt.energy<difficulty.energyCost){showToast('No tienes energía suficiente','bad');return;}
  pendingHuntDifficultyId=difficultyId;
  pendingHuntRegionId=region.id;
  pendingHuntAutoUsePotions=true;
  const potions=normalizePotionState(state.inventory?.potions);
  const fortuneActive=potions.active?.id==='fortune'&&potions.active.endsAt>Date.now()?potions.active:null;
  const fortuneUsage=fortuneActive?potionFortuneBonusUsage({
    habitState:state.habits,
    economy:state.economy,
    dayKey:fortuneActive.dayKey
  }):null;
  const lifePotions=Math.max(0,Number(potions.owned.life)||0);
  const manaPotions=Math.max(0,Number(potions.owned.mana)||0);
  const hasCombatPotions=lifePotions+manaPotions>0;
  document.getElementById('huntConfirmTitle').textContent=`¿Entrar en ${region.name}?`;
  document.getElementById('huntConfirmBody').innerHTML=`<div class="hunt-confirm-summary">
    <div><span>Dificultad</span><b>${difficulty.name}</b></div>
    <div><span>Coste</span><b><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span>${difficulty.energyCost} energía</b></div>
    <div><span>Duración</span><b>${difficulty.durationMinutes} ${difficulty.durationMinutes === 1 ? 'minuto' : 'minutos'}</b></div>
    <div class="hunt-confirm-rewards"><span>Recompensas posibles</span><b>${huntPotentialRewardsMarkup(difficulty,region)}</b></div>
  </div>
  ${fortuneActive?`<div class="hunt-fortune-notice"><b>Poción de Fortuna activa</b><span>+50% del oro obtenido · hasta +${fortuneUsage.remaining} de oro disponible</span></div>`:''}
  <label class="hunt-potion-toggle${hasCombatPotions?'':' is-empty'}">
    <input type="checkbox" id="huntAutoPotions" ${hasCombatPotions?'checked':'disabled'}>
    <span class="hunt-potion-toggle-control" aria-hidden="true"></span>
    <span class="hunt-potion-toggle-copy"><b>Usar pociones automáticamente</b><small>${hasCombatPotions?`Vida ×${lifePotions} · Maná ×${manaPotions} · máximo una de cada tipo por enemigo`:'No tienes pociones de Vida ni de Maná en el Bolso'}</small></span>
  </label>`;
  document.getElementById('huntConfirmBg').classList.add('show');
}

function confirmHuntStart(){
  if(!pendingHuntDifficultyId||!pendingHuntRegionId) return;
  const difficultyId=pendingHuntDifficultyId;
  const regionId=pendingHuntRegionId;
  pendingHuntAutoUsePotions=Boolean(document.getElementById('huntAutoPotions')?.checked);
  const autoUsePotions=pendingHuntAutoUsePotions;
  closeHuntConfirmation();
  ensureHero();
  const stats=gameStats();
  const nowTimestamp=Date.now();
  const activePotion=normalizePotionState(state.inventory?.potions).active;
  const fortune=activePotion?.id==='fortune'&&activePotion.endsAt>nowTimestamp
    ? {dayKey:activePotion.dayKey}
    : null;
  const result=startHunt({
    hunt:state.game.hunt,
    regionId,
    difficultyId,
    level:stats.lvl,
    currentHp:state.game.hp,
    maxHp:stats.maxHp,
    currentMana:state.game.mp,
    maxMana:stats.maxMp,
    relicBonuses:relicBonuses(),
    autoUsePotions,
    fortune,
    nowTimestamp
  });
  if(!result.ok){
    showToast(result.reason==='insufficient-energy'?'No tienes energía suficiente':result.reason==='level-locked'?`Necesitas nivel ${result.requiredLevel}`:'Ya hay una cacería en curso','bad');
    return;
  }
  state.game.hunt=result.hunt;
  scheduleSave({type:'hunt:start',regionId,difficultyId});
  renderHunt();
  const durationMinutes=HUNT_DIFFICULTIES[difficultyId].durationMinutes;
  showToast(`Cacería iniciada · vuelve en ${durationMinutes} ${durationMinutes===1?'minuto':'minutos'}`,'heal');
}

document.getElementById('huntConfirmCancel').addEventListener('click',closeHuntConfirmation);
document.getElementById('huntConfirmAccept').addEventListener('click',confirmHuntStart);
document.getElementById('huntConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='huntConfirmBg') closeHuntConfirmation();
});
document.getElementById('huntResultClose').addEventListener('click',()=>{
  document.getElementById('huntResultBg').classList.remove('show');
});
document.getElementById('huntResultFullReport').addEventListener('click',()=>{
  document.getElementById('huntResultBg').classList.remove('show');
  window.requestAnimationFrame(()=>{
    document.querySelector('.hunt-report')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
});
document.getElementById('huntResultBg').addEventListener('click',event=>{
  if(event.target.id==='huntResultBg') event.currentTarget.classList.remove('show');
});
document.getElementById('deathContinue').addEventListener('click',()=>{
  const g=state.game;
  if(g) g.deathModalPending=false;
  document.getElementById('deathBg').classList.remove('show');
  scheduleSave({type:'hero:death-acknowledged',deathId:g?.deathNotice?.id||null});
  renderAll();
  if(pendingPostDeathHuntReport){
    const report=pendingPostDeathHuntReport;
    pendingPostDeathHuntReport=null;
    openHuntResultModal(report);
  }else{
    showPendingWeekResult();
  }
});

document.getElementById('view-habits').addEventListener('click',event=>{
  if(!state.game?.cls) return;
  if(event.target.closest('[data-open-character-sheet]')){
    openCharacterSheet();
    return;
  }
  const huntRegionButton=event.target.closest('[data-open-hunt-region]');
  if(huntRegionButton){
    const huntContent=document.getElementById('huntContent');
    huntContent.dataset.huntScreen='region';
    huntContent.dataset.huntRegion=huntRegionButton.dataset.openHuntRegion||'fields-of-mist';
    renderHunt();
    return;
  }
  if(event.target.closest('[data-back-hunt-map]')){
    document.getElementById('huntContent').dataset.huntScreen='map';
    renderHunt();
    return;
  }
  const monster=event.target.closest('[data-hunt-monster]');
  if(monster&&renderHuntMonsterDetail({document,enemyId:monster.dataset.huntMonster})){
    showSheet(document,'sheetHuntMonster');
    return;
  }
  const startButton=event.target.closest('[data-start-hunt]');
  if(startButton){
    openHuntConfirmation(startButton.dataset.startHunt,startButton.dataset.huntRegion);
    return;
  }
  if(event.target.closest('[data-resolve-hunt]')){
    ensureHero();
    const stats=gameStats();
    const activeHuntFortune=state.game.hunt?.active?.fortune;
    const fortuneUsage=activeHuntFortune?.dayKey?potionFortuneBonusUsage({
      habitState:state.habits,
      economy:state.economy,
      dayKey:activeHuntFortune.dayKey
    }):null;
    const result=resolveHunt({
      hunt:state.game.hunt,
      classId:state.game.cls,
      level:stats.lvl,
      allocation:state.game.attributes,
      potions:state.inventory?.potions,
      fortuneBonusRemaining:fortuneUsage?.remaining||0,
      nowTimestamp:Date.now()
    });
    if(!result.ok){showToast('La expedición todavía no ha terminado','bad');return;}
    state.game.hunt=result.hunt;
    state.inventory={...(state.inventory||{}),potions:result.potions};
    state.game.hp=Math.max(0,Math.round(stats.maxHp*(result.report.heroHp/Math.max(1,result.report.heroMaxHp))));
    state.game.mp=Math.max(0,Math.round(stats.maxMp*(result.report.heroMana/Math.max(1,result.report.heroMaxMana))));
    state.game.bonusXp=Math.max(0,Number(state.game.bonusXp)||0)+result.report.rewards.xp;
    state.economy=state.economy||{coins:0,bossBlood:0,arcaneFibers:0,transactions:[]};
    state.economy.coins=Math.max(0,Number(state.economy.coins)||0)+result.report.rewards.gold;
    state.economy.arcaneFibers=Math.max(0,Number(state.economy.arcaneFibers)||0)+result.report.rewards.arcaneFibers;
    state.economy.arcaneInks=Math.max(0,Number(state.economy.arcaneInks)||0)+result.report.rewards.arcaneInks;
    state.economy.bossBlood=Math.max(0,Number(state.economy.bossBlood)||0)+result.report.rewards.bossBlood;
    state.economy.transactions=Array.isArray(state.economy.transactions)?state.economy.transactions:[];
    state.economy.transactions.push({
      id:`hunt:${result.report.id}`,
      type:'hunt',
      at:Date.now(),
      fortuneDayKey:result.report.fortune?.dayKey||null,
      ...result.report.rewards
    });
    state.economy.transactions=state.economy.transactions.slice(-200);
    const death=result.report.heroDied
      ? triggerHeroDeath({
          cause:`${[...result.report.encounters].reverse().find(encounter=>!encounter.won)?.name||'La Cacería'} derrotó a tu héroe.`,
          source:'hunt'
        })
      : null;
    scheduleSave({type:'hunt:resolve',won:result.report.won});
    renderHunt();
    if(death) pendingPostDeathHuntReport=result.report;
    else openHuntResultModal(result.report);
  }
});

document.getElementById('view-habits').addEventListener('keydown',event=>{
  if(!event.target.closest('[data-open-character-sheet]')||!['Enter',' '].includes(event.key)) return;
  event.preventDefault();
  openCharacterSheet();
});

window.setInterval(()=>{
  if(document.getElementById('view-habits')?.classList.contains('active')&&habitViewSection==='hunt') updateHuntCountdown(document,Date.now());
},1000);

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
    const recoveries=await store.listRecoveries(ACTIVE_STORAGE_KEY);
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
    const recovered=await store.recoveryState(revision,ACTIVE_STORAGE_KEY,source);
    if(!recovered) throw new Error('La copia ya no está disponible');
    store.authorizeDestructiveSave('recovery');
    state=mergeState(state,recovered);
    state={...state,...initializeForgeSeed(state)};
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
let habitEditorMode='habit';
let habitViewFilter='all';
let habitViewSection='habits';
let habitDraftDifficulty='easy';
let habitDraftFrequency='daily';
let habitDraftTarget=1;
let habitDraftRepeatable=false;
let pendingCompletedTodoId=null;
let habitEditorCloseTimer=null;
let habitEditorViewportHeight=null;
let habitEditorResizeHandler=null;

function applyClassHabitRewards({result,habit}){
  const g=state.game;
  if(!g||!g.cls) return '';
  const rewardedProgress=result.xpDelta>0;
  const key=todayKey();
  const lvl=gameStats().lvl;
  const {maxHp,maxMp}=heroMaxes();
  const week=Math.max(0,weekIndexOf(currentDayDate()));
  let rewards=g.powerProgress=g.powerProgress||{};
  rewards.habitEntries=rewards.habitEntries||{};
  const entryKey=`${result.entry.habitId}|${result.entry.periodKey}|${result.entry.count}`;
  const entryAlreadyRewarded=Boolean(rewards.habitEntries[entryKey]);
  const notices=[];
  if(result.becameCompleted){
    const challengeNotice=applyLevelEightChallengeHabitCompletion({
      habitId:habit.id,
      key,
      completedAt:Date.now()
    });
    if(challengeNotice) notices.push(challengeNotice);
    rewards=g.powerProgress||rewards;
  }
  if(entryAlreadyRewarded) return notices.length?' · '+notices.join(' · '):'';
  rewards.habitEntries=rewards.habitEntries||{};
  rewards.habitEntries[entryKey]=true;
  if(rewardedProgress&&g.cls==='sorcerer'&&lvl>=1){
    rewards.sorcererManaDays=rewards.sorcererManaDays||[];
    if(!rewards.sorcererManaDays.includes(key)){
      const recovered=recoverMana(Math.max(1,Math.round(maxMp*0.05)));
      rewards.sorcererManaDays.push(key);
      if(recovered>0) notices.push('+'+recovered+' 💧 Absorber Esencia');
    }
  }
  if(rewardedProgress&&g.cls==='paladin'&&g.buffs?.paladinManaHabit){
    const recovered=recoverMana(Math.max(1,Math.round(maxMp*0.05)));
    g.buffs.paladinManaHabit=false;
    if(recovered>0) notices.push('+'+recovered+' 💧 Luz Sanadora');
  }
  if(rewardedProgress&&(g.cls==='sorcerer'||g.cls==='druid')&&lvl>=5){
    const counterKey=`harvest:${week}`;
    const rewardKey=`harvest-rewards:${week}`;
    rewards[counterKey]=(Number(rewards[counterKey])||0)+1;
    rewards[rewardKey]=Number(rewards[rewardKey])||0;
    if(rewards[counterKey]>=4&&rewards[rewardKey]<4){
      rewards[counterKey]-=4;
      rewards[rewardKey]+=1;
      g.bonusXp=(g.bonusXp||0)+5;
      notices.push(g.cls==='sorcerer'?'+5 XP Cosecha Oscura':'+5 XP Raíces Profundas');
    }
  }
  const ultimate=rewards.ultimateChallenge;
  if(ultimate&&ultimate.day===key&&ultimate.habitIds.includes(habit.id)&&!ultimate.completedIds.includes(habit.id)){
    ultimate.completedIds.push(habit.id);
    const ultimateReward=ultimateHabitReward({
      completedCount:ultimate.completedIds.length,
      target:ultimate.habitIds.length,
    });
    g.bonusXp=(g.bonusXp||0)+ultimateReward.xp;
    state.economy.coins+=ultimateReward.gold;
    notices.push(`+${ultimateReward.xp} XP · +${ultimateReward.gold} 🪙 · ${ultimate.completedIds.length}/3`);
    if(ultimateReward.completesChallenge&&!ultimate.rewarded){
      ultimate.rewarded=true;
    }
  }
  const judgment=rewards.judgment;
  if(judgment&&judgment.day===key&&judgment.habitIds.includes(habit.id)&&!judgment.completedIds.includes(habit.id)){
    judgment.completedIds.push(habit.id);
    notices.push(`Juicio · ${judgment.completedIds.length}/${judgment.habitIds.length}`);
  }
  const wager=rewards.soulWager;
  if(wager&&!wager.completed&&Date.now()<=wager.expiresAt&&wager.habitId===habit.id){
    wager.completed=true;
    recoverMana(wager.mana||40);
    g.bonusXp=(g.bonusXp||0)+5;
    notices.push('+5 XP · apuesta recuperada');
  }
  const rebirth=rewards.rebirthHabit;
  if(rebirth&&!rebirth.completed&&Date.now()<=rebirth.expiresAt&&rebirth.habitId===habit.id&&!rebirth.entryKeys.includes(entryKey)){
    rebirth.entryKeys.push(entryKey);
    rebirth.progress=Math.min(3,(rebirth.progress||0)+1);
    const hpBefore=g.hp;
    g.hp=capHp(g.hp+Math.max(1,Math.round(maxHp*0.1)));
    const manaRecovered=recoverMana(Math.max(1,Math.round(maxMp*0.1)));
    notices.push(`Renacer ${rebirth.progress}/3 · +${g.hp-hpBefore} ♥ · +${manaRecovered} 💧`);
    if(rebirth.progress>=3){
      rebirth.completed=true;
      g.hp=maxHp;
      g.bonusXp=(g.bonusXp||0)+5;
      notices.push('+5 XP · vida completa');
    }
  }
  return notices.length?' · '+notices.join(' · '):'';
}

function applyLevelEightChallengeHabitCompletion({habitId,key=todayKey(),completedAt=Date.now()}){
  const g=state.game;
  if(!g) return '';
  const maxHp=heroMaxes().maxHp;
  const challengeResult=completeLevelEightHabitChallenge({
    progress:g.powerProgress||{},
    habitId,
    today:key,
    completedAt
  });
  if(!challengeResult.advanced) return '';
  const notices=[];
  const challengeSpellId=challengeResult.spellId;
  const rewards=g.powerProgress=challengeResult.progress;
  g.bonusXp=(g.bonusXp||0)+5;
  if(challengeSpellId==='muro'){
    g.buffs.shield=(g.buffs.shield||0)+1;
    notices.push('+5 XP · +1 Escudo');
  }else if(challengeSpellId==='ceniza'){
    const recovered=recoverMana(5);
    notices.push(`+5 XP · +${recovered} 💧`);
  }else if(challengeSpellId==='regen'){
    const before=g.hp;
    g.hp=capHp(g.hp+Math.max(1,Math.round(maxHp*0.05)));
    notices.push(`+5 XP · +${g.hp-before} ♥`);
  }else notices.push('+5 XP');
  if(challengeResult.completed){
    state.economy.coins+=2;
    notices.push('+2 🪙');
    const recordedUse=rewards.challengeDayUses?.[`${key}:${challengeSpellId}`];
    if(completedAt>0&&(Number(recordedUse?.count)||0)<2){
      window.setTimeout(()=>renderHero(),LEVEL_EIGHT_COOLDOWN_MS+80);
    }
  }
  return notices.join(' · ');
}

function reconcileStoredLevelEightHabitChallenge(){
  const challenge=state.game?.powerProgress?.habitChallenge;
  const key=todayKey();
  if(!challenge||challenge.day!==key||!Array.isArray(challenge.habitIds)||!challenge.habitIds.length) return false;
  const date=currentDayDate();
  let changed=false;
  for(const habitId of challenge.habitIds){
    const active=state.game?.powerProgress?.habitChallenge;
    if(!active) break;
    if(active.completedIds?.includes(habitId)) continue;
    const habit=state.habits?.items?.find(candidate=>candidate?.id===habitId);
    if(!habit) continue;
    const entry=habitEntryFor(state.habits,habit,date,state.config.startDate);
    if((Number(entry.count)||0)<Math.max(1,Number(habit.target)||1)) continue;
    changed=Boolean(applyLevelEightChallengeHabitCompletion({habitId,key,completedAt:0}))||changed;
  }
  if(changed){
    scheduleSave({type:'spell:challenge-reconciled',spellId:challenge.spellId});
  }
  return changed;
}

function activeHabitById(id){
  return normalizeHabitState(state.habits).items.find(habit=>habit.id===id&&habit.active!==false);
}
function activeTodoById(id){
  return normalizeTodoState(state.todos).items.find(todo=>todo.id===id&&todo.active!==false);
}
function updateHabitEditor(){
  document.querySelectorAll('[data-habit-difficulty]').forEach(button=>{
    button.classList.toggle('active',button.dataset.habitDifficulty===habitDraftDifficulty);
  });
  document.querySelectorAll('[data-habit-frequency]').forEach(button=>{
    button.classList.toggle('active',button.dataset.habitFrequency===habitDraftFrequency);
  });
  document.getElementById('habitTargetValue').textContent=habitDraftTarget;
  const repeatRow=document.getElementById('habitRepeatRow');
  const frequencySection=document.getElementById('habitFrequencySection');
  const targetRow=document.getElementById('habitTargetRow');
  const repeatToggle=document.getElementById('habitRepeatToggle');
  const editingTodo=habitEditorMode==='todo';
  const isWeekly=habitDraftFrequency==='weekly';
  frequencySection.hidden=editingTodo;
  repeatRow.hidden=editingTodo||isWeekly;
  targetRow.hidden=false;
  repeatToggle.classList.toggle('active',habitDraftRepeatable&&!isWeekly);
  repeatToggle.setAttribute('aria-pressed',String(habitDraftRepeatable&&!isWeekly));
  repeatToggle.textContent=habitDraftRepeatable&&!isWeekly?'Sí':'No';
  document.getElementById('habitTargetLabel').textContent=isWeekly
    ? 'Objetivo semanal'
    : habitDraftRepeatable?'Repeticiones':'Objetivo';
  document.getElementById('habitTargetHelp').textContent=isWeekly
    ? 'Cada avance concede una parte de la recompensa semanal'
    : habitDraftRepeatable
      ? 'Las tres primeras repeticiones conceden recompensas decrecientes'
      : 'Veces necesarias para completarlo';
  const previewHabit={
    difficulty:habitDraftDifficulty,
    frequency:editingTodo?'daily':habitDraftFrequency,
    target:editingTodo?1:habitDraftTarget,
    repeatable:editingTodo?false:habitDraftRepeatable&&!isWeekly,
  };
  const xpSchedule=habitProgressXpSchedule(previewHabit);
  const coinSchedule=habitProgressCoinSchedule(previewHabit);
  const preview=!editingTodo&&isWeekly
    ? `Primer avance: +${xpSchedule[0]||0} XP · +${coinSchedule[0]||0} 🪙 · total: +${xpSchedule.reduce((sum,value)=>sum+value,0)} XP · +${coinSchedule.reduce((sum,value)=>sum+value,0)} 🪙`
    : previewHabit.repeatable
      ? `${xpSchedule.slice(0,3).map((xp,index)=>`${xp} XP · ${coinSchedule[index]||0} 🪙`).join('  /  ')}${habitDraftTarget>3?'  /  después 0':''}`
      : `+${habitReward(previewHabit)} XP · +${habitCoinReward(previewHabit)} oro`;
  setTextWithResourceIcons(document.getElementById('habitRewardPreview'),preview);
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
  habitEditorMode='habit';
  const habit=id?activeHabitById(id):null;
  editingHabitId=habit?habit.id:null;
  habitDraftDifficulty=habit?.difficulty||'easy';
  habitDraftFrequency=habit?.frequency||'daily';
  habitDraftTarget=habit?.target||1;
  habitDraftRepeatable=habit?.repeatable===true&&habitDraftFrequency==='daily';
  document.getElementById('habitModalTitle').textContent=habit?'Editar hábito':'Nuevo hábito';
  document.getElementById('habitTitle').value=habit?.title||'';
  document.getElementById('habitNotes').value=habit?.notes||'';
  document.getElementById('habitDelete').style.display=habit?'block':'none';
  document.getElementById('habitDelete').textContent='Eliminar hábito';
  document.getElementById('habitTitle').placeholder='Ej. Caminar 20 minutos';
  updateHabitEditor();
  if(habitEditorCloseTimer||habitEditorResizeHandler) finishHabitEditorClose();
  habitEditorViewportHeight=window.visualViewport?.height||window.innerHeight;
  document.body.classList.add('habit-editor-open');
  document.getElementById('habitModalBg').classList.add('show');
}
function openTodoEditor(id=null){
  habitEditorMode='todo';
  const todo=id?activeTodoById(id):null;
  editingHabitId=todo?todo.id:null;
  habitDraftDifficulty=todo?.difficulty||'easy';
  habitDraftFrequency='daily';
  habitDraftTarget=Math.min(20,Math.max(1,Math.trunc(Number(todo?.target)||1)));
  habitDraftRepeatable=false;
  document.getElementById('habitModalTitle').textContent=todo?'Editar tarea':'Nueva tarea';
  document.getElementById('habitTitle').value=todo?.title||'';
  document.getElementById('habitTitle').placeholder='Ej. Pedir cita con el médico';
  document.getElementById('habitNotes').value=todo?.notes||'';
  document.getElementById('habitDelete').style.display=todo?'block':'none';
  document.getElementById('habitDelete').textContent='Eliminar tarea';
  updateHabitEditor();
  if(habitEditorCloseTimer||habitEditorResizeHandler) finishHabitEditorClose();
  habitEditorViewportHeight=window.visualViewport?.height||window.innerHeight;
  document.body.classList.add('habit-editor-open');
  document.getElementById('habitModalBg').classList.add('show');
}
function openTodoCompletion(todo){
  if(!todo?.id) return;
  pendingCompletedTodoId=todo.id;
  document.getElementById('todoCompletionTitle').textContent='Tarea completada';
  const body=document.getElementById('todoCompletionBody');
  body.innerHTML='';
  const taskName=document.createElement('p');
  const taskNameStrong=document.createElement('b');
  taskNameStrong.textContent=todo.title||'Tarea';
  taskName.append(taskNameStrong);
  const question=document.createElement('p');
  question.textContent='¿Quieres eliminarla de tu lista?';
  body.append(taskName,question);
  document.getElementById('todoCompletionBg').classList.add('show');
}
function closeTodoCompletion(){
  pendingCompletedTodoId=null;
  document.getElementById('todoCompletionBg').classList.remove('show');
}
function saveTodoEditor(){
  const input=normalizeTodoInput({
    title:document.getElementById('habitTitle').value,
    notes:document.getElementById('habitNotes').value,
    difficulty:habitDraftDifficulty,
    target:habitDraftTarget,
  });
  if(!input.title){
    showToast('Escribe un nombre para la tarea','dmg');
    return;
  }
  const normalized=normalizeTodoState(state.todos);
  const wasEditing=Boolean(editingHabitId);
  let savedId=editingHabitId;
  if(editingHabitId){
    normalized.items=normalized.items.map(todo=>todo.id===editingHabitId
      ? {...todo,...input,updatedAt:Date.now()}
      : todo);
  }else{
    savedId=globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function'
      ? globalThis.crypto.randomUUID()
      : 'todo-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    normalized.items.push({
      id:savedId,...input,active:true,completed:false,xpAwarded:0,coinsAwarded:0,
      count:0,order:nextTodoOrder(normalized),createdAt:Date.now(),updatedAt:Date.now(),
    });
  }
  state.todos=normalized;
  scheduleSave({type:wasEditing?'todo:update':'todo:create',id:savedId,title:input.title});
  closeHabitEditor();
  renderAll();
  showToast(wasEditing?'Tarea actualizada':'Tarea creada','heal');
}
function saveHabitEditor(){
  if(habitEditorMode==='todo'){
    saveTodoEditor();
    return;
  }
  const input=normalizeHabitInput({
    title:document.getElementById('habitTitle').value,
    notes:document.getElementById('habitNotes').value,
    difficulty:habitDraftDifficulty,
    frequency:habitDraftFrequency,
    target:habitDraftTarget,
    repeatable:habitDraftRepeatable,
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

function awardFusionDailyHabitListXp(dayKey){
  const result=awardFusionAllHabitsXp({state,habitState:state.habits,dayKey});
  state.habits=result.habitState;
  applyLootSlices(result);
  return result.xp;
}
function potionViewOptions(){
  const bossIndex=Math.max(0,Number(state.game?.bossCombat?.bossIndex)||0);
  return {dayKey:todayKey(),bossKey:RELIC_DEFINITIONS[bossIndex]?.rewardId||''};
}

function applyHabitRelicRewards({habit,dayKey,becameCompleted}){
  if(!becameCompleted) return {xp:0,coins:0,notice:''};
  let xp=0,coins=0;
  const notices=[];
  const grantCoins=(baseRelicId,sources,label)=>{
    if(!sources.length) return;
    const amount=sources.reduce((total,source)=>total+source.value,0);
    state.economy.coins+=amount;
    state.economy.transactions.push({
      id:`${baseRelicId}:${dayKey}:${Date.now()}`,type:'relic_habit_coins',
      relicId:baseRelicId,coins:amount,at:Date.now()
    });
    state.economy.transactions=state.economy.transactions.slice(-200);
    applyLootSlices(markDailyEffectSources(state,baseRelicId,dayKey,sources,amount));
    coins+=amount;
    notices.push(`+${amount} 🪙 ${label}`);
  };
  if(habit.difficulty==='hard'){
    grantCoins('relic_08',availableDailyEffectSources(state,'relic_08',dayKey),'Ojo de la Duda');
  }
  const daily=state.habits.items.filter(item=>item.active!==false&&item.frequency==='daily');
  const periodKey=`d:${dayKey}`;
  const completed=daily.filter(item=>(Number(state.habits.entries[`${item.id}|${periodKey}`]?.count)||0)>=Math.max(1,Number(item.target)||1));
  if(completed.length>=3){
    const sources=availableDailyEffectSources(state,'relic_11',dayKey);
    if(sources.length){
      const amount=sources.reduce((total,source)=>total+source.value,0);
      applyLootSlices(markDailyEffectSources(state,'relic_11',dayKey,sources,amount));
      xp+=amount;
      notices.push(`+${amount} XP Gargantilla`);
    }
  }
  if(daily.length>0&&completed.length===daily.length){
    grantCoins('relic_12',availableDailyEffectSources(state,'relic_12',dayKey),'Puño de Papel');
  }
  return {xp,coins,notice:notices.length?` · ${notices.join(' · ')}`:''};
}

document.getElementById('view-habits').addEventListener('click',event=>{
  const section=event.target.closest('[data-habit-section]');
  if(section){
    habitViewSection=section.dataset.habitSection;
    if(habitViewSection==='hunt') dismissFeatureDiscovery('hunt-tab');
    if(habitViewSection==='hunt') document.getElementById('huntContent').dataset.huntScreen='map';
    renderHabits();
    return;
  }
  const filter=event.target.closest('[data-habit-filter]');
  if(filter){
    habitViewFilter=filter.dataset.habitFilter;
    renderHabits();
    return;
  }
  if(event.target.closest('[data-open-inventory]')){
    const shortcut=event.target.closest('[data-inventory-shortcut]');
    if(shortcut) dismissInventoryShortcutHint(shortcut.dataset.inventoryShortcut);
    openInventory();
    return;
  }
  if(event.target.closest('[data-add-habit]')){
    openHabitEditor();
    return;
  }
  if(event.target.closest('[data-add-todo]')){
    openTodoEditor();
    return;
  }
  const todoProgress=event.target.closest('[data-todo-delta]');
  if(todoProgress&&!todoProgress.disabled){
    const row=todoProgress.closest('[data-todo-id]');
    const todoId=row?.dataset.todoId;
    const delta=Number(todoProgress.dataset.todoDelta)||0;
    const result=adjustTodoProgress(state.todos,todoId,delta,Date.now());
    if(!result.changed) return;
    ensureHero();
    state.todos=result.todoState;
    state.game.bonusXp=Math.max(0,(Number(state.game.bonusXp)||0)+result.xpDelta);
    state.economy.coins=Math.max(0,(Number(state.economy.coins)||0)+result.coinDelta);
    scheduleSave({type:'todo:progress',id:todoId,count:result.item?.count||0,xpDelta:result.xpDelta,coinDelta:result.coinDelta});
    renderAll();
    if(result.item?.completed){
      openTodoCompletion(result.item);
      return;
    }
    showToast(
      result.xpDelta<0||result.coinDelta<0
        ? `Tarea corregida · ${result.xpDelta} XP · ${result.coinDelta} oro`
        : result.item?.completed
          ? `Tarea completada · +${result.xpDelta} XP · +${result.coinDelta} oro`
          : `Progreso de tarea · +${result.xpDelta} XP · +${result.coinDelta} oro`,
      result.item?.completed?'heal':result.xpDelta<0||result.coinDelta<0?'dmg':'heal',
    );
    return;
  }
  const adjust=event.target.closest('[data-habit-delta]');
  if(adjust&&!adjust.disabled){
    const row=adjust.closest('[data-habit-id]');
    const habit=activeHabitById(row?.dataset.habitId);
    if(!habit) return;
    ensureHero();
    const rewardTotalsBefore={
      xp:gameStats().xp,
      coins:Number(state.economy?.coins)||0
    };
    const smokeFreeMode=usesSmokeFreeSkills(state.config);
    const buffs=state.game.buffs||{};
    const focusActive=smokeFreeMode&&state.game.cls==='paladin'&&(buffs.habitFocusCharges||0)>0;
    const dayKey=todayKey();
    const habitXpSources=availableDailyEffectSources(state,'relic_03',dayKey);
    const relicHabitXpActive=habitXpSources.length>0;
    const flatRewardBonus=relicBonuses().habitXpBonus+
      (relicHabitXpActive
        ? habitXpSources.reduce((total,source)=>total+source.value,0)
        : 0);
    const habitDate=currentDayDate();
    const previousHabitEntry=state.habits?.entries?.[`${habit.id}|${habit.frequency==='weekly'
      ? `w:${keyOf(weekRangeFor(state.config.startDate,weekIndexFor(state.config.startDate,habitDate))[0])}`
      : `d:${keyOf(habitDate)}`}`];
    const result=adjustHabitProgress({
      habitState:state.habits,
      habit,
      delta:parseInt(adjust.dataset.habitDelta,10),
      date:habitDate,
      planStartDate:state.config.startDate,
      rewardMultiplier:focusActive?1.5:1,
      flatRewardBonus
    });
    const coinResult=applyHabitCoinRewards({
      habitState:result.habitState,
      economy:state.economy,
      habit,
      date:habitDate,
      planStartDate:state.config.startDate,
      becameCompleted:result.becameCompleted,
      becameIncomplete:result.becameIncomplete,
      progressChanged:result.countChanged,
      nowTimestamp:Date.now()
    });
    state.habits=coinResult.habitState;
    state.economy=coinResult.economy;
    const potionResult=reconcilePotionHabitBonus({
      inventory:state.inventory,habitState:state.habits,economy:state.economy,
      habit,date:habitDate,planStartDate:state.config.startDate,
      previousCount:Number(previousHabitEntry?.count)||0,nowTimestamp:Date.now()
    });
    state.inventory=potionResult.inventory;
    state.habits=potionResult.habitState;
    state.economy=potionResult.economy;
    const newRelicRewards=applyHabitRelicRewards({
      habit,dayKey,becameCompleted:result.becameCompleted
    });
    const activeFrequencyHabits=state.habits.items.filter(item=>item.active!==false&&item.frequency===habit.frequency);
    const allFrequencyHabitsCompleted=activeFrequencyHabits.length>0&&activeFrequencyHabits.every(item=>{
      const entry=habitEntryFor(state.habits,item,habitDate,state.config.startDate);
      return (Number(entry.count)||0)>=Math.max(1,Number(item.target)||1);
    });
    const setEnergyResult=syncHabitSetHuntEnergy({
      hunt:state.game.hunt,
      rewardKey:`completed-set:${habit.frequency}:${result.entry.periodKey}`,
      amount:habit.frequency==='weekly'?2:1,
      allCompleted:allFrequencyHabitsCompleted,
      nowTimestamp:Date.now()
    });
    state.game.hunt=setEnergyResult.hunt;
    const huntEnergyRewardKey=`${habit.id}|${result.entry.periodKey}`;
    const huntEnergyResult=result.becameIncomplete
      ? revokeHabitHuntEnergy({
        hunt:state.game.hunt,
        rewardKey:huntEnergyRewardKey,
        becameIncomplete:true,
        nowTimestamp:Date.now()
      })
      : grantHabitHuntEnergy({
        hunt:state.game.hunt,
        rewardKey:huntEnergyRewardKey,
        becameCompleted:result.becameCompleted,
        nowTimestamp:Date.now()
      });
    state.game.hunt=huntEnergyResult.hunt;
    if(result.xpDelta>0&&focusActive){
      buffs.habitFocusCharges=Math.max(0,buffs.habitFocusCharges-1);
    }
    if(result.xpDelta>0&&relicHabitXpActive){
      applyLootSlices(markDailyEffectSources(state,'relic_03',dayKey,habitXpSources,true));
    }
    const manaSources=result.xpDelta>0
      ? availableDailyEffectSources(state,'relic_02',dayKey)
      : [];
    if(manaSources.length){
      let manaPercent=manaSources.reduce((total,source)=>total+source.value,0);
      if(canActivateFusionDaily(state,'fusion_01','first-habit-mana',dayKey)){
        manaPercent+=3;
        applyLootSlices(markFusionDaily(state,'fusion_01','first-habit-mana',dayKey,true));
      }
      const recovered=recoverMana(Math.max(1,Math.round(heroMaxes().maxMp*manaPercent/100)));
      applyLootSlices(markDailyEffectSources(state,'relic_02',dayKey,manaSources,true));
      if(recovered>0&&manaSources.some(source=>source.relicId==='fusion_07')&&
          collarRecoverySourcesForKey(dayKey).some(source=>source.relicId==='fusion_07')){
        state.inventory.dailyActivations[`fusion_07:mana-used:${dayKey}`]=true;
      }
    }
    if(result.xpDelta>0) awardFusionDailyHabitListXp(dayKey);
    if(result.xpDelta>0||result.becameCompleted) applyClassHabitRewards({result,habit});
    const rewardTotalsAfter={
      xp:gameStats().xp,
      coins:Number(state.economy?.coins)||0
    };
    const totalRewardDelta={
      xpDelta:rewardTotalsAfter.xp-rewardTotalsBefore.xp,
      coinDelta:rewardTotalsAfter.coins-rewardTotalsBefore.coins
    };
    scheduleSave({
      type:'habit:progress',id:habit.id,count:result.entry.count,
      period:result.entry.periodKey||'',coinDelta:coinResult.coinDelta+newRelicRewards.coins+potionResult.coinDelta,
      potionXpDelta:potionResult.xpDelta
    });
    renderAll();
    if(result.becameCompleted){
      const energyGained=(huntEnergyResult.granted||0)+(setEnergyResult.granted||0);
      const energyNotice=energyGained?` · +${energyGained} Energía`:'';
      const compactRewards=[];
      if(totalRewardDelta.xpDelta>0) compactRewards.push(`+${totalRewardDelta.xpDelta} XP`);
      if(totalRewardDelta.coinDelta>0) compactRewards.push(`+${totalRewardDelta.coinDelta} 🪙`);
      const rewardNotice=compactRewards.join(' · ');
      showToast(`${rewardNotice}${energyNotice}`.replace(/^ · /,''),'heal');
    }
    else if(totalRewardDelta.xpDelta>0||totalRewardDelta.coinDelta>0){
      showToast(habitRewardToast('Progreso registrado',totalRewardDelta),'heal');
    }
    else if(totalRewardDelta.xpDelta<0||totalRewardDelta.coinDelta<0||huntEnergyResult.revoked||setEnergyResult.revoked){
      const energyRevoked=(huntEnergyResult.revoked||0)+(setEnergyResult.revoked||0);
      const energyNotice=energyRevoked?` · −${energyRevoked} Energía de Cacería`:'';
      showToast(`${habitRewardToast('Progreso corregido',totalRewardDelta)}${energyNotice}`,'dmg');
    }
    else if(result.completed) showToast('Límite de recompensas alcanzado','heal');
    return;
  }
  const edit=event.target.closest('[data-edit-habit]');
  if(edit){
    openHabitEditor(edit.dataset.editHabit);
    return;
  }
  const editTodo=event.target.closest('[data-edit-todo]');
  if(editTodo) openTodoEditor(editTodo.dataset.editTodo);
});

const habitsView=document.getElementById('view-habits');
const habitsScrollArea=document.getElementById('scrollArea');
const HABIT_DRAG_HOLD_MS=450;
const HABIT_DRAG_MOVE_TOLERANCE=8;
let habitDrag=null;

function orderedItemIds(group){
  const isTodo=group?.hasAttribute('data-todo-group');
  return [...group.querySelectorAll('.habit-row')]
    .map(row=>isTodo?row.dataset.todoId:row.dataset.habitId)
    .filter(Boolean);
}

function saveHabitOrder(group){
  if(group?.hasAttribute('data-todo-group')){
    const ids=orderedItemIds(group);
    state.todos=reorderTodos(state.todos,ids);
    scheduleSave({type:'todo:reorder',ids});
    return 'tareas';
  }
  const frequency=group?.dataset.habitGroup;
  if(!frequency) return;
  const ids=orderedItemIds(group);
  state.habits=reorderHabits(state.habits,frequency,ids);
  scheduleSave({type:'habit:reorder',frequency,ids});
  return 'hábitos';
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
  const orderedKind=saveHabitOrder(group);
  renderHabits();
  showToast(`Orden de ${orderedKind||'elementos'} guardado`,'heal');
}

habitsView.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-habit-drag],[data-todo-drag]');
  if(!handle||(event.pointerType==='mouse'&&event.button!==0)) return;
  const row=handle.closest('.habit-row');
  const group=row?.closest('[data-habit-group],[data-todo-group]');
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
  if(target&&target!==row&&target.closest('[data-habit-group],[data-todo-group]')===group){
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
  const inventoryShortcut=event.target.closest('[data-open-inventory]');
  if(inventoryShortcut&&['Enter',' '].includes(event.key)){
    event.preventDefault();
    dismissInventoryShortcutHint(inventoryShortcut.dataset.inventoryShortcut);
    openInventory();
    return;
  }
  const handle=event.target.closest('[data-habit-drag],[data-todo-drag]');
  if(!handle||!['ArrowUp','ArrowDown'].includes(event.key)) return;
  const row=handle.closest('.habit-row');
  const group=row?.closest('[data-habit-group],[data-todo-group]');
  const list=group?.querySelector('.habit-group-list');
  if(!row||!group||!list) return;
  const sibling=event.key==='ArrowUp'?row.previousElementSibling:row.nextElementSibling;
  if(!sibling) return;
  event.preventDefault();
  if(event.key==='ArrowUp') list.insertBefore(row,sibling);
  else list.insertBefore(sibling,row);
  saveHabitOrder(group);
  renderHabits();
  const moved=[...habitsView.querySelectorAll('[data-habit-drag],[data-todo-drag]')]
    .find(button=>{
      const movedRow=button.closest('.habit-row');
      return (row.dataset.todoId&&movedRow?.dataset.todoId===row.dataset.todoId)
        || (row.dataset.habitId&&movedRow?.dataset.habitId===row.dataset.habitId);
    });
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
  if(habitDraftFrequency==='weekly') habitDraftRepeatable=false;
  updateHabitEditor();
});
document.getElementById('habitRepeatToggle').addEventListener('click',()=>{
  if(habitDraftFrequency==='weekly') return;
  habitDraftRepeatable=!habitDraftRepeatable;
  if(habitDraftRepeatable&&habitDraftTarget<2) habitDraftTarget=3;
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
  if(habitEditorMode==='todo'){
    if(!editingHabitId||!confirm('¿Eliminar esta tarea? La XP y el oro que ya ganaste se conservarán.')) return;
    const deletedTodoId=editingHabitId;
    const normalized=normalizeTodoState(state.todos);
    normalized.items=normalized.items.map(todo=>todo.id===editingHabitId
      ? {...todo,active:false,deletedAt:Date.now()}
      : todo);
    state.todos=normalized;
    scheduleSave({type:'todo:delete',id:deletedTodoId});
    closeHabitEditor();
    renderAll();
    showToast('Tarea eliminada','dmg');
    return;
  }
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
document.getElementById('todoCompletionCancel').addEventListener('click',closeTodoCompletion);
document.getElementById('todoCompletionAccept').addEventListener('click',()=>{
  if(!pendingCompletedTodoId) return;
  const todoId=pendingCompletedTodoId;
  const result=archiveTodo(state.todos,todoId,Date.now());
  closeTodoCompletion();
  if(!result.changed) return;
  state.todos=result.todoState;
  scheduleSave({type:'todo:delete-completed',id:todoId});
  renderAll();
  showToast('Tarea eliminada','heal');
});

/* elegir clase de héroe y lanzar hechizos */
function closeClassChangeConfirmation(){
  selectedClassChange=null;
  document.getElementById('classChangeConfirmBg').classList.remove('show');
}

function leaveClassChange(message='Mantienes tu clase actual'){
  if(!pendingClassChange) return;
  state.game.cls=pendingClassChange.fromClass;
  pendingClassChange=null;
  closeClassChangeConfirmation();
  const destination=classChangeReturn||{viewId:'view-hoy',buttonId:'navHoy'};
  classChangeReturn=null;
  switchView(destination.viewId,destination.buttonId);
  renderAll();
  if(message) showToast(message,'heal');
}

function openClassChangeConfirmation(selectedClass){
  if(!pendingClassChange||!CLASSES[selectedClass]) return;
  if(selectedClass===pendingClassChange.fromClass){
    showToast('Esta es tu clase actual. Selecciona otra.');
    return;
  }
  selectedClassChange=selectedClass;
  const classData=classDataForJourney(selectedClass,{smokeFree:usesSmokeFreeSkills(state.config)});
  const blood=Math.max(0,Number(state.economy?.bossBlood)||0);
  const freeRecoveryChange=recoveryModeController.isActive();
  document.getElementById('classChangeConfirmTitle').textContent=`Libro de habilidades · ${classData.es}`;
  document.getElementById('classChangeConfirmBody').innerHTML=`
    <p class="class-change-description">${classData.desc}</p>
    <div class="class-change-skills" id="classChangeSkills"></div>
    <div class="class-change-cost"><span>Coste al confirmar</span><b>${freeRecoveryChange?'GRATIS · Modo recuperación':'1 Sangre de Jefe'}</b><small>${freeRecoveryChange?'No se consumirá ningún recurso':`Tienes ${blood}`}</small></div>`;
  renderSkillsView({
    document,
    classId:selectedClass,
    level:pendingClassChange.level||1,
    intoxication:currentIntoxication(),
    config:state.config,
    targetId:'classChangeSkills'
  });
  const accept=document.getElementById('classChangeConfirmAccept');
  accept.disabled=!freeRecoveryChange&&blood<1;
  accept.textContent=freeRecoveryChange?'CAMBIAR GRATIS':blood<1?'SIN SANGRE':'CAMBIAR CLASE';
  document.getElementById('classChangeConfirmBg').classList.add('show');
}

document.getElementById('view-hero').addEventListener('click',e=>{
  if(e.target.closest('[data-open-hunt-from-hero]')){
    habitViewSection='hunt';
    dismissFeatureDiscovery('hero-energy');
    dismissFeatureDiscovery('hunt-tab');
    document.getElementById('huntContent').dataset.huntScreen='map';
    switchView('view-habits','navHabits');
    renderHabits();
    return;
  }
  const quickCast=e.target.closest('.hero-skill-hotbar [data-cast]');
  if(quickCast){
    castSpell(quickCast.dataset.cast);
    return;
  }
  if(e.target.closest('[data-future-skill]')){
    showToast('Próximamente','heal');
    return;
  }
  if(e.target.closest('[data-open-character-sheet]')){
    openCharacterSheet();
    return;
  }
  if(e.target.closest('[data-open-inventory]')){
    const shortcut=e.target.closest('[data-inventory-shortcut]');
    if(shortcut) dismissInventoryShortcutHint(shortcut.dataset.inventoryShortcut);
    openInventory();
    return;
  }
  if(e.target.closest('[data-open-hero-skills]')){
    showHeroSkillsPanel();
    showSheet(document,'sheetHeroSkills');
    return;
  }
  if(e.target.closest('#bossInfoBtn')){
    showBossHistoryPanel('combat');
    showSheet(document,'sheetBossHistory');
    return;
  }
  const currentBossMedal=e.target.closest('[data-open-current-boss-medal]');
  if(currentBossMedal){
    openBossMedalDetail(
      parseInt(currentBossMedal.dataset.openCurrentBossMedal,10),
      currentBossMedal.dataset.bossFile
    );
    return;
  }
  if(e.target.closest('#classChangeBack')){
    leaveClassChange();
    return;
  }
  const card=e.target.closest('[data-cls]');
  if(card){
    const selectedClass=card.dataset.cls;
    if(pendingClassChange){
      openClassChangeConfirmation(selectedClass);
      return;
    }
    const hadHero=(state.game.hp!==undefined);
    state.game.cls=selectedClass;
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

document.getElementById('skillHabitPickerList').addEventListener('click',event=>{
  const option=event.target.closest('[data-skill-habit]');
  if(!option||!pendingSkillCast?.spell) return;
  const id=option.dataset.skillHabit;
  const limit=skillSelectionLimit(pendingSkillCast.spell);
  const selected=pendingSkillCast.selected||[];
  if(selected.includes(id)) pendingSkillCast.selected=selected.filter(value=>value!==id);
  else if(selected.length<limit.max) pendingSkillCast.selected=[...selected,id];
  renderSkillHabitPicker();
});
document.getElementById('skillHabitPickerCancel').addEventListener('click',()=>{
  closeSkillHabitPicker();
  pendingSkillCast=null;
});
document.getElementById('skillHabitPickerContinue').addEventListener('click',()=>{
  if(!pendingSkillCast?.spell) return;
  const {spell,selected=[]}=pendingSkillCast;
  const limit=skillSelectionLimit(spell);
  if(selected.length<limit.min) return;
  closeSkillHabitPicker();
  pendingSkillCast=null;
  castSpell(spell.id,{
    confirmed:true,
    selectedHabitIds:selected,
    targetHabitId:spell.id==='renacer'||spell.id==='alma'?selected[0]:null,
  });
});
document.getElementById('skillConfirmCancel').addEventListener('click',()=>{
  closeSkillConfirmation();
  pendingSkillCast=null;
  resetSkillConfirmation();
});
document.getElementById('skillConfirmAccept').addEventListener('click',()=>{
  if(pendingSkillCast?.mode==='used-info'){
    closeSkillConfirmation();
    pendingSkillCast=null;
    resetSkillConfirmation();
    return;
  }
  if(!pendingSkillCast?.spell) return;
  const request={...pendingSkillCast};
  closeSkillConfirmation();
  pendingSkillCast=null;
  resetSkillConfirmation();
  castSpell(request.spell.id,{
    confirmed:true,
    selectedHabitIds:request.selectedHabitIds||[],
    targetHabitId:request.targetHabitId||null,
  });
});
document.getElementById('skillHabitPickerBg').addEventListener('click',event=>{
  if(event.target.id!=='skillHabitPickerBg') return;
  closeSkillHabitPicker();
  pendingSkillCast=null;
});
document.getElementById('skillConfirmBg').addEventListener('click',event=>{
  if(event.target.id!=='skillConfirmBg') return;
  closeSkillConfirmation();
  pendingSkillCast=null;
});

document.getElementById('sheetHeroSkills').addEventListener('click',e=>{
  const pasTap=e.target.closest('[data-pas-name]');
  if(pasTap){
    const lvl=parseInt(pasTap.dataset.pasLvl,10);
    const name=pasTap.dataset.pasName;
    const curLvl=gameStats().lvl;
    if(curLvl>=lvl) showToast(name+' · activa','heal');
    else showToast('Nivel '+lvl+' necesario','dmg');
    return;
  }
});

document.getElementById('classChangeConfirmCancel').addEventListener('click',closeClassChangeConfirmation);
document.getElementById('classChangeConfirmBg').addEventListener('click',event=>{
  if(event.target===event.currentTarget) closeClassChangeConfirmation();
});
document.getElementById('classChangeConfirmAccept').addEventListener('click',()=>{
  if(!pendingClassChange||!selectedClassChange) return;
  const fromClass=pendingClassChange.fromClass;
  const toClass=selectedClassChange;
  const freeRecoveryChange=recoveryModeController.isActive();
  if(!freeRecoveryChange){
    const payment=payClassChange({
      state,
      fromClass,
      toClass,
      operationId:`${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nowTimestamp:Date.now()
    });
    if(!payment.ok){
      closeClassChangeConfirmation();
      showToast('Necesitas 1 Sangre de Jefe','dmg');
      return;
    }
    applyLootSlices(payment);
  }
  const hadHero=state.game.hp!==undefined;
  state.game.cls=toClass;
  if(hadHero){
    state.game.buffs={};
    state.game.hp=capHp(state.game.hp);
    state.game.mp=capMp(state.game.mp);
  }
  if(LOCAL_DEMO_PALADIN_EFFECTS){
    const demoMaxes=heroMaxes();
    state.game.hp=demoMaxes.maxHp;
    state.game.mp=demoMaxes.maxMp;
  }
  pendingClassChange=null;
  closeClassChangeConfirmation();
  scheduleSave({type:'hero:class-change',toClass,bossBloodSpent:freeRecoveryChange?0:1,recoveryMode:freeRecoveryChange});
  const destination=classChangeReturn||{viewId:'view-hoy',buttonId:'navHoy'};
  classChangeReturn=null;
  switchView(destination.viewId,destination.buttonId);
  renderAll();
  showToast(freeRecoveryChange?'Clase cambiada gratis · Modo recuperación':'Clase cambiada · −1 Sangre de Jefe','heal');
});

function handlePotionUse(potionId){
  const maxes=heroMaxes();
  if(potionId==='life'&&(state.game.hp||0)>=maxes.maxHp){ showToast('La Salud ya está completa','dmg'); return false; }
  if(potionId==='mana'&&(state.game.mp||0)>=maxes.maxMp){ showToast('El Maná ya está completo','dmg'); return false; }
  const options=potionViewOptions();
  const result=usePotion({
    inventory:state.inventory,potionId,dayKey:options.dayKey,bossKey:options.bossKey,nowTimestamp:Date.now()
  });
  if(!result.ok){
    const remainingAvailability=()=>{
      if(result.reason==='active'){
        const endsAt=Number(state.inventory?.potions?.active?.endsAt)||Date.now();
        const minutes=Math.max(1,Math.ceil((endsAt-Date.now())/60000));
        return `Podrás usar otra poción en ${minutes} min`;
      }
      if(result.reason==='limit'){
        if(potionId==='blood') return 'Podrás preparar más con el próximo jefe';
        const nextDay=new Date();
        nextDay.setHours(24,0,0,0);
        const minutes=Math.max(1,Math.ceil((nextDay.getTime()-Date.now())/60000));
        const hours=Math.floor(minutes/60);
        const rest=minutes%60;
        return `Podrás usarla de nuevo en ${hours?`${hours} h${rest?` ${rest} min`:''}`:`${rest} min`}`;
      }
      return null;
    };
    const availability=remainingAvailability();
    const message=result.reason==='active'?'Ya hay una poción temporal activa'
      : result.reason==='limit'?'Has alcanzado el límite de esta poción'
      : result.reason==='empty'?'No tienes esa poción':'No se puede usar ahora';
    showToast(availability||message,'dmg'); return false;
  }
  state.inventory=result.inventory;
  let notice='Poción utilizada';
  if(potionId==='life'){
    const before=state.game.hp||0; state.game.hp=capHp(before+20); notice=`+${state.game.hp-before} Salud`;
    flashHeroStatFeedback('hp');
  }else if(potionId==='mana'){
    const before=state.game.mp||0; state.game.mp=capMp(before+25); notice=`+${state.game.mp-before} Maná`;
    flashHeroStatFeedback('mp');
  }else if(potionId==='blood') notice=`Sangre preparada · +${potionBloodChance(state.inventory.potions,options.bossKey)}%`;
  else notice=`${potionId==='fortune'?'Fortuna':'Experiencia'} activa durante 30 minutos`;
  scheduleSave({type:'potion:use',potionId});
  document.getElementById('sheetRelicDetail')?.classList.remove('show');
  renderInventoryView(document,state,potionViewOptions()); renderHero();
  showToast(notice,'heal');
  return true;
}

function openShopPurchaseConfirmation(purchase){
  pendingShopPurchase=purchase;
  const body=document.getElementById('shopPurchaseConfirmBody');
  const accept=document.getElementById('shopPurchaseConfirmAccept');
  const kicker=document.getElementById('shopPurchaseConfirmKicker');
  const title=document.getElementById('shopPurchaseConfirmTitle');
  if(purchase.type==='potion'){
    kicker.textContent='CONFIRMAR COMPRA';
    title.textContent='¿Quieres comprarlo?';
    body.innerHTML=`<p><b>${purchase.name}</b> × ${purchase.quantity}</p><p>Se descontarán <b>${purchase.coinCost} de oro</b>.</p>`;
    accept.textContent='COMPRAR';
  }else if(purchase.type==='outfit'){
    kicker.textContent='CONFIRMAR TEJIDO';
    title.textContent='¿Quieres tejer este outfit?';
    body.innerHTML=`<p><b>${purchase.name}</b></p><p>Se descontarán <b>${purchase.fiberCost} Fibras Arcanas</b> y <b>${purchase.coinCost} de oro</b>.</p>`;
    accept.textContent='TEJER';
  }else if(purchase.type==='frame'){
    kicker.textContent='CONFIRMAR PINTURA';
    title.textContent='¿Quieres pintar este fondo?';
    body.innerHTML=`<p><b>${purchase.name}</b></p><p>Se descontarán <b>${purchase.inkCost} Tintas Arcanas</b> y <b>${purchase.coinCost} de oro</b>.</p>`;
    accept.textContent='PINTAR';
  }else{
    kicker.textContent='CONFIRMAR COMPRA';
    title.textContent='¿Quieres comprarlo?';
    body.innerHTML=`<p><b>${purchase.name}</b></p><p>Se descontarán <b>${purchase.coinCost} de oro</b>${purchase.bloodCost?` y <b>${purchase.bloodCost} Sangre de Jefe</b>`:''}.</p>`;
    accept.textContent='COMPRAR';
  }
  accept.disabled=false;
  document.getElementById('shopPurchaseConfirmBg').classList.add('show');
}

function handleOutfitWeave(outfitId){
  const operationId=`outfit-${outfitId}-${Date.now()}`;
  const result=weaveOutfit({state,outfitId,operationId,nowTimestamp:Date.now()});
  if(!result.ok){
    showToast(result.reason==='resources'?'No tienes suficientes recursos':'Este outfit ya está conseguido','dmg');
    return false;
  }
  applyLootSlices(result);
  state.game=result.game;
  outfitSelectorSection=outfitSelectorContext==='shop'?'weave':'owned';
  selectedOutfitDraft=renderOutfitSelector(document,state,outfitSelectorContext==='shop'?outfitId:null,{section:outfitSelectorSection,context:outfitSelectorContext});
  scheduleSave({type:'outfit:woven',outfitId,operationId});
  renderInventoryView(document,state,potionViewOptions());
  renderHero();
  showToast('Outfit tejido · conseguido','heal');
  return true;
}

function handleFramePaint(frameId){
  const operationId=`frame-${frameId}-${Date.now()}`;
  const result=paintFrame({state,frameId,operationId,nowTimestamp:Date.now()});
  if(!result.ok){
    showToast(result.reason==='resources'?'No tienes suficientes recursos':'Este fondo ya está conseguido','dmg');
    return false;
  }
  applyLootSlices(result);
  state.game=result.game;
  selectedOutfitDraft=renderOutfitSelector(document,state,frameId,{section:'frames',context:'shop'});
  scheduleSave({type:'frame:painted',frameId,operationId});
  renderInventoryView(document,state,potionViewOptions());
  renderHero();
  showToast('Fondo pintado · conseguido','heal');
  return true;
}

async function handleRelicPurchase(relicId){
  if(shopLocked) return false;
  shopLocked=true;
  const operationId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previousLootState=normalizeLootState(state);
  const result=purchaseShopRelic({state,relicId,operationId,nowTimestamp:Date.now()});
  if(result.ok){
    applyLootSlices(result);
    let purchaseSaved=true;
    try{handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));}
    catch(error){
      purchaseSaved=false;
      applyLootSlices(previousLootState);
      console.error('No se pudo guardar la compra de la Tienda',error);
      showToast('No se pudo confirmar el guardado de la compra','dmg');
    }
    renderShopView(document,state,Date.now(),shopRenderOptions());
    renderInventoryView(document,state,potionViewOptions());
    renderHero();
    if(purchaseSaved) showToast('Reliquia recuperada','heal');
  }else{
    const message=result.reason==='coins'?'No tienes suficiente oro'
      :result.reason==='blood'?'No tienes suficiente Sangre de Jefe':'Esta reliquia ya no está disponible';
    showToast(message,'dmg');
    renderShopView(document,state,Date.now(),shopRenderOptions());
  }
  shopLocked=false;
  return result.ok;
}

function handlePotionPurchase(potionId,quantity=1){
  const operationId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result=purchasePotion({inventory:state.inventory,economy:state.economy,potionId,operationId,quantity,nowTimestamp:Date.now()});
  if(!result.ok){
    showToast(result.reason==='coins'?'No tienes suficiente oro'
      :result.reason==='bag_full'?'Bolso lleno · usa una poción para liberar un hueco'
      :'No se pudo comprar la poción','dmg');
    return false;
  }
  state.inventory=result.inventory;
  state.economy=result.economy;
  scheduleSave({type:'potion:purchase',potionId});
  document.getElementById('sheetRelicDetail')?.classList.remove('show');
  renderShopView(document,state,Date.now(),shopRenderOptions());
  renderInventoryView(document,state,potionViewOptions());
  renderHero();
  showToast(quantity>1?`${quantity} pociones añadidas al Bolso`:'Poción añadida al Bolso','heal');
  return true;
}

function potionBagIsFullFor(potionId){
  const potions=normalizePotionState(state.inventory?.potions);
  if((potions.owned[potionId]||0)>0) return false;
  return Object.values(potions.owned).filter((quantity)=>Math.max(0,Number(quantity)||0)>0).length>=POTION_BAG_SLOT_LIMIT;
}

function returnToShopMap(){
  document.getElementById('sheetInventory')?.classList.remove('inventory-shop-cosmetic-open');
  forgeFromCity=false;
  shopViewSection='map';
  showInventoryPanel('shop');
}

function returnToCharacterSheetFromShop(){
  selectedOutfitDraft=null;
  outfitSelectorContext='collection';
  document.getElementById('outfitSelectorBg')?.classList.remove('show');
  document.getElementById('sheetRelicDetail')?.classList.remove('show');
  document.getElementById('sheetInventory')?.classList.remove('show','inventory-shop-cosmetic-open');
  forgeFromCity=false;
  shopViewSection='map';
  renderCurrentCharacterSheet();
  showSheet(document,'sheetCharacter');
}

function activeShopDestinationPanel(){
  if(forgeFromCity) return document.getElementById('forgeBody');
  if(['potions','relics'].includes(shopViewSection)) return document.getElementById('shopBody');
  return null;
}

document.getElementById('sheetInventory').addEventListener('click',event=>{
  if(event.target.closest('[data-return-character-sheet]')) return;
  const destinationPanel=activeShopDestinationPanel();
  if(!destinationPanel||destinationPanel.contains(event.target)) return;
  event.stopImmediatePropagation();
  returnToShopMap();
},true);

document.getElementById('sheetInventory').addEventListener('click',async event=>{
  if(event.target.closest('[data-return-character-sheet]')){
    returnToCharacterSheetFromShop();
    return;
  }
  if(event.target===event.currentTarget||event.target.closest('[data-sheet="sheetInventory"]')){
    clearFusionFeedback();
  }
  if(event.target.closest('#bagTab')){ forgeFromCity=false; showInventoryPanel('bag'); return; }
  if(event.target.closest('#shopTab')){
    dismissFeatureDiscovery('inventory-market');
    forgeFromCity=false;
    shopViewSection='map';
    showInventoryPanel('shop');
    return;
  }
  if(event.target.closest('[data-close-shop-map]')){
    forgeFromCity=false;
    shopViewSection='map';
    showInventoryPanel('bag');
    return;
  }
  if(event.target.closest('[data-close-shop-destination]')){
    returnToShopMap();
    return;
  }
  if(event.target.closest('[data-back-shop-city]')){
    returnToShopMap();
    return;
  }
  const shopDestination=event.target.closest('[data-shop-destination]');
  if(shopDestination){
    const destination=shopDestination.dataset.shopDestination;
    if(destination==='forge'){
      forgeFromCity=true;
      showInventoryPanel('forge');
      return;
    }
    if(destination==='potions'||destination==='relics'){
      shopViewSection=destination;
      showInventoryPanel('shop');
      return;
    }
    if(destination==='weave'||destination==='frames'){
      outfitSelectorContext='shop';
      outfitSelectorSection=destination;
      selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:outfitSelectorSection,context:'shop'});
      document.getElementById('sheetInventory')?.classList.add('inventory-shop-cosmetic-open');
      document.getElementById('outfitSelectorBg').classList.add('show');
      return;
    }
  }
  if(event.target.closest('[data-open-potion-shop]')){
    shopViewSection='potions';
    showInventoryPanel('shop');
    return;
  }
  const outfitShortcut=event.target.closest('[data-open-outfits]');
  if(outfitShortcut){
    dismissAureoNotice('outfits');
    outfitSelectorContext='collection';
    outfitSelectorSection='owned';
    selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:outfitSelectorSection,context:'collection'});
    document.getElementById('outfitSelectorBg').classList.add('show');
    return;
  }
  const forgeScrollButton=event.target.closest('[data-forge-scroll]');
  if(forgeScrollButton){
    const relicStrip=forgeScrollButton.closest('.forge-collection')?.querySelector('.forge-relic-grid');
    if(relicStrip){
      const direction=Number(forgeScrollButton.dataset.forgeScroll)||1;
      relicStrip.scrollBy({left:direction*Math.max(138,relicStrip.clientWidth*.7),behavior:'smooth'});
    }
    return;
  }
  const equipPicker=event.target.closest('[data-open-equip-picker]');
  if(equipPicker){
    forgePickerTarget={mode:'equip',slot:Number(equipPicker.dataset.openEquipPicker)||0};
    renderForgeRelicPicker(document,state,forgePickerTarget);
    document.getElementById('forgeRelicPickerBg').classList.add('show');
    return;
  }
  const effectInfo=event.target.closest('[data-relic-effect]');
  if(effectInfo){
    if(renderRelicEffectInfo(document,effectInfo.dataset.relicEffect)){
      document.getElementById('relicEffectInfoBg').classList.add('show');
    }
    return;
  }
  const purchase=event.target.closest('[data-buy-relic]');
  if(purchase){
    if(purchase.disabled||shopLocked) return;
    const relicId=purchase.dataset.buyRelic;
    const offer=shopOffers(normalizeLootState(state),Date.now()).find(item=>item.relicId===relicId);
    if(!offer) return;
    openShopPurchaseConfirmation({type:'relic',relicId,name:offer.definition.name,coinCost:offer.coinPrice,bloodCost:offer.bloodPrice});
    return;
  }
  const forgeChoice=event.target.closest('[data-select-forge-relic]');
  if(forgeChoice){
    const previousScroll=forgeChoice.closest('.forge-relic-grid')?.scrollLeft||0;
    selectedForgeRelicId=forgeChoice.dataset.selectForgeRelic;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    const relicStrip=document.querySelector('.forge-relic-grid');
    if(relicStrip) relicStrip.scrollLeft=previousScroll;
    return;
  }
  const forgeModeButton=event.target.closest('[data-forge-mode]');
  if(forgeModeButton){
    forgeMode=['fusion','defusion'].includes(forgeModeButton.dataset.forgeMode)
      ? forgeModeButton.dataset.forgeMode
      :'upgrade';
    clearFusionFeedback();
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    scheduleInventorySheetPosition();
    return;
  }
  const fusionChoice=event.target.closest('[data-select-fusion-relic]');
  if(fusionChoice){
    const relicId=fusionChoice.dataset.selectFusionRelic;
    const selection=nextFusionSelection({leftId:fusionLeftId,rightId:fusionRightId},relicId);
    fusionLeftId=selection.leftId;
    fusionRightId=selection.rightId;
    fusionErrorId=selection.errorId;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  const defusionChoice=event.target.closest('[data-select-defusion-relic]');
  if(defusionChoice){
    selectedForgeRelicId=defusionChoice.dataset.selectDefusionRelic;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  const potionPurchase=event.target.closest('[data-buy-potion]');
  if(potionPurchase){
    const potionId=potionPurchase.dataset.buyPotion;
    const quantity=Number(event.currentTarget.querySelector('[data-potion-quantity]')?.textContent)||1;
    const definition=POTION_BY_ID[potionId];
    if(!definition) return;
    if(potionBagIsFullFor(potionId)){
      showToast('Bolso lleno · libera un hueco','dmg');
      return;
    }
    if(definition.price*quantity>(Number(state.economy?.coins)||0)){
      showToast('No tienes suficiente oro','dmg');
      return;
    }
    openShopPurchaseConfirmation({type:'potion',potionId,name:definition.name,quantity,coinCost:definition.price*quantity});
    return;
  }
  const shopPotionOpen=event.target.closest('[data-open-shop-potion]');
  if(shopPotionOpen){
    if(renderPotionDetail(document,state,shopPotionOpen.dataset.openShopPotion,{...potionViewOptions(),mode:'shop',nowTimestamp:Date.now()})){
      showSheet(document,'sheetRelicDetail');
    }
    return;
  }
  const potionUse=event.target.closest('[data-use-potion]');
  if(potionUse){
    handlePotionUse(potionUse.dataset.usePotion);
    return;
  }
  const potionOpen=event.target.closest('[data-open-potion]');
  if(potionOpen){
    if(renderPotionDetail(document,state,potionOpen.dataset.openPotion,{...potionViewOptions(),nowTimestamp:Date.now()})){
      showSheet(document,'sheetRelicDetail');
    }
    return;
  }
  const filledFusionSlot=event.target.closest('[data-open-filled-fusion-slot]');
  if(filledFusionSlot){
    handleFilledFusionSlotTap(filledFusionSlot.dataset.openFilledFusionSlot);
    return;
  }
  const openForgePicker=event.target.closest('[data-open-forge-picker]');
  if(openForgePicker){
    forgePickerTarget={mode:openForgePicker.dataset.openForgePicker,slot:openForgePicker.dataset.fusionSlot||'left'};
    renderForgeRelicPicker(document,state,{...forgePickerTarget,leftId:fusionLeftId,rightId:fusionRightId,currentId:selectedForgeRelicId});
    document.getElementById('forgeRelicPickerBg').classList.add('show');
    return;
  }
  const fusionButton=event.target.closest('[data-fuse-relics]');
  if(fusionButton&&!fusionButton.disabled){
    const [leftId,rightId]=fusionButton.dataset.fuseRelics.split('|');
    const left=relicDefinition(leftId),right=relicDefinition(rightId);
    if(!left||!right) return;
    pendingFusion={leftId,rightId};
    const losesConstancy=state.inventory?.equipped?.some(id=>
      (id===leftId||id===rightId)&&(id==='relic_04'||Number(state.inventory?.relics?.[id]?.inheritedEffects?.relic_04)>0)
    )&&(Number(state.inventory?.constancy?.charge)||0)>0;
    const preview=getForgeFusionPreview(state,leftId,rightId);
    document.getElementById('fusionConfirmBody').innerHTML=`<p><b>${left.name}</b> + <b>${right.name}</b></p><p>Probabilidad de éxito: <b>${preview.successProbability}%</b>. El intento cuesta <b>100 de oro</b>.</p><p>Las reliquias y <b>1 Sangre de Jefe</b> solo se consumirán si tiene éxito.</p>${losesConstancy?`<p><b>Si tiene éxito, perderás tu carga de Constancia actual (${state.inventory.constancy.charge}/6).</b></p>`:''}`;
    document.getElementById('fusionConfirmBg').classList.add('show');
    return;
  }
  const relic=event.target.closest('[data-open-relic]');
  if(relic){
    if(relic.dataset.doubleTapUnequip){
      handleActiveRelicTap(relic.dataset.doubleTapUnequip);
      return;
    }
    openRelicDetail(relic.dataset.openRelic);
  }
  const relicFilter=event.target.closest('[data-relic-filter]');
  if(relicFilter){
    const filter=relicFilter.dataset.relicFilter;
    const filterPanel=relicFilter.closest('#inventoryBody, #collectionBody');
    filterPanel?.querySelectorAll('[data-relic-filter]').forEach(button=>{
      const active=button===relicFilter;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    filterPanel?.querySelectorAll('[data-relic-kind]').forEach(item=>{
      item.hidden=filter!=='all'&&item.dataset.relicKind!==filter;
    });
  }
});

function closeAttributeResetConfirmation(){
  document.getElementById('attributeResetConfirmBg').classList.remove('show');
}

function openAttributeResetConfirmation(){
  const stats=gameStats();
  const sheet=attributeSheet({classId:state.game.cls,level:stats.lvl,allocation:state.game.attributes});
  if(!sheet.spentPoints) return;
  document.getElementById('attributeResetConfirmPoints').textContent=`${sheet.spentPoints} ${sheet.spentPoints===1?'punto':'puntos'}`;
  document.getElementById('attributeResetConfirmBg').classList.add('show');
}

function confirmAttributeReset(){
  closeAttributeResetConfirmation();
  state.game.attributes=resetAttributeAllocation();
  scheduleSave({type:'hero:attributes-reset'});
  renderCurrentCharacterSheet();
  renderHunt();
  showToast('Atributos reseteados','ok');
}

document.getElementById('attributeResetConfirmCancel').addEventListener('click',closeAttributeResetConfirmation);
document.getElementById('attributeResetConfirmAccept').addEventListener('click',confirmAttributeReset);
document.getElementById('attributeResetConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='attributeResetConfirmBg') closeAttributeResetConfirmation();
});

document.getElementById('sheetCharacter').addEventListener('click',event=>{
  const resetAttributes=event.target.closest('[data-character-reset-attributes]');
  if(resetAttributes&&!resetAttributes.disabled){
    openAttributeResetConfirmation();
    return;
  }
  const defusionButton=event.target.closest('[data-defuse-relic]');
  if(defusionButton&&!defusionButton.disabled){
    const relicId=defusionButton.dataset.defuseRelic;
    const preview=getDefusionPreview(state,relicId);
    if(!preview.ok) return;
    pendingDefusionRelicId=relicId;
    const ingredientNames=preview.ingredientIds.map(id=>relicDefinition(id)?.name||id);
    document.getElementById('defusionConfirmBody').innerHTML=`<p>Vas a consumir <b>${preview.definition.name}</b>.</p><p>Recuperarás <b>${ingredientNames.join('</b> y <b>')}</b> con su rareza, rango y efectos originales.</p><p>Coste: <b>${preview.coinCost} de oro</b> y <b>${preview.bloodCost} Sangre de Jefe</b>.</p>`;
    document.getElementById('defusionConfirmBg').classList.add('show');
    return;
  }
  const attribute=event.target.closest('[data-character-attribute]');
  if(attribute&&!attribute.disabled){
    const result=allocateAttributePoint({classId:state.game.cls,level:gameStats().lvl,allocation:state.game.attributes,attributeId:attribute.dataset.characterAttribute});
    if(!result.ok){showToast('No tienes puntos disponibles','dmg');return;}
    state.game.attributes=result.sheet.allocation;
    scheduleSave({type:'hero:attribute',attributeId:attribute.dataset.characterAttribute});
    renderCurrentCharacterSheet();
    renderHunt();
    return;
  }
  const relicSlot=event.target.closest('[data-character-relic-slot]');
  if(relicSlot){
    forgePickerTarget={mode:'equip',slot:Number(relicSlot.dataset.characterRelicSlot),source:'character'};
    renderForgeRelicPicker(document,state,forgePickerTarget);
    document.getElementById('forgeRelicPickerBg').classList.add('show');
    return;
  }
  if(event.target.closest('[data-character-bag]')){
    dismissFeatureDiscovery('character-bag');
    dismissFeatureDiscovery('character-bag-market');
    openInventory();
    return;
  }
  if(event.target.closest('[data-character-outfit]')){
    dismissFeatureDiscovery('character-hero');
    dismissFeatureDiscovery('character-backgrounds');
    outfitSelectorContext='collection';
    outfitSelectorSection='owned';
    selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:'owned',context:'collection'});
    document.getElementById('outfitSelectorBg').classList.add('show');
    return;
  }
  if(event.target.closest('[data-character-skills]')){
    showHeroSkillsPanel();
    showSheet(document,'sheetHeroSkills');
  }
});

document.getElementById('outfitSelectorBg').addEventListener('click',event=>{
  if(event.target.closest('[data-return-character-sheet]')){
    returnToCharacterSheetFromShop();
    return;
  }
  if(event.target.closest('#outfitSelectorBack')){
    selectedOutfitDraft=null;
    selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:outfitSelectorSection,context:outfitSelectorContext});
    return;
  }
  const sectionButton=event.target.closest('[data-outfit-section]');
  if(sectionButton){
    outfitSelectorContext='collection';
    outfitSelectorSection=sectionButton.dataset.outfitSection==='frames'?'frames':'owned';
    if(outfitSelectorSection==='frames') dismissAureoNotice('backgrounds');
    selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:outfitSelectorSection,context:'collection'});
    return;
  }
  const option=event.target.closest('[data-select-outfit]');
  if(option){
    selectedOutfitDraft=renderOutfitSelector(document,state,option.dataset.selectOutfit,{section:'owned',context:'collection'});
    return;
  }
  const weaveOption=event.target.closest('[data-select-weave-outfit]');
  if(weaveOption){
    selectedOutfitDraft=renderOutfitSelector(document,state,weaveOption.dataset.selectWeaveOutfit,{section:'weave',context:'shop'});
    return;
  }
  const frameOption=event.target.closest('[data-select-frame]');
  if(frameOption){
    selectedOutfitDraft=renderOutfitSelector(document,state,frameOption.dataset.selectFrame,{section:'frames',context:outfitSelectorContext});
    return;
  }
  const weave=event.target.closest('[data-weave-outfit]');
  if(weave&&!weave.disabled){
    const outfitId=weave.dataset.weaveOutfit;
    const outfit=OUTFIT_DEFINITIONS.find(item=>item.id===outfitId&&item.craftable&&item.recipe);
    if(!outfit) return;
    openShopPurchaseConfirmation({
      type:'outfit',
      outfitId,
      name:outfit.name,
      fiberCost:outfit.recipe.arcaneFibers,
      coinCost:outfit.recipe.coins,
    });
    return;
  }
  const paint=event.target.closest('[data-paint-frame]');
  if(paint&&!paint.disabled){
    const frameId=paint.dataset.paintFrame;
    const frame=FRAME_DEFINITIONS.find(item=>item.id===frameId&&item.recipe);
    if(!frame) return;
    openShopPurchaseConfirmation({
      type:'frame',frameId,name:frame.name,
      inkCost:frame.recipe.arcaneInks,coinCost:frame.recipe.coins,
    });
    return;
  }
  const equip=event.target.closest('[data-equip-outfit]');
  if(equip&&!equip.disabled){
    const outfitId=equip.dataset.equipOutfit;
    if(!isOutfitUnlocked(outfitId,state.game)) return;
    state.game={...state.game,outfit:outfitId};
    selectedOutfitDraft=outfitId;
    scheduleSave({type:'hero:outfit-equipped',outfitId});
    document.getElementById('outfitSelectorBg').classList.remove('show');
    renderInventoryView(document,state,potionViewOptions());
    renderHero();
    renderHoy();
    renderHabits();
    if(document.getElementById('sheetCharacter')?.classList.contains('show')){
      renderCurrentCharacterSheet();
    }
    showToast('Outfit equipado','heal');
    return;
  }
  const equipFrame=event.target.closest('[data-equip-frame]');
  if(equipFrame&&!equipFrame.disabled){
    const frameId=equipFrame.dataset.equipFrame;
    if(!isFrameUnlocked(frameId,state.game)) return;
    state.game={...state.game,frame:frameId};
    selectedOutfitDraft=frameId;
    scheduleSave({type:'hero:frame-equipped',frameId});
    document.getElementById('outfitSelectorBg').classList.remove('show');
    renderInventoryView(document,state,potionViewOptions());
    renderHero();
    renderHoy();
    renderHabits();
    if(document.getElementById('sheetCharacter')?.classList.contains('show')){
      renderCurrentCharacterSheet();
    }
    showToast('Marco equipado','heal');
    return;
  }
  if(event.target.id==='outfitSelectorBg'||event.target.closest('#outfitSelectorClose')){
    selectedOutfitDraft=null;
    document.getElementById('outfitSelectorBg').classList.remove('show');
    if(outfitSelectorContext==='shop'){
      returnToShopMap();
    }
  }
});
document.getElementById('forgeRelicPickerBg').addEventListener('click',event=>{
  if(event.target.id==='forgeRelicPickerBg'){event.currentTarget.classList.remove('show');return;}
  const unequipChoice=event.target.closest('[data-picker-unequip]');
  if(unequipChoice&&forgePickerTarget?.mode==='equip'){
    const returnToCharacter=forgePickerTarget.source==='character';
    if(!unequipInventoryRelic(unequipChoice.dataset.pickerUnequip)) return;
    event.currentTarget.classList.remove('show');
    forgePickerTarget=null;
    if(returnToCharacter){
      document.getElementById('sheetInventory').classList.remove('show');
      showSheet(document,'sheetCharacter');
      renderCurrentCharacterSheet();
    }
    return;
  }
  const filter=event.target.closest('[data-picker-filter]');
  if(filter){
    const kind=filter.dataset.pickerFilter;
    document.querySelectorAll('[data-picker-filter]').forEach(button=>button.classList.toggle('active',button===filter));
    document.querySelectorAll('[data-picker-kind]').forEach(item=>{item.hidden=kind!=='all'&&item.dataset.pickerKind!==kind;});
    return;
  }
  const choice=event.target.closest('[data-pick-forge-relic]');
  if(!choice||choice.disabled||!forgePickerTarget) return;
  const relicId=choice.dataset.pickForgeRelic;
  if(forgePickerTarget.mode==='equip'){
    const result=equipRelic(state,relicId,Number(forgePickerTarget.slot));
    if(!result.ok){ showToast(equipFailureMessage(result),'dmg'); return; }
    applyLootSlices(result); syncBossCombat(); capHeroAfterEquipmentChange(); syncPeriodicRelicMana();
    scheduleSave({type:'loot:equip',relicId});
    event.currentTarget.classList.remove('show');
    const returnToCharacter=forgePickerTarget.source==='character';
    forgePickerTarget=null;
    renderInventoryView(document,state,potionViewOptions()); renderHero();
    if(returnToCharacter) renderCurrentCharacterSheet();
    showToast('Reliquia equipada','heal');
    return;
  }
  if(forgePickerTarget.mode==='upgrade'||forgePickerTarget.mode==='defusion') selectedForgeRelicId=relicId;
  else if(forgePickerTarget.slot==='right') fusionRightId=relicId;
  else fusionLeftId=relicId;
  clearFusionFeedback();
  event.currentTarget.classList.remove('show');
  renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
});
document.getElementById('forgeRelicPickerClose').addEventListener('click',()=>document.getElementById('forgeRelicPickerBg').classList.remove('show'));
document.getElementById('sheetRelicDetail').addEventListener('click',async event=>{
  const quantityStep=event.target.closest('[data-potion-quantity-step]');
  if(quantityStep){
    const output=event.currentTarget.querySelector('[data-potion-quantity]');
    const buyButton=event.currentTarget.querySelector('[data-buy-potion]');
    if(!output||!buyButton) return;
    const next=Math.min(99,Math.max(1,(Number(output.textContent)||1)+Number(quantityStep.dataset.potionQuantityStep)));
    output.textContent=String(next);
    const total=next*(Number(buyButton.dataset.unitPrice)||0);
    const lacksCoins=total>(Number(state.economy?.coins)||0);
    const bagFull=potionBagIsFullFor(buyButton.dataset.buyPotion);
    buyButton.setAttribute('aria-disabled',String(lacksCoins||bagFull));
    buyButton.textContent=bagFull?'BOLSO LLENO':lacksCoins?'FALTA ORO':`COMPRAR · ${total}`;
    return;
  }
  const potionPurchase=event.target.closest('[data-buy-potion]');
  if(potionPurchase){
    const quantity=Number(event.currentTarget.querySelector('[data-potion-quantity]')?.textContent)||1;
    const potionId=potionPurchase.dataset.buyPotion;
    const definition=POTION_BY_ID[potionId];
    if(!definition) return;
    if(potionBagIsFullFor(potionId)){
      showToast('Bolso lleno · libera un hueco','dmg');
      return;
    }
    if(definition.price*quantity>(Number(state.economy?.coins)||0)){
      showToast('No tienes suficiente oro','dmg');
      return;
    }
    openShopPurchaseConfirmation({type:'potion',potionId,name:definition.name,quantity,coinCost:definition.price*quantity});
    return;
  }
  const potionUse=event.target.closest('[data-use-potion]');
  if(potionUse){
    handlePotionUse(potionUse.dataset.usePotion);
    return;
  }
  const forgeShortcut=event.target.closest('[data-open-forge-relic]');
  if(forgeShortcut){
    selectedForgeRelicId=forgeShortcut.dataset.openForgeRelic;
    forgeMode='upgrade';
    forgeFromCity=true;
    document.getElementById('sheetRelicDetail').classList.remove('show');
    showSheet(document,'sheetInventory');
    showInventoryPanel('forge');
    return;
  }
  const effectInfo=event.target.closest('[data-relic-effect]');
  if(effectInfo){
    if(renderRelicEffectInfo(document,effectInfo.dataset.relicEffect)){
      document.getElementById('relicEffectInfoBg').classList.add('show');
    }
    return;
  }
  const equip=event.target.closest('[data-equip-relic]');
  if(equip){
    const replace=Number.isInteger(Number(equip.dataset.replaceSlot))
      ? Number(equip.dataset.replaceSlot)
      : null;
    let result=equipRelic(state,equip.dataset.equipRelic,replace);
    if(result.reason==='constancy-confirmation-required'){
      if(!confirmConstancyLoss(result,'Sustituir')) return;
      result=equipRelic(state,equip.dataset.equipRelic,replace,{confirmConstancyReset:true});
    }
    if(!result.ok){ showToast(equipFailureMessage(result),'dmg'); return; }
    applyLootSlices(result); syncBossCombat(); capHeroAfterEquipmentChange(); syncPeriodicRelicMana();
    scheduleSave({type:'loot:equip',relicId:equip.dataset.equipRelic});
    document.getElementById('sheetRelicDetail').classList.remove('show');
    showSheet(document,'sheetInventory');
    showInventoryPanel('collection',true); renderHero();
    showToast('Reliquia equipada','heal');
    return;
  }
  const unequip=event.target.closest('[data-unequip-relic]');
  if(unequip){
    unequipInventoryRelic(unequip.dataset.unequipRelic);
    return;
  }
});
document.getElementById('relicEffectInfoClose').addEventListener('click',()=>{
  document.getElementById('relicEffectInfoBg').classList.remove('show');
});
document.getElementById('relicEffectInfoBg').addEventListener('click',event=>{
  if(event.target.id==='relicEffectInfoBg') event.currentTarget.classList.remove('show');
});
async function handleForgeAttempt(relicId){
  if(!relicId||forgeLocked) return;
  forgeLocked=true;
  const operationId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previousLootState=normalizeLootState(state);
  const result=attemptForge({state,relicId,operationId});
  if(result.ok){
    const commit=await commitLootOperation({
      previousState:previousLootState,
      nextState:result,
      applyState:applyLootSlices,
      persist:()=>store.set(ACTIVE_STORAGE_KEY,serializeState(state))
    });
    if(!commit.ok){
      console.error('No se pudo guardar el intento de Forja',commit.error);
      showToast('No se guardó la Forja','dmg');
      selectedForgeRelicId=relicId;
      renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions()); renderInventoryView(document,state); renderHero();
      forgeLocked=false;
      return;
    }
    handleSaveResult(commit.saveResult);
    document.getElementById('forgeResultBody').innerHTML=forgeResultMarkup(result,relicDefinition(relicId)?.name||'Reliquia',relicId);
    document.getElementById('forgeResultBg').classList.add('show');
    selectedForgeRelicId=relicId;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions()); renderInventoryView(document,state); renderHero();
  }else showToast(result.reason==='coins'?'No tienes suficiente oro':result.reason==='blood'?'No tienes suficiente Sangre de Jefe':'No cumples los requisitos de la Forja','dmg');
  forgeLocked=false;
}
document.getElementById('forgeBody').addEventListener('click',event=>{
  const forgeInfoButton=event.target.closest('.forge-info summary');
  if(forgeInfoButton){
    requestAnimationFrame(()=>{
      const details=forgeInfoButton.closest('.forge-info');
      const popover=details?.querySelector('.forge-info-popover');
      if(!details?.open||!popover) return;
      const buttonBounds=forgeInfoButton.getBoundingClientRect();
      popover.style.setProperty('--forge-info-top',`${Math.round(buttonBounds.bottom+6)}px`);
    });
  }
  const forge=event.target.closest('[data-forge-relic]');
  if(!forge||forge.disabled) return;
  const relicId=forge.dataset.forgeRelic;
  const preview=forgePreview(normalizeLootState(state),relicId);
  const definition=relicDefinition(relicId);
  if(!preview.ok||!definition) return;
  pendingForgeAttempt=relicId;
  document.getElementById('forgeAttemptConfirmTitle').textContent='¿Quieres forjar esta reliquia?';
  document.getElementById('forgeAttemptConfirmBody').replaceChildren();
  document.getElementById('forgeAttemptConfirmAccept').disabled=false;
  document.getElementById('forgeAttemptConfirmBg').classList.add('show');
});
document.addEventListener('click',event=>closeForgeInfoOutside(document,event.target));
document.getElementById('forgeResultClose').addEventListener('click',()=>{
  document.getElementById('forgeResultBg').classList.remove('show');
});
document.getElementById('forgeAttemptConfirmCancel').addEventListener('click',()=>{
  pendingForgeAttempt=null;
  document.getElementById('forgeAttemptConfirmBg').classList.remove('show');
});
document.getElementById('forgeAttemptConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='forgeAttemptConfirmBg'){
    pendingForgeAttempt=null;
    event.currentTarget.classList.remove('show');
  }
});
document.getElementById('forgeAttemptConfirmAccept').addEventListener('click',async event=>{
  if(!pendingForgeAttempt||forgeLocked||event.currentTarget.disabled) return;
  const relicId=pendingForgeAttempt;
  pendingForgeAttempt=null;
  event.currentTarget.disabled=true;
  document.getElementById('forgeAttemptConfirmBg').classList.remove('show');
  await handleForgeAttempt(relicId);
});
document.getElementById('fusionConfirmCancel').addEventListener('click',()=>{
  pendingFusion=null;
  document.getElementById('fusionConfirmBg').classList.remove('show');
});
document.getElementById('defusionConfirmCancel').addEventListener('click',()=>{
  pendingDefusionRelicId=null;
  document.getElementById('defusionConfirmBg').classList.remove('show');
});
document.getElementById('defusionConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='defusionConfirmBg'){
    pendingDefusionRelicId=null;
    event.currentTarget.classList.remove('show');
  }
});
document.getElementById('shopPurchaseConfirmCancel').addEventListener('click',()=>{
  pendingShopPurchase=null;
  document.getElementById('shopPurchaseConfirmBg').classList.remove('show');
});
document.getElementById('shopPurchaseConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='shopPurchaseConfirmBg'){
    pendingShopPurchase=null;
    event.currentTarget.classList.remove('show');
  }
});
document.getElementById('shopPurchaseConfirmAccept').addEventListener('click',async event=>{
  if(!pendingShopPurchase||event.currentTarget.disabled) return;
  const purchase=pendingShopPurchase;
  pendingShopPurchase=null;
  event.currentTarget.disabled=true;
  document.getElementById('shopPurchaseConfirmBg').classList.remove('show');
  if(purchase.type==='potion') handlePotionPurchase(purchase.potionId,purchase.quantity);
  else if(purchase.type==='outfit') handleOutfitWeave(purchase.outfitId);
  else if(purchase.type==='frame') handleFramePaint(purchase.frameId);
  else await handleRelicPurchase(purchase.relicId);
});
document.getElementById('fusionConfirmBg').addEventListener('click',event=>{
  if(event.target.id==='fusionConfirmBg'){
    pendingFusion=null;
    event.currentTarget.classList.remove('show');
  }
});
document.getElementById('fusionConfirmAccept').addEventListener('click',async()=>{
  if(!pendingFusion||forgeLocked) return;
  forgeLocked=true;
  const {leftId,rightId}=pendingFusion;
  const operationId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previousLootState=normalizeLootState(state);
  const result=fuseRelics({state,leftId,rightId,operationId,nowTimestamp:Date.now()});
  if(!result.ok){
    forgeLocked=false;
    pendingFusion=null;
    document.getElementById('fusionConfirmBg').classList.remove('show');
    showToast('La Fusión ya no puede completarse','dmg');
    return;
  }
  const commit=await commitLootOperation({
    previousState:previousLootState,
    nextState:result,
    applyState:applyLootSlices,
    persist:()=>store.set(ACTIVE_STORAGE_KEY,serializeState(state))
  });
  document.getElementById('fusionConfirmBg').classList.remove('show');
  pendingFusion=null;
  if(!commit.ok){
    console.error('No se pudo guardar la Fusión',commit.error);
    showToast('No se guardó la Fusión','dmg');
    forgeLocked=false;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  handleSaveResult(commit.saveResult);
  document.getElementById('forgeResultBody').innerHTML=fusionResultMarkup(result);
  document.getElementById('forgeResultBg').classList.add('show');
  if(result.success){
    capHeroAfterEquipmentChange();
    fusionLeftId=null; fusionRightId=null;
    clearFusionFeedback();
  }
  renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
  renderInventoryView(document,state); renderHero();
  forgeLocked=false;
});
document.getElementById('defusionConfirmAccept').addEventListener('click',async()=>{
  if(!pendingDefusionRelicId||forgeLocked) return;
  forgeLocked=true;
  const relicId=pendingDefusionRelicId;
  pendingDefusionRelicId=null;
  const operationId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previousLootState=normalizeLootState(state);
  const result=defuseRelic({state,relicId,operationId,nowTimestamp:Date.now()});
  document.getElementById('defusionConfirmBg').classList.remove('show');
  if(!result.ok){
    showToast('La Desfusión ya no puede completarse','dmg');
    forgeLocked=false;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  const commit=await commitLootOperation({
    previousState:previousLootState,
    nextState:result,
    applyState:applyLootSlices,
    persist:()=>store.set(ACTIVE_STORAGE_KEY,serializeState(state))
  });
  if(!commit.ok){
    console.error('No se pudo guardar la Desfusión',commit.error);
    showToast('No se guardó la Desfusión','dmg');
    forgeLocked=false;
    renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
    return;
  }
  handleSaveResult(commit.saveResult);
  document.getElementById('forgeResultBody').innerHTML=defusionResultMarkup(result);
  document.getElementById('forgeResultBg').classList.add('show');
  capHeroAfterEquipmentChange();
  selectedForgeRelicId=null;
  renderForgeView(document,state,selectedForgeRelicId,forgeRenderOptions());
  renderInventoryView(document,state); renderHero();
  forgeLocked=false;
});
document.getElementById('pioneerRewardAccept').addEventListener('click',async()=>{
  const button=document.getElementById('pioneerRewardAccept');
  if(button.disabled) return;
  button.disabled=true;
  const previousState=state;
  const claimState=LOCAL_PIONEER_REWARD_PREVIEW&&!state.game?.pioneerReward?.claimedAt
    ? {...state,game:{...state.game,pioneerRewardEligible:true}}
    : state;
  const result=claimPioneerReward(claimState,Date.now());
  if(!result.granted){
    if(LOCAL_PIONEER_REWARD_PREVIEW){
      document.getElementById('pioneerRewardThanks').hidden=true;
      document.getElementById('pioneerRewardReveal').hidden=false;
    }else{
      document.getElementById('pioneerRewardBg').classList.remove('show');
    }
    return;
  }
  state=result.state;
  try{
    handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));
    try{store.recordAction({type:'reward:pioneer-claimed',coins:result.coins,outfitId:result.outfitId},ACTIVE_STORAGE_KEY);}catch(error){console.warn('No se pudo registrar la recompensa de pionero',error);}
    document.getElementById('pioneerRewardThanks').hidden=true;
    document.getElementById('pioneerRewardReveal').hidden=false;
  }catch(error){
    state=previousState;
    button.disabled=false;
    console.error('No se pudo guardar la recompensa de pionero',error);
    showToast('No se guardó la recompensa · reintenta','dmg');
  }
});
document.getElementById('pioneerRewardContinue').addEventListener('click',()=>{
  document.getElementById('pioneerRewardBg').classList.remove('show');
  renderAll();
  showToast('Outfit Beta · +130 oro','heal');
});
document.getElementById('betaTesterRewardAccept').addEventListener('click',async()=>{
  const button=document.getElementById('betaTesterRewardAccept');
  if(button.disabled) return;
  button.disabled=true;
  const reward=pendingDisplayBetaTesterReward();
  if(!reward){
    document.getElementById('betaTesterRewardBg').classList.remove('show');
    return;
  }
  const previousState=state;
  const result=claimBetaTesterReward(
    state,
    reward.id,
    Date.now(),
    {force:LOCAL_BETA_TESTER_REWARD_PREVIEW},
  );
  if(!result.granted){
    if(LOCAL_BETA_TESTER_REWARD_PREVIEW){
      document.getElementById('betaTesterRewardThanks').hidden=true;
      document.getElementById('betaTesterRewardReveal').hidden=false;
    }else{
      document.getElementById('betaTesterRewardBg').classList.remove('show');
    }
    return;
  }
  state=result.state;
  try{
    handleSaveResult(await store.set(ACTIVE_STORAGE_KEY,serializeState(state)));
    try{store.recordAction({type:'reward:beta-tester-claimed',rewardId:reward.id},ACTIVE_STORAGE_KEY);}catch(error){console.warn('No se pudo registrar el regalo Beta Tester',error);}
    document.getElementById('betaTesterRewardThanks').hidden=true;
    document.getElementById('betaTesterRewardReveal').hidden=false;
  }catch(error){
    state=previousState;
    button.disabled=false;
    console.error('No se pudo guardar el regalo Beta Tester',error);
    showToast('No se guardó la recompensa · reintenta','dmg');
  }
});
document.getElementById('betaTesterRewardContinue').addEventListener('click',()=>{
  const inkRewardVisible=!document.getElementById('betaTesterRewardInks')?.hidden;
  document.getElementById('betaTesterRewardBg').classList.remove('show');
  renderAll();
  dismissAureoNotice('backgrounds');
  outfitSelectorContext=inkRewardVisible?'shop':'collection';
  outfitSelectorSection='frames';
  if(inkRewardVisible){
    forgeFromCity=false;
    shopViewSection='map';
    openInventory('shop');
    document.getElementById('sheetInventory')?.classList.add('inventory-shop-cosmetic-open');
  }
  selectedOutfitDraft=renderOutfitSelector(document,state,null,{section:'frames',context:outfitSelectorContext});
  document.getElementById('outfitSelectorBg').classList.add('show');
  showToast(inkRewardVisible?'+20 Tintas · +192 oro':'Fondo · +140 oro · +10 Fibras · +2 Energía','heal');
});
document.getElementById('fiberCatchupContinue').addEventListener('click',()=>{
  const notice=pendingFiberCatchupNotice(state);
  if(!notice) return;
  applyLootSlices(acknowledgeFiberCatchupNotice(state,notice.id));
  document.getElementById('fiberCatchupBg').classList.remove('show');
  scheduleSave({type:'reward:boss-resources-catchup-acknowledged',arcaneFibers:notice.arcaneFibers,arcaneInks:notice.arcaneInks});
  renderAll();
  const rewards=[];
  if(notice.arcaneFibers) rewards.push(`+${notice.arcaneFibers} Fibras Arcanas`);
  if(notice.arcaneInks) rewards.push(`+${notice.arcaneInks} Tintas Arcanas`);
  showToast(rewards.join(' · '),'heal');
});
document.getElementById('progressionUpdateContinue').addEventListener('click',()=>{
  state.game={
    ...state.game,
    updateNotices:{
      ...(state.game.updateNotices||{}),
      [PROGRESSION_UPDATE_NOTICE_ID]:{acknowledgedAt:Date.now()}
    }
  };
  document.getElementById('progressionUpdateBg').classList.remove('show');
  scheduleSave({type:'update:progression-notice-acknowledged',noticeId:PROGRESSION_UPDATE_NOTICE_ID});
  switchView('view-hero','navHero');
  renderHero();
  openCharacterSheet();
});
document.getElementById('lootNoticeActions').addEventListener('click',event=>{
  const inventory=event.target.closest('[data-loot-inventory]');
  const shop=event.target.closest('[data-loot-shop]');
  const keepGoing=event.target.closest('[data-loot-continue]');
  if(inventory){ acknowledgeActiveLootNotice(); switchView('view-hero','navHero'); renderHero(); openInventory('collection'); return; }
  if(shop){ acknowledgeActiveLootNotice(); switchView('view-hero','navHero'); renderHero(); openInventory(); shopViewSection='relics'; showInventoryPanel('shop'); return; }
  if(keepGoing){ acknowledgeActiveLootNotice(); renderAll(); }
});
document.getElementById('lootNoticeRewards').addEventListener('click',event=>{
  const relic=event.target.closest('[data-loot-open-relic]');
  if(!relic) return;
  openRelicDetail(relic.dataset.lootOpenRelic);
  document.getElementById('sheetRelicDetail').classList.add('loot-detail-open');
});
function closeEarlyVictoryNotice(){
  document.getElementById('earlyVictoryBg').classList.remove('show');
}
document.getElementById('earlyVictoryClose').addEventListener('click',closeEarlyVictoryNotice);
document.getElementById('earlyVictoryBg').addEventListener('click',event=>{
  if(event.target.id==='earlyVictoryBg') closeEarlyVictoryNotice();
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
  const text=`¡He derrotado a ${bossName} en Freedom y he conseguido su medallón de victoria!`;
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
  showSheet(document,'sheetBossMedal');
}

function showBossHistoryPanel(panel='combat'){
  const selected=panel==='medals'?'medals':'combat';
  document.querySelectorAll('[data-boss-history-tab]').forEach(button=>{
    const active=button.dataset.bossHistoryTab===selected;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('[data-boss-history-panel]').forEach(section=>{
    section.hidden=section.dataset.bossHistoryPanel!==selected;
  });
  const body=document.getElementById('bossHistoryBody');
  if(body) body.scrollTop=0;
}

document.getElementById('sheetBossHistory').addEventListener('click',async e=>{
  const historyTab=e.target.closest('[data-boss-history-tab]');
  if(historyTab){
    showBossHistoryPanel(historyTab.dataset.bossHistoryTab);
    return;
  }
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
  const currentClass=state.game?.cls;
  if(!currentClass) return;
  const blood=Math.max(0,Number(state.economy?.bossBlood)||0);
  if(!recoveryModeController.isActive()&&blood<1){
    showToast('Cambiar clase · falta 1 Sangre','dmg');
    return;
  }
  classChangeReturn={
    viewId:document.querySelector('.view.active')?.id||'view-hoy',
    buttonId:document.querySelector('#mainNav button.active')?.id||'navHoy'
  };
  pendingClassChange={fromClass:currentClass,level:gameStats().lvl};
  state.game.cls=null;
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
    const imported={...importedState,...initializeForgeSeed(importedState)};
    state=migratePioneerRewardEligibility(imported,{existingProfile:true}).state;
    ensureHero();
    reconcileStoredLevelEightHabitChallenge();
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
  syncPeriodicRelicMana(Date.now(),true);
  if(todayKey()!==lastDay){
    lastDay=todayKey();
    scheduleSave({type:'storage:daily-checkpoint',day:lastDay});
    renderAll();
    if(!LOCAL_PROGRESSION_UPDATE_PREVIEW&&!showPendingDeathModal()) showPendingWeekResult();
  }
  else{renderHoy();renderHero();}
}
setInterval(checkDay,60000);
function visibleCooldownLabel(remainingMs){
  const safeMs=Math.max(0,Number(remainingMs)||0);
  if(safeMs<60000) return `${Math.max(1,Math.ceil(safeMs/1000))}s`;
  if(safeMs<3600000) return `${Math.ceil(safeMs/60000)}m`;
  return `${Math.ceil(safeMs/3600000)}h`;
}
function refreshVisibleSkillCooldowns(){
  let expired=false;
  document.querySelectorAll('#view-hero [data-cooldown-until]').forEach(timer=>{
    const remaining=Number(timer.dataset.cooldownUntil)-Date.now();
    if(remaining<=0){ expired=true; return; }
    timer.textContent=visibleCooldownLabel(remaining);
    timer.setAttribute('aria-label',`Enfriamiento: ${timer.textContent}`);
  });
  if(expired&&document.getElementById('view-hero')?.classList.contains('active')) renderHero();
}
setInterval(refreshVisibleSkillCooldowns,1000);
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
    state.game={...result.game,pioneerRewardEligible:false};
    state.onboarded=result.onboarded;
    applyLootSlices(initializeForgeSeed(state,createForgeSeed()));
    registerDailyWakeEstimate();
    ensureHero();
    scheduleSave();
    document.getElementById('onboard').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('mainNav').classList.add('show');
    switchView('view-hoy','navHoy');
    renderAll();
    queuePioneerReward();
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
    days:{}, habits:{items:[],entries:{}}, todos:{items:[]}, seeded:true, seededV:SEED_V, game:{cls:null}, onboarded:false,
    ...emptyLootState()
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
    const fiberCatchup=reconcileHistoricalBossFibers({
      state,
      bossesDown:totalBossesDown(),
      nowTimestamp:Date.now()
    });
    applyLootSlices(fiberCatchup);
    if(fiberCatchup.granted>0||fiberCatchup.inkGranted>0){
      scheduleSave({
        type:'reward:boss-resources-catchup',
        bosses:fiberCatchup.bossCount,
        arcaneFibers:fiberCatchup.granted,
        arcaneInks:fiberCatchup.inkGranted
      });
    }
    ensureHero();
    prepareLocalDeathPreview();
    reconcileStoredLevelEightHabitChallenge();
    syncPeriodicRelicMana();
    renderStartupPrimary();
    preloadStartupViews();
    if((!LOCAL_DEMO_QUIET||LOCAL_DEATH_PREVIEW)&&!showPendingDeathModal()) showPendingWeekResult();
    if(LOCAL_DEMO_QUIET){
      await finishInitialReturnSplash();
    }else if(LOCAL_LOOT_NOTICE_PREVIEW){
      await finishInitialReturnSplash();
      await showPendingLootNotice();
    }else if(!LOCAL_PROGRESSION_UPDATE_PREVIEW&&(LOCAL_DEMO_FUSIONS||LOCAL_DEMO_CONSTANCY!==null||LOCAL_DEMO_PALADIN_EFFECTS)){
      await finishInitialReturnSplash();
      switchView('view-hero','navHero');
      renderHero();
      if(LOCAL_DEMO_CONSTANCY!==null){
        state.inventory.constancy={
          cycleId:'demo-constancy',charge:LOCAL_DEMO_CONSTANCY,baselineOutcomes:[],
          awaitingBaseline:false,lastIncreaseAt:Date.now(),lastIncreaseCharge:LOCAL_DEMO_CONSTANCY
        };
      }
      if(!LOCAL_DEMO_PALADIN_EFFECTS){
        openInventory();
        showInventoryPanel(LOCAL_DEMO_PROFILE==='control'?'inventory':LOCAL_DEMO_FUSIONS?'collection':'inventory',true);
      }
    }else finishInitialReturnSplash();
  }
  if(!LOCAL_DEMO_QUIET){
    if(!LOCAL_PROGRESSION_UPDATE_PREVIEW){
      queuePioneerReward();
      queueBetaTesterReward();
      queueFiberCatchup();
    }
    queueProgressionUpdate();
  }else if(LOCAL_BETA_TESTER_REWARD_PREVIEW){
    queueBetaTesterReward(220);
  }
})();
