import { describe, expect, it } from 'vitest';
import { renderHabitsView } from './habits-view.js';

function render(habitState) {
  const root = { innerHTML: '' };
  renderHabitsView({
    document: { getElementById: () => root },
    habitState,
    date: new Date(2026, 7, 1, 12),
    planStartDate: '2026-07-17',
    game: { cls: 'paladin', name: 'Kike' },
    stats: { lvl: 4, xp: 120, nextTh: 560, prog: 0.2 },
  });
  return root.innerHTML;
}

describe('vista de hábitos', () => {
  it('muestra el estado vacío y el acceso para crear', () => {
    const html = render({ items: [], entries: {} });
    expect(html).toContain('Crear mi primer hábito');
    expect(html).toContain('data-add-habit');
  });

  it('muestra progreso, recompensa y estado completado', () => {
    const html = render({
      items: [
        {
          id: 'water',
          title: 'Beber agua',
          difficulty: 'medium',
          frequency: 'daily',
          target: 2,
          active: true,
        },
      ],
      entries: {
        'water|d:2026-08-01': {
          habitId: 'water',
          periodKey: 'd:2026-08-01',
          frequency: 'daily',
          count: 2,
          xpAwarded: 6,
        },
      },
    });

    expect(html).toContain('Beber agua');
    expect(html).toContain('data-open-settings');
    expect(html).toContain('Media · Diario · +6 XP');
    expect(html).toContain('2 / 2 · +6 XP');
    expect(html).toContain('completed');
  });
});
