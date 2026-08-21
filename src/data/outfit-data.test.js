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
    expect(heroFaceSource('knight', 'original')).toBe('hero_face/knight_face.png');
    expect(heroSpriteSource('knight', 'happy', 'original')).toBe('sprites/knight_happy.png');
    expect(outfitUsesTransparentPortrait('original')).toBe(true);
  });

  it('resuelve los recursos transparentes del outfit de beta tester', () => {
    expect(isOutfitUnlocked('beta-tester', {})).toBe(false);
    expect(equippedOutfit('beta-tester', {}).id).toBe('original');
    const claimedGame = { pioneerReward: { claimedAt: 1234 } };
    expect(isOutfitUnlocked('beta-tester', claimedGame)).toBe(true);
    expect(equippedOutfit('beta-tester', claimedGame).id).toBe('beta-tester');
    expect(heroFaceSource('druid', 'beta-tester')).toBe('outfits/beta-tester/druid_face.png');
    expect(heroSpriteSource('druid', 'happy', 'beta-tester')).toBe('outfits/beta-tester/druid_happy.png');
    expect(outfitUsesTransparentPortrait('beta-tester')).toBe(true);
  });

  it('resuelve los recursos eléctricos del outfit crafteable', () => {
    expect(heroFaceSource('knight', 'arcane-weave-01'))
      .toBe('outfits/telecom-beta/knight_face.png');
    expect(heroSpriteSource('knight', 'happy', 'arcane-weave-01'))
      .toBe('outfits/telecom-beta/knight_happy.png');
    expect(outfitUsesTransparentPortrait('arcane-weave-01')).toBe(true);
  });
});
