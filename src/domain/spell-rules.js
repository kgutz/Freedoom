function cappedHealth(hp, maxHp) {
  return Math.max(0, Math.min(maxHp, hp));
}

export function castSpellEffect({
  game,
  spell,
  level,
  currentWeek,
  today,
  nowTimestamp,
  maxHp,
}) {
  if (!spell) return { ok: false, reason: 'unknown-spell' };
  if (level < spell.lvl) {
    return { ok: false, reason: 'level', requiredLevel: spell.lvl };
  }
  if (spell.ulti && game.ultiW === currentWeek) {
    return { ok: false, reason: 'ultimate-used' };
  }

  const mana = game.mp || 0;
  if (mana < spell.cost) {
    return {
      ok: false,
      reason: 'mana',
      requiredMana: spell.cost,
      minimumMana: spell.id === 'alma',
    };
  }

  const nextGame = {
    ...game,
    buffs: { ...(game.buffs || {}) },
  };

  if (spell.id === 'alma') {
    const healing = Math.floor(mana / 2);
    const hpBefore = nextGame.hp;
    nextGame.hp = cappedHealth(nextGame.hp + healing, maxHp);
    nextGame.mp = 0;
    nextGame.ultiW = currentWeek;
    return {
      ok: true,
      game: nextGame,
      spentMana: mana,
      healing: nextGame.hp - hpBefore,
    };
  }

  nextGame.mp = mana - spell.cost;
  const result = {
    ok: true,
    game: nextGame,
    spentMana: spell.cost,
    healing: 0,
  };

  switch (spell.id) {
    case 'ceniza': {
      result.durationHours = level >= 12 ? 3 : 2;
      nextGame.buffs.cenizaUntil =
        nowTimestamp + result.durationHours * 3_600_000;
      break;
    }
    case 'muro':
      nextGame.buffs.shield = (nextGame.buffs.shield || 0) + 2;
      break;
    case 'grito': {
      const hpBefore = nextGame.hp;
      nextGame.hp = cappedHealth(nextGame.hp + 20, maxHp);
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'bastion':
      nextGame.buffs.bastion = true;
      nextGame.ultiW = currentWeek;
      break;
    case 'certero':
      nextGame.buffs.certeroUntil = nowTimestamp + 3_600_000;
      break;
    case 'luz':
    case 'balsamo': {
      const hpBefore = nextGame.hp;
      nextGame.hp = cappedHealth(nextGame.hp + 15, maxHp);
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'juicio':
      nextGame.judgmentDays = [...(nextGame.judgmentDays || [])];
      if (!nextGame.judgmentDays.includes(today)) {
        nextGame.judgmentDays.push(today);
      }
      nextGame.ultiW = currentWeek;
      break;
    case 'peste':
      nextGame.buffs.pesteDay = today;
      break;
    case 'regen':
      nextGame.buffs.regenUntil = nowTimestamp + 2 * 3_600_000;
      break;
    case 'renacer':
      nextGame.buffs.renacer = true;
      nextGame.ultiW = currentWeek;
      break;
    default:
      return { ok: false, reason: 'unknown-spell' };
  }

  return result;
}
