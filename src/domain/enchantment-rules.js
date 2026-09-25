// Initial tuning agreed for the local prototype; not enabled in live rewards yet.
export const ENCHANTMENTS = Object.freeze([
  {id:'attack',weight:16,physicalAttack:1},
  {id:'power',weight:16,magicAttack:1},
  {id:'defense',weight:16,defense:1},
  {id:'health',weight:16,maxHpPercent:3},
  {id:'mana',weight:16,maxManaPercent:3},
  {id:'first-hit',weight:5,damageReductionPercent:5,limit:'once-per-encounter'},
  {id:'mana-reserve',weight:5,recoveryPercent:5,limit:'once-per-hunt'},
  {id:'elite-hunter',weight:5,damageBonusPercent:3,target:'miniboss'},
  {id:'finisher',weight:5,damageBonusPercent:10,enemyHpThresholdPercent:20,limit:'once-per-enemy'},
].map(Object.freeze));

export function enchantmentStoneDropChance({source,regionIndex,difficultyId,won=false}) {
  if(!won) return 0;
  if(source==='campaign-boss') return 0.30;
  if(source==='hunt-miniboss' && Number.isInteger(regionIndex) && regionIndex>=1 && difficultyId==='hard') return 0.15;
  return 0;
}

function checkedRoll(random) {
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1) throw new RangeError('La tirada debe estar entre 0 y 1, sin incluir 1');
  return value;
}

export function rollEnchantmentStone(context,random=Math.random) {
  const chance=enchantmentStoneDropChance(context);
  return chance>0 && checkedRoll(random)<chance ? 1 : 0;
}

export function rollEnchantment(random=Math.random) {
  const roll=checkedRoll(random)*100;
  let cumulative=0;
  for(const effect of ENCHANTMENTS) {
    cumulative+=effect.weight;
    if(roll<cumulative) return {id:effect.id};
  }
  throw new Error('Distribución de encantamientos incompleta');
}

export function normalizeEnchantment(value) {
  return ENCHANTMENTS.some(effect=>effect.id===value?.id) ? {id:value.id} : null;
}

// Pure transfer helpers: callers must commit these with a successful fusion only.
export function inheritFusionEnchantment(left,right,choice) {
  const options=[normalizeEnchantment(left),normalizeEnchantment(right)];
  if(!options[0]&&!options[1]) return {ok:true,enchantment:null};
  if(!options[0]||!options[1]) return {ok:true,enchantment:options[0]||options[1]};
  if(choice!=='left'&&choice!=='right') return {ok:false,reason:'choose-enchantment'};
  return {ok:true,enchantment:options[choice==='left'?0:1]};
}

export function splitFusionEnchantment(enchantment,recipient) {
  const current=normalizeEnchantment(enchantment);
  if(!current) return {ok:true,left:null,right:null};
  if(recipient!=='left'&&recipient!=='right') return {ok:false,reason:'choose-recipient'};
  return {ok:true,left:recipient==='left'?current:null,right:recipient==='right'?current:null};
}
