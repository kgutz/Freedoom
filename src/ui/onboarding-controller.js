import { CLASSES, classDataForJourney } from '../data/game-data.js';
import { heroFaceSource } from '../data/outfit-data.js';
import {
  JOURNEY_MODE_REDUCTION,
  JOURNEY_MODE_SMOKE_FREE,
  JOURNEY_MODE_CONTROLLED,
  DEFAULT_CONTROLLED_DAYS,
  DEFAULT_CONTROLLED_WEEKLY_LIMIT,
  normalizeJourneyMode,
} from '../domain/journey-mode-rules.js';
import {
  SPLASH_FADE_MS,
  SPLASH_MIN_VISIBLE_MS,
  waitForSplashAssets,
} from './splash-assets.js';

export function createOnboardingResult({
  startDate,
  startLimit,
  wakeTime,
  sleepTime,
  dayStartTime,
  takesPills,
  pillsGoal,
  tracksBeer,
  classId,
  heroName,
  journeyMode,
  controlledDays,
  controlledWeeklyLimit,
}) {
  const selectedClass = CLASSES[classId] ? classId : 'knight';
  const selectedMode = normalizeJourneyMode(journeyMode);
  return {
    config: {
      journeyMode: selectedMode,
      startDate,
      startLimit:
        selectedMode !== JOURNEY_MODE_REDUCTION
          ? 21
          : Number.parseInt(startLimit, 10) || 20,
      ...(selectedMode === JOURNEY_MODE_CONTROLLED
        ? {
            controlledDays:
              Array.isArray(controlledDays) && controlledDays.length
                ? controlledDays.map(Number)
                : [...DEFAULT_CONTROLLED_DAYS],
            controlledWeeklyLimit:
              Math.max(1, Number.parseInt(controlledWeeklyLimit, 10)) ||
              DEFAULT_CONTROLLED_WEEKLY_LIMIT,
          }
        : {}),
      wakeTime: wakeTime || '09:00',
      sleepTime: sleepTime || '23:00',
      dayStartTime: dayStartTime || '04:00',
      takesPills,
      pillsGoal: takesPills ? Number.parseInt(pillsGoal, 10) || 3 : 0,
      tracksBeer,
    },
    game: {
      cls: selectedClass,
      name: heroName.trim() || CLASSES[selectedClass].es,
    },
    onboarded: true,
  };
}

