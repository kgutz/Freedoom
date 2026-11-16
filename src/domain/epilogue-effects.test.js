import {FUSION_RELIC_DEFINITIONS,relicRankEffect} from '../data/loot-data.js';
import {emptyLootState,equipRelic,unequipRelic,fuseRelics,equippedHuntEffects} from './loot-rules.js';
import {it,expect} from 'vitest';
import {simulatePveCombat,startHunt} from './pve-combat-rules.js';
const hero={maxHp:100,maxMana:20,physicalAttack:20,magicAttack:20,defense:0,criticalChance:0,dodgeChance:0};
const enemy={maxHp:1000,physicalAttack:10,defense:0,dodgeChance:0,criticalChance:0};
const fight=(relicEffects,extra={})=>simulatePveCombat({hero,enemy,heroHp:70,heroMana:10,attackType:'physical',maxRounds:4,roll:()=>0.9,relicEffects,...extra});
it('19 restores both resources once on a direct damaging critical, capped',()=>{
 const r=fight({criticalResourceRecovery:3},{hero:{...hero,criticalChance:1}});
 expect([r.criticalHealthRecovered,r.criticalManaRecovered]).toEqual([3,3]);
 expect(fight({criticalResourceRecovery:3}).criticalHealthRecovered).toBe(0);
 expect(fight({criticalResourceRecovery:3},{hero:{...hero,criticalChance:1},heroHp:100,maxRounds:1}).criticalHealthRecovered).toBe(0);
});
it('20 consumes next-attempt bonus after first miss;22 grants opening bonus only',()=>{
 let i=0;const seq=[0,0.9,0.9, 0.9,0.04,0.9,0.9, 0.9,0.04,0.9,0.9];
 const r=fight({missCriticalBonus:5},{enemy:{...enemy,dodgeChance:0.1},maxRounds:3,roll:()=>seq[i++]??0.9});
 expect(r.log.filter(x=>x.actor==='hero').map(x=>x.critical)).toEqual([false,true,false]);
 expect(fight({openingCriticalBonus:5},{maxRounds:2,roll:()=>0.04}).log.filter(x=>x.actor==='hero').map(x=>x.critical)).toEqual([true,false]);
});
it('21 reduces only excess pre-relic damage on first qualifying hit',()=>{
 const r=fight({excessGuardPercent:20},{heroHp:100,enemy:{...enemy,physicalAttack:50},maxRounds:2});
 expect(r.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([45,50]);
 expect(r.excessGuardPrevented).toBe(5);
 expect(fight({excessGuardPercent:20},{enemy:{...enemy,physicalAttack:25},maxRounds:1}).excessGuardPrevented).toBe(0);
});
it('23 restores mana only on second direct physical damaging hit',()=>{
 expect(fight({secondPhysicalMana:3}).secondPhysicalManaRecovered).toBe(3);
 expect(fight({secondPhysicalMana:3},{attackType:'magic'}).secondPhysicalManaRecovered).toBe(0);
 expect(fight({secondPhysicalMana:3},{maxRounds:1}).secondPhysicalManaRecovered).toBe(0);
});
it('24 arms on paid magic, applies only once and preserves minimum one',()=>{
 expect(fight({spellWardFlat:3},{attackType:'magic'}).spellWardPrevented).toBe(3);
 expect(fight({spellWardFlat:3}).spellWardPrevented).toBe(0);
 expect(fight({spellWardFlat:3},{attackType:'magic',heroMana:0}).spellWardPrevented).toBe(0);
 expect(fight({spellWardFlat:3},{attackType:'magic',enemy:{...enemy,physicalAttack:1}}).spellWardPrevented).toBe(0);
});
it('25 heals only living low-health victory, floors percent, never revives',()=>{
 expect(fight({lowVictoryHealthPercent:4},{heroHp:35,enemy:{...enemy,maxHp:10}}).lowVictoryHealthRecovered).toBe(4);
 expect(fight({lowVictoryHealthPercent:4},{heroHp:36,enemy:{...enemy,maxHp:10}}).lowVictoryHealthRecovered).toBe(0);
 expect(fight({lowVictoryHealthPercent:4},{heroHp:0,enemy:{...enemy,maxHp:10}}).heroHp).toBe(0);
 expect(fight({lowVictoryHealthPercent:4}).lowVictoryHealthRecovered).toBe(0);
});
it('snapshots all epilogue values',()=>{
 const relicEffects={criticalResourceRecovery:3,missCriticalBonus:7,excessGuardPercent:20,openingCriticalBonus:7,secondPhysicalMana:3,spellWardFlat:3,lowVictoryHealthPercent:4};
 const r=startHunt({hunt:{},regionId:'fields-of-mist',difficultyId:'easy',level:30,nowTimestamp:1000,seed:5,relicEffects});
 expect(r.ok).toBe(true);expect(JSON.parse(JSON.stringify(r.hunt.active.relicEffects))).toMatchObject(relicEffects);
});

it('21 qualifies before other relics mitigate and never repeats',()=>{
 const r=fight({excessGuardPercent:20,damageReduction:50},{heroHp:100,enemy:{...enemy,physicalAttack:50},maxRounds:2});
 expect(r.excessGuardPrevented).toBe(5);
 expect(r.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([22,25]);
});
it('19 caps recovery and never triggers on an automatic echo or dead entry',()=>{
 const r=fight({criticalResourceRecovery:3},{hero:{...hero,criticalChance:1},heroHp:99,heroMana:20,maxRounds:1});
 expect([r.criticalHealthRecovered,r.criticalManaRecovered]).toEqual([1,2]);
 expect(fight({criticalResourceRecovery:3,echoPercent:20},{attackType:'magic'}).criticalHealthRecovered).toBe(0);
 expect(fight({criticalResourceRecovery:3},{heroHp:0,hero:{...hero,criticalChance:1}}).heroHp).toBe(0);
});
it('24 consumes paid cast on miss, retains ward through dodge, then consumes once',()=>{
 let i=0;const seq=[0,0, 0.9,0.9,0.9,0.9];
 const r=fight({spellWardFlat:3},{hero:{...hero,dodgeChance:0.1},enemy:{...enemy,dodgeChance:0.1},attackType:'magic',maxRounds:3,roll:()=>seq[i++]??0.9});
 expect(r.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([0,7,10]);
});
it('25 restores floor minimum one, caps, and leaves mana untouched',()=>{
 const r=fight({lowVictoryHealthPercent:2},{hero:{...hero,maxHp:10},heroHp:3,heroMana:5,enemy:{...enemy,maxHp:1}});
 expect(r.heroHp).toBe(4);expect(r.lowVictoryHealthRecovered).toBe(1);expect(r.heroMana).toBe(3);
});

it.each(['criticalResourceRecovery','missCriticalBonus','excessGuardPercent','openingCriticalBonus','secondPhysicalMana','spellWardFlat','lowVictoryHealthPercent'].map((key,i)=>['relic_'+(19+i),key]))('%s inherited effect survives save and disappears when unequipped',(id,key)=>{
 const def=FUSION_RELIC_DEFINITIONS.find(r=>r.ingredientIds.includes(id));
 const state=emptyLootState();state.economy.coins=1000;state.economy.bossBlood=10;
 for(const base of def.ingredientIds)state.inventory.relics[base]={unlocked:true,rank:2,rarity:'rare',affixes:[]};
 const result=fuseRelics({state,leftId:def.ingredientIds[0],rightId:def.ingredientIds[1],operationId:id,randomValue:0,nowTimestamp:1});
 expect(result.ok).toBe(true);
 const equipped=equipRelic(JSON.parse(JSON.stringify(result)),def.id);expect(equipped.ok).toBe(true);
 expect(equippedHuntEffects(equipped)[key]).toBe(relicRankEffect(id,2));
 expect(equippedHuntEffects(unequipRelic(equipped,def.id))[key]).toBe(0);
});

it('20 never arms from a later miss when the opening attack succeeded',()=>{
 let i=0;const sequence=[0.9,0.9,0.9,0.9, 0,0.9,0.9, 0.9,0.04,0.9,0.9];
 const r=fight({missCriticalBonus:7},{enemy:{...enemy,dodgeChance:0.1},maxRounds:3,roll:()=>sequence[i++]??0.9});
 expect(r.log.filter(x=>x.actor==='hero').map(x=>[x.dodged,x.critical])).toEqual([[false,false],[true,false],[false,false]]);
});
