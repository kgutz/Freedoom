import { CLASSES } from '../data/game-data.js';
import { keyOf } from '../domain/date-utils.js';
import { intoxicationStage } from '../domain/intoxication-rules.js';
import {
  heroFaceSource,
  heroSpriteSource,
  outfitUsesTransparentPortrait,
} from '../data/outfit-data.js';
import { heroBackgroundSource } from '../data/frame-data.js';
import { resourceIcon } from './resource-icons.js';
import { normalizeTodoState, sortTodos, todoReward } from '../domain/todo-rules.js';
import {
  HABIT_DIFFICULTIES,
  habitEntryFor,
  habitProgressCoinSchedule,
  habitProgressXpSchedule,
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

export function markedHabitIdsForGame(game, date = new Date()) {
  const marked = new Set();
  const progress = game?.powerProgress || {};
  const today = keyOf(date);
  const nowTimestamp = date.getTime();
  const challenge = progress.habitChallenge;
  const challengeTarget = challenge?.autoNextHabitCount || challenge?.habitIds?.length || 0;
  if (
    challenge?.day === today &&
    challengeTarget > 0 &&
    (challenge.completedIds?.length || 0) < challengeTarget
  ) {
    for (const id of challenge.habitIds || []) marked.add(id);
  }
  const judgment = progress.judgment;
  if (judgment?.day === today && !judgment.rewarded) {
    for (const id of judgment.habitIds || []) marked.add(id);
  }
  const ultimate = progress.ultimateChallenge;
  if (ultimate?.day === today && !ultimate.rewarded) {
    for (const id of ultimate.habitIds || []) marked.add(id);
  }
  const wager = progress.soulWager;
  if (wager?.habitId && !wager.completed && nowTimestamp <= wager.expiresAt) {
    marked.add(wager.habitId);
  }
  const rebirth = progress.rebirthHabit;
  if (rebirth?.habitId && !rebirth.completed && nowTimestamp <= rebirth.expiresAt) {
    marked.add(rebirth.habitId);
  }
  return marked;
}

export function habitHeroCardMarkup({ game, stats, intoxication, earnedLabel, limitLabel = '', backgroundSrc = null, variantClass = '' }) {
  const classId = game?.cls || 'knight';
  const className = CLASSES[classId]?.name || 'Héroe';
  const level = stats?.lvl || 1;
  const xp = stats?.xp || 0;
  const nextXp = stats?.nextTh || 35;
  const progress = Math.max(0, Math.min(100, Math.round((stats?.prog || 0) * 100)));
  const intoxicationStageValue = intoxicationStage(intoxication);
  const intoxicationClass = intoxicationStageValue > 0
    ? ` compact-hero-intoxicated compact-intoxication-stage-${intoxicationStageValue}`
    : '';
  const outfitPortraitClass = outfitUsesTransparentPortrait(game?.outfit)
    ? ` outfit-transparent-portrait outfit-id-${game?.outfit || 'original'}`
    : '';
  const resolvedBackgroundSrc = backgroundSrc || heroBackgroundSource(
    game?.frame,
    classId,
    'habits',
    game,
  );
  return `<div class="habit-hero-card${intoxicationStageValue > 0 ? ' hero-card--intoxicated' : ''}${variantClass ? ` ${escapeHtml(variantClass)}` : ''}" data-open-character-sheet role="button" tabindex="0" aria-label="Abrir ficha de personaje">
      <img class="habit-hero-bg" src="${escapeHtml(resolvedBackgroundSrc)}" alt="" aria-hidden="true">
      <span class="inventory-shortcut-card-shimmer" aria-hidden="true"></span>
      <span class="habit-hero-sprite${intoxicationClass}${outfitPortraitClass}" aria-hidden="true"><img src="${heroFaceSource(classId, game?.outfit)}" alt="" onerror="this.onerror=null;this.src='${heroSpriteSource(classId, 'happy', game?.outfit)}';this.className='face-full'"></span>
      <div class="habit-hero-info">
        <div class="habit-hero-line"><span>${escapeHtml(game?.name || className)} · Nivel ${level}</span><b>${escapeHtml(earnedLabel)}</b></div>
        <div class="habit-xp-track"><i style="width:${progress}%"></i></div>
        <div class="habit-xp-label"><span>${xp} / ${nextXp} XP</span>${limitLabel ? `<span>${escapeHtml(limitLabel)}</span>` : ''}</div>
      </div>
    </div>`;
}

function habitRow(habit, entry, skillMarked = false) {
  const completed = entry.count >= habit.target;
  const difficulty = HABIT_DIFFICULTIES[habit.difficulty] || HABIT_DIFFICULTIES.easy;
  const rewardXp = habitProgressXpSchedule(habit).reduce((total, value) => total + value, 0);
  const rewardCoins = habitProgressCoinSchedule(habit).reduce((total, value) => total + value, 0);
  const earnedParts = [];
  if (entry.xpAwarded > 0) earnedParts.push(`+${entry.xpAwarded} XP`);
  if (entry.coinsAwarded > 0) earnedParts.push(`+${entry.coinsAwarded} ${resourceIcon('coin')}`);
  const earnedCopy = earnedParts.length ? ` · ${earnedParts.join(' · ')}` : '';
  return `<article class="habit-row${completed ? ' completed' : ''}${skillMarked ? ' skill-marked' : ''}" data-habit-id="${escapeHtml(habit.id)}"${skillMarked ? ' data-skill-marked="true"' : ''}>
    <button class="habit-adjust habit-minus" type="button" data-habit-delta="-1" aria-label="Restar progreso"${entry.count <= 0 ? ' disabled' : ''}>−</button>
    <button class="habit-main" type="button" data-edit-habit="${escapeHtml(habit.id)}">
      <span class="habit-title">${escapeHtml(habit.title)}</span>
      ${habit.notes ? `<span class="habit-notes">${escapeHtml(habit.notes)}</span>` : ''}
      <span class="habit-meta">${difficulty.label} · ${rewardXp} XP + ${rewardCoins} oro</span>
      <span class="habit-progress"><i style="width:${Math.min(100, Math.round((entry.count / habit.target) * 100))}%"></i></span>
      <span class="habit-count">${entry.count} / ${habit.target}${earnedCopy}</span>
    </button>
    <button class="habit-grip" type="button" data-habit-drag aria-label="Mantener pulsado para mover ${escapeHtml(habit.title)}" title="Mantén pulsado y arrastra para ordenar">⠿</button>
    <button class="habit-adjust habit-plus" type="button" data-habit-delta="1" aria-label="Sumar progreso"${completed ? ' disabled' : ''}>+</button>
  </article>`;
}

function habitGroup({ habits, frequency, title, normalized, date, planStartDate, markedHabitIds }) {
  const group = habits.filter((habit) => habit.frequency === frequency);
  if (!group.length) return '';
  const rows = group
    .map((habit) =>
      habitRow(
        habit,
        habitEntryFor(normalized, habit, date, planStartDate),
        markedHabitIds.has(habit.id),
      ),
    )
    .join('');
  return `<section class="habit-group" data-habit-group="${frequency}">
    <h2 class="habit-group-head"><span>${title}</span><b>${group.length}</b></h2>
    <div class="habit-group-list">${rows}</div>
  </section>`;
}

function todoRow(todo) {
  const difficulty = HABIT_DIFFICULTIES[todo.difficulty] || HABIT_DIFFICULTIES.easy;
  const reward = todoReward(todo);
  const target = Math.min(20, Math.max(1, Math.trunc(Number(todo.target) || 1)));
  const count = Number.isFinite(Number(todo.count))
    ? Math.min(target, Math.max(0, Math.trunc(Number(todo.count))))
    : todo.completed === true ? target : 0;
  const completed = count >= target;
  const earnedCopy = completed
    ? ` · +${Math.max(0, Number(todo.xpAwarded) || reward.xp)} XP · +${Math.max(0, Number(todo.coinsAwarded) || reward.coins)} ${resourceIcon('coin')}`
    : '';
  return `<article class="habit-row todo-row${completed ? ' completed' : ''}" data-todo-id="${escapeHtml(todo.id)}">
    <button class="habit-adjust habit-minus" type="button" data-todo-delta="-1" aria-label="Restar progreso"${count <= 0 ? ' disabled' : ''}>−</button>
    <button class="habit-main" type="button" data-edit-todo="${escapeHtml(todo.id)}">
      <span class="habit-title">${escapeHtml(todo.title)}</span>
      ${todo.notes ? `<span class="habit-notes">${escapeHtml(todo.notes)}</span>` : ''}
      <span class="habit-meta">${difficulty.label} · ${reward.xp} XP + ${reward.coins} oro</span>
      <span class="habit-progress"><i style="width:${Math.min(100, Math.round((count / target) * 100))}%"></i></span>
      <span class="habit-count">${count} / ${target}${earnedCopy}</span>
    </button>
    <button class="habit-grip" type="button" data-todo-drag aria-label="Mantener pulsado para mover ${escapeHtml(todo.title)}" title="Mantén pulsado y arrastra para ordenar">⠿</button>
    <button class="habit-adjust habit-plus" type="button" data-todo-delta="1" aria-label="Sumar progreso"${completed ? ' disabled' : ''}>+</button>
  </article>`;
}

export function renderHabitsView({
  document,
  habitState,
  todoState,
  date,
  planStartDate,
  game,
  stats,
  intoxication,
  filter = 'all',
  section = 'habits',
}) {
  const root = document.getElementById('habitsContent');
  if (!root) return;
  const normalized = normalizeHabitState(habitState);
  const markedHabitIds = markedHabitIdsForGame(game, date);
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
  const selectedFilter = ['daily', 'weekly'].includes(filter) ? filter : 'all';
  const selectedSection = ['todo', 'hunt'].includes(section) ? section : 'habits';
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
              markedHabitIds,
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
              markedHabitIds,
            })
          : '',
      ].join('')
    : `<div class="habit-empty">
        <div class="habit-empty-icon">✦</div>
        <h3>${habits.length ? 'No hay hábitos en este filtro' : 'Empieza con un hábito pequeño'}</h3>
        <p>${habits.length ? 'Prueba otro filtro o crea un hábito nuevo.' : 'Completar hábitos positivos dará experiencia a tu héroe.'}</p>
        <button type="button" data-add-habit>${habits.length ? 'Crear hábito' : 'Crear mi primer hábito'}</button>
      </div>`;

  const tabs = `
    <div class="habits-head">
      <div class="habit-section-tabs" role="tablist" aria-label="Organización">
        <button type="button" data-habit-section="habits" class="${selectedSection === 'habits' ? 'active' : ''}" role="tab" aria-selected="${selectedSection === 'habits'}">Hábitos</button>
        <button type="button" data-habit-section="todo" class="${selectedSection === 'todo' ? 'active' : ''}" role="tab" aria-selected="${selectedSection === 'todo'}">To Do List</button>
        <button type="button" data-habit-section="hunt" class="${selectedSection === 'hunt' ? 'active' : ''}" role="tab" aria-selected="${selectedSection === 'hunt'}"><span class="habit-section-icon" aria-hidden="true">⚔</span><span>Cacería</span></button>
      </div>
      ${selectedSection === 'hunt' ? '' : `<button class="habit-create" type="button" ${selectedSection === 'habits' ? 'data-add-habit aria-label="Crear hábito"' : 'data-add-todo aria-label="Crear tarea"'}>+</button>`}
    </div>`;

  if (selectedSection === 'hunt') {
    root.innerHTML = tabs;
    return;
  }

  if (selectedSection === 'todo') {
    const normalizedTodos = normalizeTodoState(todoState);
    const todos = sortTodos(normalizedTodos.items
      .filter((todo) => todo.active !== false));
    const todoXpEarned = normalizedTodos.items.reduce(
      (total, todo) => total + Math.max(0, Number(todo.xpAwarded) || 0),
      0,
    );
    const todoList = todos.length
      ? `<section class="habit-group todo-group" data-todo-group>
          <div class="habit-group-list habit-list todo-list">${todos.map(todoRow).join('')}</div>
        </section>`
      : `<div class="todo-list-preview" role="tabpanel">
          <div class="habit-empty-icon" aria-hidden="true">✓</div>
          <h3>Empieza con una tarea</h3>
          <p>Organiza pendientes concretos sin convertirlos en hábitos.</p>
          <button type="button" data-add-todo>Crear mi primera tarea</button>
        </div>`;
    root.innerHTML = `${tabs}
      ${habitHeroCardMarkup({ game, stats, intoxication, earnedLabel: `+${todoXpEarned} XP To Do` })}
      ${todoList}`;
    return;
  }

  root.innerHTML = `${tabs}
    ${habitHeroCardMarkup({ game, stats, intoxication, earnedLabel: `+${earnedNow} XP hábitos`, limitLabel: `Topes ${dailyXpCap}/día · ${weeklyXpCap}/sem.` })}
    <div class="habit-filter" role="group" aria-label="Filtrar hábitos">
      <button type="button" data-habit-filter="all" class="${selectedFilter === 'all' ? 'active' : ''}" aria-pressed="${selectedFilter === 'all'}">Todos</button>
      <button type="button" data-habit-filter="daily" class="${selectedFilter === 'daily' ? 'active' : ''}" aria-pressed="${selectedFilter === 'daily'}">Diarios</button>
      <button type="button" data-habit-filter="weekly" class="${selectedFilter === 'weekly' ? 'active' : ''}" aria-pressed="${selectedFilter === 'weekly'}">Semanales</button>
    </div>
    ${visibleHabits.length > 1 ? '<p class="habit-order-hint">Mantén pulsado <span aria-hidden="true">⠿</span> y arrastra para ordenar.</p>' : ''}
    <div class="habit-list">${list}</div>`;
}
