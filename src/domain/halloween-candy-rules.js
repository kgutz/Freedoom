export const HALLOWEEN_CANDIES = Object.freeze([
  Object.freeze({ id: 'blood', name: 'Chuche de Sangre', image: 'potions/candy_blood.webp', price: 100,
    shortEffect: 'En Cacería difícil, una tirada independiente del 40% para obtener +1 Sangre del minijefe.' }),
  Object.freeze({ id: 'energy', name: 'Chuche de Energía', image: 'potions/candy_energy.webp', price: 30,
    shortEffect: 'Recupera 2 puntos de Energía de Cacería al instante.' }),
  Object.freeze({ id: 'experience', name: 'Chuche de Experiencia', image: 'potions/candy_experience.webp', price: 30,
    shortEffect: '+50% de experiencia en la próxima Cacería. No se acumula consigo misma.' }),
]);

export const HALLOWEEN_CANDY_BY_ID = Object.freeze(Object.fromEntries(
  HALLOWEEN_CANDIES.map(definition => [definition.id, definition]),
));
export const HALLOWEEN_CANDY_DROP_RATES = Object.freeze({ easy: .07, medium: .12, hard: .20 });
export const HALLOWEEN_BLOOD_DROP_RATE = .40;
export const HALLOWEEN_BLOOD_BONUS_RATE = .40;
export const HALLOWEEN_XP_BONUS_RATE = .50;

const objectOf = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const quantity = value => Math.min(9999, Math.max(0, Math.trunc(Number(value) || 0)));

export function halloweenSeasonActive(nowTimestamp = Date.now(), localPreview = false) {
  return localPreview || new Date(nowTimestamp).getMonth() === 9;
}

export function normalizeHalloweenCandy(value) {
  const raw = objectOf(value);
  const owned = objectOf(raw.owned);
  const prepared = objectOf(raw.prepared);
  return {
    owned: Object.fromEntries(HALLOWEEN_CANDIES.map(({ id }) => [id, quantity(owned[id])])),
    prepared: { blood: prepared.blood === true, experience: prepared.experience === true },
    awards: Object.fromEntries(Object.entries(objectOf(raw.awards)).slice(-250)),
  };
}

export function buyHalloweenCandy({ candy, coins, id, quantity: count = 1 }) {
  const definition = HALLOWEEN_CANDY_BY_ID[id];
  const current = normalizeHalloweenCandy(candy);
  const number = Math.min(99, Math.max(1, Math.trunc(Number(count) || 1)));
  if (!definition) return { ok: false, reason: 'unknown', candy: current };
  if (Math.max(0, Number(coins) || 0) < definition.price * number)
    return { ok: false, reason: 'coins', candy: current };
  current.owned[id] += number;
  return { ok: true, candy: current, cost: definition.price * number, quantity: number };
}

export function prepareHalloweenCandy(candy, id) {
  const current = normalizeHalloweenCandy(candy);
  if (!HALLOWEEN_CANDY_BY_ID[id] || id === 'energy') return { ok: false, reason: 'unknown', candy: current };
  if (current.prepared[id]) return { ok: false, reason: 'prepared', candy: current };
  if (current.owned[id] < 1) return { ok: false, reason: 'empty', candy: current };
  current.owned[id] -= 1;
  current.prepared[id] = true;
  return { ok: true, candy: current };
}

export function takePreparedHalloweenCandy(candy, difficultyId) {
  const current = normalizeHalloweenCandy(candy);
  const used = {
    blood: difficultyId === 'hard' && current.prepared.blood,
    experience: current.prepared.experience,
  };
  if (used.blood) current.prepared.blood = false;
  if (used.experience) current.prepared.experience = false;
  return { candy: current, used };
}

export function rollHalloweenHuntCandy({ candy, report, active = false, random = Math.random }) {
  const current = normalizeHalloweenCandy(candy);
  if (!report?.id || current.awards[`hunt:${report.id}`])
    return { candy: current, drops: { blood: 0, energy: 0, experience: 0 }, bloodBonus: 0, maskBloodBonus:0, xpBonus: 0 };
  const drops = { blood: 0, energy: 0, experience: 0 };
  const rate = HALLOWEEN_CANDY_DROP_RATES[report.difficultyId] || 0;
  (active ? report.encounters || [] : []).forEach((encounter, index) => {
    if (!encounter?.won) return;
    if (random() < rate) drops.energy += 1;
    if (random() < rate) drops.experience += 1;
    if (index === 2 && report.difficultyId === 'hard' && random() < HALLOWEEN_BLOOD_DROP_RATE)
      drops.blood += 1;
  });
  const prepared = objectOf(report.halloweenCandy);
  const minibossWon = report.difficultyId === 'hard' && report.encounters?.[2]?.won === true;
  const bloodBonus = minibossWon && prepared.blood && random() < HALLOWEEN_BLOOD_BONUS_RATE ? 1 : 0;
  const xpBonus = prepared.experience && Number(report.rewards?.xp) > 0
    ? Math.round(report.rewards.xp * HALLOWEEN_XP_BONUS_RATE) : 0;
  const maskBloodBonus = minibossWon && report.maskBloodChance === 50 && random() < .5 ? 1 : 0;
  for (const id of Object.keys(drops)) current.owned[id] += drops[id];
  if (prepared.blood && !minibossWon) current.owned.blood += 1;
  if (prepared.experience && !Number(report.rewards?.xp)) current.owned.experience += 1;
  current.awards[`hunt:${report.id}`] = { ...drops, bloodBonus, maskBloodBonus, xpBonus };
  return { candy: current, drops, bloodBonus, maskBloodBonus, xpBonus };
}

export function rollHalloweenWeeklyCandy({ candy, rewardId, active = false, random = Math.random }) {
  const current = normalizeHalloweenCandy(candy);
  if (!active || !rewardId || current.awards[`boss:${rewardId}`])
    return { candy: current, drops: { blood: 0, energy: 0, experience: 0 } };
  const drops = { blood: 0, energy: 0, experience: 0 };
  for (const id of Object.keys(drops)) {
    if (random() < .8) drops[id] = 1 + Number(random() < .5);
    current.owned[id] += drops[id];
  }
  current.awards[`boss:${rewardId}`] = { ...drops };
  return { candy: current, drops };
}
