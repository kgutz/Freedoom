import { describe, expect, it } from 'vitest';
import {
  equippedOutfit,
  heroFaceSource,
  heroSpriteSource,
  isOutfitUnlocked,
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

  it('mapea las cuatro clases del Maestro del Ritmo Celestial', () => {
    const game = { outfits: { owned: { 'celestial-rhythm-master': { acquiredAt: 1 } } } };
    expect(isOutfitUnlocked('celestial-rhythm-master', game)).toBe(true);
    for (const classId of ['knight', 'paladin', 'sorcerer', 'druid']) {
      expect(heroFaceSource(classId, 'celestial-rhythm-master'))
        .toBe(`outfits/celestial-rhythm/${classId}_face.webp`);
      expect(heroSpriteSource(classId, 'happy', 'celestial-rhythm-master'))
        .toBe(`outfits/celestial-rhythm/${classId}_happy.webp`);
    }
  });
});
