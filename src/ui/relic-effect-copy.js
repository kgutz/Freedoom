import { relicRankEffect } from '../data/loot-data.js';

// One presentation source for detail, collection detail and forge previews.
// Inherited values come from the saved fusion, never from its current rank.
const names = {
  relic_01: 'Protección', relic_02: 'Maná del hábito', relic_03: 'Experiencia del hábito',
  relic_04: 'Constancia', relic_05: 'Maná de victoria', relic_06: 'Vida de victoria',
  relic_07: 'Vampirismo', relic_08: 'Mirada petrificante', relic_09: 'Escamas protectoras',
  relic_10: 'Sangre adicional', relic_11: 'Tres hábitos', relic_12: 'Hábitos completos',
};

function baseDescription(id, value) {
  return {
    relic_01: `Reduce ${value} de daño de la primera fuente del día.`,
    relic_02: `Recupera ${value}% del Maná máximo con el primer hábito con XP del día.`,
    relic_03: `Gana ${value} XP con el primer hábito con XP del día.`,
    relic_04: `Gana ${value} XP con 6 días consecutivos cumplidos y el jefe derrotado. Una vez por ciclo; el progreso se pierde al desequipar.`,
    relic_05: `Recupera ${value}% del Maná máximo por enemigo derrotado en Cacería.`,
    relic_06: `Recupera ${value}% de la Vida máxima por enemigo derrotado en Cacería.`,
    relic_07: `Recupera Vida igual al ${value}% del daño real de tus ataques en Cacería.`,
    relic_08: `Reduce un ${value}% el siguiente golpe que te alcance tras tu primer ataque a cada enemigo de Cacería.`,
    relic_09: `Reduce un ${value}% el daño recibido en Cacería. No reduce a cero un golpe con daño.`,
    relic_10: `Suma ${value} p. p. a la probabilidad de +1 Sangre de Jefe al vencer al jefe semanal.`,
    relic_11: `Gana ${value} XP al completar 3 hábitos distintos en el día. Una vez al día.`,
    relic_12: `Gana ${value} de oro al completar todos los hábitos programados para el día. Una vez al día.`,
  }[id];
}

const singleCharge = 'Solo guardas 1 carga y la gastas al entrar.';
const equippedCharge = 'Solo guardas 1 carga: la gastas al entrar o la pierdes al desequipar.';

