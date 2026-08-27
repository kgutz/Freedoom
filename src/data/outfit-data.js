export const OUTFIT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'original',
    name: 'Atuendo Original',
    rarity: 'common',
    unlocked: true,
    transparentPortrait: true,
    lore: 'La vestimenta con la que comenzó tu aventura en Freedom.',
  }),
  Object.freeze({
    id: 'beta-tester',
    name: 'Beta Tester',
    rarity: 'rare',
    unlocked: false,
    transparentPortrait: true,
    lore: 'Un atuendo reservado para quienes ayudaron a construir los primeros pasos de Freedom.',
  }),
  Object.freeze({
    id: 'arcane-weave-01',
    name: 'Operador del Nexo',
    unlocked: false,
    craftable: true,
    assetId: 'telecom-beta',
    transparentPortrait: true,
    lore: 'Dice la leyenda que un Beta Tester recorría Freedom reparando sus redes. Con cada señal y consejo, ayudaba a construir un mundo mejor conectado.',
    recipe: Object.freeze({ arcaneFibers: 5, coins: 80 }),
  }),
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
  if (game?.outfits?.owned?.[outfit.id]) return true;
  return Boolean(outfit.unlocked);
}

export function equippedOutfit(outfitId, game = {}) {
  const outfit = outfitDefinition(outfitId);
  return isOutfitUnlocked(outfit, game) ? outfit : OUTFIT_DEFINITIONS[0];
}

export function heroSpriteSource(classId, mood = 'happy', outfitId = 'original') {
  const outfit = outfitDefinition(outfitId);
  const assetId = outfit.assetId || outfit.id;
  if (assetId === 'original') return `sprites/${classId}_${mood}.webp`;
  return `outfits/${assetId}/${classId}_${mood}.webp`;
}

export function heroFaceSource(classId, outfitId = 'original') {
  const outfit = outfitDefinition(outfitId);
  const assetId = outfit.assetId || outfit.id;
  if (assetId === 'original') return `hero_face/${classId}_face.webp`;
  return `outfits/${assetId}/${classId}_face.webp`;
}

export function outfitUsesTransparentPortrait(outfitId = 'original') {
  return Boolean(outfitDefinition(outfitId).transparentPortrait);
}
