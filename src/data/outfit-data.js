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
    rarity: 'mythic',
    unlocked: false,
    transparentPortrait: true,
    lore: 'Un atuendo reservado para quienes ayudaron a construir los primeros pasos de Freedom.',
  }),
  Object.freeze({
    id: 'arcane-weave-01',
    name: 'Operador del Nexo',
    rarity: 'legendary',
    unlocked: false,
    craftable: true,
    assetId: 'telecom-beta',
    transparentPortrait: true,
    lore: 'Dice la leyenda que un Beta Tester recorría Freedom reparando sus redes. Con cada señal y consejo, ayudaba a construir un mundo mejor conectado.',
    recipe: Object.freeze({ arcaneFibers: 20, coins: 320 }),
  }),
  Object.freeze({
    id: 'arcane-weave-02',
    name: 'Forjador del Crisol',
    rarity: 'legendary',
    released: true,
    unlocked: false,
    craftable: true,
    assetId: 'welder-beta',
    transparentPortrait: true,
    lore: 'Cuenta la leyenda que un Beta Tester dominaba el fuego y el metal. Entre chispas y consejos, ayudó a templar un Freedom más resistente.',
    recipe: Object.freeze({ arcaneFibers: 20, coins: 320 }),
  }),
  Object.freeze({
    id: 'celestial-rhythm-master',
    name: 'Maestro del Ritmo Celestial',
    rarity: 'legendary',
    released: true,
    unlocked: false,
    craftable: true,
    assetId: 'celestial-rhythm',
    transparentPortrait: true,
    lore: 'Dicen que un Beta Tester aprendió a escuchar la frecuencia oculta de Freedom. Entre máquinas ancestrales, discos de cristal y ritmos capaces de hacer vibrar el oro, convirtió cada expedición en una obra digna de los dioses.',
    recipe: Object.freeze({ arcaneFibers: 20, coins: 320 }),
  }),
]);

const DISPLAY_CLASSES = Object.freeze(['knight', 'paladin', 'sorcerer', 'druid']);

