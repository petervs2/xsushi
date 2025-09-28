import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { format, parseISO } from 'date-fns';

function App() {
  // State for data, loading, error, and selected ratio type (default to growing xSushi/Sushi)
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRatioType, setSelectedRatioType] = useState('xsushi_sushi');

  // Fetch initial data from API on mount
  useEffect(() => {
    fetch('/api/ratio-data')
      .then(res => res.json())
      .then(rawData => {
        const processedData = rawData.map((point, index) => ({
          ...point,
          originalRatio: point.ratio, // Store original for calculations
          deltaPercent: index > 0 ? ((point.ratio - rawData[index - 1].ratio) / rawData[index - 1].ratio * 100).toFixed(2) : null
        }));
        setData(processedData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Memoized processed data for graph based on selected type
  const processedGraphData = useMemo(() => {
    return data.map((point, index) => {
      const ratio = selectedRatioType === 'sushi_xsushi' ? point.originalRatio : 1 / point.originalRatio;
      let deltaPercent = selectedRatioType === 'sushi_xsushi' 
        ? point.deltaPercent 
        : (index > 0 ? (((1 / point.originalRatio) - (1 / data[index - 1].originalRatio)) / (1 / data[index - 1].originalRatio) * 100).toFixed(2) : null);
      return { ...point, ratio, deltaPercent };
    });
  }, [data, selectedRatioType]);

  // Custom tooltip with date, value, and change %
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const date = format(parseISO(label), 'MMM dd, yyyy HH:mm');
      const delta = payload[0].payload.deltaPercent;
      const deltaColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#6b7280';
      const ratioLabel = selectedRatioType === 'xsushi_sushi' ? 'xSushi/Sushi' : 'Sushi/xSushi';
      return (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '12px',
          color: '#e2e8f0',
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{date}</p>
          <p style={{ margin: 0 }}>{ratioLabel}: {value.toFixed(4)}</p>
          {delta !== null && (
            <p style={{ margin: '4px 0 0 0', color: deltaColor }}>
              Change: {delta > 0 ? '+' : ''}{delta}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) return <div style={{ color: '#e2e8f0', padding: '20px' }}>Loading data...</div>;
  if (error) return <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>;

  // Dynamic Y-axis domain based on ratio type
  const ratios = processedGraphData.map(d => d.ratio);
  let minRatio, maxRatio;
  if (selectedRatioType === 'sushi_xsushi') {
    minRatio = Math.min(...ratios) - 0.005;
    maxRatio = 0.65;
  } else {
    minRatio = 1 / 0.65; // ~1.5385, fixed min
    maxRatio = Math.max(...ratios) + 0.005; // Buffer above for growing
  }
  const yDomain = [minRatio, maxRatio];

  const currentValue = data.length > 0 ? processedGraphData[processedGraphData.length - 1].ratio.toFixed(4) : 'N/A';
  const ratioLabel = selectedRatioType === 'xsushi_sushi' ? 'xSushi/Sushi' : 'Sushi/xSushi';

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 15px 0', color: '#00d4ff' }}>
        SushiSwap Stake xSushi Ratio Changes
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '15px 0 10px 0' }}>
        <select
          value={selectedRatioType}
          onChange={(e) => setSelectedRatioType(e.target.value)}
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#94a3b8',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="xsushi_sushi">xSushi/Sushi</option>
          <option value="sushi_xsushi">Sushi/xSushi</option>
        </select>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#94a3b8' }}>
          Current value: {currentValue}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={processedGraphData}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(date) => format(parseISO(date), 'MMM dd, yyyy')} 
            angle={-20} 
            height={70}
            tick={{ fill: '#94a3b8', fontSize: '10px' }}
            stroke="#475569"
          />
          <YAxis 
            domain={yDomain}
            tickFormatter={(value) => value.toFixed(4)}
            tick={{ fill: '#94a3b8', fontSize: '12px' }}
            stroke="#475569"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="ratio" 
            stroke="#00d4ff" 
            strokeWidth={3} 
            dot={{ fill: '#00d4ff', strokeWidth: 2, r: 6 }} 
            activeDot={{ r: 8, stroke: '#00d4ff', strokeWidth: 2 }}
          />
          <Brush
            dataKey="timestamp"
            height={30}
            stroke="#475569"
            fill="#1e293b"
            tickFormatter={(value) => format(parseISO(value), 'dd-MM-yyyy')}
            tick={{ fill: '#94a3b8', fontSize: '10px' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <a href="https://t.me/xsushi_ratio_changes_bot" style={{ 
        margin: '10px 0 0 0', 
        fontSize: '18px', 
        fontWeight: 'bold', 
        color: '#00d4ff', 
        textDecoration: 'none', 
        cursor: 'pointer',
        display: 'block'
      }} 
      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
      >
        Press to get instant notifications about reward distribution
      </a>
      <a href="https://github.com/petervs2/xsushi" style={{ 
        margin: '5px 0 0 0', 
        fontSize: '14px', 
        fontWeight: 'normal', 
        color: '#94a3b8', 
        textDecoration: 'none', 
        cursor: 'pointer',
        display: 'block'
      }} 
      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
      >
        🐙 View source on GitHub
      </a>
    </div>
  );
}

export default App;