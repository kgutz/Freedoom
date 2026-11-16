import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { RELIC_DEFINITIONS, FUSION_RELIC_DEFINITIONS, MAX_INITIAL_RELICS, BOSS_REWARDS, relicCombatBonuses, relicRankEffect } from '../data/loot-data.js';
import { emptyLootState, fuseRelics, defuseRelic, fusionRecipeStatus, grantBossRewards, normalizeLootState } from './loot-rules.js';
const priorCatalog=FUSION_RELIC_DEFINITIONS.filter(r=>Number(r.id.split('_')[1])<=125);
const phase=priorCatalog.filter(r=>Number(r.id.split('_')[1])>=63);
const pairs={14:[1,2,3,4,5,6,7,8,9,10,11,12],15:[2,3,4,5,6,7,10,11,12,13,14],16:[1,3,4,6,7,8,9,10,11,12,13,14,15],17:[2,3,4,5,6,7,10,11,12,13,14,16],18:[1,2,3,4,5,6,7,8,9,10,11,12,15,16,17]};
const id=n=>`relic_${String(n).padStart(2,'0')}`;
describe('Approved phase 14–18 catalog',()=>{
 it('adds only three missing bases and exactly 63 unique recipes',()=>{
  expect(MAX_INITIAL_RELICS).toBe(25);expect(RELIC_DEFINITIONS.slice(0,18)).toHaveLength(18);expect(phase).toHaveLength(63);expect(priorCatalog).toHaveLength(124);
  expect(new Set(priorCatalog.map(r=>r.id)).size).toBe(124);
  expect(new Set(priorCatalog.map(r=>[...r.ingredientIds].sort().join('+'))).size).toBe(124);
  for(const [b,as] of Object.entries(pairs))for(const a of as){const recipe=fusionRecipeStatus(id(a),id(b));expect(recipe.status).toBe('available');expect(phase).toContain(recipe.definition);expect(recipe.definition.synergy).toBeUndefined();}
 });
 it('excludes matching primary families without changing historical recipes',()=>{
  for(const pair of [[13,14],[1,15],[8,15],[9,15],[2,16],[5,16],[1,17],[8,17],[9,17],[15,17],[13,18],[14,18]])expect(fusionRecipeStatus(...pair.map(id)).status).toBe('incompatible');
  expect(fusionRecipeStatus(id(12),id(13)).definition.id).toBe('fusion_62');
 });
 it('has production art for every phase definition',()=>{for(const r of [...RELIC_DEFINITIONS.slice(15,18),...phase])expect(existsSync(`public/${r.image}`),r.image).toBe(true);});
 it('extends rewards only through boss18 and remains idempotent',()=>{
  expect(BOSS_REWARDS.slice(15,18)).toEqual([{coins:295,bossBlood:3},{coins:310,bossBlood:3},{coins:325,bossBlood:3}]);
  const first=grantBossRewards({state:emptyLootState(),bossesDown:18,source:'retroactive',seed:'phase',nowTimestamp:1});
  const again=grantBossRewards({state:first,bossesDown:18,source:'retroactive',seed:'phase',nowTimestamp:2});
  expect(again.economy.coins).toBe(first.economy.coins);expect(Object.keys(again.inventory.relics).some(x=>x==='relic_19')).toBe(false);
 });
 it.each(phase.map(r=>[r.id,r]))('%s inherits exact effects/stats and survives save serialization',(_,r)=>{
  for(const rank of [1,2,3]){
   const state=emptyLootState();state.economy.coins=1000;state.economy.bossBlood=10;
   for(const x of r.ingredientIds)state.inventory.relics[x]={unlocked:true,rank,rarity:'rare',affixes:[]};
   const result=fuseRelics({state,leftId:r.ingredientIds[0],rightId:r.ingredientIds[1],randomValue:0,operationId:r.id+rank,nowTimestamp:1});expect(result.ok).toBe(true);
   const saved=normalizeLootState(JSON.parse(JSON.stringify(result)));const fusion=saved.inventory.relics[r.id];
   expect(fusion.inheritedEffects).toEqual(Object.fromEntries(r.ingredientIds.map(x=>[x,relicRankEffect(x,rank)])));
   const sums={};for(const x of r.ingredientIds)for(const b of relicCombatBonuses(x,rank))sums[b.stat]=(sums[b.stat]||0)+b.value;
   expect(Object.fromEntries(relicCombatBonuses(r.id,rank,fusion.ingredientSnapshots).map(b=>[b.stat,b.value]))).toEqual(sums);
   const restored=defuseRelic({state:saved,relicId:r.id,operationId:'undo-'+r.id+rank,nowTimestamp:2});expect(restored.ok).toBe(true);for(const x of r.ingredientIds)expect(restored.inventory.relics[x]).toMatchObject({rank,rarity:'rare',affixes:[]});
  }
 });
});
