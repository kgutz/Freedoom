/* Repetición automática de Cacería: el jugador elige un nivel una vez y, cada vez que termina, se lanza otra
   idéntica mientras haya energía y todo vaya bien. Solo decide y resume: gastar energía, resolver combates y
   pagar recompensas sigue siendo cosa de startHunt/resolveHunt, así que cada repetición es una Cacería normal. */

export const AUTO_REPEAT_MAX_RUNS = 30;
// Por debajo de este porcentaje de Vida el héroe no entra solo en otra Cacería: cada derrota con muerte cuesta XP.
export const AUTO_REPEAT_MIN_HP_RATIO = 0.4;

export const AUTO_REPEAT_STOP_REASONS = Object.freeze({
  'no-energy': 'Terminó: ya no queda energía para otra cacería.',
  defeat: 'Se detuvo: tu héroe no superó la última cacería.',
  died: 'Se detuvo: tu héroe cayó en combate.',
  'low-health': 'Se detuvo para proteger a tu héroe: su Vida está por debajo del 40 %.',
  level: 'Se detuvo: ya no cumples el nivel mínimo de esta dificultad.',
  'max-runs': 'Se detuvo: se alcanzó el máximo de repeticiones seguidas.',
  manual: 'Detenida por ti.',
});

const safeInteger = (value, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));

export function normalizeAutoRepeat(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const regionId = typeof raw.regionId === 'string' ? raw.regionId : '';
  const difficultyId = typeof raw.difficultyId === 'string' ? raw.difficultyId : '';
  if (!regionId || !difficultyId) return null;
  const enabled = raw.enabled === true;
  const stopReason = !enabled && AUTO_REPEAT_STOP_REASONS[raw.stopReason] ? raw.stopReason : '';
  return {
    enabled,
    regionId,
    difficultyId,
    autoUsePotions: raw.autoUsePotions === true,
    runs: safeInteger(raw.runs, AUTO_REPEAT_MAX_RUNS),
    reportIds: (Array.isArray(raw.reportIds) ? raw.reportIds : [])
      .filter((id) => typeof id === 'string' && id)
      .slice(-AUTO_REPEAT_MAX_RUNS),
    startedAt: safeInteger(raw.startedAt),
    stoppedAt: enabled ? 0 : safeInteger(raw.stoppedAt),
    stopReason,
  };
}

/* Cuántas Cacerías completas permite la energía actual. */
export function autoRepeatPossibleRuns(energy, energyCost) {
  const cost = Math.max(1, safeInteger(energyCost));
  return Math.floor(safeInteger(energy) / cost);
}

export function beginAutoRepeat({ regionId, difficultyId, autoUsePotions = false, nowTimestamp = Date.now() }) {
  return normalizeAutoRepeat({
    enabled: true, regionId, difficultyId, autoUsePotions, runs: 1, reportIds: [], startedAt: nowTimestamp,
  });
}

export function stopAutoRepeat(config, reason = 'manual', nowTimestamp = Date.now()) {
  const current = normalizeAutoRepeat(config);
  if (!current) return null;
  if (!current.enabled) return current;
  return normalizeAutoRepeat({ ...current, enabled: false, stopReason: reason, stoppedAt: nowTimestamp });
}

/* Anota una Cacería terminada de la cadena y, si cuenta como una repetición más, la suma. */
export function recordAutoRepeatReport(config, reportId) {
  const current = normalizeAutoRepeat(config);
  if (!current || !reportId || current.reportIds.includes(reportId)) return current;
  return { ...current, reportIds: [...current.reportIds, reportId].slice(-AUTO_REPEAT_MAX_RUNS) };
}

export function countAutoRepeatRun(config) {
  const current = normalizeAutoRepeat(config);
  return current ? { ...current, runs: Math.min(AUTO_REPEAT_MAX_RUNS, current.runs + 1) } : null;
}

/* ¿Lanzamos otra? Devuelve el motivo de la parada si no. Orden: lo más grave primero. */
export function autoRepeatDecision({
  config, report, energy = 0, energyCost = 1, hpRatio = 1, level = 1, requiredLevel = 1,
}) {
  const current = normalizeAutoRepeat(config);
  if (!current?.enabled) return { proceed: false, reason: '' };
  if (report?.heroDied) return { proceed: false, reason: 'died' };
  if (!report?.won) return { proceed: false, reason: 'defeat' };
  if (current.runs >= AUTO_REPEAT_MAX_RUNS) return { proceed: false, reason: 'max-runs' };
  if (safeInteger(level) < safeInteger(requiredLevel)) return { proceed: false, reason: 'level' };
  if (safeInteger(energy) < safeInteger(energyCost)) return { proceed: false, reason: 'no-energy' };
  if (Number(hpRatio) < AUTO_REPEAT_MIN_HP_RATIO) return { proceed: false, reason: 'low-health' };
  return { proceed: true, reason: '' };
}

/* Suma de lo conseguido en la cadena, leyendo los informes guardados (historial + último). */
export function autoRepeatSummary(config, hunt = {}) {
  const current = normalizeAutoRepeat(config);
  if (!current) return null;
  const known = new Set(current.reportIds);
  const pool = [...(Array.isArray(hunt.history) ? hunt.history : []), hunt.lastReport].filter(Boolean);
  const seen = new Set();
  const reports = pool.filter((report) => report.id && known.has(report.id) && !seen.has(report.id) && seen.add(report.id));
  const total = (pick) => reports.reduce((sum, report) => sum + safeInteger(pick(report)), 0);
  return {
    runs: Math.max(current.runs, reports.length),
    finished: reports.length,
    wins: reports.filter((report) => report.won).length,
    xp: total((report) => report.rewards?.xp),
    gold: total((report) => report.rewards?.gold),
    arcaneFibers: total((report) => report.rewards?.arcaneFibers),
    arcaneInks: total((report) => report.rewards?.arcaneInks),
    bossBlood: total((report) => report.rewards?.bossBlood),
    enabled: current.enabled,
    stopReason: current.stopReason,
  };
}
