import React from 'react';
import { formatUsd, formatWeth } from '../utils/format';
import WethProgressBar from './WethProgressBar';
import styles from './BalanceCard.module.css';

/**
 * Shows the treasury fees awaiting distribution (USD value + WETH amount)
 * with a heatmap progress bar scaled to 0–30 WETH.
 */
export default function BalanceCard({ balance }) {
  if (!balance) return null;
  const { balance_usd, weth_balance } = balance;
  return (
    <div className={styles.wrapper}>
      <p className={styles.balance}>
        Fees awaiting distribution: ~${formatUsd(balance_usd)} ({formatWeth(weth_balance)} WETH)
      </p>
      <WethProgressBar wethBalance={Number(weth_balance)} />
    </div>
  );
}
