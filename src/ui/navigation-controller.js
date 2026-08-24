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
  onOpenInventory,
  onOpenRecoveries,
  onHabits,
  onCalendar,
}) {
  const faqSearch = document.getElementById('faqSearch');
  const faqSearchClear = document.getElementById('faqSearchClear');
  const faqEmpty = document.getElementById('faqEmpty');
  const faqCategories = [...document.querySelectorAll('.faq-category')];
  const normalizeFaqText = (value = '') => value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const filterFaq = (rawQuery = '') => {
    const query = normalizeFaqText(rawQuery);
    let visibleItems = 0;

    faqCategories.forEach((category) => {
      const categoryMatch = query && normalizeFaqText(category.dataset.faqCategory).includes(query);
      const items = [...category.querySelectorAll('.faq-item')];
      let categoryItems = 0;

      items.forEach((item) => {
        const matches = !query || categoryMatch || normalizeFaqText(`${item.dataset.faqItem} ${item.textContent}`).includes(query);
        item.hidden = !matches;
        if (matches) {
          categoryItems += 1;
          visibleItems += 1;
        }
        if (!query) item.open = false;
      });

      category.hidden = categoryItems === 0;
      category.open = Boolean(query && categoryItems);
    });

    if (faqSearchClear) faqSearchClear.hidden = !query;
    if (faqEmpty) faqEmpty.hidden = visibleItems !== 0;
  };

  if (faqSearch) {
    faqSearch.addEventListener('input', () => filterFaq(faqSearch.value));
    faqSearchClear?.addEventListener('click', () => {
      faqSearch.value = '';
      filterFaq();
      faqSearch.focus();
    });
  }

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
    if (event.target.closest('.hoy-hero[data-open-inventory]')) onOpenInventory();
  });
  document.getElementById('view-hoy').addEventListener('keydown', (event) => {
    if (!event.target.closest('.hoy-hero[data-open-inventory]') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    onOpenInventory();
  });
  document.getElementById('navMenu').addEventListener('click', () => {
    document.getElementById('menuBg').classList.add('show');
  });
  document.getElementById('menuAjustes').addEventListener('click', () => {
    document.getElementById('menuBg').classList.remove('show');
    onOpenSettings();
  });
  document.getElementById('menuRecoveries').addEventListener('click', () => {
    document.getElementById('menuBg').classList.remove('show');
    onOpenRecoveries();
  });
  document.getElementById('menuInstr').addEventListener('click', () => {
    document.getElementById('menuBg').classList.remove('show');
    document.getElementById('sheetInstr').classList.add('show');
    if (faqSearch) {
      faqSearch.value = '';
      filterFaq();
    }
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
