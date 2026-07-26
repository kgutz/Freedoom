import { CLASS_GROWTH } from '../data/game-data.js';

export function levelFromXp(xp) {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 35));
}

export function classMaxes(classId, level) {
  const growth = CLASS_GROWTH[classId] || { hp: 5, mp: 5 };
  const safeLevel = Math.max(1, level || 1);

  return {
    maxHp: 100 + growth.hp * (safeLevel - 1),
    maxMp: 100 + growth.mp * (safeLevel - 1),
  };
}
