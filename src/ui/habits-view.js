import { CLASSES } from '../data/game-data.js';
import {
  HABIT_DAILY_XP_CAP,
  HABIT_WEEKLY_XP_CAP,
  HABIT_DIFFICULTIES,
  habitEntryFor,
  habitReward,
  habitXpForCurrentPeriods,
  normalizeHabitState,
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
  return `<article class="habit-row${completed ? ' completed' : ''}" data-habit-id="${escapeHtml(habit.id)}">
    <button class="habit-adjust habit-minus" type="button" data-habit-delta="-1" aria-label="Restar progreso"${entry.count <= 0 ? ' disabled' : ''}>−</button>
    <button class="habit-main" type="button" data-edit-habit="${escapeHtml(habit.id)}">
      <span class="habit-title">${escapeHtml(habit.title)}</span>
      ${habit.notes ? `<span class="habit-notes">${escapeHtml(habit.notes)}</span>` : ''}
      <span class="habit-meta">${difficulty.label} · ${frequency} · +${reward} XP al completar</span>
      <span class="habit-progress"><i style="width:${Math.min(100, Math.round((entry.count / habit.target) * 100))}%"></i></span>
      <span class="habit-count">${entry.count} / ${habit.target}${completed ? ` · +${entry.xpAwarded} XP` : ''}</span>
    </button>
    <button class="habit-adjust habit-plus" type="button" data-habit-delta="1" aria-label="Sumar progreso"${completed ? ' disabled' : ''}>+</button>
  </article>`;
}

export function renderHabitsView({
  document,
  habitState,
  date,
  planStartDate,
  game,
  stats,
}) {
  const root = document.getElementById('habitsContent');
  if (!root) return;
  const normalized = normalizeHabitState(habitState);
  const habits = normalized.items
    .filter((habit) => habit.active !== false)
    .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));
  const earnedNow = habitXpForCurrentPeriods(
    normalized,
    date,
    planStartDate,
  );
  const classId = game?.cls || 'knight';
  const className = CLASSES[classId]?.name || 'Héroe';
  const level = stats?.lvl || 1;
  const xp = stats?.xp || 0;
  const nextXp = stats?.nextTh || 35;
  const progress = Math.max(0, Math.min(100, Math.round((stats?.prog || 0) * 100)));

  const list = habits.length
    ? habits
        .map((habit) =>
          habitRow(
            habit,
            habitEntryFor(normalized, habit, date, planStartDate),
          ),
        )
        .join('')
    : `<div class="habit-empty">
        <div class="habit-empty-icon">✦</div>
        <h3>Empieza con un hábito pequeño</h3>
        <p>Completar hábitos positivos dará experiencia a tu héroe.</p>
        <button type="button" data-add-habit>Crear mi primer hábito</button>
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
      <div class="habit-hero-sprite"><img src="hero_face/${classId}_face.png" alt="${escapeHtml(className)}" onerror="this.onerror=null;this.src='sprites/${classId}_happy.png';this.className='face-full'"></div>
      <div class="habit-hero-info">
        <div class="habit-hero-line"><span>${escapeHtml(game?.name || className)} · Nivel ${level}</span><b>+${earnedNow} XP hábitos</b></div>
        <div class="habit-xp-track"><i style="width:${progress}%"></i></div>
        <div class="habit-xp-label"><span>${xp} / ${nextXp} XP</span><span>Topes ${HABIT_DAILY_XP_CAP}/día · ${HABIT_WEEKLY_XP_CAP}/sem.</span></div>
      </div>
    </div>
    <div class="habit-list">${list}</div>`;
}
