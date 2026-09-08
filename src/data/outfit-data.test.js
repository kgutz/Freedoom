import { describe, expect, it } from 'vitest';
import {
  OUTFIT_DEFINITIONS,
  OUTFIT_DISPLAY_PROFILES,
  equippedOutfit,
  heroFaceSource,
  heroSpriteSource,
  isOutfitUnlocked,
  outfitDisplayProfile,
  outfitDisplayStyle,
  outfitUsesTransparentPortrait,
} from './outfit-data.js';

describe('outfits de héroe', () => {
  it('mantiene los recursos originales para el outfit original', () => {
    expect(heroFaceSource('knight', 'original')).toBe('hero_face/knight_face.webp');
    expect(heroSpriteSource('knight', 'happy', 'original')).toBe('sprites/knight_happy.webp');
    expect(outfitUsesTransparentPortrait('original')).toBe(true);
  });

  it('resuelve los recursos transparentes del outfit de beta tester', () => {
    expect(isOutfitUnlocked('beta-tester', {})).toBe(false);
    expect(equippedOutfit('beta-tester', {}).id).toBe('original');
    const claimedGame = { pioneerReward: { claimedAt: 1234 } };
    expect(isOutfitUnlocked('beta-tester', claimedGame)).toBe(true);
    expect(equippedOutfit('beta-tester', claimedGame).id).toBe('beta-tester');
    expect(heroFaceSource('druid', 'beta-tester')).toBe('outfits/beta-tester/druid_face.webp');
    expect(heroSpriteSource('druid', 'happy', 'beta-tester')).toBe('outfits/beta-tester/druid_happy.webp');
    expect(outfitUsesTransparentPortrait('beta-tester')).toBe(true);
  });

  it('resuelve los recursos eléctricos del outfit crafteable', () => {
    expect(heroFaceSource('knight', 'arcane-weave-01'))
      .toBe('outfits/telecom-beta/knight_face.webp');
    expect(heroSpriteSource('knight', 'happy', 'arcane-weave-01'))
      .toBe('outfits/telecom-beta/knight_happy.webp');
    expect(outfitUsesTransparentPortrait('arcane-weave-01')).toBe(true);
  });

  it('resuelve los recursos del Forjador del Crisol publicado', () => {
    const previouslyOwned = { outfits: { owned: { 'arcane-weave-02': { acquiredAt: 1 } } } };
    expect(isOutfitUnlocked('arcane-weave-02', previouslyOwned)).toBe(true);
    expect(equippedOutfit('arcane-weave-02', previouslyOwned).id).toBe('arcane-weave-02');
    expect(heroFaceSource('paladin', 'arcane-weave-02'))
      .toBe('outfits/welder-beta/paladin_face.webp');
    expect(heroSpriteSource('paladin', 'happy', 'arcane-weave-02'))
      .toBe('outfits/welder-beta/paladin_happy.webp');
    expect(outfitUsesTransparentPortrait('arcane-weave-02')).toBe(true);
  });

  it('publica el Maestro del Ritmo Celestial con sus recursos definitivos', () => {
    const game = { outfits: { owned: { 'celestial-rhythm-master': { acquiredAt: 1 } } } };
    const outfit = OUTFIT_DEFINITIONS.find((candidate) => candidate.id === 'celestial-rhythm-master');
    expect(outfit).toMatchObject({ released: true, recipe: { arcaneFibers: 20, coins: 320 } });
    expect(isOutfitUnlocked('celestial-rhythm-master', game)).toBe(true);
    expect(equippedOutfit('celestial-rhythm-master', game).id).toBe('celestial-rhythm-master');
    expect(heroFaceSource('knight', 'celestial-rhythm-master'))
      .toBe('outfits/celestial-rhythm/knight_face.webp');
    expect(heroSpriteSource('knight', 'happy', 'celestial-rhythm-master'))
      .toBe('outfits/celestial-rhythm/knight_happy.webp');
  });

  it('exige una calibracion completa para cada outfit y cada heroe', () => {
    const remastered = OUTFIT_DEFINITIONS;
    const classes = ['knight', 'paladin', 'sorcerer', 'druid'];
    for (const outfit of remastered) {
      expect(OUTFIT_DISPLAY_PROFILES[outfit.id]).toBeDefined();
      for (const classId of classes) {
        const profile = outfitDisplayProfile(classId, outfit.id);
        expect(profile).toBeDefined();
        expect(Object.keys(profile)).toEqual(['hero', 'sheet', 'card', 'face']);
        for (const values of Object.values(profile)) {
          expect(values).toHaveLength(3);
          expect(values.every(Number.isFinite)).toBe(true);
          expect(values[0]).toBeGreaterThan(0);
        }
        const style = outfitDisplayStyle(classId, outfit.id);
        expect(style).toContain('--outfit-hero-size:');
        expect(style).toContain('--outfit-sheet-size:');
        expect(style).toContain('--outfit-card-size:');
        expect(style).toContain('--outfit-face-size:');
      }
    }
    expect(outfitDisplayProfile('paladin', 'original')).toBeDefined();
    expect(outfitDisplayStyle('paladin', 'original')).toContain('--outfit-hero-size:78%');
  });

  it('mantiene todos los pies en la misma linea de tienda e inventario', () => {
    const alphaBottom = {
      original: { knight: 312 / 320, paladin: 312 / 320, sorcerer: 312 / 320, druid: 312 / 320 },
      'beta-tester': { knight: 368 / 384, paladin: 368 / 384, sorcerer: 368 / 384, druid: 368 / 384 },
      'arcane-weave-01': { knight: 368 / 384, paladin: 368 / 384, sorcerer: 368 / 384, druid: 368 / 384 },
      'arcane-weave-02': { knight: 368 / 384, paladin: 368 / 384, sorcerer: 368 / 384, druid: 368 / 384 },
      'celestial-rhythm-master': { knight: 373 / 384, paladin: 372 / 384, sorcerer: 372 / 384, druid: 372 / 384 },
    };

    for (const [outfitId, classes] of Object.entries(alphaBottom)) {
      for (const [classId, bottom] of Object.entries(classes)) {
        const [size, , y] = outfitDisplayProfile(classId, outfitId).card;
        const renderedFootLine = 50 + y + (0.8 * size * (bottom - 0.5));
        expect(renderedFootLine).toBeCloseTo(88, 1);
      }
    }
  });
});
