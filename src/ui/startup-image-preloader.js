import { BOSS_SLUGS, CLASSES } from '../data/game-data.js';
import { FRAME_DEFINITIONS, heroBackgroundSource, isFrameUnlocked } from '../data/frame-data.js';
import { ALL_RELIC_DEFINITIONS } from '../data/loot-data.js';
import {
  OUTFIT_DEFINITIONS,
  equippedOutfit,
  heroFaceSource,
  heroSpriteSource,
  isOutfitUnlocked,
} from '../data/outfit-data.js';
import { POTION_DEFINITIONS } from '../data/potion-data.js';

const HUNT_ASSETS = Object.freeze([
  'hunt/world-map.webp',
  'hunt/fields-of-mist/region.webp',
  'hunt/fields-of-mist/blighted-harvester.webp',
  'hunt/fields-of-mist/spore-overseer.webp',
  'hunt/fields-of-mist/mist-mother.webp',
]);

function unique(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function classSpellAssets(classId) {
  const definition = CLASSES[classId];
  if (!definition) return [];
  const effectId = { paladin: 'certero', sorcerer: 'ceniza', druid: 'regen' }[classId];
  return unique([
    ...definition.pas.map((ability) => `spells/${classId}_spells/${classId}_pas_${ability.icon}.webp`),
    ...definition.act.map((ability) => `spells/${classId}_spells/${classId}_act_${ability.icon}.webp`),
    effectId ? `spells/effect_icons/${classId}_effect_${effectId}.webp` : null,
    'spells/effect_icons/beer_effect_intoxication.webp',
  ]);
}

export function startupImagePhases(game = {}) {
  const classId = game.cls || 'knight';
  const outfit = equippedOutfit(game.outfit, game);
  const ownedOutfits = OUTFIT_DEFINITIONS.filter((candidate) => isOutfitUnlocked(candidate, game));
  const ownedFrames = FRAME_DEFINITIONS.filter((candidate) => isFrameUnlocked(candidate, game));
  const currentHeroAssets = [
    heroFaceSource(classId, outfit.id),
    heroSpriteSource(classId, 'happy', outfit.id),
    heroBackgroundSource(game.frame, classId, 'today', game),
    heroBackgroundSource(game.frame, classId, 'hero', game),
    heroBackgroundSource(game.frame, classId, 'habits', game),
  ];

  return [
    {
      id: 'current-hero',
      delay: 0,
      assets: unique(['logo.webp', 'ui/backpack.webp', ...currentHeroAssets]),
    },
    {
      id: 'hero-details',
      delay: 1_500,
      assets: classSpellAssets(classId),
    },
    {
      id: 'hunt',
      delay: 3_500,
      assets: HUNT_ASSETS,
    },
    {
      id: 'customization',
      delay: 6_000,
      assets: unique([
        ...ownedOutfits.flatMap((candidate) => [
          heroFaceSource(classId, candidate.id),
          heroSpriteSource(classId, 'happy', candidate.id),
        ]),
        ...ownedFrames.map((candidate) => heroBackgroundSource(candidate.id, classId, 'hero', game)),
      ]),
    },
    {
      id: 'inventory',
      delay: 8_500,
      assets: unique([
        ...ALL_RELIC_DEFINITIONS.map((definition) => definition.image),
        ...POTION_DEFINITIONS.map((definition) => `potions/potion_${definition.id}.webp`),
        'relics/boss_loot_chest.webp',
        'relics/boss_loot_chest_open_sapphire.webp',
        'rewards/pioneer-chest.webp',
      ]),
    },
    {
      id: 'bosses',
      delay: 11_000,
      assets: unique([
        'bosses/boss_medal_locked.webp',
        ...BOSS_SLUGS.slice(0, 12).map((slug, index) => (
          `bosses/boss_${String(index + 1).padStart(2, '0')}_${slug}.webp`
        )),
      ]),
    },
  ];
}

export function createImagePreloader({ window, concurrency = 2 } = {}) {
  const queued = new Set();
  const pending = [];
  const activeImages = new Set();
  let active = 0;
  let cancelled = false;

  const pump = () => {
    if (cancelled) return;
    while (active < concurrency && pending.length) {
      const source = pending.shift();
      const image = new window.Image();
      active += 1;
      activeImages.add(image);
      image.decoding = 'async';

      const finish = () => {
        active -= 1;
        activeImages.delete(image);
        pump();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).finally(finish);
        } else {
          finish();
        }
      };
      image.onerror = finish;
      image.src = source;
    }
  };

  return {
    enqueue(sources = []) {
      if (cancelled) return;
      for (const source of sources) {
        if (!source || queued.has(source)) continue;
        queued.add(source);
        pending.push(source);
      }
      pump();
    },
    cancel() {
      cancelled = true;
      pending.length = 0;
      activeImages.clear();
    },
    snapshot() {
      return { queued: queued.size, pending: pending.length, active };
    },
  };
}

export function scheduleImagePreloadPhases({ window, phases, preloader }) {
  let cancelled = false;
  const cancelers = phases.map((phase) => {
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const run = () => {
        if (!cancelled) preloader.enqueue(phase.assets);
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 750 });
      } else {
        run();
      }
    }, phase.delay);
    return () => window.clearTimeout(timer);
  });

  return () => {
    cancelled = true;
    cancelers.forEach((cancel) => cancel());
    preloader.cancel();
  };
}
