import { describe, expect, it } from 'vitest';
import { huntResultRewardsMarkup, renderHuntView } from './hunt-view.js';

function renderReport(rewards, difficultyId = 'easy') {
  const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
  renderHuntView({
    document: { getElementById: () => root },
    game: {
      cls: 'paladin',
      hunt: {
        energyDay: '2026-08-26',
        energy: 4,
        lastReport: {
          difficultyId,
          won: true,
          encounters: [],
          rewards,
        },
      },
    },
    stats: { lvl: 20 },
    intoxication: null,
    nowTimestamp: new Date(2026, 7, 26, 12).getTime(),
  });
  return root.innerHTML;
}

describe('informe de Cacería', () => {
  it('prepara el botín final como casillas visuales con icono y cantidad', () => {
    const html = huntResultRewardsMarkup({ xp: 12, gold: 14, arcaneFibers: 1, bossBlood: 0 });
    expect(html).toContain('hunt-result-reward-grid items-3');
    expect(html).toContain('hunt-result-xp-icon');
    expect(html).toContain('12<small> XP</small>');
    expect(html).toContain('resource-icon--coin');
    expect(html).toContain('resource-icon--arcane-fiber');
    expect(html).not.toContain('resource-icon--boss-blood');
  });

  it('muestra una casilla vacía cuando no se obtiene botín', () => {
    expect(huntResultRewardsMarkup({})).toContain('Sin botín obtenido');
  });

  it('muestra únicamente las recompensas obtenidas', () => {
    const html = renderReport({ xp: 5, gold: 7, arcaneFibers: 0, bossBlood: 0 });
    expect(html).toContain('5</b> XP');
    expect(html).toContain('resource-icon--coin');
    expect(html).not.toContain('resource-icon--arcane-fiber');
    expect(html).not.toContain('resource-icon--boss-blood');
    expect(html).not.toContain('🪙');
  });

  it('no anuncia una expedición activa cuando no existe', () => {
    const html = renderReport({ xp: 0, gold: 0, arcaneFibers: 0, bossBlood: 0 });
    expect(html).not.toContain('Una expedición activa');
  });

  it('muestra la energía extra como una carga separada y consumible', () => {
    const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
    renderHuntView({
      document: { getElementById: () => root },
      game: {
        cls: 'paladin',
        hunt: {
          energyDay: '2026-08-26',
          baseEnergy: 5,
          energy: 6,
          bonusEnergyEarned: 1,
          bonusEnergyRemaining: 1,
        },
      },
      stats: { lvl: 20 },
      nowTimestamp: new Date(2026, 7, 26, 12).getTime(),
    });
    expect(root.innerHTML).toContain('<strong>5/5<em>+1</em></strong>');
    expect(root.innerHTML).not.toContain('6/6');
  });

  it('muestra de nuevo una carga antigua que había quedado borrada', () => {
    const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
    renderHuntView({
      document: { getElementById: () => root },
      game: {
        cls: 'paladin',
        hunt: {
          energyDay: '2026-08-26',
          baseEnergy: 5,
          energy: 5,
          bonusEnergyEarned: 0,
          bonusEnergyRemaining: 0,
          habitEnergyRolls: [{ key: 'habit-legacy', granted: 1, status: 'spent' }],
        },
      },
      stats: { lvl: 20 },
      nowTimestamp: new Date(2026, 7, 26, 12).getTime(),
    });
    expect(root.innerHTML).toContain('<strong>5/5<em>+1</em></strong>');
  });

  it('muestra fibra y sangre cuando realmente caen', () => {
    const html = renderReport({ xp: 22, gold: 24, arcaneFibers: 2, bossBlood: 1 }, 'hard');
    expect(html).toContain('resource-icon--arcane-fiber');
    expect(html).toContain('resource-icon--boss-blood');
    expect(html).not.toContain('🧵');
    expect(html).not.toContain('🩸');
  });
});
