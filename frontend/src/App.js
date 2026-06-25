import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RATIO_TYPES, DEFAULT_PERIOD, PERIODS } from './constants';
import { useRatioData } from './hooks/useRatioData';
import { useBalance } from './hooks/useBalance';
import {
  buildChartData,
  withSplitKeys,
  computeVisibleChange,
} from './utils/ratio';
import { formatRatio } from './utils/format';
import Header from './components/Header';
import BalanceCard from './components/BalanceCard';
import RatioSelector from './components/RatioSelector';
import PeriodStats from './components/PeriodStats';
import RatioChart from './components/RatioChart';
import Skeleton from './components/Skeleton';
import Footer from './components/Footer';
import styles from './App.module.css';

function App() {
  const { data, loading, error, refetch } = useRatioData();
  const { balance } = useBalance();

  const [selectedRatioType, setSelectedRatioType] = useState(RATIO_TYPES.XSUSHI_SUSHI);
  const [selectedPeriod, setSelectedPeriod] = useState(DEFAULT_PERIOD);

  // Brush selection (controlled). { startIndex, endIndex } into graphData.
  // Null until the dataset is first built — Brush then shows the full range.
  const [brushRange, setBrushRange] = useState(null);

  // Build the chart dataset for the selected period + ratio type. This handles
  // period filtering, extends the line to "now", and reports whether any real
  // distribution fell inside the window.
  const { graphData, fullStats, currentValue } = useMemo(() => {
    const periodDays = PERIODS.find((p) => p.id === selectedPeriod)?.days ?? null;
    const built = buildChartData(data, periodDays, selectedRatioType);
    return {
      graphData: withSplitKeys(built.points),
      fullStats: built,
      currentValue:
        built.lastRealRatio != null ? formatRatio(built.lastRealRatio) : 'N/A',
    };
  }, [data, selectedRatioType, selectedPeriod]);

  // Reset the brush to the full range whenever the underlying dataset changes
  // (data load, period switch, ratio type switch) so the window never points at
  // stale indices.
  useEffect(() => {
    if (graphData.length > 0) {
      setBrushRange({ startIndex: 0, endIndex: graphData.length - 1 });
    } else {
      setBrushRange(null);
    }
  }, [graphData]);

  // Visible-window stats: Change % + date range, driven by the brush selection.
  const { visibleStats, noDistribution, periodRange } = useMemo(() => {
    const range =
      brushRange && graphData.length > 0
        ? brushRange
        : { startIndex: 0, endIndex: Math.max(0, graphData.length - 1) };

    const lo = Math.max(0, Math.min(range.startIndex, range.endIndex));
    const hi = Math.min(graphData.length - 1, Math.max(range.startIndex, range.endIndex));

    const changePct = computeVisibleChange(graphData, lo, hi);

    // "No distribution" now means: no real points inside the *visible* window.
    const hasRealVisible = graphData
      .slice(lo, hi + 1)
      .some((p) => p.isReal);

    const from = graphData.length > 0 ? graphData[lo].timestamp : null;
    const to = graphData.length > 0 ? graphData[hi].timestamp : null;

    return {
      visibleStats: { changePct },
      noDistribution: fullStats.hasRealPoints ? !hasRealVisible : true,
      periodRange: { from, to },
    };
  }, [graphData, brushRange, fullStats.hasRealPoints]);

  return (
    <div className={styles.app}>
      <Header />

      <Link
        to="/about"
        className={styles.aboutLink}
      >
        How SushiSwap Stake Works
      </Link>

      <BalanceCard balance={balance} />

      {loading ? (
        <>
          <Skeleton variant="card" />
          <Skeleton variant="chart" />
        </>
      ) : error ? (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>Error: {error}</p>
          <button type="button" className={styles.retryBtn} onClick={refetch}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <RatioSelector
            ratioType={selectedRatioType}
            onRatioTypeChange={setSelectedRatioType}
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />

          <PeriodStats
            stats={visibleStats}
            ratioType={selectedRatioType}
            currentValue={currentValue}
            noDistribution={noDistribution}
            periodRange={periodRange}
          />

          {graphData.length > 0 && (
            <RatioChart
              graphData={graphData}
              ratioType={selectedRatioType}
              brushRange={brushRange}
              onBrushChange={setBrushRange}
            />
          )}
        </>
      )}

      <Footer />
    </div>
  );
}

export default App;
