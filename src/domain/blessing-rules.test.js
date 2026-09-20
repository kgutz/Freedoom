import {describe,it,expect} from 'vitest';
import {blessingPrice,purchaseBlessing,blessedDeathPenalty,blessedDailyEnergy} from './blessing-rules.js';
import {normalizeHuntState} from './pve-combat-rules.js';
import {serializeState,parseState,mergeState,createBrowserStore} from '../storage/state-storage.js';

const buy=(overrides={})=>purchaseBlessing({game:{},economy:{coins:1000},id:'experience',level:19,dayKey:'2026-09-20',operationId:'one',now:100,...overrides});
describe('blessings',()=>{
  it.each(['energy','experience'])('grants the temple background once with the first %s purchase',id=>{
    const first=buy({id,game:{frame:'original',frames:{owned:{'beta-tester':{acquiredAt:1}}}}});
    expect(first.giftGranted).toBe(true);
    expect(first.game.frames.owned['azariel-temple']).toMatchObject({source:'first-blessing'});
    expect(first.game.frames.owned['beta-tester']).toBeTruthy();
    expect(first.game.frame).toBe('original');
    const loaded=parseState(serializeState({game:first.game})).game;
    expect(loaded.templeGift).toEqual({grantedAt:100,seenAt:null});
    const second=buy({id:id==='energy'?'experience':'energy',game:loaded,operationId:'two'});
    expect(second.giftGranted).toBe(false);
    expect(second.game.templeGift.grantedAt).toBe(100);
  });
  it('does not grant a gift on failed payment or duplicate an already owned background',()=>{
    expect(buy({economy:{coins:0}}).giftGranted).toBeUndefined();
    const owned={frames:{owned:{'azariel-temple':{acquiredAt:1}}}};
    expect(buy({game:owned}).giftGranted).toBe(false);
  });
  it('persists purchase and consumption across storage restarts',async()=>{
    const values=new Map();
    const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
    const bought=buy({game:{cls:'knight'}});
    const saved={onboarded:true,game:bought.game,economy:bought.economy,days:{}};
    const store=createBrowserStore({localStorage});
    store.set('blessing-test',serializeState(saved));
    const loaded=parseState((await createBrowserStore({localStorage}).get('blessing-test')).value);
    expect(loaded.game.blessings.experience.active).toBe(true);
    expect(loaded.economy.coins).toBe(830);
    loaded.game.blessings=blessedDeathPenalty({xp:12000,level:19,source:'hunt',blessings:loaded.game.blessings}).blessings;
    store.set('blessing-test',serializeState(loaded));
    expect(parseState((await createBrowserStore({localStorage}).get('blessing-test')).value).game.blessings.experience.active).toBe(false);
  });
  it('retains the paid protection and gold through the real save/load format',()=>{
    const bought=buy();
    const loaded=mergeState({config:{},game:{},inventory:{},economy:{}},parseState(serializeState({game:bought.game,economy:bought.economy})));
    expect(loaded.game.blessings.experience.active).toBe(true);
    expect(loaded.economy.coins).toBe(830);
  });
  it('keeps the agreed prices and +5 forever',()=>{
    expect([blessingPrice('experience',5),blessingPrice('energy',5)]).toEqual([100,125]);
    expect([blessingPrice('experience',19),blessingPrice('energy',19)]).toEqual([170,195]);
    expect(blessingPrice('energy',36)-blessingPrice('energy',35)).toBe(5);
    expect(blessingPrice('energy',1)).toBe(125);
  });
  it('charges exactly once and preserves unrelated game and economy fields',()=>{
    const result=buy({game:{hp:40},economy:{coins:1000,bossBlood:4}});
    expect(result.game.hp).toBe(40);
    expect(result.game.blessings.experience.active).toBe(true);
    expect(result.economy.coins).toBe(830);
    expect(result.economy.bossBlood).toBe(4);
    expect(buy({game:result.game,economy:result.economy}).reason).toBe('active');
  });
  it('rejects insufficient gold, unknown types, changed price and protected levels',()=>{
    expect(buy({economy:{coins:169}}).reason).toBe('coins');
    expect(buy({id:'other'}).reason).toBe('unknown');
    expect(buy({expectedPrice:100}).reason).toBe('price');
    expect(buy({level:4}).reason).toBe('level');
  });
  it('blocks replay even after consumption',()=>{
    const result=buy();
    expect(buy({economy:result.economy,game:{}}).reason).toBe('duplicate');
  });
  it('fully protects one hunt death and only one',()=>{
    const result=buy();
    const death=blessedDeathPenalty({xp:12000,level:19,source:'hunt',blessings:result.game.blessings});
    expect(death.penalty).toMatchObject({xpLost:0,xpAfter:12000,blessingProtected:true});
    expect(death.blessings.experience.active).toBe(false);
    expect(blessedDeathPenalty({xp:12000,level:19,source:'hunt',blessings:death.blessings}).penalty.xpLost).toBeGreaterThan(0);
  });
  it.each(['hunt','alcohol','boss-counterattack','unknown',undefined])('protects every death cause: %s',source=>{
    const blessings=buy().game.blessings;
    const result=blessedDeathPenalty({xp:12000,level:19,source,blessings});
    expect(result.penalty).toMatchObject({xpLost:0,xpAfter:12000,blessingProtected:true});
    expect(result.blessings.experience.active).toBe(false);
    expect(blessedDeathPenalty({xp:12000,level:19,source,blessings:result.blessings}).penalty.xpLost).toBeGreaterThan(0);
  });
  it('does not consume XP protection at already protected levels',()=>{
    const blessings=buy().game.blessings;
    expect(blessedDeathPenalty({xp:400,level:4,source:'hunt',blessings}).blessings).toBe(blessings);
  });
  it('allows both protections independently and repurchase after consumption',()=>{
    const first=buy();
    const both=buy({game:first.game,economy:first.economy,id:'energy',operationId:'two'});
    expect(both.game.blessings.energy.active).toBe(true);
    expect(both.game.blessings.experience.active).toBe(true);
    const death=blessedDeathPenalty({xp:12000,level:19,source:'hunt',blessings:both.game.blessings});
    expect(buy({game:{blessings:death.blessings},economy:both.economy,operationId:'three'}).ok).toBe(true);
  });
  const energy=()=>buy({id:'energy'}).game.blessings;
  const refill=(overrides={})=>blessedDailyEnergy({blessings:energy(),dayKey:'2026-09-21',previousEnergyDay:'2026-09-20',failed:true,...overrides});
  it('protects the next failed-day refill and remembers it across reloads',()=>{
    const result=refill();
    expect(result.baseEnergy).toBe(10);
    expect(result.consumed).toBe(true);
    expect(result.blessings.energy.active).toBe(false);
    const loaded=JSON.parse(JSON.stringify(result.blessings));
    expect(refill({blessings:loaded,previousEnergyDay:'2026-09-21'})).toMatchObject({baseEnergy:10,consumed:false});
    expect(refill({blessings:loaded,dayKey:'2026-09-22'}).baseEnergy).toBe(2);
  });
  it('does not expire on successful days',()=>{
    expect(refill({failed:false,dayKey:'2026-10-20'})).toMatchObject({baseEnergy:10,consumed:false,blessings:{energy:{active:true}}});
  });
  it('cannot restore spent energy or protect retroactively on purchase day',()=>{
    expect(refill({dayKey:'2026-09-20'})).toMatchObject({baseEnergy:2,consumed:false});
    expect(refill({previousEnergyDay:'2026-09-21'})).toMatchObject({baseEnergy:2,consumed:false});
  });
  it('refills to 10 once and does not refill again on repeated normalization',()=>{
    const now=new Date(2026,8,21,12).getTime();
    const protectedRefill=refill();
    const hunt=normalizeHuntState({energyDay:'2026-09-20',energy:0},now,protectedRefill.baseEnergy);
    expect(hunt.energy).toBe(10);
    expect(normalizeHuntState({...hunt,energy:3},now,10).energy).toBe(3);
  });
});
