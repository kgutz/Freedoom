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
