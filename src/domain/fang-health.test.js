import { describe, expect, it } from 'vitest';
import { relicCombatBonus } from '../data/loot-data.js';
import { emptyLootState, normalizeLootState, advancePeriodicHealthRecovery, advancePeriodicManaRecovery, fuseRelics, defuseRelic, equipRelic, equippedRelicBonuses, activateFusionFirstHabitHealth, activateRelicConstancy, syncRelicConstancy } from './loot-rules.js';

const HALF_HOUR = 1800000;
function fixture(rank = 1) {
  const state = emptyLootState();
  state.economy.coins = 10000;
  state.economy.bossBlood = 100;
  for (let i = 1; i <= 6; i++) state.inventory.relics[`relic_0${i}`] = { unlocked: true, rank, rarity: 'legendary', affixes: ['vitality'] };
  return state;
}
function fused(left, rank = 1) {
  return fuseRelics({ state: fixture(rank), leftId: left, rightId: 'relic_06', operationId: 'test', randomValue: 0, nowTimestamp: 1 });
}
describe('Colmillo: recuperación de vida y nuevas fusiones', () => {
  it.each([[1,30],[2,45],[3,60]])('rango %i conserva fuerza y recupera %i%% diario sin curación al equipar', (rank, percent) => {
    const state = fixture(rank);
    state.inventory.equipped = ['relic_06'];
    const first = advancePeriodicHealthRecovery({state, nowTimestamp: 1000, maxHp: 1000, currentHp: 100});
    expect(first.hpRecovered).toBe(0);
    const day = advancePeriodicHealthRecovery({state:first, nowTimestamp:1000+48*HALF_HOUR,maxHp:1000,currentHp:100});
    expect(day.hpRecovered).toBe(percent*10);
    expect(relicCombatBonus('relic_06',rank)).toEqual({stat:'physicalAttack',value:rank+1});
    expect(advancePeriodicHealthRecovery({state:day,nowTimestamp:1000+48*HALF_HOUR,maxHp:1000,currentHp:day.hp}).hpRecovered).toBe(0);
  });
  it('respeta vida máxima, no resucita y pausa al desequipar', () => {
    const state = fixture(); state.inventory.equipped=['relic_06'];
    const first=advancePeriodicHealthRecovery({state,nowTimestamp:1000,maxHp:1000,currentHp:999});
    expect(advancePeriodicHealthRecovery({state:first,nowTimestamp:1000+HALF_HOUR,maxHp:1000,currentHp:999}).hp).toBe(1000);
    expect(advancePeriodicHealthRecovery({state:first,nowTimestamp:1000+HALF_HOUR,maxHp:1000,currentHp:0}).hp).toBe(0);
    first.inventory.equipped=[];
    const paused=advancePeriodicHealthRecovery({state:first,nowTimestamp:1000+HALF_HOUR/2,maxHp:1000,currentHp:100});
    paused.inventory.equipped=['relic_06'];
    const resumed=advancePeriodicHealthRecovery({state:paused,nowTimestamp:1000+48*HALF_HOUR,maxHp:1000,currentHp:100});
    expect(resumed.hpRecovered).toBe(0);
    expect(resumed.inventory.periodicEffects.healthRecovery.timers.relic_06.nextAt).toBe(1000+48.5*HALF_HOUR);
  });
  it.each(['relic_01','relic_02','relic_05'])('migra la fusión con %s sin perder rareza, rango, XP histórica o ingredientes', left => {
    const legacy=fused(left,2); const id=legacy.fusedRelicId || Object.keys(legacy.inventory.relics).find(k=>k.startsWith('fusion_'));
    const relic=legacy.inventory.relics[id];
    relic.inheritedEffects.relic_06=15; relic.ingredientSnapshots.relic_06.effectValue=15;
    legacy.inventory.dailyActivations['relic_06:ayer']=15;
    const migrated=normalizeLootState(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.inventory.relics[id]).toMatchObject({rank:2,rarity:'legendary',affixes:['vitality'],inheritedEffects:{relic_06:45}});
    expect(migrated.inventory.dailyActivations['relic_06:ayer']).toBe(15);
    expect(normalizeLootState(migrated).inventory.relics[id]).toEqual(migrated.inventory.relics[id]);
    const restored=defuseRelic({state:migrated,relicId:id,operationId:'undo',nowTimestamp:2});
    expect(restored.ok).toBe(true); expect(restored.inventory.relics.relic_06.rank).toBe(2);
  });
  it('Daga hereda ambos ataques y extras sin duplicados; cura una vez al día', () => {
    const state=equipRelic(fused('relic_03'),'fusion_17');
    expect(equippedRelicBonuses(state)).toMatchObject({physicalAttack:3,maxHpPercent:5});
    expect(state.inventory.relics.fusion_17.inheritedEffects).toEqual({relic_03:2,relic_06:30});
    const healed=activateFusionFirstHabitHealth({state,dayKey:'today',maxHp:100,currentHp:50});
    expect(healed.hp).toBe(53);
    expect(activateFusionFirstHabitHealth({state:healed,dayKey:'today',maxHp:100,currentHp:53}).hpRecovered).toBe(0);
  });
  it('Yelmo hereda defensa/fuerza y Constancia; añade vida sin más XP ni repetición', () => {
    const equipped=equipRelic(fused('relic_04'),'fusion_05');
    expect(equippedRelicBonuses(equipped)).toMatchObject({physicalAttack:2,defense:2});
    const state=syncRelicConstancy(equipped,{cycleId:'cycle',outcomes:[],nowTimestamp:1});
    const first=activateRelicConstancy({state,cycleId:'cycle',outcomes:Array(6).fill('hit'),bossWon:true,nowTimestamp:2});
    expect(first).toMatchObject({xp:20,healthPercent:10});
    expect(activateRelicConstancy({state:first,cycleId:'cycle',outcomes:Array(6).fill('hit'),bossWon:true,nowTimestamp:3})).toMatchObject({xp:0,healthPercent:0});
  });
  it('Frasco y Colmillo fusionados mantienen temporizadores independientes', () => {
    const equipped=equipRelic(fused('relic_05'),'fusion_16');
    const mana=advancePeriodicManaRecovery({state:equipped,nowTimestamp:1000,maxMana:1000,currentMana:100});
    const health=advancePeriodicHealthRecovery({state:mana,nowTimestamp:1000,maxHp:1000,currentHp:100});
    const next=advancePeriodicHealthRecovery({state:health,nowTimestamp:1000+48*HALF_HOUR,maxHp:1000,currentHp:100});
    expect(next.hpRecovered).toBe(300);
    expect(next.inventory.periodicEffects.manaRecovery).toEqual(mana.inventory.periodicEffects.manaRecovery);
  });
});
