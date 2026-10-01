-- Read-only, manual end-of-event report. Does not run during gameplay.
-- Client-reported balance indicators, not an authoritative purchase ledger.
-- No names, emails, user ids or deduplication ids are returned.
-- Uses existing game_saves JSONB; no new table, trigger, RPC or subscription.
-- Change the year when needed. No event rows are expected before publication.
WITH summaries AS (
  SELECT state->'eventAnalytics'->'events'->'halloween-2026' AS summary,
    COALESCE((state->'eventAnalytics'->>'capped')::boolean, false) AS capped
  FROM public.game_saves
  WHERE state->'eventAnalytics'->'events' ? 'halloween-2026'
), metrics AS (
  SELECT metric.key, metric.value::numeric AS amount, summaries.capped
  FROM summaries
  CROSS JOIN LATERAL jsonb_each_text(summary->'totals') AS metric
)
SELECT key AS metric, SUM(amount) AS total,
  BOOL_OR(capped) AS any_incomplete_summary
FROM metrics
GROUP BY key ORDER BY key;

-- Detail for balance comparisons by level, zone and difficulty, per day.
WITH summaries AS (
  SELECT state->'eventAnalytics'->'events'->'halloween-2026' AS summary
  FROM public.game_saves
  WHERE state->'eventAnalytics'->'events' ? 'halloween-2026'
), segments AS (
  SELECT segment.value AS segment
  FROM summaries
  CROSS JOIN LATERAL jsonb_each(summary->'segments') AS segment
)
SELECT segment->>'day' AS day, segment->>'level' AS level,
  segment->>'region' AS region, segment->>'difficulty' AS difficulty,
  segment->>'source' AS source, metric.key AS metric,
  SUM(metric.value::numeric) AS total
FROM segments
CROSS JOIN LATERAL jsonb_each_text(segment->'metrics') AS metric
GROUP BY 1, 2, 3, 4, 5, 6 ORDER BY 1, 2, 3, 4, 5, 6;

-- Retention: independent of the last-20-hunts history and seasonal inventory.
-- Bounds per player: 10,000 operation keys per year; at most 8 event years.
-- Overall analytics payload budget: 256 KiB, including prior years.
-- At 1,000 detailed segments new segments are pooled into "overflow"; totals
-- remain exact until the operation limit. A capped summary is visibly flagged.
-- Mask/pack/gift counters are reserved; their gameplay hooks must be added
-- when those features are implemented. No rewards are modified by analytics.
