import { describe, expect, it } from 'vitest';
import { markedHabitIdsForGame, renderHabitsView } from './habits-view.js';

function render(habitState, filter = 'all', game = { cls: 'paladin', name: 'Kike' }) {
  const root = { innerHTML: '' };
  renderHabitsView({
    document: { getElementById: () => root },
    habitState,
    date: new Date(2026, 7, 1, 12),
    planStartDate: '2026-07-17',
    game,
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
    expect(html).toContain('data-open-inventory');
    expect(html).toContain('<span class="habit-meta">Media · Diario</span>');
    expect(html).toContain('2 / 2 · +6 XP');
    expect(html).not.toContain('🪙');
    expect(html).toContain('completed');
    expect(html).toContain('data-habit-drag');
    expect(html).toContain('Mantener pulsado para mover Beber agua');
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

  it('oculta las recompensas en la descripción y conserva lo ganado debajo', () => {
    const html = render({
      items: [
        { id: 'water', title: 'Beber agua', difficulty: 'medium', frequency: 'daily', target: 3, repeatable: true, active: true },
        { id: 'gym', title: 'Gimnasio', difficulty: 'medium', frequency: 'weekly', target: 3, active: true },
      ],
      entries: {
        'water|d:2026-08-01': { habitId: 'water', periodKey: 'd:2026-08-01', frequency: 'daily', count: 1, xpAwarded: 6, coinsAwarded: 3 },
        'gym|w:2026-07-31': { habitId: 'gym', periodKey: 'w:2026-07-31', frequency: 'weekly', count: 1, xpAwarded: 7, coinsAwarded: 2 },
      },
    });
    expect(html).toContain('<span class="habit-meta">Media · Diario · Repetible</span>');
    expect(html).toContain('<span class="habit-meta">Media · Semanal</span>');
    expect(html).not.toContain('Próximo avance:');
    expect(html).toContain('1 / 3 · +6 XP · +3 🪙');
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
    expect(html).toContain('Mantén pulsado');
  });

  it('muestra los topes dinámicos calculados desde los hábitos activos', () => {
    const html = render({
      items: [
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `daily-hard-${index}`,
          title: `Diario ${index}`,
          difficulty: 'hard',
          frequency: 'daily',
          target: 1,
          active: true,
        })),
        { id: 'weekly-hard-1', title: 'Semanal 1', difficulty: 'hard', frequency: 'weekly', target: 1, active: true },
        { id: 'weekly-hard-2', title: 'Semanal 2', difficulty: 'hard', frequency: 'weekly', target: 1, active: true },
      ],
      entries: {},
    });
    expect(html).toContain('Topes 45/día · 53/sem.');
  });

  it('marca con el estado dorado los hábitos elegidos por una habilidad activa', () => {
    const html = render({
      items: [
        { id: 'water', title: 'Beber agua', difficulty: 'easy', frequency: 'daily', target: 1, active: true },
        { id: 'walk', title: 'Caminar', difficulty: 'easy', frequency: 'daily', target: 1, active: true },
      ],
      entries: {},
    }, 'all', {
      cls: 'paladin',
      name: 'Kike',
      powerProgress: {
        habitChallenge: {
          spellId: 'certero',
          habitIds: ['water'],
          completedIds: [],
          day: '2026-08-01',
        },
      },
    });

    expect(html).toContain('class="habit-row skill-marked" data-habit-id="water" data-skill-marked="true"');
    expect(html).not.toContain('data-habit-id="walk" data-skill-marked="true"');
  });

  it('incluye todos los retos con selección y deja de marcar los completados', () => {
    const expiresAt = new Date(2026, 7, 2, 12).getTime();
    const marked = markedHabitIdsForGame({
      powerProgress: {
        judgment: { day: '2026-08-01', habitIds: ['judgment'], rewarded: false },
        soulWager: { habitId: 'soul', completed: false, expiresAt },
        rebirthHabit: { habitId: 'rebirth', completed: false, expiresAt },
        habitChallenge: { day: '2026-08-01', habitIds: ['finished'], completedIds: ['finished'] },
      },
    }, new Date(2026, 7, 1, 12));

    expect([...marked].sort()).toEqual(['judgment', 'rebirth', 'soul']);
  });
});
