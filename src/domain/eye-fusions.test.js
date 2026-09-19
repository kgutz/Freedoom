import { describe, expect, it } from 'vitest';
import { fusionDefinition, relicRankEffect, relicCombatBonuses } from '../data/loot-data.js';
import { emptyLootState, normalizeLootState, fuseRelics, defuseRelic, equipRelic, unequipRelic, equippedHuntEffects, equippedRelicBonuses, chargeFirstHabitVampirism, consumeHuntCharges, activateRelicConstancy, syncRelicConstancy, fusionRecipeStatus } from './loot-rules.js';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';

const ids = ['fusion_20','fusion_21','fusion_22','fusion_23','fusion_24','fusion_25'];
function create(id, rank=1) {
  const state = emptyLootState(); state.economy.coins=10000; state.economy.bossBlood=100;
  const recipe=fusionDefinition(id);
  recipe.ingredientIds.forEach((base,i)=>{state.inventory.relics[base]={unlocked:true,rank,rarity:'legendary',affixes:[i?'fortune':'vitality']};});
  const result=fuseRelics({state,leftId:recipe.ingredientIds[0],rightId:'relic_08',operationId:'make',randomValue:0,nowTimestamp:1});
  expect(result.ok).toBe(true);
  return equipRelic(result,id);
}
const hero={maxHp:1000,maxMana:100,physicalAttack:100,magicAttack:100,defense:0};
const enemy={maxHp:1000,physicalAttack:100,defense:0};
const fight=(effects,extra={})=>simulatePveCombat({hero,enemy,heroHp:500,heroMana:10,maxRounds:3,roll:()=>0.99,relicEffects:effects,...extra});
function expedition(effects={}) {
  const begun=startHunt({hunt:{},difficultyId:'easy',level:20,seed:15,nowTimestamp:1000,relicEffects:effects});
  expect(begun.ok).toBe(true);
  return resolveHunt({hunt:JSON.parse(JSON.stringify(begun.hunt)),classId:'knight',level:20,allocation:{constitution:60},nowTimestamp:61000});
}

describe.each(ids)('%s herencia y persistencia',id=>{
  it.each([1,2,3])('rango %i: crea, descubre y deshace con snapshots, afijos y atributos íntegros',rank=>{
    const state=create(id,rank), recipe=fusionDefinition(id);
    const relic=state.inventory.relics[id];
    expect(state.ok).toBe(true);
    expect(state.forge.fusion.discoveredRecipes).toContain(recipe.recipeId);
    expect(relic.affixes).toEqual(['vitality','fortune']);
    for(const base of recipe.ingredientIds){
      expect(relic.inheritedEffects[base]).toBe(relicRankEffect(base,rank));
      expect(relic.ingredientSnapshots[base].rank).toBe(rank);
    }
    const summed={physicalAttack:0,magicAttack:0,defense:0};
    for(const base of recipe.ingredientIds) for(const stat of relicCombatBonuses(base,rank)) summed[stat.stat]+=stat.value;
    expect(equippedRelicBonuses(state)).toMatchObject(summed);
    const loaded=normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(normalizeLootState(loaded)).toEqual(loaded);
    expect(equippedHuntEffects(loaded).petrification).toBe(relicRankEffect('relic_08',rank));
    const unequipped=unequipRelic(loaded,id,{confirmConstancyReset:true});
    expect(Object.entries(equippedHuntEffects(unequipped)).filter(([key])=>key.startsWith('petrification')).every(([,value])=>value===0)).toBe(true);
    const restored=defuseRelic({state:loaded,relicId:id,operationId:'undo',nowTimestamp:2});
    expect(restored.ok).toBe(true);
    for(const [i,base] of recipe.ingredientIds.entries()) expect(restored.inventory.relics[base]).toMatchObject({rank,rarity:'legendary',affixes:[i?'fortune':'vitality']});
    expect(equippedHuntEffects(restored).petrification).toBe(0);
  });
});

