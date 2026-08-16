import { CLASSES } from '../data/game-data.js';
import {
  HABIT_DIFFICULTIES,
  habitEntryFor,
  habitProgressCoinSchedule,
  habitProgressXpSchedule,
  habitReward,
  habitXpCapForState,
  habitXpForCurrentPeriods,
  normalizeHabitState,
  sortHabits,
} from '../domain/habit-rules.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function habitRow(habit, entry) {
  const completed = entry.count >= habit.target;
  const difficulty = HABIT_DIFFICULTIES[habit.difficulty] || HABIT_DIFFICULTIES.easy;
  const frequency = habit.frequency === 'weekly' ? 'Semanal' : 'Diario';
  const reward = habitReward(habit);
  const xpSchedule = habitProgressXpSchedule(habit);
  const coinSchedule = habitProgressCoinSchedule(habit);
  const progressive = habit.frequency === 'weekly' || habit.repeatable === true;
  const nextXp = xpSchedule[entry.count] || 0;
  const nextCoins = coinSchedule[entry.count] || 0;
  const rewardCopy = progressive && !completed
    ? `Próximo avance: +${nextXp} XP · +${nextCoins} 🪙`
    : `+${reward} XP`;
  const earnedParts = [];
  if (entry.xpAwarded > 0) earnedParts.push(`+${entry.xpAwarded} XP`);
  if (entry.coinsAwarded > 0) earnedParts.push(`+${entry.coinsAwarded} 🪙`);
  const earnedCopy = earnedParts.length ? ` · ${earnedParts.join(' · ')}` : '';
  return `<article class="habit-row${completed ? ' completed' : ''}" data-habit-id="${escapeHtml(habit.id)}">
    <button class="habit-adjust habit-minus" type="button" data-habit-delta="-1" aria-label="Restar progreso"${entry.count <= 0 ? ' disabled' : ''}>−</button>
    <button class="habit-main" type="button" data-edit-habit="${escapeHtml(habit.id)}">
      <span class="habit-title">${escapeHtml(habit.title)}</span>
      ${habit.notes ? `<span class="habit-notes">${escapeHtml(habit.notes)}</span>` : ''}
      <span class="habit-meta">${difficulty.label} · ${frequency}${habit.repeatable ? ' · Repetible' : ''} · ${rewardCopy}</span>
      <span class="habit-progress"><i style="width:${Math.min(100, Math.round((entry.count / habit.target) * 100))}%"></i></span>
      <span class="habit-count">${entry.count} / ${habit.target}${earnedCopy}</span>
    </button>
    <button class="habit-grip" type="button" data-habit-drag aria-label="Mantener pulsado para mover ${escapeHtml(habit.title)}" title="Mantén pulsado y arrastra para ordenar">⠿</button>
    <button class="habit-adjust habit-plus" type="button" data-habit-delta="1" aria-label="Sumar progreso"${completed ? ' disabled' : ''}>+</button>
  </article>`;
}

function habitGroup({ habits, frequency, title, normalized, date, planStartDate }) {
  const group = habits.filter((habit) => habit.frequency === frequency);
  if (!group.length) return '';
  const rows = group
    .map((habit) =>
      habitRow(
        habit,
        habitEntryFor(normalized, habit, date, planStartDate),
      ),
    )
    .join('');
  return `<section class="habit-group" data-habit-group="${frequency}">
    <h2 class="habit-group-head"><span>${title}</span><b>${group.length}</b></h2>
    <div class="habit-group-list">${rows}</div>
  </section>`;
}

