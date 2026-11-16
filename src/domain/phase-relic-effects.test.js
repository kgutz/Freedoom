import { FUSION_RELIC_DEFINITIONS } from '../data/loot-data.js';
import { emptyLootState, fuseRelics, equipRelic, equippedHuntEffects } from './loot-rules.js';
import { describe, it, expect } from 'vitest';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';
const hero={maxHp:100,maxMana:20,physicalAttack:20,magicAttack:20,defense:0,criticalChance:0,dodgeChance:0};
const enemy={maxHp:1000,physicalAttack:10,defense:0,dodgeChance:0,criticalChance:0,attackType:'physical'};
const fight=(effects,overrides={})=>simulatePveCombat({hero,enemy,heroHp:100,heroMana:20,attackType:'magic',roll:()=>0.9,maxRounds:6,relicEffects:effects,...overrides});
describe('phase 14-18 combat effects',()=>{
 it('discounts only the first paid magical cast, with minimum cost one',()=>{
  for(const clarityManaDiscount of [1,2,3]) expect(fight({clarityManaDiscount}).clarityManaSaved).toBe(1);
  expect(fight({clarityManaDiscount:3},{attackType:'physical'}).clarityManaSaved).toBe(0);
  expect(fight({clarityManaDiscount:3},{heroMana:0}).clarityManaSaved).toBe(0);
  expect(fight({clarityManaDiscount:3},{heroMana:1}).clarityManaSaved).toBe(0);
 });
 it('consumes the discount even if the cast misses',()=>{
  let i=0;const roll=()=>[0,0.9,0.9,0.9][i++]??0.9;
  expect(fight({clarityManaDiscount:3},{enemy:{...enemy,dodgeChance:0.1},roll,maxRounds:2}).clarityManaSaved).toBe(1);
 });
 it('arms guard on crossing and reduces only the next connected hit once',()=>{
  const result=fight({emergencyGuardPercent:20},{heroHp:60,maxRounds:4});
  expect(result.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([10,8,10,10]);
  expect(result.emergencyGuardPrevented).toBe(2);
  expect(fight({emergencyGuardPercent:20},{heroHp:50,maxRounds:2}).emergencyGuardPrevented).toBe(0);
  expect(fight({emergencyGuardPercent:20},{heroHp:60,enemy:{...enemy,physicalAttack:100}}).heroHp).toBe(0);
 });
 it('does not spend armed guard on an enemy dodge and keeps damage at least one',()=>{
  let i=0;const sequence=[0.9,0.9,0.9,0.9, 0.9,0.9,0, 0.9,0.9,0.9,0.9];
  const result=fight({emergencyGuardPercent:20},{hero:{...hero,dodgeChance:0.1},heroHp:60,maxRounds:3,roll:()=>sequence[i++]??0.9});
  expect(result.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([10,0,8]);
  const tiny=fight({emergencyGuardPercent:20},{heroHp:51,enemy:{...enemy,physicalAttack:1},maxRounds:2});
  expect(tiny.log.filter(x=>x.actor==='enemy').map(x=>x.damage)).toEqual([1,1]);
 });
 it('does not count missed attacks toward the third strike',()=>{
  let i=0;const result=fight({thirdStrikePercent:20},{enemy:{...enemy,dodgeChance:0.1},maxRounds:3,roll:()=>i++===0?0:0.9});
  expect(result.thirdStrikeDamageDealt).toBe(0);
 });
 it('adds damage only on the third direct damaging hit, without counting echo',()=>{
  expect(fight({thirdStrikePercent:20},{maxRounds:2}).thirdStrikeDamageDealt).toBe(0);
  expect(fight({thirdStrikePercent:20,echoPercent:20},{maxRounds:6}).thirdStrikeDamageDealt).toBe(4);
  expect(fight({thirdStrikePercent:10},{attackType:'physical'}).thirdStrikeDamageDealt).toBe(2);
 });
 it('persists all effects in the hunt snapshot and replays deterministically',()=>{
  const relicEffects={clarityManaDiscount:3,emergencyGuardPercent:20,thirdStrikePercent:20};
  const begun=startHunt({hunt:{},regionId:'fields-of-mist',difficultyId:'easy',level:30,nowTimestamp:1000,seed:5,currentHp:100,maxHp:100,currentMana:100,maxMana:100,relicEffects});
  expect(begun.ok).toBe(true);
  expect(begun.hunt.active.relicEffects).toMatchObject(relicEffects);
  const args={hunt:JSON.parse(JSON.stringify(begun.hunt)),classId:'sorcerer',level:30,nowTimestamp:1000+6*3600*1000};
  expect(resolveHunt(args).report).toEqual(resolveHunt(args).report);
 });
});

it.each([['relic_16','clarityManaDiscount',2],['relic_17','emergencyGuardPercent',15],['relic_18','thirdStrikePercent',15]])('%s inherits its saved effect through fusion and equip', (id,key,value)=>{
 const definition=FUSION_RELIC_DEFINITIONS.find(x=>x.ingredientIds.includes(id));
 const state=emptyLootState();state.economy.coins=1000;state.economy.bossBlood=10;
 for(const base of definition.ingredientIds)state.inventory.relics[base]={unlocked:true,rank:2,rarity:'rare',affixes:[]};
 const fused=fuseRelics({state,leftId:definition.ingredientIds[0],rightId:definition.ingredientIds[1],operationId:'phase-'+id,randomValue:0,nowTimestamp:1});
 expect(fused.ok).toBe(true);
 const saved=JSON.parse(JSON.stringify(fused));
 const equipped=equipRelic(saved,definition.id);
 expect(equipped.ok).toBe(true);
 expect(equippedHuntEffects(equipped)[key]).toBe(value);
});
