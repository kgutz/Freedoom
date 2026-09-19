// node scripts/audit-eye-fusions.mjs [seeds=200]
// Paired seeds compare inherited effects + stats against the same loadout with
// synergy. Assumes charge ready for 20/22, full HP/MP, no potions/affixes.
import { HUNT_REGIONS, huntDifficultyForRegion, startHunt, resolveHunt } from '../src/domain/pve-combat-rules.js';
import { fusionDefinition, relicRankEffect, relicCombatBonuses } from '../src/data/loot-data.js';
const trials=Number(process.argv[2])||200;
const keys={fusion_20:'petrificationFirstBonus',fusion_21:'petrificationXp',fusion_22:'petrificationHuntBonus',fusion_23:'petrificationMana',fusion_24:'petrificationHealth',fusion_25:'petrificationVampirism'};
const inheritedKeys={relic_05:'victoryMana',relic_06:'victoryHealth',relic_07:'vampirism',relic_08:'petrification'};
for(const [id,bonusKey] of Object.entries(keys)) for(const rank of [1,2,3]) for(const difficultyId of ['easy','medium','hard']) {
  const totals=[{wins:0,damage:0},{wins:0,damage:0}]; let runs=0; let maxDelta=-Infinity; let maxCase='';
  const definition=fusionDefinition(id), effects={}, relicBonuses={};
  for(const base of definition.ingredientIds) {
    if(inheritedKeys[base]) effects[inheritedKeys[base]]=relicRankEffect(base,rank);
    for(const stat of relicCombatBonuses(base,rank)) relicBonuses[stat.stat]=(relicBonuses[stat.stat]||0)+stat.value;
  }
  for(const regionId of Object.keys(HUNT_REGIONS)) for(const classId of ['knight','paladin','sorcerer','druid']) for(const build of ['offensive','balanced']) {
    const level=huntDifficultyForRegion(regionId,difficultyId).minLevel;
    const attack=['sorcerer','druid'].includes(classId)?'power':'strength';
    const allocation=build==='offensive'?{[attack]:level*3}:{[attack]:level,defense:level,constitution:level};
    const wins=[0,0];
    for(let mode=0;mode<2;mode++) for(let seed=1;seed<=trials;seed++) {
      const relicEffects={...effects,[bonusKey]:mode?definition.synergy.values[rank]:0};
      const begun=startHunt({regionId,difficultyId,level,seed,relicEffects,relicBonuses,nowTimestamp:1000});
      if(!begun.ok) throw Error(begun.reason);
      const {report}=resolveHunt({hunt:begun.hunt,classId,level,allocation,nowTimestamp:1000000});
      totals[mode].wins+=Number(report.won); wins[mode]+=Number(report.won);
      totals[mode].damage+=report.encounters.reduce((sum,e)=>sum+e.damageTaken,0);
    }
    runs+=trials;
    const delta=(wins[1]-wins[0])*100/trials;
    if(delta>maxDelta){maxDelta=delta;maxCase=`${regionId}/${classId}/${build}`;}
  }
  console.log(JSON.stringify({id,rank,difficultyId,runsPerVariant:runs,baseWin:+(totals[0].wins*100/runs).toFixed(2),synergyWin:+(totals[1].wins*100/runs).toFixed(2),baseDamage:+(totals[0].damage/runs).toFixed(2),synergyDamage:+(totals[1].damage/runs).toFixed(2),maxDelta,maxCase}));
}
