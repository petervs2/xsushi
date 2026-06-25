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
 *  - Two <Line> elements share the same <LineChart data>:
 *    1) Solid line — passes `data` as graphData where bridge/now points have
 *       `ratio: null`. connectNulls bridges the gap so the last real step is
 *       drawn, but the tail portion has no values → no solid line there.
 *    2) Dashed line — passes `data` as graphData where only bridge/now points
 *       have values. connectNulls draws a horizontal dashed step to "now".
 *  - A ReferenceDot with "Now" label marks the end of the dashed tail.
 *  - Animation draws the solid line from left to right on mount / period change.
 *
 * `graphData` is built by `buildChartData()` and contains `isNow` / `isBridge`
 * flags on each point. The bridge point overlaps the last real point so the
 * dashed tail starts horizontally (doesn't re-draw the step).
 *
 * Memoized: re-renders only when graphData or ratioType identity changes.
 */
function RatioChart({ graphData, ratioType }) {
  const ratios = graphData.map((d) => d.ratio);
  const yDomain = computeYDomain(ratios, ratioType);

  // Calendar ticks (1st of each month / Jan 1st yearly) + matching formatter.
  const axisTicks = useMemo(() => generateCalendarTicks(graphData), [graphData]);
  const tickFormatter = useMemo(() => getTickFormatter(graphData), [graphData]);

  // Locate the "now" point for the ReferenceDot marker.
  const nowPoint = graphData.find((d) => d.isNow);

  // Two separate data arrays for the two <Line> components:
  // - solidData: same as graphData, but bridge/now rows have ratio=null.
  //   connectNulls will draw the solid step line through real points, then
  //   a straight connector across the null gap to any trailing real point.
  //   Because the bridge is at the same X as the last real point, that
  //   connector is zero-length (invisible).
  // - dashedData: same as graphData, but only bridge/now rows have values.
  //   connectNulls draws the dashed horizontal step to "now".
  const solidData = graphData.map((d) =>
    d.isBridge || d.isNow ? { ...d, ratio: null } : d,
  );
  const dashedData = graphData.map((d) =>
    !d.isBridge && !d.isNow ? { ...d, ratio: null } : d,
  );

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

        {/* Solid step line — real distribution history */}
        <Line
          data={solidData}
          type="stepAfter"
          dataKey="ratio"
          stroke="#00d4ff"
          strokeWidth={2.5}
          connectNulls
          dot={(props) => {
            const { cx, cy, index, payload } = props;
            if (payload.ratio == null || payload.isSynthetic) {
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

        {/* Dashed tail — from last real distribution to "now" */}
        <Line
          data={dashedData}
          type="stepAfter"
          dataKey="ratio"
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
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default memo(RatioChart);
