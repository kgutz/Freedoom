import { describe, expect, it } from 'vitest';
import { applyFeedbackReward, isFeedbackRewardApplied } from './feedback-reward-rules.js';

const event = { eventId: 'feedback-report-0001', reward: { coins: 100, bloodPotions: 3, vigorPotions: 3 } };

describe('feedback rewards', () => {
  it('entrega el pack exacto y registra una marca idempotente', () => {
    const initial = { game: {}, economy: { coins: 10 }, inventory: { potions: { owned: { blood: 1, energy: 2 } } } };
    const result = applyFeedbackReward(initial, event, 1234);
    expect(result.granted).toBe(true);
    expect(result.state.economy.coins).toBe(110);
    expect(result.state.inventory.potions.owned.blood).toBe(4);
    expect(result.state.inventory.potions.owned.energy).toBe(5);
    expect(isFeedbackRewardApplied(result.state, event.eventId)).toBe(true);
  });

  it('no duplica una recompensa ya aplicada', () => {
    const once = applyFeedbackReward({ game: {}, economy: {}, inventory: {} }, event, 1234).state;
    const twice = applyFeedbackReward(once, event, 5678);
    expect(twice.granted).toBe(false);
    expect(twice.state.economy.coins).toBe(100);
    expect(twice.state.inventory.potions.owned.blood).toBe(3);
    expect(twice.state.inventory.potions.owned.energy).toBe(3);
  });
});