describe('Cargas de Ojo',()=>{
  it.each([1,2,3])('primer hábito carga una vez, persistencia, consumo y ausencia retroactiva R%i',rank=>{
    const id='fusion_20', value=fusionDefinition(id).synergy.values[rank];
    let state=chargeFirstHabitVampirism(create(id,rank),'day');
    state=normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(equippedHuntEffects(state).petrificationFirstBonus).toBe(value);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state,'day')).petrificationFirstBonus).toBe(value);
    const started=startHunt({hunt:{},difficultyId:'easy',level:20,nowTimestamp:1000,relicEffects:equippedHuntEffects(state)});
    expect(started.ok).toBe(true);
    state=consumeHuntCharges(state);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state,'day')).petrificationFirstBonus).toBe(0);
    expect(started.hunt.active.relicEffects.petrificationFirstBonus).toBe(value);
    state=chargeFirstHabitVampirism(state,'tomorrow');
    expect(equippedHuntEffects(state).petrificationFirstBonus).toBe(value);
    state=unequipRelic(state,id);
    expect(equippedHuntEffects(equipRelic(state,id)).petrificationFirstBonus).toBe(0);
  });
  it('no carga si el primer hábito ocurrió sin equipar; desfusión/refusión no recarga',()=>{
    let state=create('fusion_20');
    state=chargeFirstHabitVampirism(unequipRelic(state,'fusion_20'),'day');
    state=chargeFirstHabitVampirism(equipRelic(state,'fusion_20'),'day');
    expect(equippedHuntEffects(state).petrificationFirstBonus).toBe(0);
    state=chargeFirstHabitVampirism(state,'tomorrow');
    state=defuseRelic({state,relicId:'fusion_20',operationId:'undo'});
    state=fuseRelics({state,leftId:'relic_02',rightId:'relic_08',operationId:'remake',randomValue:0});
    state=chargeFirstHabitVampirism(equipRelic(state,'fusion_20'),'tomorrow');
    expect(equippedHuntEffects(state).petrificationFirstBonus).toBe(0);
  });
  it.each([1,2,3])('Constancia carga toda la expedición una vez por ciclo R%i',rank=>{
    const id='fusion_22';
    let state=syncRelicConstancy(create(id,rank),{cycleId:'week',outcomes:[],nowTimestamp:1});
    const args={cycleId:'week',outcomes:Array(6).fill('hit'),bossWon:true,nowTimestamp:2};
    state=activateRelicConstancy({state,...args});
    expect(state.xp).toBe(relicRankEffect('relic_04',rank));
    expect(equippedHuntEffects(state).petrificationHuntBonus).toBe(fusionDefinition(id).synergy.values[rank]);
    const un=unequipRelic(state,id,{confirmConstancyReset:true});
    expect(equippedHuntEffects(equipRelic(un,id)).petrificationHuntBonus).toBe(0);
    expect(equippedHuntEffects(activateRelicConstancy({state:consumeHuntCharges(state),...args})).petrificationHuntBonus).toBe(0);
  });
  it('rechaza salida inválida sin consumir y captura solo los efectos de salida',()=>{
    const state=chargeFirstHabitVampirism(create('fusion_20'),'day');
    expect(startHunt({hunt:{},difficultyId:'hard',level:1,relicEffects:equippedHuntEffects(state)}).ok).toBe(false);
    expect(equippedHuntEffects(state).petrificationFirstBonus).toBe(2);
    expect(fusionRecipeStatus('relic_01','relic_08').status).toBe('incompatible');
  });
  it('reemplazar la fusión borra la carga y no permite duplicar la familia del Ojo',()=>{
    let state=chargeFirstHabitVampirism(create('fusion_20'),'day');
    state.inventory.relics.relic_08={unlocked:true,rank:1,rarity:'rare',affixes:[]};
    expect(equipRelic(state,'relic_08').ok).toBe(false);
    const changed= equipRelic(state,'relic_08',0);
    expect(changed.ok).toBe(true);
    expect(changed.inventory.huntCharges.fusion_20).toBe(false);
    expect(equippedHuntEffects(equipRelic(changed,'fusion_20',0)).petrificationFirstBonus).toBe(0);
  });
  it('primer bono solo primera Mirada; Constancia contra los tres enemigos',()=>{
    const base=expedition({petrification:10}).report;
    // Synthetic bonus separates rounding buckets to isolate encounter scope.
    const first=expedition({petrification:10,petrificationFirstBonus:50}).report;
    const all=expedition({petrification:10,petrificationHuntBonus:50}).report;
    expect(first.encounters[0].roundDetails[0].damageTaken).toBeLessThan(base.encounters[0].roundDetails[0].damageTaken);
    for(let i=1;i<3;i++){
      expect(first.encounters[i].damageTaken).toBe(base.encounters[i].damageTaken);
      expect(all.encounters[i].damageTaken).toBeLessThan(base.encounters[i].damageTaken);
    }
  });
});

