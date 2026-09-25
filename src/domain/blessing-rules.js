import { deathExperiencePenalty } from './death-rules.js';

export const BLESSINGS = Object.freeze({
  experience: {name:'Protección de experiencia',basePrice:100,description:'Evita toda la pérdida de experiencia de tu próxima muerte, sea cual sea la causa, dentro o fuera de Cacería.'},
  energy: {name:'Protección de energía',basePrice:125,description:'Tras un día fallado, conserva la recarga habitual de 10 de energía al comenzar el siguiente día, en lugar de 2. No restaura energía al comprarla.'},
});
export function blessingPrice(id, level) {
  return Object.hasOwn(BLESSINGS,id) ? BLESSINGS[id].basePrice + 5 * Math.max(0, Math.trunc(Number(level)||1)-5) : null;
}
export function purchaseBlessing({game={},economy={},id,level,dayKey,operationId,expectedPrice,now=Date.now()}) {
  const price=blessingPrice(id,level);
  if(price===null) return {ok:false,reason:'unknown'};
  if(game.blessings?.[id]?.active) return {ok:false,reason:'active'};
  if(id==='experience' && level<5) return {ok:false,reason:'level'};
  if(expectedPrice!==undefined && expectedPrice!==price) return {ok:false,reason:'price'};
  const transactions=Array.isArray(economy.transactions)?economy.transactions:[];
  if(!operationId || transactions.some(t=>t.id===`blessing:${operationId}`)) return {ok:false,reason:'duplicate'};
  const coins=Math.max(0,Math.trunc(Number(economy.coins)||0));
  if(coins<price) return {ok:false,reason:'coins'};
  const giftGranted=!game.templeGift?.grantedAt && !game.frames?.owned?.['azariel-temple'];
  const gift=giftGranted?{
    templeGift:{grantedAt:Math.max(1,now),seenAt:null},
    frames:{...game.frames,owned:{...game.frames?.owned,'azariel-temple':{acquiredAt:Math.max(1,now),source:'first-blessing'}}},
  }:{};
  return {ok:true,giftGranted,game:{...game,...gift,blessings:{...game.blessings,[id]:{active:true,purchasedAt:now,purchasedDay:dayKey,price}}},
    economy:{...economy,coins:coins-price,transactions:[...transactions,{id:`blessing:${operationId}`,type:'blessing_purchase',blessing:id,coins:-price,at:now}].slice(-200)}};
}
export function blessedDeathPenalty({xp,level,source,blessings={},now=Date.now()}) {
  const penalty=deathExperiencePenalty({xp,level});
  if(!blessings.experience?.active||penalty.xpLost===0) return {penalty,blessings};
  return {penalty:{...penalty,xpAfter:penalty.xpBefore,xpLost:0,levelAfter:level,protected:true,blessingProtected:true},
    blessings:{...blessings,experience:{...blessings.experience,active:false,consumedAt:now}}};
}
export function blessedDailyEnergy({blessings={},dayKey,previousEnergyDay,failed,now=Date.now()}) {
  if(blessings.energy?.protectedDay===dayKey) return {baseEnergy:10,blessings,consumed:false};
  const eligible=failed && previousEnergyDay!==dayKey && blessings.energy?.active
    && blessings.energy.purchasedDay && blessings.energy.purchasedDay<dayKey;
  if(!eligible) return {baseEnergy:failed?2:10,blessings,consumed:false};
  return {baseEnergy:10,consumed:true,blessings:{...blessings,energy:{...blessings.energy,active:false,consumedAt:now,protectedDay:dayKey}}};
}
