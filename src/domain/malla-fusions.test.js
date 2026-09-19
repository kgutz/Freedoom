import { describe, expect, it } from 'vitest';
import { fusionDefinition, relicRankEffect, relicCombatBonuses } from '../data/loot-data.js';
import { emptyLootState, normalizeLootState, fuseRelics, defuseRelic, equipRelic, unequipRelic, equippedHuntEffects, equippedRelicBonuses, chargeFirstHabitVampirism, consumeHuntCharges, activateRelicConstancy, syncRelicConstancy, fusionRecipeStatus } from './loot-rules.js';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';

const ids = ['fusion_26','fusion_27','fusion_28','fusion_29','fusion_30','fusion_31'];
function create(id, rank=1) {
  const state = emptyLootState(); state.economy.coins=10000; state.economy.bossBlood=100;
  const recipe=fusionDefinition(id);
  recipe.ingredientIds.forEach((base,i)=>{state.inventory.relics[base]={unlocked:true,rank,rarity:'legendary',affixes:[i?'fortune':'vitality']};});
  const result=fuseRelics({state,leftId:recipe.ingredientIds[0],rightId:'relic_09',operationId:'make',randomValue:0,nowTimestamp:1});
  expect(result.ok).toBe(true);
  return equipRelic(result,id);
}
const hero={maxHp:1000,maxMana:100,physicalAttack:100,magicAttack:100,defense:0};
const enemy={maxHp:10000,physicalAttack:100,defense:0};
const fight=(effects,extra={})=>simulatePveCombat({hero,enemy,heroHp:500,heroMana:10,maxRounds:3,roll:()=>0.99,relicEffects:effects,...extra});
function expedition(effects={},extra={}) {
  const begun=startHunt({hunt:{},difficultyId:'easy',level:20,seed:15,nowTimestamp:1000,relicEffects:effects,...extra});
  expect(begun.ok).toBe(true);
  return resolveHunt({hunt:JSON.parse(JSON.stringify(begun.hunt)),classId:'knight',level:20,allocation:{constitution:60},nowTimestamp:1000000});
}

describe.each(ids)('%s herencia completa',id=>{
  it.each([1,2,3])('R%i: forja, descubrimiento, afijos, atributos, migración y desfusión',rank=>{
    const state=create(id,rank), recipe=fusionDefinition(id), relic=state.inventory.relics[id];
    expect(state.forge.fusion.discoveredRecipes).toContain(recipe.recipeId);
    expect(relic.affixes).toEqual(['vitality','fortune']);
    const summed={physicalAttack:0,magicAttack:0,defense:0};
    for(const base of recipe.ingredientIds){
      expect(relic.inheritedEffects[base]).toBe(relicRankEffect(base,rank));
      expect(relic.ingredientSnapshots[base].rank).toBe(rank);
      for(const stat of relicCombatBonuses(base,rank)) summed[stat.stat]+=stat.value;
    }
    expect(equippedRelicBonuses(state)).toMatchObject(summed);
    // Obsolete forge-refund value cannot become a 40% combat shield on load.
    relic.inheritedEffects.relic_09=40;
    relic.ingredientSnapshots.relic_09.effectValue=40;
    const loaded=normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(normalizeLootState(loaded)).toEqual(loaded);
    expect(equippedHuntEffects(loaded).damageReduction).toBe(relicRankEffect('relic_09',rank));
    const un=unequipRelic(loaded,id,{confirmConstancyReset:true});
    expect(Object.entries(equippedHuntEffects(un)).filter(([key])=>key.startsWith('armor') || key==='damageReduction').every(([,v])=>v===0)).toBe(true);
    const restored=defuseRelic({state:loaded,relicId:id,operationId:'undo',nowTimestamp:2});
    expect(restored.ok).toBe(true);
    for(const [i,base] of recipe.ingredientIds.entries()) expect(restored.inventory.relics[base]).toMatchObject({rank,rarity:'legendary',affixes:[i?'fortune':'vitality']});
    expect(equippedHuntEffects(restored).damageReduction).toBe(0);
  });
});

