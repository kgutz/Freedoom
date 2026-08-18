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
  maxMp = 100,
  activeFailureChance = 0,
  passiveMultiplier = 1,
  smokeFreeMode = false,
  randomValue = Math.random(),
  manaDiscount = 0,
  selectedHabitIds = [],
  targetHabitId = null,
}) {
  if (!spell) return { ok: false, reason: 'unknown-spell' };
  if (level < spell.lvl) {
    return { ok: false, reason: 'level', requiredLevel: spell.lvl };
  }
  if (spell.ulti && game.ultiW === currentWeek) {
    return { ok: false, reason: 'ultimate-used' };
  }
  const progress = game.powerProgress || {};
  if (spell.habitChallenge && !spell.ulti && progress.challengeWeekUses?.[`${currentWeek}:${spell.id}`]) {
    return { ok: false, reason: 'challenge-used' };
  }
  if (spell.habitChallenge && !spell.autoHabitChallenge) {
    const minimum = spell.id === 'renacer' ? 1 : 2;
    if (selectedHabitIds.length < minimum && !targetHabitId) {
      return { ok: false, reason: 'habits', requiredHabits: minimum };
    }
  }
  if (spell.modern && spell.id === 'alma' && !targetHabitId) {
    return { ok: false, reason: 'habits', requiredHabits: 1 };
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
  nextGame.powerProgress = {
    ...(game.powerProgress || {}),
    challengeWeekUses: { ...(game.powerProgress?.challengeWeekUses || {}) },
  };

  if (spell.modern && spell.hpCost) {
    const hpCost = Math.max(1, Math.round(maxHp * spell.hpCost / 100));
    if ((nextGame.hp || 0) <= hpCost) {
      return { ok: false, reason: 'health', requiredHealth: hpCost + 1 };
    }
    nextGame.hp -= hpCost;
  }

  if (spell.modern && spell.id === 'alma') {
    nextGame.mp = mana - effectiveCost;
    nextGame.ultiW = currentWeek;
    nextGame.powerProgress.soulWager = {
      habitId: targetHabitId,
      startedAt: nowTimestamp,
      expiresAt: nowTimestamp + 24 * 3_600_000,
      mana: effectiveCost,
      completed: false,
    };
    return { ok: true, game: nextGame, spentMana: effectiveCost, healing: 0 };
  }

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
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: spell.autoHabitChallenge ? [] : [...new Set(selectedHabitIds)].slice(0, 2),
          autoNextHabitCount: spell.autoHabitChallenge ? 2 : 0,
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        nextGame.powerProgress.challengeWeekUses[`${currentWeek}:${spell.id}`] = true;
        break;
      }
      result.durationHours =
        level >= 12 ? 2 + passiveMultiplier : 2;
      nextGame.buffs.cenizaUntil =
        nowTimestamp + result.durationHours * 3_600_000;
      break;
    }
    case 'muro':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        nextGame.powerProgress.challengeWeekUses[`${currentWeek}:${spell.id}`] = true;
        break;
      }
      nextGame.buffs.shield = (nextGame.buffs.shield || 0) + 2;
      break;
    case 'grito': {
      const hpBefore = nextGame.hp;
      const amount = spell.modern ? Math.round(maxHp * 0.1) : 20;
      nextGame.hp = cappedHealth(nextGame.hp + amount, maxHp);
      if (spell.modern) nextGame.buffs.knightGuard = { amount: 2, day: today };
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'bastion':
      if (spell.modern) {
        const charges = Math.max(0, Number(nextGame.powerProgress.bastionCharges) || 0);
        if (charges < 6) return { ok: false, reason: 'charges', requiredCharges: 6, charges };
        nextGame.powerProgress.bastionCharges = 0;
        nextGame.powerProgress.bastionArmorProtected = true;
        nextGame.bonusXp = (nextGame.bonusXp || 0) + 5;
      }
      nextGame.buffs.bastion = true;
      nextGame.ultiW = currentWeek;
      break;
    case 'certero':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        nextGame.powerProgress.challengeWeekUses[`${currentWeek}:${spell.id}`] = true;
        break;
      }
      if(smokeFreeMode){
        nextGame.buffs.habitFocusCharges=(nextGame.buffs.habitFocusCharges||0)+2;
      }else{
        nextGame.buffs.certeroUntil = nowTimestamp + 3_600_000;
      }
      break;
    case 'luz':
      if (spell.modern) {
        const hpBefore = nextGame.hp;
        nextGame.hp = cappedHealth(nextGame.hp + Math.round(maxHp * 0.1), maxHp);
        nextGame.buffs.paladinManaHabit = true;
        result.healing = nextGame.hp - hpBefore;
        break;
      }
    case 'balsamo': {
      const hpBefore = nextGame.hp;
      if (spell.modern) {
        nextGame.hp = cappedHealth(nextGame.hp + Math.round(maxHp * 0.06), maxHp);
        nextGame.buffs.balm = {
          remaining: Math.round(maxHp * 0.09),
          startedAt: nowTimestamp,
          until: nowTimestamp + 30 * 60_000,
        };
      } else nextGame.hp = cappedHealth(nextGame.hp + 15, maxHp);
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'juicio':
      if (spell.modern) {
        nextGame.powerProgress.judgment = {
          habitIds: [...new Set(selectedHabitIds)].slice(0, 3),
          completedIds: [],
          day: today,
          rewarded: false,
        };
        nextGame.ultiW = currentWeek;
        break;
      }
      nextGame.judgmentDays = [...(nextGame.judgmentDays || [])];
      if (!nextGame.judgmentDays.includes(today)) {
        nextGame.judgmentDays.push(today);
      }
      nextGame.ultiW = currentWeek;
      break;
    case 'peste':
      if (spell.modern) {
        const hpBefore = nextGame.hp;
        const amount = Math.round(maxHp * 0.08);
        nextGame.hp = cappedHealth(nextGame.hp + amount, maxHp);
        result.healing = nextGame.hp - hpBefore;
        break;
      }
      if(smokeFreeMode){
        nextGame.pestXpDays=[...(nextGame.pestXpDays||[])];
        if(!nextGame.pestXpDays.includes(today)) nextGame.pestXpDays.push(today);
      }else{
        nextGame.buffs.pesteDay = today;
      }
      break;
    case 'regen':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        nextGame.powerProgress.challengeWeekUses[`${currentWeek}:${spell.id}`] = true;
        break;
      }
      nextGame.buffs.regenUntil = nowTimestamp + 2 * 3_600_000;
      break;
    case 'renacer':
      if (spell.modern) {
        nextGame.powerProgress.rebirthHabit = {
          habitId: targetHabitId || selectedHabitIds[0],
          progress: 0,
          entryKeys: [],
          startedAt: nowTimestamp,
          expiresAt: nowTimestamp + 7 * 24 * 3_600_000,
          completed: false,
        };
        nextGame.ultiW = currentWeek;
        break;
      }
      nextGame.buffs.renacer = true;
      nextGame.ultiW = currentWeek;
      break;
    default:
      return { ok: false, reason: 'unknown-spell' };
  }

  return result;
}
