export const FRAME_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'original',
    name: 'Marco Original',
    unlocked: true,
    lore: 'El escenario original de tu vocación en Freedom.',
  }),
  Object.freeze({
    id: 'beta-tester',
    name: 'Corazón de Freedom',
    image: 'hero_background/beta_tester_bg_final.webp',
    unlocked: false,
    lore: 'La central arcana donde vive el corazón de Freedom. Un recuerdo reservado para quienes ayudaron a construir este mundo.',
  }),
  Object.freeze({
    id: 'welder-beta',
    name: 'Santuario del Crisol',
    image: 'hero_background/welder_beta_forge.webp',
    unlocked: false,
    compatibleOutfitId: 'arcane-weave-02',
    recipe: Object.freeze({ arcaneInks: 20, coins: 320 }),
    lore: 'En las entrañas de Freedom arde una forja que nunca duerme. Aquí, el Forjador del Crisol convirtió fuego y metal en un legado para quienes ayudaron a templar este mundo.',
  }),
  Object.freeze({
    id: 'celestial-music-studio',
    name: 'Estudio Musical Celestial',
    rarity: 'mythic',
    image: 'hero_background/celestial_music_studio.webp',
    released: false,
    unlocked: false,
    recipe: Object.freeze({ arcaneInks: 35, coins: 350 }),
    lore: 'En este estudio ancestral, cada nota queda grabada en cristal y oro. Sus máquinas celestiales transforman el ritmo de Freedom en tinta capaz de reescribir el destino.',
  }),
]);

function frameDefinition(frameId) {
  return FRAME_DEFINITIONS.find((frame) => frame.id === frameId)
    || FRAME_DEFINITIONS[0];
}

export function isFrameUnlocked(frameOrId, game = {}) {
  const frame = typeof frameOrId === 'string'
    ? FRAME_DEFINITIONS.find((candidate) => candidate.id === frameOrId)
    : frameOrId;
  if (!frame) return false;
  if (frame.released === false) return false;
  if (frame.id === 'original') return true;
  if (game?.frames?.owned?.[frame.id]) return true;
  return Boolean(frame.unlocked);
}

export function equippedFrame(frameId, game = {}) {
  const frame = frameDefinition(frameId);
  return isFrameUnlocked(frame, game) ? frame : FRAME_DEFINITIONS[0];
}

export function heroBackgroundSource(frameId, classId = 'paladin', surface = 'hero', game = {}) {
  const frame = equippedFrame(frameId, game);
  if (frame.image) return frame.image;
  if (surface === 'today') return `hero_background/${classId}_today_bg.webp`;
  if (surface === 'habits') return 'backgrounds/habits_training_bg.webp';
  return `hero_background/${classId}_bg.webp`;
}
