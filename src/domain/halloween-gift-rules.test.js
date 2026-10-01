import { describe, expect, it } from 'vitest';
import { claimHalloweenGift, shouldOfferHalloweenGift } from './halloween-gift-rules.js';

const october = new Date(2026, 9, 10).getTime();
const state = () => ({ onboarded:true, game:{cls:'paladin'}, inventory:{halloweenCandy:{owned:{blood:2,energy:3,experience:4},prepared:{blood:true}}}, economy:{coins:50} });

describe('Halloween welcome gift', () => {
  it('grants exactly one of each candy, preserving existing progress', () => {
    const original = state();
    const result = claimHalloweenGift(original, october);
    expect(result.granted).toBe(true);
    expect(result.state.inventory.halloweenCandy.owned).toEqual({blood:3,energy:4,experience:5});
    expect(result.state.inventory.halloweenCandy.prepared.blood).toBe(true);
    expect(result.state.economy).toBe(original.economy);
    expect(original.inventory.halloweenCandy.owned.blood).toBe(2);
  });
  it('does not grant again after saving and reloading the same event', () => {
    const result = claimHalloweenGift(state(), october);
    const loaded = JSON.parse(JSON.stringify(result.state));
    expect(shouldOfferHalloweenGift(loaded, october)).toBe(false);
    expect(claimHalloweenGift(loaded, october).granted).toBe(false);
  });
  it('requires October and a character, except for the explicit local preview', () => {
    const september = new Date(2026, 8, 30).getTime();
    expect(claimHalloweenGift(state(), september).granted).toBe(false);
    expect(claimHalloweenGift(state(), september, true).granted).toBe(true);
    expect(shouldOfferHalloweenGift({onboarded:false}, october)).toBe(false);
  });
});
