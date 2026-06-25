// Formatting helpers for dates, ratios, currency and percentages.
// Timestamps in graph data are numeric (ms), matching the time-based XAxis.

import { format } from 'date-fns';

/** Format a numeric timestamp as a full tooltip label (e.g. "Jun 24, 2026 14:30"). */
export function formatDateTime(ts) {
  return format(new Date(ts), 'MMM dd, yyyy HH:mm');
}

/** Format a numeric timestamp as dd.MM.yyyy (e.g. "24.06.2026"). */
export function formatDateDMY(ts) {
  if (ts == null) return '';
  return format(new Date(ts), 'dd.MM.yyyy');
}

/** Ratio values are displayed to 4 decimal places. */
export function formatRatio(value) {
  return Number(value).toFixed(4);
}

/** Format a USD amount with thousands separators and no decimals. */
export function formatUsd(value) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Format a WETH balance to 2 decimals. */
export function formatWeth(value) {
  return Number(value).toFixed(2);
}

/**
 * Format a signed percentage change, e.g. "+1.23%" / "-0.45%".
 * Pass null/undefined to get an empty string.
 */
export function formatChangePct(value) {
  if (value === null || value === undefined) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}