// Fuente unica de escala y anclaje para todos los lugares donde se muestra un
// cuerpo completo. Cada tripleta es [tamano, desplazamiento X, desplazamiento Y]
// en porcentajes. El perfil original también se declara para que tienda e
// inventario compartan exactamente la misma línea de pies que los remasteres.
export const OUTFIT_DISPLAY_PROFILES = Object.freeze({
  original: Object.freeze({
    knight: Object.freeze({ hero: [83, 0, 0.13], sheet: [81.7, 0, 0.13], card: [105, 0, -1.9], face: [107, 0, 0] }),
    paladin: Object.freeze({ hero: [78, 0, 2.5], sheet: [76.7, 0, 2.5], card: [100, 0, 0], face: [100, 0, 0] }),
    sorcerer: Object.freeze({ hero: [78, 0, 2.5], sheet: [76.7, 0, 2.5], card: [100, 0, 0], face: [100, 0, 0] }),
    druid: Object.freeze({ hero: [78, 0, 2.5], sheet: [76.7, 0, 2.5], card: [100, 0, 0], face: [100, 0, 0] }),
  }),
  'beta-tester': Object.freeze({
    knight: Object.freeze({ hero: [95.3333, -2.0833, -4.12], sheet: [94.05, -2.0833, -4.12], card: [119.68, -2.67, -5.88], face: [125, 0.2, 0] }),
    paladin: Object.freeze({ hero: [97.63, 1.6667, -5.22], sheet: [96, 1.6667, -5.13], card: [116, 2.14, -4.53], face: [120, 0, 0] }),
    sorcerer: Object.freeze({ hero: [95.6, -1.6667, -4.25], sheet: [94, -1.6667, -4.18], card: [122.56, -2.14, -6.94], face: [112, 0, 0] }),
    druid: Object.freeze({ hero: [95.3333, 0, -4.33], sheet: [93.81, 0, -4.33], card: [121.09, 0, -6.4], face: [112, 0.2, 0] }),
  }),
  'arcane-weave-01': Object.freeze({
    knight: Object.freeze({ hero: [100.3333, -2.0833, -5.29], sheet: [98.8733, -2.0833, -5.29], card: [127.73, -2.67, -8.84], face: [125, 0.2, 0] }),
    paladin: Object.freeze({ hero: [95.5, 1.6667, 0], sheet: [93.91, 1.6667, 0], card: [107, 2.14, -1.23], face: [116, 0, 0] }),
    sorcerer: Object.freeze({ hero: [94.9633, -1.6667, -3.97], sheet: [93.4333, -1.6667, -3.93], card: [121.18, -2.14, -6.43], face: [128.5, 3.65, 0.13] }),
    druid: Object.freeze({ hero: [93, 0, -3.26], sheet: [91.4767, 0, -3.26], card: [118.94, 0, -5.61], face: [119, 0, 0] }),
  }),
  'arcane-weave-02': Object.freeze({
    knight: Object.freeze({ hero: [106.5, -2.0833, -8.12], sheet: [105.04, -2.0833, -8.12], card: [134.85, -2.67, -11.45], face: [121, -4.42, -3.81] }),
    paladin: Object.freeze({ hero: [89.6666, 1.6667, -1.6], sheet: [88.0766, 1.6667, -1.47], card: [109.22, 2.14, -2.05], face: [119, -0.66, -7.24] }),
    sorcerer: Object.freeze({ hero: [92.03, -1.6667, -2.62], sheet: [90.5, -1.6667, -2.58], card: [121.53, -2.14, -4.34], face: [109.91, 0, -5.25] }),
    druid: Object.freeze({ hero: [91.3333, 0, -2.5], sheet: [89.81, 0, -2.5], card: [116.9, 0, -4.86], face: [118.5, 0, -10.1] }),
  }),
  'celestial-rhythm-master': Object.freeze({
    knight: Object.freeze({ hero: [91.3333, -2.0833, -2.36], sheet: [90.05, -2.0833, -2.36], card: [115.68, -2.35, -5.62], face: [139, 0, -2.8] }),
    paladin: Object.freeze({ hero: [95.5, 1.6667, -4.1667], sheet: [93.91, 1.6667, -4.1667], card: [110, 2.14, -3.25], face: [134, 0, -2.3] }),
    sorcerer: Object.freeze({ hero: [90.4467, 0, -2.83], sheet: [88.9667, 0, -2.8], card: [115.67, 0, -5.38], face: [134, 0, -2] }),
    druid: Object.freeze({ hero: [91.3333, 0, -2.5], sheet: [89.81, 0, -2.5], card: [117.09, 4.08, -5.91], face: [139, 0, -0.6] }),
  }),
});

export function outfitDisplayProfile(classId, outfitId) {
  if (!DISPLAY_CLASSES.includes(classId)) return null;
  return OUTFIT_DISPLAY_PROFILES[outfitId]?.[classId] || null;
}

export function outfitDisplayStyle(classId, outfitId) {
  const profile = outfitDisplayProfile(classId, outfitId);
  if (!profile) return '';
  const variables = Object.entries(profile).flatMap(([surface, values]) => {
    const [size, x, y] = values;
    return [
      `--outfit-${surface}-size:${size}%`,
      `--outfit-${surface}-x:${x}%`,
      `--outfit-${surface}-y:${y}%`,
    ];
  });
  return variables.join(';');
}

function outfitDefinition(outfitId) {
  return OUTFIT_DEFINITIONS.find((outfit) => outfit.id === outfitId && outfit.released !== false)
    || OUTFIT_DEFINITIONS[0];
}

export function isOutfitUnlocked(outfitOrId, game = {}) {
  const outfit = typeof outfitOrId === 'string'
    ? OUTFIT_DEFINITIONS.find((candidate) => candidate.id === outfitOrId)
    : outfitOrId;
  if (!outfit) return false;
  if (outfit.released === false) return false;
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
