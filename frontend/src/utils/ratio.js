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

/**
 * Enrich raw API points. Converts ISO timestamp to numeric ms (for recharts
 * time-based XAxis) and computes the percent delta vs the previous point.
 *
 * @param {Array<{timestamp: string, ratio: number}>} rawData
 * @returns {Array<{timestamp: number, ratio: number, originalRatio: number, deltaPercent: number|null}>}
 */
export function processRawData(rawData) {
  if (!rawData) return [];
  return rawData.map((point, index) => ({
    ...point,
    timestamp: new Date(point.timestamp).getTime(),
    originalRatio: point.ratio,
    deltaPercent:
      index > 0
        ? ((point.ratio - rawData[index - 1].ratio) / rawData[index - 1].ratio) * 100
        : null,
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
 * Compute the percent delta for a point in the *display* (possibly inverted)
 * domain, relative to the previous point.
 */
export function displayDeltaPercent(originalRatio, prevOriginalRatio) {
  if (originalRatio === undefined || prevOriginalRatio === undefined) return null;
  const cur = 1 / originalRatio;
  const prev = 1 / prevOriginalRatio;
  return ((cur - prev) / prev) * 100;
}

/**
 * Map processed points into chart-ready rows for the given ratio type.
 * Recomputes `ratio` and `deltaPercent` for the selected view.
 */
export function toGraphData(processedData, ratioType) {
  return processedData.map((point, index) => {
    const prevOriginal = index > 0 ? processedData[index - 1].originalRatio : undefined;
    return {
      ...point,
      ratio: toDisplayRatio(point.originalRatio, ratioType),
      deltaPercent:
        ratioType === RATIO_TYPES.SUSHI_XSUSHI
          ? point.deltaPercent
          : displayDeltaPercent(point.originalRatio, prevOriginal),
    };
  });
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

/**
 * Filter processed points to the last `days` days. `days: null` keeps everything.
 * Timestamps are numeric (ms), matching the time-based XAxis.
 */
export function applyPeriodFilter(processedData, days) {
  if (!days) return processedData;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return processedData.filter((point) => point.timestamp >= cutoff);
}

/**
 * Statistics over a set of graph points for the selected view.
 * Returns min/max/average display ratios and the total change % across the window.
 */
export function computeStats(graphPoints) {
  if (!graphPoints.length) {
    return { min: null, max: null, avg: null, changePct: null };
  }
  const values = graphPoints.map((p) => p.ratio);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const first = graphPoints[0].ratio;
  const last = graphPoints[graphPoints.length - 1].ratio;
  const changePct = first !== 0 ? ((last - first) / first) * 100 : null;
  return { min, max, avg, changePct };
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
