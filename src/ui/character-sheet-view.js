import { CLASSES } from '../data/game-data.js';
import { RARITIES, relicDefinition } from '../data/loot-data.js';
import { equippedOutfit } from '../data/outfit-data.js';
import { ATTRIBUTE_IDS, attributeSheet } from '../domain/attribute-rules.js';
import { pveHeroStats } from '../domain/pve-combat-rules.js';
import { heroIntoxicationBadgeMarkup, heroVisualMarkup } from './hero-view.js';
import { relicArt } from './inventory-view.js';

const ATTRIBUTE_COPY = {
  strength: ['Fuerza', 'Daño físico'],
  defense: ['Defensa', 'Reducción de daño'],
  dexterity: ['Destreza', 'Crítico y esquiva'],
  power: ['Poder', 'Magia y maná'],
  constitution: ['Constitución', 'Vida máxima'],
};

function equippedRelicMarkup(state, relicId, index) {
  const definition = relicId ? relicDefinition(relicId) : null;
  const item = relicId ? state.inventory?.relics?.[relicId] : null;
  if (!definition) return `<button type="button" class="character-relic-slot empty" data-character-relic-slot="${index}" aria-label="Elegir reliquia ${index + 1}"><span aria-hidden="true">+</span></button>`;
  const rarity = RARITIES[item?.rarity] || RARITIES.rare;
  const fusionClass = definition.recipeId ? ' fusion-relic' : '';
  return `<button type="button" class="character-relic-slot rarity-${rarity.id}${fusionClass}" data-character-relic-slot="${index}" aria-label="Cambiar ${definition.name}, reliquia ${index + 1}">
    ${relicArt(definition)}
  </button>`;
}

export function renderCharacterSheet({ document, state, stats, heroModel }) {
  const root = document.getElementById('characterSheetBody');
  if (!root || !state.game?.cls || !stats) return;
  const game = state.game;
  const classData = CLASSES[game.cls];
  const outfit = equippedOutfit(game.outfit, game);
  const sheet = attributeSheet({ classId: game.cls, level: stats.lvl, allocation: game.attributes });
  const combat = pveHeroStats({ classId: game.cls, level: stats.lvl, allocation: game.attributes });
  const equipped = Array.isArray(state.inventory?.equipped) ? state.inventory.equipped.slice(0, 2) : [];
  const xpStart = 35 * (stats.lvl - 1) * (stats.lvl - 1);
  const xpInLevel = Math.max(0, stats.xp - xpStart);
  const xpNeeded = Math.max(1, stats.nextTh - xpStart);
  const xpPercent = Math.max(0, Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)));
  const attributes = ATTRIBUTE_IDS.map((id) => {
    const [name, effect] = ATTRIBUTE_COPY[id];
    return `<div class="character-attribute"><div><span>${name}</span><small>${effect}</small></div><b>${sheet.attributes[id]}</b><button type="button" data-character-attribute="${id}" ${sheet.availablePoints ? '' : 'disabled'} aria-label="Subir ${name}">+</button></div>`;
  }).join('');
  root.innerHTML = `<section class="character-identity">
      <div><span>${classData.name}</span><h2>${game.name || classData.name}</h2></div>
      <div class="character-identity-actions">
        <strong>NIVEL ${stats.lvl}</strong>
        <button class="character-skills-shortcut" type="button" data-character-skills aria-label="Abrir libro de habilidades" title="Abrir libro de habilidades">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h5.25A2.75 2.75 0 0 1 12 7.25V20a3.5 3.5 0 0 0-3.5-3.5H4V4.5Zm16 0h-5.25A2.75 2.75 0 0 0 12 7.25V20a3.5 3.5 0 0 1 3.5-3.5H20V4.5Z"/></svg>
        </button>
      </div>
    </section>
    <section class="character-xp">
      <div><span>EXPERIENCIA</span><b>${stats.xp} / ${stats.nextTh} XP</b></div>
      <div class="character-xp-track"><i style="width:${xpPercent}%"></i></div>
      <small>${xpPercent}% del nivel actual</small>
    </section>
    <section class="character-stage">
      <div class="character-equipment">
        <button type="button" class="character-bag-primary" data-character-bag aria-label="Abrir bolso"><span class="character-bag-art" aria-hidden="true"><img src="ui/backpack.webp" alt="" loading="lazy" decoding="async"></span></button>
        ${equippedRelicMarkup(state, equipped[0], 0)}
        ${equippedRelicMarkup(state, equipped[1], 1)}
      </div>
      <div class="character-hero-art${heroModel?.intoxication?.level > 0 ? ' hero-card--intoxicated' : ''}">
        ${heroVisualMarkup({classId:game.cls,mood:heroModel?.mood||'happy',outfitId:outfit.id,frameId:game.frame,game,progress:stats.prog,level:stats.lvl,intoxication:heroModel?.intoxication,interactive:false})}
        ${heroIntoxicationBadgeMarkup(heroModel?.intoxication)}
        <button type="button" class="character-outfit-trigger" data-character-outfit aria-label="Cambiar outfit. Actual: ${outfit.name}"></button>
      </div>
    </section>
    <section class="character-vitals"><div><span>VIDA</span><b>${Math.round(game.hp || stats.maxHp)} / ${stats.maxHp}</b><i><em style="width:${Math.min(100,Math.round(((game.hp || stats.maxHp)/stats.maxHp)*100))}%"></em></i></div><div><span>MANÁ</span><b>${Math.round(game.mp || stats.maxMp)} / ${stats.maxMp}</b><i><em style="width:${Math.min(100,Math.round(((game.mp || stats.maxMp)/stats.maxMp)*100))}%"></em></i></div></section>
    <section class="character-attributes-panel"><header><span>ATRIBUTOS</span><b><span class="resource-icon resource-icon--attribute-points" aria-hidden="true"></span>${sheet.availablePoints} PUNTOS DISPONIBLES</b></header>${attributes}</section>
    <section class="character-derived"><span>ESTADÍSTICAS DE COMBATE</span><div><b>⚔ ${combat.physicalAttack}</b><b>✦ ${combat.magicAttack}</b><b>🛡 ${combat.defense}</b><b>◎ ${(combat.criticalChance*100).toFixed(1)}%</b></div><button type="button" class="character-reset-attributes" data-character-reset-attributes ${sheet.spentPoints ? '' : 'disabled'}>RESETEAR ATRIBUTOS</button></section>`;
}
