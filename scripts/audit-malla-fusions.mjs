// node scripts/audit-malla-fusions.mjs [seeds=100]
// Paired same-seed baseline vs synergy, inherited gear stats included.
import { HUNT_REGIONS, huntDifficultyForRegion, startHunt, resolveHunt } from '../src/domain/pve-combat-rules.js';
import { fusionDefinition, relicRankEffect, relicCombatBonuses } from '../src/data/loot-data.js';
const trials=Number(process.argv[2])||100;
const keys={fusion_26:'armorReserve',fusion_27:'armorXp',fusion_28:'armorHuntBonus',fusion_29:'armorManaCap',fusion_30:'armorHealthCap',fusion_31:'armorVampirism'};
const inheritedKeys={relic_05:'victoryMana',relic_06:'victoryHealth',relic_07:'vampirism',relic_08:'petrification',relic_09:'damageReduction'};
for(const [id,bonusKey] of Object.entries(keys)) for(const rank of [1,2,3]) for(const difficultyId of ['easy','medium','hard']) {
  const totals=[{wins:0,damage:0,bonus:0},{wins:0,damage:0,bonus:0}]; let runs=0; let maxDelta=-Infinity; let maxCase='';
  const definition=fusionDefinition(id);
  // At R3 also check every combat-relevant non-conflicting second base relic.
  const partners=rank===3?['none',...['relic_05','relic_06','relic_07','relic_08'].filter(b=>!definition.ingredientIds.includes(b))]:['none'];
  for(const partner of partners) {
    const effects={}, relicBonuses={};
    for(const base of [...definition.ingredientIds,...(partner==='none'?[]:[partner])]) {
      if(inheritedKeys[base]) effects[inheritedKeys[base]]=relicRankEffect(base,rank);
      for(const stat of relicCombatBonuses(base,rank)) relicBonuses[stat.stat]=(relicBonuses[stat.stat]||0)+stat.value;
    }
    for(const regionId of Object.keys(HUNT_REGIONS)) for(const classId of ['knight','paladin','sorcerer','druid']) for(const build of ['offensive','balanced']) for(const resources of ['full','low-mana']) {
      const level=huntDifficultyForRegion(regionId,difficultyId).minLevel;
      const attack=['sorcerer','druid'].includes(classId)?'power':'strength';
      const allocation=build==='offensive'?{[attack]:level*3}:{[attack]:level,defense:level,constitution:level};
      const wins=[0,0];
      for(let mode=0;mode<2;mode++) for(let seed=1;seed<=trials;seed++) {
        const relicEffects={...effects,[bonusKey]:mode?definition.synergy.values[rank]:0};
        const begun=startHunt({regionId,difficultyId,level,seed,relicEffects,relicBonuses,currentHp:100,maxHp:100,currentMana:resources==='full'?100:10,maxMana:100,nowTimestamp:1000});
        if(!begun.ok) throw Error(begun.reason);
        if(begun.hunt.active.entryManaRatio !== (resources==='full'?1:0.1)) throw Error('entry ratio');
        const {report}=resolveHunt({hunt:begun.hunt,classId,level,allocation,nowTimestamp:1000000});
        totals[mode].wins+=Number(report.won); wins[mode]+=Number(report.won);
        totals[mode].damage+=report.encounters.reduce((sum,e)=>sum+e.damageTaken,0);
        for(const e of report.encounters){
          if(e.armorManaRecovered>relicEffects.armorManaCap || e.armorHealthRecovered>relicEffects.armorHealthCap || e.armorXp>relicEffects.armorXp) throw Error('cap');
          if(e.roundDetails.some(r=>r.heroHp<0 || r.heroHp>report.heroMaxHp || r.heroMana>report.heroMaxMana)) throw Error('resources');
          totals[mode].bonus+=e.armorManaRecovered+e.armorHealthRecovered+e.armorXp+e.armorReserveUsed;
        }
        if(report.encounters.reduce((n,e)=>n+e.armorReserveUsed,0)>(relicEffects.armorReserve||0)) throw Error('reserve reset');
      }
      runs+=trials;
      const delta=(wins[1]-wins[0])*100/trials;
      if(delta>maxDelta){maxDelta=delta;maxCase=`${regionId}/${classId}/${build}/${resources}/${partner}`;}
    }
  }
  console.log(JSON.stringify({id,rank,difficultyId,runsPerVariant:runs,baseWin:+(totals[0].wins*100/runs).toFixed(2),synergyWin:+(totals[1].wins*100/runs).toFixed(2),baseDamage:+(totals[0].damage/runs).toFixed(2),synergyDamage:+(totals[1].damage/runs).toFixed(2),averageBonus:+(totals[1].bonus/runs).toFixed(2),maxDelta,maxCase}));
}
