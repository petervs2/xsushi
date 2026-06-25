import React from 'react';
import { formatChangePct, formatDateDMY } from '../utils/format';
import styles from './PeriodStats.module.css';

/**
 * Three stat cards over the currently visible chart range:
 * - Current value (last known ratio, independent of the brush window)
 * - Period: date range currently shown on the chart (dd.MM.yyyy – dd.MM.yyyy),
 *   driven by the Brush selection
 * - Change % across the visible range (0.00% when no distribution there)
 *
 * `stats.changePct` reflects the brush-selected window, computed in App via
 * computeVisibleChange().
 */
export default function PeriodStats({
  stats,
  ratioType,
  currentValue,
  noDistribution,
  periodRange,
}) {
  const ratioLabel = ratioType === 'xsushi_sushi' ? 'xSushi/Sushi' : 'Sushi/xSushi';

  const changeClass =
    stats.changePct > 0
      ? styles.up
      : stats.changePct < 0
        ? styles.down
        : styles.neutral;
  const changeDisplay = noDistribution
    ? '0.00%'
    : formatChangePct(
        stats.changePct !== null && stats.changePct !== undefined
          ? stats.changePct.toFixed(2)
          : null,
      );

  const periodLabel =
    periodRange && periodRange.from != null && periodRange.to != null
      ? `${formatDateDMY(periodRange.from)} – ${formatDateDMY(periodRange.to)}`
      : '—';

  return (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Current {ratioLabel}</span>
        <span className={styles.cellValue}>{currentValue}</span>
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Period</span>
        <span className={styles.cellValue}>{periodLabel}</span>
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Change</span>
        {noDistribution ? (
          <>
            <span className={styles.cellValue + ' ' + styles.neutral}>
              {changeDisplay}
            </span>
            <span className={styles.noDistrNote}>No distribution in this period</span>
          </>
        ) : (
          <span className={`${styles.cellValue} ${changeClass}`}>{changeDisplay}</span>
        )}
      </div>
    </div>
  );
}
