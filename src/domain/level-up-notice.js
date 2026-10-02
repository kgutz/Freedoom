import { classDataForJourney } from '../data/game-data.js';
import { ATTRIBUTE_POINTS_PER_LEVEL } from './attribute-rules.js';
import { HUNT_DIFFICULTIES, HUNT_REGIONS, huntDifficultyMinLevel } from './pve-combat-rules.js';

/* Qué mostrar al subir de nivel: puntos ganados y lo que se desbloquea en el tramo (previo, actual]. */
export function levelUpNotice({ classId, previousLevel, level, smokeFree = false } = {}) {
  const from = Math.max(0, Math.trunc(Number(previousLevel) || 0));
  const to = Math.max(0, Math.trunc(Number(level) || 0));
  if (to <= from) return null;
  const crossed = (required) => required > from && required <= to;
  const skills = (classDataForJourney(classId, { smokeFree })?.act || [])
    .filter((ability) => crossed(Number(ability.lvl) || 0))
    .map((ability) => ability.name);
  const hunts = [];
  for (const region of Object.values(HUNT_REGIONS)) {
    if (crossed(huntDifficultyMinLevel(region.id, 'easy'))) hunts.push(`Nueva zona de Cacería: ${region.name}`);
    for (const difficultyId of ['medium', 'hard']) {
      const required = huntDifficultyMinLevel(region.id, difficultyId);
      if (crossed(required) && !(crossed(huntDifficultyMinLevel(region.id, 'easy')))) {
        hunts.push(`Cacería ${HUNT_DIFFICULTIES[difficultyId].name} en ${region.name}`);
      }
    }
  }
  return {
    previousLevel: from,
    level: to,
    levelsGained: to - from,
    pointsGained: (to - from) * ATTRIBUTE_POINTS_PER_LEVEL,
    skills,
    hunts,
  };
}
