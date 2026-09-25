import {describe,it,expect,vi} from 'vitest';
import {ENCHANTMENTS,enchantmentStoneDropChance,rollEnchantmentStone,rollEnchantment,inheritFusionEnchantment,splitFusionEnchantment} from './enchantment-rules.js';

describe('Piedras de encantamiento — reglas acordadas',()=>{
  it('limita Paso firme a 5% sin cambiar su probabilidad ni los otros efectos',()=>{
    expect(ENCHANTMENTS.find(effect=>effect.id==='first-hit')).toMatchObject({weight:5,damageReductionPercent:5,limit:'once-per-encounter'});
    expect(ENCHANTMENTS.find(effect=>effect.id==='elite-hunter').damageBonusPercent).toBe(3);
    expect(ENCHANTMENTS.find(effect=>effect.id==='finisher').damageBonusPercent).toBe(10);
  });
  it('asigna 80% a estadísticas y 20% a efectos especiales',()=>{
    expect(ENCHANTMENTS).toHaveLength(9);
    expect(ENCHANTMENTS.reduce((sum,e)=>sum+e.weight,0)).toBe(100);
    const counts={};
    for(let i=0;i<100;i++) {const {id}=rollEnchantment(()=>(i+0.5)/100);counts[id]=(counts[id]||0)+1;}
    for(const effect of ENCHANTMENTS) expect(counts[effect.id]).toBe(effect.weight);
  });
  it('excluye Bruma, dificultades inferiores, enemigos normales y derrotas',()=>{
    const base={source:'hunt-miniboss',regionIndex:1,difficultyId:'hard',won:true};
    expect(enchantmentStoneDropChance(base)).toBe(.15);
    expect(enchantmentStoneDropChance({...base,regionIndex:2})).toBe(.15);
    for(const change of [{regionIndex:0},{difficultyId:'easy'},{difficultyId:'medium'},{won:false},{source:'hunt-enemy'}]) {
      const random=vi.fn(()=>0);
      expect(rollEnchantmentStone({...base,...change},random)).toBe(0);
      expect(random).not.toHaveBeenCalled();
    }
    expect(rollEnchantmentStone(base,()=>.14999)).toBe(1);
    expect(rollEnchantmentStone(base,()=>.15)).toBe(0);
  });
  it('otorga solo una piedra con 30% en victorias de campaña',()=>{
    const context={source:'campaign-boss',won:true};
    expect(rollEnchantmentStone(context,()=>.29999)).toBe(1);
    expect(rollEnchantmentStone(context,()=>.30)).toBe(0);
    expect(rollEnchantmentStone({...context,won:false},()=>0)).toBe(0);
  });
  it('exige elegir al fusionar y no duplica al separar',()=>{
    const left={id:'attack'},right={id:'mana'};
    expect(inheritFusionEnchantment(left,right)).toMatchObject({ok:false});
    expect(inheritFusionEnchantment(left,right,'right')).toEqual({ok:true,enchantment:right});
    // A fused relic can receive a new effect; only its current effect is transferred.
    expect(splitFusionEnchantment({id:'finisher'},'left')).toEqual({ok:true,left:{id:'finisher'},right:null});
    expect(splitFusionEnchantment(left)).toMatchObject({ok:false});
    expect(left).toEqual({id:'attack'});expect(right).toEqual({id:'mana'});
  });
});
