import { describe, expect, it } from 'vitest';
import {
  equippedFrame,
  heroBackgroundSource,
  isFrameUnlocked,
} from './frame-data.js';

describe('marcos del héroe', () => {
  it('mantiene el marco original disponible y dependiente de la superficie', () => {
    expect(isFrameUnlocked('original', {})).toBe(true);
    expect(heroBackgroundSource('original', 'druid', 'hero')).toBe('hero_background/druid_bg.png');
    expect(heroBackgroundSource('original', 'druid', 'today')).toBe('hero_background/druid_today_bg.png');
    expect(heroBackgroundSource('original', 'druid', 'habits')).toBe('backgrounds/habits_training_bg.png');
  });

  it('solo permite equipar el marco Beta Tester cuando pertenece al jugador', () => {
    expect(isFrameUnlocked('beta-tester', {})).toBe(false);
    expect(equippedFrame('beta-tester', {}).id).toBe('original');
    const game = { frames: { owned: { 'beta-tester': { acquiredAt: 1234 } } } };
    expect(isFrameUnlocked('beta-tester', game)).toBe(true);
    expect(equippedFrame('beta-tester', game).id).toBe('beta-tester');
    expect(heroBackgroundSource('beta-tester', 'knight', 'today', game)).toBe('hero_background/beta_tester_bg_final.webp');
  });
});