describe('Cargas y familias de Malla',()=>{
  it.each([1,2,3])('reserva de primer hábito R%i: evento, snapshot, consumo, no retroactividad',rank=>{
    let state=chargeFirstHabitVampirism(create('fusion_26',rank),'day');
    const value=rank+1;
    expect(equippedHuntEffects(normalizeLootState(JSON.parse(JSON.stringify(state)))).armorReserve).toBe(value);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state,'tomorrow')).armorReserve).toBe(value);
    expect(startHunt({hunt:{},difficultyId:'hard',level:1,relicEffects:equippedHuntEffects(state)}).ok).toBe(false);
    expect(equippedHuntEffects(state).armorReserve).toBe(value);
    const begun=startHunt({hunt:{},difficultyId:'easy',level:20,relicEffects:equippedHuntEffects(state)});
    expect(begun.ok).toBe(true);
    state=consumeHuntCharges(state);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state,'day')).armorReserve).toBe(0);
    expect(begun.hunt.active.relicEffects.armorReserve).toBe(value);
    state=chargeFirstHabitVampirism(state,'next');
    const un=unequipRelic(state,'fusion_26');
    expect(equippedHuntEffects(equipRelic(un,'fusion_26')).armorReserve).toBe(0);
  });
  it('el primer hábito sin equipar no carga después; refusión no duplica',()=>{
    let state=create('fusion_26');
    state=chargeFirstHabitVampirism(unequipRelic(state,'fusion_26'),'day');
    expect(equippedHuntEffects(chargeFirstHabitVampirism(equipRelic(state,'fusion_26'),'day')).armorReserve).toBe(0);
    state=chargeFirstHabitVampirism(equipRelic(state,'fusion_26'),'next');
    state=defuseRelic({state,relicId:'fusion_26',operationId:'undo'});
    state=fuseRelics({state,leftId:'relic_02',rightId:'relic_09',operationId:'remake',randomValue:0});
    expect(equippedHuntEffects(chargeFirstHabitVampirism(equipRelic(state,'fusion_26'),'next')).armorReserve).toBe(0);
  });
  it.each([1,2,3])('Constancia R%i: una carga por ciclo y se pierde al cambiar',rank=>{
    let state=syncRelicConstancy(create('fusion_28',rank),{cycleId:'week',outcomes:[],nowTimestamp:1});
    const args={cycleId:'week',outcomes:Array(6).fill('hit'),bossWon:true,nowTimestamp:2};
    state=activateRelicConstancy({state,...args});
    expect(state.xp).toBe(relicRankEffect('relic_04',rank));
    expect(equippedHuntEffects(state).armorHuntBonus).toBe(rank);
    expect(equippedHuntEffects(activateRelicConstancy({state:consumeHuntCharges(state),...args})).armorHuntBonus).toBe(0);
    expect(equippedHuntEffects(equipRelic(unequipRelic(state,'fusion_28',{confirmConstancyReset:true}),'fusion_28')).armorHuntBonus).toBe(0);
  });
  it('incompatibilidades defensivas y reemplazo sin conservar cargas',()=>{
    expect(fusionRecipeStatus('relic_01','relic_09').status).toBe('incompatible');
    expect(fusionRecipeStatus('relic_08','relic_09').status).toBe('incompatible');
    let state=chargeFirstHabitVampirism(create('fusion_26'),'day');
    state.inventory.relics.relic_09={unlocked:true,rank:1,rarity:'rare',affixes:[]};
    expect(equipRelic(state,'relic_09').ok).toBe(false);
    state=equipRelic(state,'relic_09',0);
    expect(state.ok).toBe(true);
    expect(state.inventory.huntCharges.fusion_26).toBe(false);
    expect(equippedHuntEffects(equipRelic(state,'fusion_26',0)).armorReserve).toBe(0);
  });
});

