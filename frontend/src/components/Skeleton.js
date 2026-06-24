import React from 'react';
import styles from './Skeleton.module.css';

/**
 * Animated placeholder shown while data loads, instead of plain text.
 * `variant` controls the shape: "chart" (tall block) or "card" (small block).
 */
export default function Skeleton({ variant = 'card', className = '' }) {
  return <div className={`${styles.skeleton} ${styles[variant] || ''} ${className}`} />;
}
