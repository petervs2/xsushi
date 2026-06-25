import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
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

  const point = payload[0].payload;
  const value = point.ratio;
  const delta = point.deltaPercent;
  const ratioLabel = ratioType === 'xsushi_sushi' ? 'xSushi/Sushi' : 'Sushi/xSushi';
  const deltaColor =
    delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const sign = delta > 0 ? '+' : '';
  const isNow = point.isNow;

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDate}>
        {isNow ? 'Now' : formatDateTime(label)}
      </p>
      <p className={styles.tooltipRatio}>
        {ratioLabel}: {formatRatio(value)}
      </p>
      {delta != null && !isNow && (
        <p className={styles.tooltipDelta} style={{ color: deltaColor }}>
          Change: {sign}
          {delta.toFixed(2)}%
        </p>
      )}
    </div>
  );
};

/**
 * Ratio step chart with a time-based XAxis and strict calendar ticks.
 *
 * Visual design:
 *  - `stepAfter` line type: correctly shows the step nature of distributions
 *    (value stays constant between distributions, then jumps).
 *  - Two <Line> elements read from the **same** <LineChart data> (no per-Line
 *    `data` prop — that breaks Brush index-based filtering):
 *    1) Solid line — dataKey="solidRatio" (null for bridge/now rows).
 *    2) Dashed line — dataKey="dashedRatio" (null for everything else).
 *    Both use connectNulls to skip gaps.
 *  - A ReferenceDot with "Now" label marks the end of the dashed tail.
 *  - Animation draws the solid line from left to right on mount / period change.
 *
 * `graphData` is built by `buildChartData()` + `withSplitKeys()` and contains
 * `isNow` / `isBridge` flags plus `solidRatio` / `dashedRatio` data keys.
 *
 * Memoized: re-renders only when graphData or ratioType identity changes.
 */
function RatioChart({ graphData, ratioType, brushRange, onBrushChange }) {
  const ratios = graphData.map((d) => d.ratio);
  const yDomain = computeYDomain(ratios, ratioType);

  // Calendar ticks (1st of each month / Jan 1st yearly) + matching formatter.
  const axisTicks = useMemo(() => generateCalendarTicks(graphData), [graphData]);
  const tickFormatter = useMemo(() => getTickFormatter(graphData), [graphData]);

  // Locate the "now" point for the ReferenceDot marker.
  const nowPoint = graphData.find((d) => d.isNow);

  // Brush is controlled: startIndex/endIndex are owned by the parent so the
  // visible window drives the Change card + Period card. When the data changes
  // (period switch), the parent resets brushRange to the full range.
  const handleBrushChange = (payload) => {
    if (!payload || payload.startIndex == null || payload.endIndex == null) return;
    onBrushChange?.({ startIndex: payload.startIndex, endIndex: payload.endIndex });
  };

  // Animation duration — longer for more data points (capped).
  const animDuration = Math.min(600 + graphData.length * 15, 1500);

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

        {/* Solid step line — real distribution history. Reads solidRatio
            which is null for bridge/now rows, so connectNulls draws the
            step through real points and stops at the last real step. */}
        <Line
          type="stepAfter"
          dataKey="solidRatio"
          stroke="#00d4ff"
          strokeWidth={2.5}
          connectNulls
          dot={(props) => {
            const { cx, cy, index, payload } = props;
            if (payload.solidRatio == null || payload.isSynthetic) {
              return <g key={`skip-${index}`} />;
            }
            return (
              <circle
                key={`dot-${index}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill="#00d4ff"
                stroke="#0f172a"
                strokeWidth={1}
              />
            );
          }}
          activeDot={{ r: 7, stroke: '#00d4ff', strokeWidth: 2 }}
          isAnimationActive={true}
          animationDuration={animDuration}
        />

        {/* Dashed tail — from last real distribution to "now". Reads
            dashedRatio which is only non-null for bridge/now rows. */}
        <Line
          type="stepAfter"
          dataKey="dashedRatio"
          stroke="#00d4ff"
          strokeWidth={2}
          strokeDasharray="8 5"
          connectNulls
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />

        {/* "Now" marker dot with label */}
        {nowPoint && (
          <ReferenceDot
            x={nowPoint.timestamp}
            y={nowPoint.ratio}
            r={6}
            fill="#00d4ff"
            stroke="#fff"
            strokeWidth={2}
            label={{
              value: 'Now',
              position: 'top',
              fill: '#e2e8f0',
              fontSize: 12,
              fontWeight: 'bold',
              offset: 10,
            }}
          />
        )}

        <Brush
          dataKey="timestamp"
          height={30}
          stroke="#475569"
          fill="#1e293b"
          tickFormatter={tickFormatter}
          tick={{ fill: '#94a3b8', fontSize: '10px' }}
          startIndex={brushRange?.startIndex}
          endIndex={brushRange?.endIndex}
          onChange={handleBrushChange}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default memo(RatioChart);
