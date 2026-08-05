import {
  controlledDaysOf,
  controlledWeeklyLimitOf,
  isControlledMode,
  isSmokeFreeMode,
} from '../domain/journey-mode-rules.js';

export function createSettingsModel({ config, game }) {
  return {
    startDate: config.startDate,
    startLimit: config.startLimit,
    wakeTime: config.wakeTime || '09:00',
    sleepTime: config.sleepTime || '23:00',
    dayStartTime: config.dayStartTime || '04:00',
    pillsGoal: config.pillsGoal || 3,
    heroName: game?.name || '',
    tracksBeer: config.tracksBeer !== false,
    smokeFreeMode: isSmokeFreeMode(config),
    controlledMode: isControlledMode(config),
    controlledDays: controlledDaysOf(config),
    controlledWeeklyLimit: controlledWeeklyLimitOf(config),
    pendingJourneyTransition: config.pendingJourneyTransition || null,
  };
}

export function renderSettingsView({ document, config, game }) {
  const model = createSettingsModel({ config, game });
  document.getElementById('cfgStart').value = model.startDate;
  document.getElementById('cfgLimit').value = model.startLimit;
  const limitRow = document.getElementById('settingsLimitRow');
  if (limitRow) {
    limitRow.style.display =
      model.smokeFreeMode || model.controlledMode ? 'none' : '';
  }
  const journeyMode = document.getElementById('settingsJourneyMode');
  if (journeyMode) {
    journeyMode.textContent = model.smokeFreeMode
      ? 'Mantenerme sin fumar'
      : model.controlledMode
        ? 'Consumo controlado'
        : 'Reducción progresiva';
  }
  const controlledFields = document.getElementById('settingsControlledFields');
  if (controlledFields) {
    controlledFields.style.display = model.controlledMode ? '' : 'none';
    document.querySelectorAll('[data-settings-controlled-day]').forEach(
      (button) => {
        button.classList.toggle(
          'active',
          model.controlledDays.includes(Number(button.dataset.settingsControlledDay)),
        );
      },
    );
    document.getElementById('cfgControlledWeeklyLimit').value =
      model.controlledWeeklyLimit;
  }
  const changeBox = document.getElementById('journeyChangeBox');
  const changeForm = document.getElementById('journeyChangeForm');
  const changeOpen = document.getElementById('journeyChangeOpen');
  const changePending = document.getElementById('journeyChangePending');
  if (changeBox) {
    const pending = model.pendingJourneyTransition;
    changeBox.style.display = model.smokeFreeMode || pending ? '' : 'none';
    changeOpen.style.display = model.smokeFreeMode && !pending ? '' : 'none';
    if (pending) {
      changeForm.style.display = 'none';
      changePending.style.display = '';
      const [year, month, day] = pending.effectiveDate.split('-');
      document.getElementById('journeyChangePendingText').textContent =
        `El consumo controlado comenzará el ${day}/${month}/${year}. ` +
        `Máximo ${pending.controlledWeeklyLimit}/semana.`;
    } else {
      changePending.style.display = 'none';
    }
  }
  document.getElementById('cfgWake').value = model.wakeTime;
  document.getElementById('cfgSleep').value = model.sleepTime;
  document.getElementById('cfgDayStart').value = model.dayStartTime;
  document.getElementById('cfgPills').value = model.pillsGoal;
  const heroName = document.getElementById('cfgHeroName');
  if (heroName) heroName.value = model.heroName;
  const beerYes = document.getElementById('beerYes');
  const beerNo = document.getElementById('beerNo');
  if (beerYes && beerNo) {
    beerYes.classList.toggle('active', model.tracksBeer);
    beerNo.classList.toggle('active', !model.tracksBeer);
  }
}
