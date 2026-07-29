import { CLASSES } from '../data/game-data.js';

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
}) {
  const selectedClass = CLASSES[classId] ? classId : 'knight';
  return {
    config: {
      startDate,
      startLimit: Number.parseInt(startLimit, 10) || 20,
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
  let pillsYes = true;
  let beerYes = true;
  let chosenClass = null;

  const showStep = (step) => {
    document
      .querySelectorAll('.ob-step')
      .forEach((element) => element.classList.remove('active'));
    document.getElementById(`ob${step}`).classList.add('active');
    document.getElementById('onboard').scrollTop = 0;
  };

  const renderHeroes = () => {
    document.getElementById('obClsGrid').innerHTML = Object.entries(CLASSES)
      .map(
        ([classId, classData]) => `<div class="cls-card" data-obcls="${classId}">
      ${spriteImage(classId, 'happy')}
      <div class="cn">${classData.name}</div>
      <div class="ce">${classData.es}</div>
      <div class="cd">${classData.desc}</div>
    </div>`,
      )
      .join('');
  };

  const resetChoices = () => {
    pillsYes = true;
    beerYes = true;
    chosenClass = null;
    document.querySelectorAll('[data-pills]').forEach((button) => {
      button.classList.toggle('active', button.dataset.pills === 'yes');
    });
    document.querySelectorAll('[data-beer]').forEach((button) => {
      if (button.classList.contains('ob-tg')) {
        button.classList.toggle('active', button.dataset.beer === 'yes');
      }
    });
    document.getElementById('obPillsQty').style.display = 'block';
    document.getElementById('obName').value = '';
  };

  const start = () => {
    resetChoices();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('mainNav').classList.remove('show');
    document.getElementById('onboard').style.display = 'flex';
    document.getElementById('obStart2').value = todayKey();
    renderHeroes();
    showStep(1);
  };

  document.getElementById('onboard').addEventListener('click', () => {
    if (document.getElementById('ob1').classList.contains('active')) {
      showStep(2);
    }
  });
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
  document.getElementById('obToHero').addEventListener('click', (event) => {
    event.stopPropagation();
    showStep(3);
  });
  document.getElementById('obClsGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-obcls]');
    if (!card) return;
    chosenClass = card.dataset.obcls;
    const classData = CLASSES[chosenClass];
    document.getElementById('obHeroPreview').innerHTML = spriteImage(
      chosenClass,
      'happy',
    );
    document.getElementById('obName').value = '';
    document.getElementById('obName').placeholder = `${classData.es}…`;
    showStep(4);
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
      }),
    );
  });

  return { start, showStep };
}
