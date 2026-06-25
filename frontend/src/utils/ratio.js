// Pure helpers for ratio data transformation and statistics.
// No React, no DOM — safe to reuse on both render and SSR paths.

import {
  startOfMonth,
  endOfMonth,
  differenceInMonths,
  eachMonthOfInterval,
  eachYearOfInterval,
} from 'date-fns';
import { RATIO_TYPES, RATIO_UPPER_BOUND, RATIO_AXIS_PADDING } from '../constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Enrich raw API points: convert ISO timestamp to numeric ms (for recharts
 * time-based XAxis) and keep the canonical Sushi/xSushi ratio as `originalRatio`.
 *
 * `deltaPercent` is left to buildChartData(), which needs the display-domain
 * delta after the selected ratio type (and synthetic "now" points) are applied.
 *
 * @param {Array<{timestamp: string, ratio: number}>} rawData
 * @returns {Array<{timestamp: number, ratio: number, originalRatio: number}>}
 */
export function processRawData(rawData) {
  if (!rawData) return [];
  return rawData.map((point) => ({
    ...point,
    timestamp: new Date(point.timestamp).getTime(),
    originalRatio: point.ratio,
  }));
}

/**
 * Convert the stored canonical ratio (Sushi/xSushi) into the value shown for the
 * selected view type.
 */
export function toDisplayRatio(originalRatio, ratioType) {
  return ratioType === RATIO_TYPES.SUSHI_XSUSHI
    ? originalRatio
    : 1 / originalRatio;
}

/**
 * Recompute deltaPercent relative to the previous row of an array of
 * display rows (used after synthetic points are appended).
 */
function recomputeDeltas(rows) {
  return rows.map((row, index) => {
    if (index === 0) return { ...row, deltaPercent: null };
    const prev = rows[index - 1];
    if (row.ratio == null || prev.ratio == null) return { ...row, deltaPercent: null };
    return { ...row, deltaPercent: ((row.ratio - prev.ratio) / prev.ratio) * 100 };
  });
}

/**
 * Build the full chart dataset for a given period and ratio type.
 *
 * The backend stores a point only when a distribution changes the ratio, so the
 * data is naturally step-shaped: between points the value is constant. This
 * function turns that into a chart that always reaches "now" and is honest about
 * which part of the line is a real observation vs. a value still awaiting the
 * next distribution.
 *
 * Responsibilities:
 *  - filter to the selected period (`days: null` = all history)
 *  - when the period has no real points, synthesize a flat segment using the
 *    last known value, so the chart still draws as a straight line
 *  - always extend the line to the current time with a trailing segment marked
 *    `isNow: true` (rendered dashed). A duplicate "bridge" point is injected so
 *    the dashed tail does not visually re-draw the last real step.
 *
 * Returns: {
 *   points: Array<row>,            // chart rows (display ratios, deltas, flags)
 *   noDistribution: boolean,       // no real distribution fell inside the period
 *   hasRealPoints: boolean,
 *   lastRealRatio: number | null,  // last real display ratio (== current value)
 *   changePct: number,             // total change across the window (>=0 floor)
 * }
 */
