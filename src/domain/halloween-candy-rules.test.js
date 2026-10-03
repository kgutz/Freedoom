import { describe, expect, it } from 'vitest';
import {
  buyHalloweenCandy, normalizeHalloweenCandy, prepareHalloweenCandy,
  HALLOWEEN_CANDY_BY_ID, HALLOWEEN_BLOOD_DROP_RATE,
  rollHalloweenHuntCandy, rollHalloweenWeeklyCandy, takePreparedHalloweenCandy,
} from './halloween-candy-rules.js';

describe('chuches de Halloween', () => {
  it.each([[.199,1,0],[.20,1,0],[.279,1,0],[.28,0,0],[.49,0,0]])('aplica 28%% a la chuche (máx. +1 extra, la máscara no tira si acierta) con tirada %s', (value,bloodBonus,maskBloodBonus) => {
    for (const maskBloodChance of [20,50]) {
      const report={id:`balance-${maskBloodChance}`,difficultyId:'hard',maskBloodChance,halloweenCandy:{blood:true},encounters:[{won:true},{won:true},{won:true}],rewards:{xp:22}};
      expect(rollHalloweenHuntCandy({report,active:false,random:()=>value})).toMatchObject({bloodBonus,maskBloodBonus});
    }
  });
  it.each([[.199,1],[.249,1],[.25,0],[.49,0]])('aplica 25%% a la máscara sin chuche preparada con tirada %s', (value,maskBloodBonus) => {
    const report={id:'mask-only-roll',difficultyId:'hard',maskBloodChance:20,halloweenCandy:{},encounters:[{won:true},{won:true},{won:true}],rewards:{xp:22}};
    expect(rollHalloweenHuntCandy({report,active:false,random:()=>value})).toMatchObject({bloodBonus:0,maskBloodBonus});
  });
  it('conserva precio y caída de la chuche y actualiza su descripción', () => {
    expect(HALLOWEEN_BLOOD_DROP_RATE).toBe(.25);
    expect(HALLOWEEN_CANDY_BY_ID.blood.price).toBe(100);
    expect(HALLOWEEN_CANDY_BY_ID.blood.shortEffect).toContain('28%');
    const report={id:'drop-unchanged',difficultyId:'hard',encounters:[{won:true},{won:true},{won:true}],rewards:{xp:22}};
    expect(rollHalloweenHuntCandy({report,active:true,random:()=>.20}).drops.blood).toBe(1);
  });
  it('compra sin afectar a las pociones y descuenta el precio', () => {
    const bought = buyHalloweenCandy({ candy: null, coins: 200, id: 'blood', quantity: 2 });
    expect(bought.ok).toBe(true);
    expect(bought.cost).toBe(200);
    expect(bought.candy.owned.blood).toBe(2);
    expect(buyHalloweenCandy({ candy: null, coins: 199, id: 'blood', quantity: 2 }).ok).toBe(false);
  });

  it('prepara una sola chuche de sangre y la reserva para difícil', () => {
    const prepared = prepareHalloweenCandy({ owned: { blood: 2 } }, 'blood');
    expect(prepared.candy.owned.blood).toBe(1);
    expect(prepareHalloweenCandy(prepared.candy, 'blood').ok).toBe(false);
    expect(takePreparedHalloweenCandy(prepared.candy, 'easy').used.blood).toBe(false);
    const taken = takePreparedHalloweenCandy(prepared.candy, 'hard');
    expect(taken.used.blood).toBe(true);
    expect(taken.candy.prepared.blood).toBe(false);
  });

  it('hace tiradas independientes por enemigo, sangre aparte, y evita duplicados', () => {
    const report = {
      id: 'hunt-1', difficultyId: 'hard', halloweenCandy: { blood: true, experience: true },
      encounters: [{ won: true }, { won: true }, { won: true }], rewards: { xp: 22 },
    };
    const rolled = rollHalloweenHuntCandy({ candy: null, report, active: true, random: () => 0 });
    expect(rolled.drops).toEqual({ blood: 1, energy: 3, experience: 3 });
    expect(rolled.bloodBonus).toBe(1);
    expect(rolled.xpBonus).toBe(11);
    const repeated = rollHalloweenHuntCandy({ candy: rolled.candy, report, active: true, random: () => 0 });
    expect(repeated.drops).toEqual({ blood: 0, energy: 0, experience: 0 });
    expect(repeated.candy.owned).toEqual(rolled.candy.owned);
  });

  it('devuelve la sangre preparada si no se vence al minijefe', () => {
    const report = {
      id: 'hunt-2', difficultyId: 'hard', halloweenCandy: { blood: true, experience: true },
      encounters: [{ won: true }, { won: false }], rewards: { xp: 0 },
    };
    const rolled = rollHalloweenHuntCandy({ candy: null, report, active: true, random: () => 1 });
    expect(rolled.candy.owned.blood).toBe(1);
    expect(rolled.candy.owned.experience).toBe(1);
  });

  it('el jefe semanal tira dos veces por tipo y solo la segunda si sale la primera', () => {
    const awarded = rollHalloweenWeeklyCandy({ candy: null, rewardId: 'boss-1', active: true, random: () => 0 });
    expect(awarded.drops).toEqual({ blood: 2, energy: 2, experience: 2 });
    const repeated = rollHalloweenWeeklyCandy({ candy: awarded.candy, rewardId: 'boss-1', active: true, random: () => 0 });
    expect(repeated.drops).toEqual({ blood: 0, energy: 0, experience: 0 });
    expect(normalizeHalloweenCandy(repeated.candy).owned).toEqual(awarded.candy.owned);
    expect(rollHalloweenWeeklyCandy({ candy: null, rewardId: 'boss-2', active: true, random: () => 1 }).drops)
      .toEqual({ blood: 0, energy: 0, experience: 0 });
  });
});