function fusionBonus(definition, rank, inherited) {
  const value = definition.synergy?.values?.[rank] ?? definition.synergy?.value;
  const mana = definition.synergy?.manaValues?.[rank];
  const health = definition.synergy?.healthValues?.[rank];
  const increase = (id, extra) => `del ${inherited[id]}% al ${inherited[id] + extra}%`;
  return {
    fusion_01: `Con el primer hábito que te dé XP del día, recuperas un ${value}% extra del Maná máximo.`,
    fusion_02: `Al completar Constancia, ganas ${value} XP extra. Solo una vez por ciclo.`,
    fusion_04: `Al completar todos los hábitos del día, ganas ${value} XP. Solo una vez al día.`,
    fusion_05: `Al completar Constancia, recuperas ${health}% de la Vida máxima. Solo una vez por ciclo.`,
    fusion_06: `Con el primer hábito que te dé XP del día, ganas ${value} XP si aún no has usado Protección.`,
    fusion_07: `Con el primer hábito que te dé XP del día, ganas ${value} XP extra.`,
    fusion_08: `Al completar todos los hábitos del día, ganas ${value} XP. Solo una vez al día.`,
    fusion_09: `Con el primer hábito que te dé XP del día, ganas ${value} XP si aún no has usado Protección.`,
    fusion_10: `Al activar Protección, recuperas ${value}% del Maná máximo. Solo una vez al día.`,
    fusion_11: `Al cumplir el día, ganas ${value} XP si Protección te ha evitado daño ese día.`,
    fusion_12: `Si el primer hábito que te dé XP del día activa los dos efectos heredados, ganas ${value} XP extra.`,
    fusion_13: `Al completar Constancia, ganas ${value} XP extra y recuperas ${mana}% del Maná máximo. Solo una vez por ciclo.`,
    fusion_14: `Al cumplir el día, ganas ${value} XP si el primer hábito de ese día te recuperó Maná.`,
    fusion_15: `Al completar Constancia, ganas ${value} XP extra y recuperas ${mana}% del Maná máximo. Solo una vez por ciclo.`,
    fusion_16: `Al cumplir el día, ganas ${value} XP si esta reliquia te recuperó Maná ese día.`,
    fusion_17: `Con el primer hábito que te dé XP del día, recuperas ${health}% de la Vida máxima. No te devuelve a la vida.`,
    fusion_18: `Al completar el primer hábito del día, mejoras Vampirismo ${increase('relic_07', 1)} contra el primer enemigo de la próxima Cacería. ${singleCharge}`,
    fusion_19: `Al completar Constancia, mejoras Vampirismo ${increase('relic_07', 1)} para toda la próxima Cacería. ${singleCharge}`,
    fusion_20: `Al completar el primer hábito del día, mejoras Mirada petrificante ${increase('relic_08', value)} para su primer uso en la próxima Cacería. ${equippedCharge}`,
    fusion_21: `La primera vez que Mirada petrificante te evita daño en una Cacería, ganas ${value} XP.`,
    fusion_22: `Al completar Constancia, mejoras Mirada petrificante ${increase('relic_08', value)} contra cada enemigo de la próxima Cacería. ${equippedCharge}`,
    fusion_23: `Si Mirada petrificante reduce un golpe y sobrevives, recuperas ${value} de Maná. Solo una vez por enemigo.`,
    fusion_24: `Si Mirada petrificante reduce un golpe y sobrevives, recuperas ${value} de Vida. Solo una vez por enemigo.`,
    fusion_25: `Cuando Mirada petrificante te evita daño, Vampirismo sube ${increase('relic_07', value)} en tu siguiente ataque que dañe a ese enemigo. Solo una vez por enemigo; no puedes acumularlo.`,
    fusion_26: `Al completar el primer hábito del día, preparas ${value} de protección extra para la próxima Cacería: evitas 1 de daño por golpe, sin bajarlo a cero. ${equippedCharge}`,
    fusion_27: `Si Escamas protectoras evita al menos 5 de daño contra un enemigo y lo derrotas, ganas ${value} XP. Solo una vez por enemigo, hasta ${value * 3} XP por Cacería.`,
    fusion_28: `Al completar Constancia, mejoras Escamas protectoras ${increase('relic_09', value)} para toda la próxima Cacería. ${equippedCharge}`,
    fusion_29: `Cuando Escamas protectoras evita daño y sobrevives, recuperas como Maná el 20% del total evitado, sin decimales. Hasta ${value} de Maná por enemigo; lo que sobre se pierde.`,
    fusion_30: `Cuando Escamas protectoras evita daño y sobrevives, recuperas como Vida el 15% del total evitado, sin decimales. Hasta ${value} de Vida por enemigo; lo que sobre se pierde.`,
    fusion_31: `Cuando Escamas protectoras evita un total de 5 de daño contra un enemigo, Vampirismo sube ${increase('relic_07', value)} hasta terminar ese combate. Contra el siguiente enemigo, vuelve a empezar.`,
  }[definition.id];
}

export function relicEffectCopy(definition, relic) {
  const inherited = definition.recipeId
    ? Object.entries(relic.inheritedEffects || {})
    : [[definition.id, relicRankEffect(definition.id, relic.rank)]];
  const rows = inherited.map(([id, value]) => ({
    id, name: names[id], description: baseDescription(id, value),
  }));
  if (definition.recipeId) rows.push({
    id: definition.id, name: 'Bonus de fusión', description: fusionBonus(definition, relic.rank, relic.inheritedEffects || {}),
  });
  return rows;
}

export const HUNT_CHARGE_RELIC_IDS = ['fusion_18', 'fusion_19', 'fusion_20', 'fusion_22', 'fusion_26', 'fusion_28'];
export function huntChargeCopy(ready) {
  return ready ? 'Preparada · se consume al iniciar Cacería' : 'Sin carga preparada';
}
