// Compact, client-reported balance summaries. No names, emails or per-hit logs.
// Saved with the existing game snapshot; this module makes no network requests.
export const EVENT_METRICS = Object.freeze([
  'huntsStarted', 'huntsCompleted', 'huntsWon', 'minibossWins',
  'goldSpentCandy', 'goldSpentCosmetics', 'goldSpentMask', 'goldSpentPack',
  'goldEarnedHunts', 'goldEarnedWeekly', 'bloodBase', 'bloodCandy', 'bloodMask',
  'xpBase', 'xpCandy', 'energyCandyGranted', 'energySpentNormal', 'energySpentExtra',
  'bloodBought', 'energyBought', 'experienceBought',
  'bloodDropped', 'energyDropped', 'experienceDropped',
  'bloodGifted', 'energyGifted', 'experienceGifted',
  'bloodPrepared', 'experiencePrepared', 'bloodConsumed', 'experienceConsumed',
  'bloodRefunded', 'experienceRefunded',
]);
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = value => Number.isFinite(Number(value)) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(Number(value)))) : 0;
const cleanMetrics = input => Object.fromEntries(EVENT_METRICS.filter(key => count(input?.[key]) > 0).map(key => [key, count(input[key])]));
const add = (a, b) => cleanMetrics(Object.fromEntries(EVENT_METRICS.map(key => [key, Math.min(Number.MAX_SAFE_INTEGER, count(a?.[key]) + count(b?.[key]))])));
export const EVENT_ANALYTICS_MAX_BYTES = 256 * 1024;

export function recordHalloweenAnalytics(raw, entry, { active = false, nowTimestamp = Date.now() } = {}) {
  if (!active || !entry?.operationId || typeof entry.operationId !== 'string' || entry.operationId.length > 180) return raw;
  const date = new Date(nowTimestamp);
  if (!Number.isFinite(date.getTime())) return raw;
  const eventId = `halloween-${date.getFullYear()}`;
  const root = object(raw);
  if (root.capped === true) return raw;
  const events = object(root.events);
  const previous = object(events[eventId]);
  const seen = object(previous.seen);
  if (seen[entry.operationId]) return raw;
  // Stop instead of evicting deduplication keys and counting old rewards twice.
  if (Object.keys(seen).length >= 10000 || (!events[eventId] && Object.keys(events).length >= 8)) {
    if (root.capped === true) return raw;
    return { ...root, capped: true };
  }
  const metrics = cleanMetrics(entry.metrics);
  if (!Object.keys(metrics).length) return raw;
  const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const level = count(entry.level);
  const region = ['fields-of-mist','dead-hours-bunker','nuncabasta-peaks'].includes(entry.region) ? entry.region : 'none';
  const difficulty = ['easy','medium','hard'].includes(entry.difficulty) ? entry.difficulty : 'none';
  const source = ['hunt','weekly','candy-purchase','candy-use','cosmetic-purchase','mask-purchase','pack-purchase','gift'].includes(entry.source) ? entry.source : 'other';
  const segmentId = `${day}|${level}|${region}|${difficulty}|${source}`;
  const segments = object(previous.segments);
  const next = {
    schemaVersion: 1,
    events: {
      ...events,
      [eventId]: {
        ...previous,
        totals: add(previous.totals, metrics),
        segments: { ...segments, [Object.keys(segments).length >= 1000 && !segments[segmentId] ? 'overflow' : segmentId]:
          Object.keys(segments).length >= 1000 && !segments[segmentId]
            ? { source: 'overflow', metrics: add(segments.overflow?.metrics, metrics) }
            : { day, level, region, difficulty, source, metrics: add(segments[segmentId]?.metrics, metrics) } },
        seen: { ...seen, [entry.operationId]: true },
        updatedAt: nowTimestamp,
      },
    },
  };
  // Budget includes prior event years, detailed groups and deduplication keys.
  // Keep a little space for the flag; never grow the regular cloud snapshot
  // beyond this analytics budget, nor silently erase older event information.
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength > EVENT_ANALYTICS_MAX_BYTES - 100) {
    return { ...root, capped: true };
  }
  return next;
}

export function halloweenHuntMetrics(report) {
  const rewards = object(report?.rewards);
  const drops = object(rewards.candyDrops);
  const miniWon = report?.encounters?.[2]?.won === true;
  const bloodUsed = report?.halloweenCandy?.blood === true;
  const xpUsed = report?.halloweenCandy?.experience === true;
  return cleanMetrics({
    huntsCompleted: 1, huntsWon: report?.won ? 1 : 0, minibossWins: miniWon ? 1 : 0,
    goldEarnedHunts: rewards.gold,
    bloodBase: Math.max(0, count(rewards.bossBlood)-count(rewards.candyBloodBonus)-count(rewards.maskBloodBonus)),
    bloodCandy: rewards.candyBloodBonus, bloodMask: rewards.maskBloodBonus,
    xpBase: Math.max(0, count(rewards.xp)-count(rewards.candyXpBonus)), xpCandy: rewards.candyXpBonus,
    bloodDropped: drops.blood, energyDropped: drops.energy, experienceDropped: drops.experience,
    bloodConsumed: bloodUsed && miniWon ? 1 : 0, bloodRefunded: bloodUsed && !miniWon ? 1 : 0,
    experienceConsumed: xpUsed && count(rewards.xp)>0 ? 1 : 0, experienceRefunded: xpUsed && !count(rewards.xp) ? 1 : 0,
  });
}
