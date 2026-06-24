import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { formatDateTime, formatRatio } from '../utils/format';
import {
  computeYDomain,
  generateCalendarTicks,
  getTickFormatter,
} from '../utils/ratio';
import styles from './RatioChart.module.css';

/**
 * Custom tooltip. Declared OUTSIDE the chart component so it isn't recreated on
 * every render. `ratioType` is injected via a closure prop from the parent.
 */
const ChartTooltip = ({ active, payload, label, ratioType }) => {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const delta = payload[0].payload.deltaPercent;
  const ratioLabel = ratioType === 'xsushi_sushi' ? 'xSushi/Sushi' : 'Sushi/xSushi';
  const deltaColor =
    delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const sign = delta > 0 ? '+' : '';

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>{formatDateTime(label)}</p>
      <p className={styles.tooltipRatio}>
        {ratioLabel}: {formatRatio(value)}
      </p>
      {delta !== null && (
        <p className={styles.tooltipDelta} style={{ color: deltaColor }}>
          Change: {sign}
          {delta.toFixed(2)}%
        </p>
      )}
    </div>
  );
};

/**
 * Ratio line chart with a time-based XAxis and strict calendar ticks.
 * `graphData` is already view-adjusted for the selected ratio type.
 *
 * Memoized: re-renders only when graphData or ratioType identity changes.
 */
function RatioChart({ graphData, ratioType }) {
  const ratios = graphData.map((d) => d.ratio);
  const yDomain = computeYDomain(ratios, ratioType);

  // Calendar ticks (1st of each month / Jan 1st yearly) + matching formatter.
  const axisTicks = useMemo(() => generateCalendarTicks(graphData), [graphData]);
  const tickFormatter = useMemo(() => getTickFormatter(graphData), [graphData]);

  return (
    <ResponsiveContainer width="100%" height={500}>
      <LineChart data={graphData}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          ticks={axisTicks}
          tickFormatter={tickFormatter}
          height={50}
          tick={{ fill: '#94a3b8', fontSize: '12px' }}
          stroke="#475569"
        />
        <YAxis
          domain={yDomain}
          tickFormatter={formatRatio}
          tick={{ fill: '#94a3b8', fontSize: '12px' }}
          stroke="#475569"
        />
        <Tooltip content={<ChartTooltip ratioType={ratioType} />} />
        <Line
          type="monotone"
          dataKey="ratio"
          stroke="#00d4ff"
          strokeWidth={3}
          dot={{ r: 4, fill: '#00d4ff', stroke: '#0f172a', strokeWidth: 1 }}
          activeDot={{ r: 8, stroke: '#00d4ff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Brush
          dataKey="timestamp"
          height={30}
          stroke="#475569"
          fill="#1e293b"
          tickFormatter={tickFormatter}
          tick={{ fill: '#94a3b8', fontSize: '10px' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default memo(RatioChart);
