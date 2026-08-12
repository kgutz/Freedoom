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
  activeFailureChance = 0,
  passiveMultiplier = 1,
  smokeFreeMode = false,
  randomValue = Math.random(),
  manaDiscount = 0,
}) {
  if (!spell) return { ok: false, reason: 'unknown-spell' };
  if (level < spell.lvl) {
    return { ok: false, reason: 'level', requiredLevel: spell.lvl };
  }
  if (spell.ulti && game.ultiW === currentWeek) {
    return { ok: false, reason: 'ultimate-used' };
  }

  const mana = game.mp || 0;
  const effectiveCost = Math.max(
    0,
    spell.cost - Math.max(0, Math.round(Number(manaDiscount) || 0)),
  );
  if (mana < effectiveCost) {
    return {
      ok: false,
      reason: 'mana',
      requiredMana: effectiveCost,
      minimumMana: spell.id === 'alma',
    };
  }

  if (randomValue < activeFailureChance) {
    return {
      ok: false,
      reason: 'intoxicated',
      game: {
        ...game,
        buffs: { ...(game.buffs || {}) },
        mp: mana - effectiveCost,
      },
      spentMana: effectiveCost,
    };
  }

  const nextGame = {
    ...game,
    buffs: { ...(game.buffs || {}) },
  };

  if (spell.id === 'alma') {
    const spentMana = Math.max(0, mana - Math.max(0, Math.round(manaDiscount)));
    const healing = Math.floor(spentMana / 2);
    const hpBefore = nextGame.hp;
    nextGame.hp = cappedHealth(nextGame.hp + healing, maxHp);
    nextGame.mp = mana - spentMana;
    nextGame.ultiW = currentWeek;
    return {
      ok: true,
      game: nextGame,
      spentMana,
      healing: nextGame.hp - hpBefore,
    };
  }

  nextGame.mp = mana - effectiveCost;
  const result = {
    ok: true,
    game: nextGame,
    spentMana: effectiveCost,
    healing: 0,
  };

  switch (spell.id) {
    case 'ceniza': {
      result.durationHours =
        level >= 12 ? 2 + passiveMultiplier : 2;
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
      if(smokeFreeMode){
        nextGame.buffs.habitFocusCharges=(nextGame.buffs.habitFocusCharges||0)+2;
      }else{
        nextGame.buffs.certeroUntil = nowTimestamp + 3_600_000;
      }
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
      if(smokeFreeMode){
        nextGame.pestXpDays=[...(nextGame.pestXpDays||[])];
        if(!nextGame.pestXpDays.includes(today)) nextGame.pestXpDays.push(today);
      }else{
        nextGame.buffs.pesteDay = today;
      }
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
