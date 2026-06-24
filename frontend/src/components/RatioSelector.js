import React from 'react';
import { RATIO_TYPES, PERIODS } from '../constants';
import styles from './RatioSelector.module.css';

/**
 * Controls: the ratio view type (styled select) and the period preset (button group).
 * Stateless — all state is owned by the parent.
 */
export default function RatioSelector({
  ratioType,
  onRatioTypeChange,
  period,
  onPeriodChange,
}) {
  return (
    <div className={styles.row}>
      <select
        className={styles.select}
        value={ratioType}
        onChange={(e) => onRatioTypeChange(e.target.value)}
        aria-label="Ratio type"
      >
        <option value={RATIO_TYPES.XSUSHI_SUSHI}>xSushi/Sushi</option>
        <option value={RATIO_TYPES.SUSHI_XSUSHI}>Sushi/xSushi</option>
      </select>

      <div className={styles.periods} role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.periodBtn} ${period === p.id ? styles.periodBtnActive : ''}`}
            onClick={() => onPeriodChange(p.id)}
            aria-pressed={period === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
