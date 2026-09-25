import { expect, it } from 'vitest';
import { RELIC_DEFINITIONS } from '../data/loot-data.js';
import { CLASSES } from '../data/game-data.js';
import { renderCharacterSheet } from './character-sheet-view.js';

it('no muestra sangre en la ficha ni altera las pociones preparadas', () => {
  const state = { game: { cls:Object.keys(CLASSES)[0], bossCombat: { bossIndex: 0 } }, inventory: { potions: { bloodPrepared: { [RELIC_DEFINITIONS[0].rewardId]: 3 } } } };
  const root={innerHTML:''};
  renderCharacterSheet({document:{getElementById:()=>root},state,stats:{lvl:5,xp:560,nextTh:875,maxHp:100,maxMp:50,prog:0}});
  expect(root.innerHTML).toContain('character-hero-art');
  expect(root.innerHTML).not.toContain('hero-blood-badge');
  expect(root.innerHTML).not.toContain('potion_blood.webp');
  expect(state.inventory.potions.bloodPrepared[RELIC_DEFINITIONS[0].rewardId]).toBe(3);
});

it('muestra el nombre importado como texto y no como HTML ejecutable', () => {
  const marker = '<img src=x onerror="globalThis.auditXss=1">';
  const state = {
    game: { cls: Object.keys(CLASSES)[0], name: marker },
    inventory: {},
  };
  const root = { innerHTML: '' };
  renderCharacterSheet({
    document: { getElementById: () => root },
    state,
    stats: { lvl: 1, xp: 0, nextTh: 35, maxHp: 100, maxMp: 50, prog: 0 },
  });
  expect(root.innerHTML).not.toContain(marker);
  expect(root.innerHTML).toContain('&lt;img src=x onerror=&quot;globalThis.auditXss=1&quot;&gt;');
});
