import { describe,it,expect } from 'vitest';
import { buyHalloweenMask,halloweenMaskPrice,halloweenMaskActive } from './halloween-mask-rules.js';
import { emptyLootState,normalizeLootState,equipRelic,unequipRelic,equippedRelicBonuses,equippedHuntEffects,forgePreview,sellRelicToShop,getForgeFusionPreview } from './loot-rules.js';
import { rollHalloweenHuntCandy } from './halloween-candy-rules.js';
describe('Máscara del Diezmo Carmesí',()=>{
  const now=Date.now();
  const purchase=()=>buyHalloweenMask({state:{...emptyLootState(),economy:{...emptyLootState().economy,coins:1000,bossBlood:3}},level:22,active:true,operationId:'test',nowTimestamp:now});
  it('costs level-adjusted gold plus 1 boss blood; rank 3 and no timer before equipping',()=>{
    expect(halloweenMaskPrice(22)).toBe(160);
    const bought=purchase();
    expect(bought.economy.coins).toBe(840);
    expect(bought.economy.bossBlood).toBe(2);
    expect(buyHalloweenMask({state:{...emptyLootState(),economy:{...emptyLootState().economy,coins:1000,bossBlood:0}},level:22,active:true,operationId:'no-blood'}).reason).toBe('blood');
    expect(bought.inventory.relics['halloween-mask']).toMatchObject({rank:3,expiresAt:0});
    expect(buyHalloweenMask({state:bought,active:true,operationId:'second'}).reason).toBe('owned');
    expect(buyHalloweenMask({state:bought,active:true,operationId:'test'}).duplicate).toBe(true);
  });
  it('starts 24 real hours once and preserves timer on reload and unequip',()=>{
    const equipped=equipRelic(purchase(),'halloween-mask',null,{nowTimestamp:now});
    expect(equipped.ok).toBe(true);
    expect(equipped.inventory.relics['halloween-mask'].expiresAt).toBe(now+86400000);
    expect(equippedRelicBonuses(equipped)).toMatchObject({physicalAttack:5,magicAttack:5,defense:4});
    expect(equippedHuntEffects(equipped)).toMatchObject({vampirism:10,maskBloodChance:20});
    const restored=normalizeLootState(JSON.parse(JSON.stringify(unequipRelic(equipped,'halloween-mask'))));
    const again=equipRelic(restored,'halloween-mask',null,{nowTimestamp:now+1000});
    expect(again.inventory.relics['halloween-mask'].expiresAt).toBe(now+86400000);
    expect(equipRelic(restored,'halloween-mask',null,{nowTimestamp:now+86400000}).reason).toBe('expired');
  });
  it('cannot upgrade, fuse or resell; allows repurchase only after expiry',()=>{
    const equipped=equipRelic(purchase(),'halloween-mask',null,{nowTimestamp:now});
    expect(forgePreview(equipped,'halloween-mask').ok).toBe(false);
    expect(sellRelicToShop({state:equipped,relicId:'halloween-mask',operationId:'sale'}).ok).toBe(false);
    expect(getForgeFusionPreview(equipped,'halloween-mask','relic_01').ok).toBe(false);
    const expired=normalizeLootState(equipped); expired.inventory.relics['halloween-mask'].expiresAt=now-1;
    expect(halloweenMaskActive(expired.inventory.relics['halloween-mask'],now)).toBe(false);
    expect(equippedRelicBonuses(expired).physicalAttack).toBe(0);
    const bought=buyHalloweenMask({state:expired,active:true,operationId:'renew',nowTimestamp:now,level:22});
    expect(bought.ok).toBe(true);
    expect(bought.inventory.equipped).not.toContain('halloween-mask');
    expect(bought.inventory.collection['halloween-mask']).toBeTruthy();
  });
  it('grants at most +1 extra blood per difficult miniboss victory (candy first, then mask)',()=>{
    const report={id:'mask-hunt',difficultyId:'hard',maskBloodChance:20,halloweenCandy:{blood:true},encounters:[{won:true},{won:true},{won:true}],rewards:{xp:22}};
    const rolled=rollHalloweenHuntCandy({candy:null,report,active:true,random:()=>0});
    expect(rolled).toMatchObject({bloodBonus:1,maskBloodBonus:0});
    const maskOnly={...report,id:'mask-only',halloweenCandy:{}};
    expect(rollHalloweenHuntCandy({candy:null,report:maskOnly,active:true,random:()=>0})).toMatchObject({bloodBonus:0,maskBloodBonus:1});
    expect(rollHalloweenHuntCandy({candy:rolled.candy,report,active:true,random:()=>0})).toMatchObject({bloodBonus:0,maskBloodBonus:0});
    expect(rollHalloweenHuntCandy({candy:null,report:{...report,difficultyId:'easy'},active:true,random:()=>0}).maskBloodBonus).toBe(0);
  });
});
