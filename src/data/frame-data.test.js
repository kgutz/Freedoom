import { describe, expect, it } from 'vitest';
import {
  FRAME_DEFINITIONS,
  equippedFrame,
  heroBackgroundSource,
  isFrameUnlocked,
} from './frame-data.js';

describe('marcos del héroe', () => {
  it('usa los dos formatos del regalo del Templo solo cuando está desbloqueado',()=>{
    const game={frames:{owned:{'azariel-temple':{acquiredAt:1}}}};
    expect(isFrameUnlocked('azariel-temple',{})).toBe(false);
    expect(heroBackgroundSource('azariel-temple','paladin','hero',game)).toBe('hero_background/azariel_temple.webp');
    expect(heroBackgroundSource('azariel-temple','paladin','today',game)).toBe('hero_background/azariel_temple_wide.webp');
    expect(heroBackgroundSource('azariel-temple','paladin','habits',game)).toBe('hero_background/azariel_temple_wide.webp');
  });
  it('mantiene el marco original disponible y dependiente de la superficie', () => {
    expect(isFrameUnlocked('original', {})).toBe(true);
    expect(heroBackgroundSource('original', 'druid', 'hero')).toBe('hero_background/druid_bg.webp');
    expect(heroBackgroundSource('original', 'druid', 'today')).toBe('hero_background/druid_today_bg.webp');
    expect(heroBackgroundSource('original', 'druid', 'habits')).toBe('backgrounds/habits_training_bg.webp');
  });

  it('solo permite equipar el marco Beta Tester cuando pertenece al jugador', () => {
    expect(isFrameUnlocked('beta-tester', {})).toBe(false);
    expect(equippedFrame('beta-tester', {}).id).toBe('original');
    const game = { frames: { owned: { 'beta-tester': { acquiredAt: 1234 } } } };
    expect(isFrameUnlocked('beta-tester', game)).toBe(true);
    expect(equippedFrame('beta-tester', game).id).toBe('beta-tester');
    expect(heroBackgroundSource('beta-tester', 'knight', 'today', game)).toBe('hero_background/beta_tester_bg_final.webp');
  });

  it('mantiene bloqueado el Santuario del Crisol hasta comprarlo en el Pintor', () => {
    expect(isFrameUnlocked('welder-beta', {})).toBe(false);
    const game = { frames: { owned: { 'welder-beta': { acquiredAt: 1234 } } } };
    expect(isFrameUnlocked('welder-beta', game)).toBe(true);
    expect(heroBackgroundSource('welder-beta', 'paladin', 'hero', game)).toBe('hero_background/welder_beta_forge.webp');
  });

  it('publica el Estudio Musical Celestial con su fondo definitivo', () => {
    const game = { frames: { owned: { 'celestial-music-studio': { acquiredAt: 1 } } } };
    const frame = FRAME_DEFINITIONS.find((candidate) => candidate.id === 'celestial-music-studio');
    expect(frame).toMatchObject({ released: true, recipe: { arcaneInks: 35, coins: 350 } });
    expect(isFrameUnlocked('celestial-music-studio', game)).toBe(true);
    expect(equippedFrame('celestial-music-studio', game).id).toBe('celestial-music-studio');
    expect(heroBackgroundSource('celestial-music-studio', 'druid', 'today', game))
      .toBe('hero_background/celestial_music_studio.webp');
  });
});