describe('Mitigación sostenida y límites',()=>{
  it('rango3 con Ojo: reducción multiplicativa y daño positivo en golpes posteriores',()=>{
    const result=fight({damageReduction:12,armorHuntBonus:3,petrification:27});
    expect(result.log.filter(e=>e.actor==='enemy').map(e=>e.damage)).toEqual([62,85,85]);
    expect(result.armorPrevented).toBe(41);
  });
  it('recursos y contadores se reinician por enemigo, sin activación retroactiva por equipo',()=>{
    const effects={damageReduction:12,armorManaCap:4,armorHealthCap:3,armorVampirism:3};
    const a=fight(effects,{maxRounds:4});
    const b=fight(effects,{maxRounds:1,relicCarry:a});
    expect(b.armorVampirismUsed).toBe(0);
    expect(b.armorManaRecovered).toBe(2);
    const started=startHunt({hunt:{},difficultyId:'easy',level:20,nowTimestamp:1000,relicEffects:{}});
    const saved=JSON.stringify(started.hunt);
    equipRelic(create('fusion_31'),'fusion_31');
    expect(JSON.stringify(started.hunt)).toBe(saved);
    expect(started.hunt.active.relicEffects.armorVampirism).toBe(0);
  });
  it.each([1,2,3])('reserva R%i: 1 por golpe, no reinicia por enemigo ni concede inmunidad',rank=>{
    const value=rank+1;
    const result=fight({damageReduction:12,armorReserve:value},{maxRounds:6,heroHp:1000});
    expect(result.armorReserveUsed).toBe(value);
    expect(result.armorReserveRemaining).toBe(0);
    expect(result.log.filter(e=>e.actor==='enemy').map(e=>e.damage)).toEqual(Array.from({length:6},(_,i)=>i<value?87:88));
    const report=expedition({damageReduction:12,armorReserve:value}).report;
    expect(report.encounters.reduce((n,e)=>n+e.armorReserveUsed,0)).toBe(value);
    const tiny=fight({damageReduction:100,armorReserve:value},{enemy:{...enemy,physicalAttack:1}});
    expect(tiny.armorReserveUsed).toBe(0);
    expect(tiny.damageTaken).toBe(3);
  });
  it.each([1,2,3])('Constancia R%i: reducción aditiva acotada aplicada en todos los golpes',rank=>{
    const effect=equippedHuntEffects(create('fusion_28',rank));
    const result=fight({...effect,armorHuntBonus:rank});
    expect(result.damageTaken).toBe(3*(100-relicRankEffect('relic_09',rank)-rank));
    expect(fight({armorHuntBonus:rank,armorReserve:4}).damageTaken).toBe(300);
  });
  it.each([1,2,3])('conversiones R%i: topes, acumulación, no vida/maná infinitos',rank=>{
    const mana=fight(equippedHuntEffects(create('fusion_29',rank)),{maxRounds:5,heroHp:1000});
    const hp=fight(equippedHuntEffects(create('fusion_30',rank)),{maxRounds:5,heroHp:1000});
    expect(mana.armorManaRecovered).toBe(rank+1);
    expect(hp.armorHealthRecovered).toBe(rank);
    const effects={damageReduction:12,armorManaCap:rank+1,armorHealthCap:rank};
    expect(fight(effects,{heroHp:1})).toMatchObject({armorManaRecovered:0,armorHealthRecovered:0,heroHp:0});
    expect(fight(effects,{hero:{...hero,dodgeChance:1}})).toMatchObject({armorManaRecovered:0,armorHealthRecovered:0});
    expect(fight(effects,{enemy:{...enemy,maxHp:1}})).toMatchObject({armorManaRecovered:0,armorHealthRecovered:0});
  });
  it('fracciones se acumulan, exceso no se guarda, no cuenta esquiva ni Mirada',()=>{
    const result=fight({damageReduction:5,armorManaCap:4,armorHealthCap:3},{enemy:{...enemy,physicalAttack:20},maxRounds:7});
    expect(result.armorPrevented).toBe(7);
    expect(result.armorManaRecovered).toBe(1);
    expect(result.armorHealthRecovered).toBe(1);
    expect(fight({petrification:90,armorManaCap:4,armorHealthCap:3}).armorManaRecovered).toBe(0);
    const full=fight({damageReduction:50,armorManaCap:4},{heroMana:100,maxRounds:3});
    // First hit generates 4, only 2 missing; discarded 2 cannot be recovered later.
    expect(full.armorManaRecovered).toBe(2);
  });
  it.each([1,2,3])('Collar R%i: empieza tras umbral y permanece, sin cargar el siguiente enemigo',rank=>{
    const effects=equippedHuntEffects(create('fusion_31',rank));
    const result=fight(effects),base=fight({...effects,armorVampirism:0});
    expect(result.armorVampirismUsed).toBe(rank*2);
    expect(result.vampirismRecovered-base.vampirismRecovered).toBe(rank*2);
    expect(fight(effects,{attackType:'magic'}).armorVampirismUsed).toBe(rank*2);
    expect(fight(effects,{maxRounds:1,relicCarry:result}).armorVampirismUsed).toBe(0);
    expect(fight(effects,{hero:{...hero,dodgeChance:1}}).armorVampirismUsed).toBe(0);
  });
  it('Collar no activa antes de 5 ni cuenta ataques esquivados o exceso de daño',()=>{
    const effects={damageReduction:5,vampirism:3,armorVampirism:3};
    expect(fight(effects,{enemy:{...enemy,physicalAttack:20},maxRounds:5}).armorVampirismUsed).toBe(0);
    expect(fight(effects,{enemy:{...enemy,physicalAttack:20},maxRounds:6}).armorVampirismUsed).toBe(3);
    expect(fight(effects,{enemy:{...enemy,dodgeChance:1},maxRounds:3}).armorVampirismUsed).toBe(0);
    const capped=fight(effects,{enemy:{...enemy,maxHp:150}});
    expect(capped.vampirismRecovered).toBe(6); // 3 from 100 + 3 from actual final 50, not 100.
  });
  it.each([1,2,3])('XP R%i solo victoria con umbral, tres topes y sin doble cobro',rank=>{
    const result=expedition({damageReduction:12,armorXp:rank});
    expect(result.report.encounters.map(e=>e.armorXp)).toEqual([0,0,rank]);
    const base=expedition({damageReduction:12});
    expect(result.report.rewards.xp-base.report.rewards.xp).toBe(rank);
    // Synthetic mitigation makes two enemies meet threshold independently.
    const two=expedition({damageReduction:50,armorXp:rank}).report;
    expect(two.encounters.map(e=>e.armorXp)).toEqual([0,rank,rank]);
    expect(two.encounters.reduce((n,e)=>n+e.armorXp,0)).toBeLessThanOrEqual(rank*3);
    expect(resolveHunt({hunt:result.hunt,nowTimestamp:999999}).reason).toBe('no-active-hunt');
    expect(expedition({armorXp:rank}).report.encounters.every(e=>e.armorXp===0)).toBe(true);
    const dead=expedition({damageReduction:12,armorXp:rank},{currentHp:0.1,maxHp:100,difficultyId:'hard'}).report;
    expect(dead.won).toBe(false);
    expect(dead.encounters.some(e=>!e.won)).toBe(true);
    expect(dead.encounters.filter(e=>!e.won).every(e=>e.armorXp===0)).toBe(true);
  });
  it('snapshots antiguos sin nuevos campos son deterministas y no generan bonos',()=>{
    const begun=startHunt({hunt:{},level:20,difficultyId:'easy',seed:10,nowTimestamp:1000});
    delete begun.hunt.active.relicEffects;
    const args={hunt:begun.hunt,level:20,classId:'knight',allocation:{constitution:60},nowTimestamp:61000};
    const a=resolveHunt(args),b=resolveHunt({...args,hunt:JSON.parse(JSON.stringify(args.hunt))});
    expect(a).toEqual(b);
    expect(a.report.encounters.every(e=>e.armorPrevented===0 && e.armorXp===0)).toBe(true);
  });
});
