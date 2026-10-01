import { describe, expect, it } from 'vitest';
import {
  buyHalloweenCandy, normalizeHalloweenCandy, prepareHalloweenCandy,
  rollHalloweenHuntCandy, rollHalloweenWeeklyCandy, takePreparedHalloweenCandy,
} from './halloween-candy-rules.js';

describe('chuches de Halloween', () => {
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
