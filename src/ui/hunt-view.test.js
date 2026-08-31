import { describe, expect, it } from 'vitest';
import { huntResultRewardsMarkup, huntResultSummaryMarkup, renderHuntView } from './hunt-view.js';

function renderReport(rewards, difficultyId = 'easy', reportOverrides = {}) {
  const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
  renderHuntView({
    document: { getElementById: () => root },
    game: {
      cls: 'paladin',
      hunt: {
        energyDay: '2026-08-26',
        energyCapacityVersion: 2,
        energy: 4,
        lastReport: {
          difficultyId,
          won: true,
          encounters: [],
          rewards,
          ...reportOverrides,
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

  it('separa la bonificación de Fortuna del oro total', () => {
    const rewards = { xp: 12, gold: 21, baseGold: 14, fortuneGold: 7 };
    expect(huntResultRewardsMarkup(rewards)).toContain('Poción de Fortuna · +7 oro (50%)');
    const summary = huntResultSummaryMarkup({
      defeatedEnemies: 3,
      heroHp: 80,
      heroMana: 60,
      heroMaxHp: 100,
      heroMaxMana: 100,
      encounters: [],
      rewards,
      fortune: { dayKey: '2026-08-28', granted: 7 },
    });
    expect(summary).toContain('Fortuna · +7 oro de bonificación');
    const report = renderReport(rewards, 'medium', {
      fortune: { dayKey: '2026-08-28', granted: 7 },
    });
    expect(report).toContain('Fortuna · +7 oro (50%)');
  });

  it('muestra una casilla vacía cuando no se obtiene botín', () => {
    expect(huntResultRewardsMarkup({})).toContain('Sin botín obtenido');
  });

  it('resume toda la batalla en el modal de botín', () => {
    const html = huntResultSummaryMarkup({
      defeatedEnemies: 2,
      heroHp: 42,
      heroMana: 31,
      heroMaxHp: 100,
      heroMaxMana: 80,
      encounters: [
        { rounds: 4, damageDealt: 50, damageTaken: 12, potionUses: [{ type: 'life' }] },
        { rounds: 3, damageDealt: 80, damageTaken: 24, potionUses: [{ type: 'mana' }] },
      ],
    });
    expect(html).toContain('<b>2/3</b>');
    expect(html).toContain('<b>7</b>');
    expect(html).toContain('<span>Daño efectuado</span><b>130</b>');
    expect(html).toContain('<span>Daño recibido</span><b>36</b>');
    expect(html).toContain('Salida de la cacería');
    expect(html).toContain('<i>Vida</i> 42%');
    expect(html).toContain('<i>Maná</i> 39%');
    expect(html).toContain('Vida ×1 · Maná ×1');
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
          energyCapacityVersion: 2,
          baseEnergy: 10,
          energy: 11,
          bonusEnergyEarned: 1,
          bonusEnergyRemaining: 1,
        },
      },
      stats: { lvl: 20 },
      nowTimestamp: new Date(2026, 7, 26, 12).getTime(),
    });
    expect(root.innerHTML).toContain('<strong>10/10<em>+1</em></strong>');
    expect(root.innerHTML).not.toContain('11/11');
  });

  it('mantiene 10 como capacidad aunque el día penalizado recargue solo 2', () => {
    const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
    renderHuntView({
      document: { getElementById: () => root },
      game: {
        cls: 'paladin',
        hunt: {
          energyDay: '2026-08-26',
          energyCapacityVersion: 2,
          baseEnergy: 2,
          energy: 2,
        },
      },
      stats: { lvl: 20 },
      nowTimestamp: new Date(2026, 7, 26, 12).getTime(),
    });
    expect(root.innerHTML).toContain('<strong>2/10</strong>');
    expect(root.innerHTML).not.toContain('2/2');
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
    expect(root.innerHTML).toContain('<strong>10/10<em>+1</em></strong>');
  });

  it('integra la cacería activa sobre la imagen de la región sin crear otra tarjeta', () => {
    const root = { dataset: { huntScreen: 'region' }, innerHTML: '' };
    const nowTimestamp = new Date(2026, 7, 26, 12).getTime();
    renderHuntView({
      document: { getElementById: () => root },
      game: {
        cls: 'paladin',
        hunt: {
          energyDay: '2026-08-26',
          energyCapacityVersion: 2,
          energy: 4,
          active: {
            difficultyId: 'easy',
            startedAt: nowTimestamp,
            endsAt: nowTimestamp + 60_000,
          },
        },
      },
      stats: { lvl: 20 },
      nowTimestamp,
    });
    expect(root.innerHTML).toContain('hunt-region-art');
    expect(root.innerHTML).toContain('hunt-region-active');
    expect(root.innerHTML).toContain('CACERÍA EN CURSO · Fácil');
    expect(root.innerHTML).toContain('data-hunt-countdown');
    expect(root.innerHTML).not.toContain('card hunt-active');
  });

  it('muestra fibra y sangre cuando realmente caen', () => {
    const html = renderReport({ xp: 22, gold: 24, arcaneFibers: 2, bossBlood: 1 }, 'hard');
    expect(html).toContain('resource-icon--arcane-fiber');
    expect(html).toContain('resource-icon--boss-blood');
    expect(html).not.toContain('🧵');
    expect(html).not.toContain('🩸');
  });

  it('explica claramente con qué vida y maná termina la cacería', () => {
    const html = renderReport(
      { xp: 10, gold: 12, arcaneFibers: 1, bossBlood: 0 },
      'hard',
      {
        won: false,
        defeatedEnemies: 2,
        heroHp: 27,
        heroMaxHp: 100,
        heroMana: 40,
        heroMaxMana: 80,
        recovery: { hp: 17, mana: 10 },
        encounters: [{
          role: 'Soldado',
          name: 'Brote Engañoso',
          won: false,
          rounds: 1,
          damageDealt: 20,
          damageTaken: 30,
          heroHpAtStart: 80,
          heroManaAtStart: 60,
          heroHp: 10,
          heroMana: 30,
          nextHeroHp: 10,
          nextHeroMana: 30,
          recoveryAfter: { hp: 0, mana: 0 },
          roundDetails: [],
          rewards: { xp: 0, gold: 0, arcaneFibers: 0, bossBlood: 0 },
        }],
      },
    );
    expect(html).toContain('AVANCE PARCIAL');
    expect(html).toContain('<span>ENTRASTE</span><b>80% vida</b><b>75% maná</b>');
    expect(html).toContain('<span>SALISTE</span><b>27% vida</b><b>50% maná</b>');
    expect(html).not.toContain('Recuperaste');
    expect(html).toContain('resource-icon--arcane-fiber');
  });

  it('colapsa cada enemigo y despliega solo el resumen de su combate', () => {
    const html = renderReport(
      { xp: 5, gold: 7, arcaneFibers: 0, bossBlood: 0 },
      'easy',
      {
        heroMaxHp: 100,
        heroMaxMana: 80,
        encounters: [{
          role: 'Soldado',
          name: 'Brote Engañoso',
          won: true,
          rounds: 2,
          damageDealt: 44,
          damageTaken: 12,
          heroHp: 38,
          heroMana: 26,
          nextHeroHp: 70,
          nextHeroMana: 34,
          recoveryAfter: { hp: 32, mana: 8 },
          potionUses: [{ round: 1, type: 'life', restored: 20 }],
          roundDetails: [
            { round: 1, damageDealt: 24, damageTaken: 7, heroHp: 43, heroMana: 28, potionUses: [{ type: 'life', restored: 20 }] },
            { round: 2, damageDealt: 20, damageTaken: 5, heroHp: 38, heroMana: 26, potionUses: [] },
          ],
          rewards: { xp: 5, gold: 7, arcaneFibers: 0, bossBlood: 0 },
        }],
      },
    );
    expect(html).toContain('<details class="hunt-report-row won">');
    expect(html).toContain('<strong>Brote Engañoso</strong>');
    expect(html).toContain('<small class="hunt-report-role soldier">Soldado</small>');
    expect(html).toContain('<b>VICTORIA</b>');
    expect(html).toContain('<i class="hunt-report-chevron" aria-hidden="true"></i>');
    expect(html).toContain('<small>RONDAS</small><b>2</b>');
    expect(html).toContain('DAÑO EFECTUADO');
    expect(html).toContain('<small>DAÑO EFECTUADO</small><b>44</b>');
    expect(html).toContain('DAÑO RECIBIDO');
    expect(html).toContain('<small>DAÑO RECIBIDO</small><b>12</b>');
    expect(html).toContain('+32 vida · +8 maná');
    expect(html).toContain('<span>BOTÍN</span>');
    expect(html).toContain('FIN DE LOS COMBATES');
    expect(html).toContain('70% vida · 43% maná');
    expect(html).not.toContain('REGISTRO DE COMBATE');
    expect(html).not.toContain('RONDA 1');
    expect(html).not.toContain('Poción de vida +20');
    expect(html).not.toContain('Informe anterior');
    expect(html).not.toContain('Final:');
  });
});