export function buildChartData(processedData, days, ratioType) {
  const now = Date.now();

  // --- 1. period filter ----------------------------------------------------
  const cutoff = days ? now - days * DAY_MS : null;
  const realInPeriod = cutoff
    ? processedData.filter((p) => p.timestamp >= cutoff)
    : processedData.slice();

  const hasRealPoints = realInPeriod.length > 0;

  // Last known value across the ENTIRE dataset (constant for the whole dataset
  // lifetime, independent of the selected period).
  const lastRealOriginal = processedData.length
    ? processedData[processedData.length - 1].originalRatio
    : null;
  const lastRealRatio =
    lastRealOriginal != null ? toDisplayRatio(lastRealOriginal, ratioType) : null;

  let rows;

  if (!hasRealPoints) {
    // No distribution in this period → draw a flat line at the last known value
    // across the whole window. The user sees "nothing changed here".
    const fromTs = cutoff;
    const ratio = lastRealRatio;
    // Both points are part of the dashed "awaiting distribution" tail.
    // The start point is marked isBridge so the dashed line picks it up.
    rows = recomputeDeltas([
      {
        timestamp: fromTs,
        ratio,
        originalRatio: lastRealOriginal,
        isReal: false,
        isSynthetic: true,
        isBridge: true,
      },
      {
        timestamp: now,
        ratio,
        originalRatio: lastRealOriginal,
        isReal: false,
        isSynthetic: true,
        isNow: true,
      },
    ]);
  } else {
    // Real points within the period. Convert to the display ratio view.
    const real = realInPeriod.map((p) => ({
      ...p,
      ratio: toDisplayRatio(p.originalRatio, ratioType),
      isReal: true,
    }));

    // Extend to "now": the value stays at the last real ratio until the next
    // distribution. A bridge point duplicates the last real value so the dashed
    // tail starts horizontally (and the last real step isn't redrawn dashed).
    const tail = [];
    if (lastRealRatio != null) {
      tail.push({
        timestamp: real[real.length - 1].timestamp,
        ratio: lastRealRatio,
        originalRatio: lastRealOriginal,
        isReal: false,
        isBridge: true,
      });
      tail.push({
        timestamp: now,
        ratio: lastRealRatio,
        originalRatio: lastRealOriginal,
        isReal: false,
        isNow: true,
      });
    }
    rows = recomputeDeltas([...real, ...tail]);
  }

  // --- total change across the window --------------------------------------
  const realRatios = rows.filter((r) => r.isReal).map((r) => r.ratio);
  let changePct;
  if (realRatios.length >= 2) {
    const first = realRatios[0];
    const last = realRatios[realRatios.length - 1];
    changePct = first !== 0 ? ((last - first) / first) * 100 : 0;
  } else {
    // 0 or 1 real point in the window → no observable change.
    changePct = 0;
  }

  return {
    points: rows,
    noDistribution: !hasRealPoints,
    hasRealPoints,
    lastRealRatio,
    changePct,
  };
}

/**
 * Post-process chart rows for rendering: add `solidRatio` and `dashedRatio`
 * data-key fields so each <Line> in the chart reads from the *same* dataset
 * that <LineChart> and <Brush> share (no per-Line `data` prop — that breaks
 * Brush index-based filtering).
 *
 *  - solidRatio: null for bridge/now rows, ratio otherwise.
 *  - dashedRatio: null for everything except bridge/now rows.
 */
export function withSplitKeys(rows) {
  return rows.map((d) => ({
    ...d,
    solidRatio: d.isBridge || d.isNow ? null : d.ratio,
    dashedRatio: d.isBridge || d.isNow ? d.ratio : null,
  }));
}

/**
 * Y-axis domain for the chart, matching the original fixed-cap behaviour.
 */
export function computeYDomain(ratios, ratioType) {
  if (!ratios.length) return [0, 1];
  if (ratioType === RATIO_TYPES.SUSHI_XSUSHI) {
    return [Math.min(...ratios) - RATIO_AXIS_PADDING, RATIO_UPPER_BOUND];
  }
  return [1 / RATIO_UPPER_BOUND, Math.max(...ratios) + RATIO_AXIS_PADDING];
}

// ---------------------------------------------------------------------------
// Calendar ticks for time-based XAxis (ported from the old version)
// ---------------------------------------------------------------------------

/**
 * Generate strict calendar tick positions (1st of each month, or Jan 1st
 * yearly if the range is > 2 years). Returns numeric timestamps.
 */
export function generateCalendarTicks(data) {
  if (!data || data.length < 2) return undefined;

  const minTime = data[0].timestamp;
  const maxTime = data[data.length - 1].timestamp;
  const start = startOfMonth(new Date(minTime));
  const end = endOfMonth(new Date(maxTime));
  const totalMonths = differenceInMonths(end, start);

  const dates =
    totalMonths > 24
      ? eachYearOfInterval({ start, end })
      : eachMonthOfInterval({ start, end });

  return dates.map((t) => t.getTime());
}

/**
 * Returns a tick formatter function for the XAxis.
 * Uses 'yyyy' for yearly ranges, 'MMM yyyy' for monthly.
 */
export function getTickFormatter(data) {
  const ticks = generateCalendarTicks(data);
  if (!ticks) return (t) => formatDateShort(t);

  const isYearly =
    ticks.length > 0 &&
    differenceInMonths(new Date(ticks[ticks.length - 1]), new Date(ticks[0])) > 24;

  return (tick) => (isYearly ? formatYear(tick) : formatMonthYear(tick));
}

function formatDateShort(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonthYear(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatYear(ts) {
  return new Date(ts).getFullYear().toString();
}