export function createOnboardingController({
  document,
  todayKey,
  spriteImage,
  onFinish,
}) {
  let pillsYes = false;
  let beerYes = false;
  let chosenClass = null;
  let chosenJourneyMode = null;
  let introTimer = null;
  let introSequence = 0;

  const renderPlanCopy = (mode) => {
    const copy = {
      [JOURNEY_MODE_REDUCTION]: {
        kicker: 'PASO 2/3',
        summary: 'Marca un objetivo realista. Freedom lo reducirá contigo, semana a semana.',
        start: 'Esta fecha inicia tu primera semana y el combate contra tu primer jefe.',
      },
      [JOURNEY_MODE_SMOKE_FREE]: {
        kicker: 'PASO 2/3',
        summary: 'Cada día cuenta. Registrarás tu constancia mientras tu héroe se hace más fuerte.',
        start: 'Esta fecha comienza tu camino y marca el inicio de cada jefe semanal.',
      },
      [JOURNEY_MODE_CONTROLLED]: {
        kicker: 'PASO 2/3',
        summary: 'Elige tus días permitidos y un límite semanal que puedas mantener.',
        start: 'Esta fecha inicia tu primera semana de control y el combate contra tu primer jefe.',
      },
    }[mode] || {};
    document.getElementById('obPlanKicker').textContent = copy.kicker || 'PASO 2/3';
    document.getElementById('obPlanSummary').textContent = copy.summary || '';
    document.getElementById('obStartNote').textContent = copy.start || '';
  };

  const clearIntroTimer=()=>{
    clearTimeout(introTimer);
    introTimer=null;
    introSequence+=1;
  };

  const playIntro=async()=>{
    clearTimeout(introTimer);
    const sequence=++introSequence;
    const intro=document.getElementById('ob1');
    intro.classList.remove('exit','intro-ready');
    await waitForSplashAssets(intro);
    if(sequence!==introSequence||!intro.classList.contains('active')) return;
    intro.classList.add('intro-ready');
    introTimer=setTimeout(()=>{
      if(!intro.classList.contains('active')) return;
      intro.classList.add('exit');
      introTimer=setTimeout(()=>{
        if(intro.classList.contains('active')) showStep(2);
      },SPLASH_FADE_MS);
    },SPLASH_MIN_VISIBLE_MS);
  };

  const showStep = (step) => {
    clearIntroTimer();
    document.getElementById('ob1').classList.remove('exit','intro-ready');
    document
      .querySelectorAll('.ob-step')
      .forEach((element) => element.classList.remove('active'));
    document.getElementById(`ob${step}`).classList.add('active');
    document.getElementById('onboard').scrollTop = 0;
    if(step===1) playIntro();
  };

  const renderHeroes = () => {
    document.getElementById('obClsGrid').innerHTML = Object.keys(CLASSES)
      .map(
        (classId) => {
          const classData=classDataForJourney(classId,{
            smokeFree:chosenJourneyMode!==JOURNEY_MODE_REDUCTION,
          });
          return `<button type="button" class="cls-card" data-obcls="${classId}">
      <div class="ob-class-art">${spriteImage(classId, 'happy')}</div>
      <div class="ce">${classData.es}</div>
      <div class="cn">${classData.name}</div>
      <div class="cd">${classData.desc}</div>
      <span class="cls-card-action">Elegir</span>
    </button>`;
        },
      )
      .join('');
  };

  const resetChoices = () => {
    pillsYes = false;
    beerYes = false;
    chosenClass = null;
    chosenJourneyMode = null;
    document.querySelectorAll('[data-pills]').forEach((button) => {
      button.classList.remove('active');
    });
    document.querySelectorAll('[data-beer]').forEach((button) => {
      if (button.classList.contains('ob-tg')) {
        button.classList.remove('active');
      }
    });
    document.getElementById('obPillsQty').style.display = 'none';
    document.getElementById('obName').value = '';
    document.querySelectorAll('[data-journey-mode]').forEach((button) => {
      button.classList.remove('active');
    });
    document.querySelectorAll('[data-controlled-day]').forEach((button) => {
      button.classList.toggle(
        'active',
        DEFAULT_CONTROLLED_DAYS.includes(Number(button.dataset.controlledDay)),
      );
    });
    [
      'obStart2',
      'obLimit',
      'obControlledWeeklyLimit',
      'obPills',
      'obWake',
      'obSleep',
      'obDayStart',
    ].forEach((inputId) => {
      document.getElementById(inputId).value = '';
    });
  };

  const start = () => {
    resetChoices();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('mainNav').classList.remove('show');
    document.getElementById('onboard').style.display = 'flex';
    renderHeroes();
    showStep(1);
  };

  document.querySelectorAll('[data-ob-back]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      showStep(Number(button.dataset.obBack));
    });
  });
  document.querySelectorAll('.ob-tg').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const isPills = button.dataset.pills !== undefined;
      button.parentElement
        .querySelectorAll('.ob-tg')
        .forEach((element) => element.classList.remove('active'));
      button.classList.add('active');
      if (isPills) {
        pillsYes = button.dataset.pills === 'yes';
        document.getElementById('obPillsQty').style.display = pillsYes
          ? 'block'
          : 'none';
      } else {
        beerYes = button.dataset.beer === 'yes';
      }
    });
  });
  document.querySelectorAll('[data-journey-mode]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      chosenJourneyMode = normalizeJourneyMode(button.dataset.journeyMode);
      document.querySelectorAll('[data-journey-mode]').forEach((option) => {
        option.classList.toggle('active', option === button);
      });
      const smokeFree = chosenJourneyMode === JOURNEY_MODE_SMOKE_FREE;
      const controlled = chosenJourneyMode === JOURNEY_MODE_CONTROLLED;
      document.getElementById('obLimitField').style.display = smokeFree || controlled
        ? 'none'
        : '';
      document.getElementById('obControlledFields').style.display = controlled
        ? ''
        : 'none';
      renderPlanCopy(chosenJourneyMode);
      showStep(3);
    });
  });
  document.querySelectorAll('[data-controlled-day]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const active = document.querySelectorAll('[data-controlled-day].active');
      if (button.classList.contains('active') && active.length === 1) return;
      button.classList.toggle('active');
    });
  });
  document.getElementById('obToHero').addEventListener('click', (event) => {
    event.stopPropagation();
    if (!chosenJourneyMode) chosenJourneyMode = JOURNEY_MODE_REDUCTION;
    renderHeroes();
    showStep(4);
  });
  document.getElementById('obClsGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-obcls]');
    if (!card) return;
    chosenClass = card.dataset.obcls;
    const classData = classDataForJourney(chosenClass,{
      smokeFree:chosenJourneyMode!==JOURNEY_MODE_REDUCTION,
    });
    document.getElementById('obHeroPreview').innerHTML = `
      <img src="${heroFaceSource(chosenClass)}" alt="Retrato de ${classData.es}">
    `;
    document.getElementById('obName').value = '';
    document.getElementById('obName').placeholder = `${classData.es}…`;
    showStep(5);
  });
  document.getElementById('obFinish').addEventListener('click', (event) => {
    event.stopPropagation();
    onFinish(
      createOnboardingResult({
        startDate: document.getElementById('obStart2').value || todayKey(),
        startLimit: document.getElementById('obLimit').value,
        wakeTime: document.getElementById('obWake').value,
        sleepTime: document.getElementById('obSleep').value,
        dayStartTime: document.getElementById('obDayStart').value,
        takesPills: pillsYes,
        pillsGoal: document.getElementById('obPills').value,
        tracksBeer: beerYes,
        classId: chosenClass || 'knight',
        heroName: document.getElementById('obName').value,
        journeyMode: chosenJourneyMode || JOURNEY_MODE_REDUCTION,
        controlledDays: Array.from(
          document.querySelectorAll('[data-controlled-day].active'),
          (button) => Number(button.dataset.controlledDay),
        ),
        controlledWeeklyLimit: document.getElementById(
          'obControlledWeeklyLimit',
        ).value,
      }),
    );
  });

  return { start, showStep };
}
