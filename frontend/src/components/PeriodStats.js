import React from 'react';
import { formatChangePct } from '../utils/format';
import styles from './PeriodStats.module.css';

/**
 * Two stat cards displayed over the selected period:
 * - Current value (always shown from the full dataset)
 * - Change % across the period (or "—" if no distribution occurred)
 */
export default function PeriodStats({ stats, ratioType, currentValue, noDistribution }) {
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
        stats.changePct !== null ? stats.changePct.toFixed(2) : null
      );

  return (
    <div className={styles.grid}>
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Current {ratioLabel}</span>
        <span className={styles.cellValue}>{currentValue}</span>
      </div>
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Change</span>
        {noDistribution ? (
          <>
            <span className={styles.cellValue + ' ' + styles.neutral}>{changeDisplay}</span>
            <span className={styles.noDistrNote}>No distribution in this period</span>
          </>
        ) : (
          <span className={`${styles.cellValue} ${changeClass}`}>{changeDisplay}</span>
        )}
      </div>
    </div>
  );
}
