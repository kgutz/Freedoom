import {describe,it,expect} from 'vitest';
import {simulatePveCombat,scaledEnemy,HUNT_REGIONS,huntDifficultyForRegion} from './pve-combat-rules.js';
const hero={maxHp:200,maxMana:100,physicalAttack:1,defense:0};
const enemy={maxHp:1000,physicalAttack:20,defense:0,huntRendPercent:30};
const fight=(extra={})=>simulatePveCombat({hero,enemy,heroHp:100,heroMana:100,maxRounds:1,roll:()=>.99,...extra});
describe('Desgarro determinista de Cacería Difícil',()=>{
 it('caps a guarded hit before actual damage, logging and Vampirismo',()=>{
  const r=fight({hero:{...hero,physicalAttack:1000},enemy:{...enemy,huntGuardPercent:49},relicEffects:{vampirism:8}});
  expect(r.guardDamagePrevented).toBe(510);
  expect(r.vampirismRecovered).toBe(39);
  expect(r.log.find(e=>e.actor==='hero').damage).toBe(490);
 });
 it('does not raise small hits or dodged hits through Tenacidad',()=>{
  expect(fight({enemy:{...enemy,huntGuardPercent:49}}).guardDamagePrevented).toBe(0);
  const r=fight({hero:{...hero,physicalAttack:1000},enemy:{...enemy,huntGuardPercent:49,dodgeChance:1}});
  expect(r.guardDamagePrevented).toBe(0);
  expect(r.vampirismRecovered).toBe(0);
 });
 it('enables Tenacidad only for the configured Hard Bunker miniboss',()=>{
  for(const region of Object.values(HUNT_REGIONS))for(const id of ['easy','medium','hard'])for(const e of region.enemies){
   const current=scaledEnemy(e,huntDifficultyForRegion(region.id,id));
   expect(current.huntGuardPercent).toBe(id==='hard'&&e.id==='dead-hours-puppeteer'?49:0);
  }
 });
 it('prevents two-hit boss bursts without extending an ordinary four-hit fight',()=>{
  const guarded={maxHp:100,physicalAttack:1,defense:0,huntGuardPercent:49};
  const strong=simulatePveCombat({hero:{...hero,physicalAttack:1000,criticalChance:1},enemy:guarded,heroHp:200,heroMana:100,roll:()=>.99});
  const ordinary=simulatePveCombat({hero:{...hero,physicalAttack:30},enemy:guarded,heroHp:200,heroMana:100,roll:()=>.99});
  expect(strong.won).toBe(true);expect(strong.rounds).toBe(3);
  expect(ordinary.won).toBe(true);expect(ordinary.rounds).toBe(4);
 });
 it('uses current HP, not max HP, and joins the ordinary hit',()=>{
  expect(fight().damageTaken).toBe(50);
  expect(fight({heroHp:50}).damageTaken).toBe(35);
  expect(fight().rendDamageBeforeMitigation).toBe(30);
 });
 it('uses existing criticals, with no additional random roll',()=>{
  let rolls=0;
  const r=fight({enemy:{...enemy,criticalChance:1},roll:()=>{rolls++;return .99;}});
  expect(r.damageTaken).toBe(80);expect(rolls).toBe(4);
 });
 it('allows dodge and applies Ojo and Malla to the whole hit',()=>{
  expect(fight({hero:{...hero,dodgeChance:1}}).damageTaken).toBe(0);
  expect(fight({relicEffects:{petrification:27,damageReduction:12}}).damageTaken).toBe(31);
 });
 it('does not retaliate after death or revive the hero',()=>{
  expect(fight({hero:{...hero,physicalAttack:10000}}).damageTaken).toBe(0);
  const r=fight({heroHp:1});expect(r.heroHp).toBe(0);expect(r.won).toBe(false);
 });
 it('leaves generic combat unchanged when the enemy has no pressure',()=>{
  expect(fight({enemy:{...enemy,huntRendPercent:0}}).damageTaken).toBe(20);
  expect(fight({enemy:{...enemy,huntRendPercent:0}}).rendDamageBeforeMitigation).toBe(0);
 });
 it('can never enable pressure in Easy or Medium through the tuning table',()=>{
  for(const region of Object.values(HUNT_REGIONS))for(const id of ['easy','medium']) {
   const difficulty=huntDifficultyForRegion(region.id,id);
   for(const e of region.enemies)expect(scaledEnemy(e,{...difficulty,enemyStatMultipliers:{...difficulty.enemyStatMultipliers,rendPercent:100}}).huntRendPercent).toBe(0);
  }
 });
 it('keeps Vampirismo based on actual damage and heals before the reply',()=>{
  const r=fight({hero:{...hero,physicalAttack:100},relicEffects:{vampirism:8}});
  expect(r.vampirismRecovered).toBe(8);
  expect(r.rendDamageBeforeMitigation).toBe(32);
  expect(r.heroHp).toBe(56);
 });
});
