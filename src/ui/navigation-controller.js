export const VIEW_BY_NAVIGATION = {
  navHoy: 'view-hoy',
  navHabits: 'view-habits',
  navHero: 'view-hero',
  navCal: 'view-cal',
};

export function bindNavigation({
  document,
  window,
  onOpenSettings,
  onHabits,
  onCalendar,
}) {
  const switchView = (viewId, buttonId) => {
    document
      .querySelectorAll('nav button, .gear-btn')
      .forEach((button) => button.classList.remove('active'));
    document
      .querySelectorAll('.view')
      .forEach((view) => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.getElementById(buttonId).classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('scrollArea').scrollTop = 0;
  };

  Object.entries(VIEW_BY_NAVIGATION).forEach(([buttonId, viewId]) => {
    document.getElementById(buttonId).addEventListener('click', () => {
      switchView(viewId, buttonId);
      if (buttonId === 'navHabits') onHabits();
      if (buttonId === 'navCal') onCalendar();
    });
  });

  document.getElementById('view-hoy').addEventListener('click', (event) => {
    if (event.target.closest('.hoy-face')) onOpenSettings();
  });
  document.getElementById('navMenu').addEventListener('click', () => {
    document.getElementById('menuBg').classList.add('show');
  });
  document.getElementById('menuAjustes').addEventListener('click', () => {
    document.getElementById('menuBg').classList.remove('show');
    onOpenSettings();
  });
  document.getElementById('menuInstr').addEventListener('click', () => {
    document.getElementById('menuBg').classList.remove('show');
    document.getElementById('sheetInstr').classList.add('show');
  });
  document.getElementById('menuBg').addEventListener('click', (event) => {
    if (event.target.id === 'menuBg') event.target.classList.remove('show');
  });
  document.querySelectorAll('.sheet-close').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.sheet).classList.remove('show');
    });
  });
  document.querySelectorAll('.sheet-bg').forEach((sheet) => {
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) sheet.classList.remove('show');
    });
  });

  return { switchView };
}
