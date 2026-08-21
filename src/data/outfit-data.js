export const OUTFIT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'original', name: 'Atuendo Original', rarity: 'common', unlocked: true, transparentPortrait: true }),
  Object.freeze({ id: 'beta-tester', name: 'Beta Tester', rarity: 'rare', unlocked: false, transparentPortrait: true }),
  Object.freeze({ id: 'locked-2', name: 'Outfit por descubrir', unlocked: false }),
]);

function outfitDefinition(outfitId) {
  return OUTFIT_DEFINITIONS.find((outfit) => outfit.id === outfitId)
    || OUTFIT_DEFINITIONS[0];
}

export function isOutfitUnlocked(outfitOrId, game = {}) {
  const outfit = typeof outfitOrId === 'string'
    ? OUTFIT_DEFINITIONS.find((candidate) => candidate.id === outfitOrId)
    : outfitOrId;
  if (!outfit) return false;
  if (outfit.id === 'original') return true;
  if (outfit.id === 'beta-tester') return Boolean(game?.pioneerReward?.claimedAt);
  return Boolean(outfit.unlocked);
}

export function equippedOutfit(outfitId, game = {}) {
  const outfit = outfitDefinition(outfitId);
  return isOutfitUnlocked(outfit, game) ? outfit : OUTFIT_DEFINITIONS[0];
}

export function heroSpriteSource(classId, mood = 'happy', outfitId = 'original') {
  const outfit = outfitDefinition(outfitId);
  if (outfit.id === 'original') return `sprites/${classId}_${mood}.png`;
  return `outfits/${outfit.id}/${classId}_${mood}.png`;
}

export function heroFaceSource(classId, outfitId = 'original') {
  const outfit = outfitDefinition(outfitId);
  if (outfit.id === 'original') return `hero_face/${classId}_face.png`;
  return `outfits/${outfit.id}/${classId}_face.png`;
}

export function outfitUsesTransparentPortrait(outfitId = 'original') {
  return Boolean(outfitDefinition(outfitId).transparentPortrait);
}
