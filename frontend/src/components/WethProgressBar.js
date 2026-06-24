import React, { useMemo } from 'react';
import { WETH_MAX, WETH_MARKERS } from '../constants';
import styles from './WethProgressBar.module.css';

/**
 * Heatmap-style progress bar for the WETH balance awaiting distribution.
 * Scale: 0 → 30 WETH with gradient from red (low) to green (high).
 * Markers at 10 and 20 WETH.
 */
export default function WethProgressBar({ wethBalance }) {
  const percentage = Math.min((wethBalance / WETH_MAX) * 100, 100);

  const gradientStops = useMemo(() => {
    return 'linear-gradient(to right, #ef4444 0%, #f97316 20%, #facc15 40%, #c5f2a7 60%, #63e60b 80%, #055924 100%)';
  }, []);

  const backgroundSize = percentage > 0 ? `calc(100% / ${percentage} * 100)` : '0%';

  return (
    <div className={styles.container}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${percentage}%`,
            background: gradientStops,
            backgroundSize,
            borderRadius: percentage < 100 ? '8px 0 0 8px' : '8px',
          }}
        />
        {WETH_MARKERS.map((level) => (
          <div
            key={level}
            className={styles.marker}
            style={{ left: `${(level / WETH_MAX) * 100}%` }}
          />
        ))}
      </div>

      <div className={styles.labels}>
        <span className={styles.labelLeft}>0</span>
        <span
          className={styles.labelMid}
          style={{ left: `${(10 / WETH_MAX) * 100}%`, transform: 'translateX(-50%)' }}
        >
          10
        </span>
        <span
          className={styles.labelMid}
          style={{ left: `${(20 / WETH_MAX) * 100}%`, transform: 'translateX(-30%)' }}
        >
          20
        </span>
        <span
          className={styles.labelRight}
          style={{ color: wethBalance >= WETH_MAX ? '#055924' : undefined }}
        >
          &gt; {WETH_MAX} WETH
        </span>
      </div>
    </div>
  );
}