describe('Bonos de golpe de Mirada',()=>{
  it.each([1,2,3])('Aguijón otorga XP una vez por expedición y no al reclamar de nuevo R%i',rank=>{
    const result=expedition(equippedHuntEffects(create('fusion_21',rank)));
    expect(result.report.encounters.map(e=>e.petrificationXp)).toEqual([fusionDefinition('fusion_21').synergy.values[rank],0,0]);
    expect(resolveHunt({hunt:result.hunt,nowTimestamp:999999}).reason).toBe('no-active-hunt');
  });
  it.each([1,2,3])('Ampolla/Colmillo recuperan una vez por enemigo, no cada ronda R%i',rank=>{
    for(const [id,metric] of [['fusion_23','petrificationManaRecovered'],['fusion_24','petrificationHealthRecovered']]) {
      const effect=equippedHuntEffects(create(id,rank));
      expect(fight(effect)[metric]).toBe(rank);
      expect(fight(effect,{maxRounds:6})[metric]).toBe(rank);
      expect(fight(effect,{heroHp:1})[metric]).toBe(0);
      expect(fight(effect,{hero:{...hero,dodgeChance:1}})[metric]).toBe(0);
      expect(fight(effect,{enemy:{...enemy,maxHp:1}})[metric]).toBe(0);
    }
  });
  it.each([1,2,3])('Collar añade vampirismo a un único ataque real posterior R%i',rank=>{
    const effects=equippedHuntEffects(create('fusion_25',rank));
    const enhanced=fight(effects), base=fight({...effects,petrificationVampirism:0});
    expect(enhanced.petrificationVampirismUsed).toBe(rank);
    expect(enhanced.vampirismRecovered-base.vampirismRecovered).toBe(rank);
    expect(fight(effects,{maxRounds:1}).petrificationVampirismUsed).toBe(0);
    expect(fight(effects,{attackType:'magic'}).petrificationVampirismUsed).toBe(rank);
    expect(fight(effects,{hero:{...hero,dodgeChance:1}}).petrificationVampirismUsed).toBe(0);
  });
  it('Collar conserva token ante esquiva pero no lo transfiere al siguiente enemigo',()=>{
    const effects={petrification:27,petrificationVampirism:3};
    // hero hit, enemy hit; hero dodged, enemy hit; hero hit, enemy hit
    const values=[.99,.99,.99,.99,0,.99,.99,.99,.99,.99,.99];
    const result=fight(effects,{enemy:{...enemy,dodgeChance:.5},roll:()=>values.shift()??.99});
    expect(result.petrificationVampirismUsed).toBe(3);
    const next=fight({petrification:0,petrificationVampirism:3});
    expect(next.petrificationVampirismUsed).toBe(0);
  });
  it('no resucita, no excede máximos y bonos no funcionan sin Mirada',()=>{
    expect(fight({petrification:27,petrificationHealth:3},{heroHp:1}).heroHp).toBe(0);
    expect(fight({petrification:27,petrificationMana:3},{heroMana:99,maxRounds:1}).heroMana).toBe(100);
    expect(fight({petrificationMana:3,petrificationHealth:3,petrificationVampirism:3})).toMatchObject({petrificationManaRecovered:0,petrificationHealthRecovered:0,petrificationVampirismUsed:0});
  });
  it('recuperaciones limitadas por máximos y activaciones no aumentan al guardar/cargar',()=>{
    const state=normalizeLootState(JSON.parse(JSON.stringify(create('fusion_24',3))));
    const effects=equippedHuntEffects(state);
    expect(fight(effects,{heroHp:999,enemy:{...enemy,physicalAttack:1},maxRounds:1}).heroHp).toBe(1000);
    expect(fight(effects,{heroHp:0}).petrificationTriggered).toBe(false);
    const started=startHunt({hunt:{},difficultyId:'easy',level:20,seed:15,nowTimestamp:1000,relicEffects:effects});
    const args={classId:'knight',level:20,allocation:{constitution:60},nowTimestamp:61000};
    expect(resolveHunt({hunt:JSON.parse(JSON.stringify(started.hunt)),...args}).report).toEqual(resolveHunt({hunt:started.hunt,...args}).report);
  });
  it('Aguijón no premia sin reducir daño; un golpe reducido letal no duplica ni pierde su premio',()=>{
    expect(expedition({petrificationXp:5}).report.encounters.every(e=>e.petrificationXp===0)).toBe(true);
    const begun=startHunt({hunt:{},difficultyId:'easy',level:1,seed:5,nowTimestamp:1000,currentHp:1,maxHp:100,relicEffects:{petrification:10,petrificationXp:5}});
    const result=resolveHunt({hunt:begun.hunt,classId:'paladin',level:1,allocation:{},nowTimestamp:61000});
    expect(result.report.heroDied).toBe(true);
    expect(result.report.rewards.xp).toBe(5);
    expect(result.report.encounters.reduce((s,e)=>s+e.petrificationXp,0)).toBe(5);
  });
});