export function renderHabitsView({
  document,
  habitState,
  date,
  planStartDate,
  game,
  stats,
  filter = 'all',
}) {
  const root = document.getElementById('habitsContent');
  if (!root) return;
  const normalized = normalizeHabitState(habitState);
  const habits = sortHabits(
    normalized.items.filter((habit) => habit.active !== false),
  );
  const earnedNow = habitXpForCurrentPeriods(
    normalized,
    date,
    planStartDate,
  );
  const dailyXpCap = habitXpCapForState(normalized, 'daily');
  const weeklyXpCap = habitXpCapForState(normalized, 'weekly');
  const classId = game?.cls || 'knight';
  const className = CLASSES[classId]?.name || 'Héroe';
  const level = stats?.lvl || 1;
  const xp = stats?.xp || 0;
  const nextXp = stats?.nextTh || 35;
  const progress = Math.max(0, Math.min(100, Math.round((stats?.prog || 0) * 100)));
  const selectedFilter = ['daily', 'weekly'].includes(filter) ? filter : 'all';
  const visibleHabits = selectedFilter === 'all'
    ? habits
    : habits.filter((habit) => habit.frequency === selectedFilter);

  const list = visibleHabits.length
    ? [
        selectedFilter !== 'weekly'
          ? habitGroup({
              habits: visibleHabits,
              frequency: 'daily',
              title: 'Diarios',
              normalized,
              date,
              planStartDate,
            })
          : '',
        selectedFilter !== 'daily'
          ? habitGroup({
              habits: visibleHabits,
              frequency: 'weekly',
              title: 'Semanales',
              normalized,
              date,
              planStartDate,
            })
          : '',
      ].join('')
    : `<div class="habit-empty">
        <div class="habit-empty-icon">✦</div>
        <h3>${habits.length ? 'No hay hábitos en este filtro' : 'Empieza con un hábito pequeño'}</h3>
        <p>${habits.length ? 'Prueba otro filtro o crea un hábito nuevo.' : 'Completar hábitos positivos dará experiencia a tu héroe.'}</p>
        <button type="button" data-add-habit>${habits.length ? 'Crear hábito' : 'Crear mi primer hábito'}</button>
      </div>`;

  root.innerHTML = `
    <div class="habits-head">
      <div>
        <h1>Hábitos</h1>
        <p>Construye una rutina que acompañe tu camino.</p>
      </div>
      <button class="habit-create" type="button" data-add-habit aria-label="Crear hábito">+</button>
    </div>
    <div class="habit-hero-card">
      <img class="habit-hero-bg" src="backgrounds/habits_training_bg.png" alt="" aria-hidden="true">
      <button class="habit-hero-sprite" type="button" data-open-settings aria-label="Abrir ajustes del héroe"><img src="hero_face/${classId}_face.png" alt="${escapeHtml(className)}" onerror="this.onerror=null;this.src='sprites/${classId}_happy.png';this.className='face-full'"></button>
      <div class="habit-hero-info">
        <div class="habit-hero-line"><span>${escapeHtml(game?.name || className)} · Nivel ${level}</span><b>+${earnedNow} XP hábitos</b></div>
        <div class="habit-xp-track"><i style="width:${progress}%"></i></div>
        <div class="habit-xp-label"><span>${xp} / ${nextXp} XP</span><span>Topes ${dailyXpCap}/día · ${weeklyXpCap}/sem.</span></div>
      </div>
    </div>
    <div class="habit-filter" role="group" aria-label="Filtrar hábitos">
      <button type="button" data-habit-filter="all" class="${selectedFilter === 'all' ? 'active' : ''}" aria-pressed="${selectedFilter === 'all'}">Todos</button>
      <button type="button" data-habit-filter="daily" class="${selectedFilter === 'daily' ? 'active' : ''}" aria-pressed="${selectedFilter === 'daily'}">Diarios</button>
      <button type="button" data-habit-filter="weekly" class="${selectedFilter === 'weekly' ? 'active' : ''}" aria-pressed="${selectedFilter === 'weekly'}">Semanales</button>
    </div>
    ${visibleHabits.length > 1 ? '<p class="habit-order-hint">Mantén pulsado <span aria-hidden="true">⠿</span> y arrastra para ordenar.</p>' : ''}
    <div class="habit-list">${list}</div>`;
}
