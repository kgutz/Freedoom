// Reproducible paired seeds. Run: node scripts/audit-malla-hunt.mjs [trials=1000]
// Isolates main effects: identical armor stats in every variant, full HP/mana,
// no potions/affixes. Low entry levels intentionally stress survivability.
import { startHunt, resolveHunt } from '../src/domain/pve-combat-rules.js';
import { relicRankEffect } from '../src/data/loot-data.js';
const trials = Number(process.argv[2]) || 1000;
const variants = { base: {}, ojo3: { petrification: relicRankEffect('relic_08', 3) } };
for (const rank of [1, 2, 3]) {
  variants[`malla${rank}`] = { damageReduction: relicRankEffect('relic_09', rank) };
  variants[`malla${rank}+ojo3`] = { ...variants[`malla${rank}`], ...variants.ojo3 };
}
for (const [difficultyId, level] of [['easy', 1], ['medium', 5], ['hard', 11]]) {
  for (const classId of ['knight', 'paladin', 'sorcerer', 'druid']) {
    const attack = ['sorcerer', 'druid'].includes(classId) ? 'power' : 'strength';
    for (const [build, allocation] of Object.entries({ offensive: { [attack]: 3 * level }, balanced: { [attack]: level, defense: level, constitution: level } })) {
      const rows = {};
      for (const [variant, relicEffects] of Object.entries(variants)) {
        let wins = 0, damage = 0, encounters = 0;
        for (let seed = 1; seed <= trials; seed++) {
          const started = startHunt({ difficultyId, level, seed, relicEffects, nowTimestamp: 1000 });
          if (!started.ok) throw Error(started.reason);
          const { report } = resolveHunt({ hunt: started.hunt, classId, level, allocation, nowTimestamp: 1000000 });
          wins += Number(report.won);
          damage += report.encounters.reduce((sum, e) => sum + e.damageTaken, 0);
          encounters += report.encounters.length;
        }
        rows[variant] = { winPercent: wins * 100 / trials, meanDamage: +(damage / trials).toFixed(2), meanEncounters: encounters / trials };
      }
      console.log(JSON.stringify({ difficultyId, level, classId, build, trials, rows }));
    }
  }
}
