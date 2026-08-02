import { isSmokeFreeMode } from '../domain/journey-mode-rules.js';

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
  };
}

export function renderSettingsView({ document, config, game }) {
  const model = createSettingsModel({ config, game });
  document.getElementById('cfgStart').value = model.startDate;
  document.getElementById('cfgLimit').value = model.startLimit;
  const limitRow = document.getElementById('settingsLimitRow');
  if (limitRow) limitRow.style.display = model.smokeFreeMode ? 'none' : '';
  const journeyMode = document.getElementById('settingsJourneyMode');
  if (journeyMode) {
    journeyMode.textContent = model.smokeFreeMode
      ? 'Mantenerme sin fumar'
      : 'Reducción progresiva';
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
