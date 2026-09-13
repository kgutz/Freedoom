import { expect, it } from 'vitest';
import { RELIC_DEFINITIONS } from '../data/loot-data.js';
import { characterBloodBadgeMarkup } from './character-sheet-view.js';

it('muestra el icono de sangre con solo la cantidad preparada para el jefe actual', () => {
  const state = { game: { bossCombat: { bossIndex: 0 } }, inventory: { potions: { bloodPrepared: { [RELIC_DEFINITIONS[0].rewardId]: 3 } } } };
  const html = characterBloodBadgeMarkup(state);
  expect(html).toContain('potion_blood.webp');
  expect(html).toContain('<b>3</b>');
  expect(html).not.toContain('3/3');
  state.game.bossCombat.bossIndex = 1;
  expect(characterBloodBadgeMarkup(state)).toBe('');
});
