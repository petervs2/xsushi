import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RATIO_TYPES, DEFAULT_PERIOD, PERIODS } from './constants';
import { useRatioData } from './hooks/useRatioData';
import { useBalance } from './hooks/useBalance';
import { buildChartData, withSplitKeys } from './utils/ratio';
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

  // Build the chart dataset for the selected period + ratio type. This handles
  // period filtering, extends the line to "now", and reports whether any real
  // distribution fell inside the window.
  const { graphData, stats, noDistribution, currentValue } = useMemo(() => {
    const periodDays = PERIODS.find((p) => p.id === selectedPeriod)?.days ?? null;
    const built = buildChartData(data, periodDays, selectedRatioType);
    return {
      graphData: withSplitKeys(built.points),
      stats: { changePct: built.changePct },
      noDistribution: built.noDistribution,
      currentValue:
        built.lastRealRatio != null ? formatRatio(built.lastRealRatio) : 'N/A',
    };
  }, [data, selectedRatioType, selectedPeriod]);

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
            stats={stats}
            ratioType={selectedRatioType}
            currentValue={currentValue}
            noDistribution={noDistribution}
          />

          {graphData.length > 0 && (
            <RatioChart graphData={graphData} ratioType={selectedRatioType} />
          )}
        </>
      )}

      <Footer />
    </div>
  );
}

export default App;
