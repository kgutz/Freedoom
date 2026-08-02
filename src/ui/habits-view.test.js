import { describe, expect, it } from 'vitest';
import { renderHabitsView } from './habits-view.js';

function render(habitState, filter = 'all') {
  const root = { innerHTML: '' };
  renderHabitsView({
    document: { getElementById: () => root },
    habitState,
    date: new Date(2026, 7, 1, 12),
    planStartDate: '2026-07-17',
    game: { cls: 'paladin', name: 'Kike' },
    stats: { lvl: 4, xp: 120, nextTh: 560, prog: 0.2 },
    filter,
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
    expect(html).toContain('data-habit-drag');
  });

  it('agrupa diarios antes que semanales aunque se crearan después', () => {
    const html = render({
      items: [
        { id: 'gym', title: 'Gimnasio', difficulty: 'hard', frequency: 'weekly', target: 3, active: true, createdAt: 1 },
        { id: 'water', title: 'Beber agua', difficulty: 'easy', frequency: 'daily', target: 1, active: true, createdAt: 2 },
      ],
      entries: {},
    });

    expect(html.indexOf('Diarios')).toBeLessThan(html.indexOf('Semanales'));
    expect(html.indexOf('Beber agua')).toBeLessThan(html.indexOf('Gimnasio'));
  });

  it('permite mostrar solo una frecuencia', () => {
    const html = render({
      items: [
        { id: 'water', title: 'Beber agua', difficulty: 'easy', frequency: 'daily', target: 1, active: true },
        { id: 'gym', title: 'Gimnasio', difficulty: 'hard', frequency: 'weekly', target: 3, active: true },
      ],
      entries: {},
    }, 'weekly');

    expect(html).not.toContain('Beber agua');
    expect(html).toContain('Gimnasio');
    expect(html).toContain('data-habit-filter="weekly" class="active"');
  });

  it('renderiza los hábitos según su orden guardado', () => {
    const html = render({
      items: [
        { id: 'water', title: 'Beber agua', difficulty: 'easy', frequency: 'daily', target: 1, active: true, order: 2 },
        { id: 'walk', title: 'Caminar', difficulty: 'easy', frequency: 'daily', target: 1, active: true, order: 0 },
        { id: 'read', title: 'Leer', difficulty: 'easy', frequency: 'daily', target: 1, active: true, order: 1 },
      ],
      entries: {},
    });

    expect(html.indexOf('Caminar')).toBeLessThan(html.indexOf('Leer'));
    expect(html.indexOf('Leer')).toBeLessThan(html.indexOf('Beber agua'));
    expect(html).toContain('Arrastra');
  });
});
