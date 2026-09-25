import {it,expect} from 'vitest';
import {emptyLootState,equipRelic,normalizeLootState} from './loot-rules.js';
function fixture(first='relic_02',second='relic_03'){
  const state=emptyLootState();
  for(const id of [first,second]) state.inventory.relics[id]={unlocked:true,rank:1,rarity:'rare',affixes:[],enchantment:{id:'first-hit'}};
  state.inventory.equipped=[first];
  return state;
}
it('blocks identical enchantments without altering the equipped items or inventory',()=>{
  const state=fixture();const before=JSON.stringify(state);
  const result=equipRelic(state,'relic_03');
  expect(result).toMatchObject({ok:false,reason:'enchantment-equipped-conflict'});
  expect(result.inventory.equipped).toEqual(['relic_02']);
  expect(JSON.stringify(state)).toBe(before);
  expect(normalizeLootState(state).inventory.relics.relic_03.enchantment).toEqual({id:'first-hit'});
});
it('allows replacing the conflicting slot and allows different enchantments',()=>{
  expect(equipRelic(fixture(),'relic_03',0).ok).toBe(true);
  const state=fixture();state.inventory.relics.relic_03.enchantment={id:'finisher'};
  expect(equipRelic(state,'relic_03').ok).toBe(true);
});
it('also blocks duplicate enchantments on fused relics',()=>{
  expect(equipRelic(fixture('relic_03','fusion_20'),'fusion_20')).toMatchObject({ok:false,reason:'enchantment-equipped-conflict'});
});
