import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RATIO_TYPES, DEFAULT_PERIOD, PERIODS } from './constants';
import { useRatioData } from './hooks/useRatioData';
import { useBalance } from './hooks/useBalance';
import { toGraphData, applyPeriodFilter, computeStats } from './utils/ratio';
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

  // Full (unfiltered) graph for the "Current value" — always shown.
  const fullGraph = useMemo(
    () => toGraphData(data, selectedRatioType),
    [data, selectedRatioType],
  );
  const currentValue =
    fullGraph.length > 0
      ? formatRatio(fullGraph[fullGraph.length - 1].ratio)
      : 'N/A';

  // Period-filtered data for the chart, stats, and distribution detection.
  const { graphData, stats, noDistribution } = useMemo(() => {
    const periodDays = PERIODS.find((p) => p.id === selectedPeriod)?.days ?? null;
    const filtered = applyPeriodFilter(data, periodDays);
    const graph = toGraphData(filtered, selectedRatioType);
    return {
      graphData: graph,
      stats: computeStats(graph),
      noDistribution: data.length > 0 && graph.length === 0,
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

          {!noDistribution && graphData.length > 0 && (
            <RatioChart graphData={graphData} ratioType={selectedRatioType} />
          )}

          {noDistribution && (
            <p className={styles.emptyPeriod}>
              No distributions were made in this period.
            </p>
          )}
        </>
      )}

      <Footer />
    </div>
  );
}

export default App;
