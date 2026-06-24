// App-wide constants. Extracted to remove magic numbers scattered across the UI.

// Chart Y-axis bounds. The xSushi/Sushi ratio historically stays below this cap.
export const RATIO_UPPER_BOUND = 0.65;
// Padding added around min/max when computing the Y-axis domain.
export const RATIO_AXIS_PADDING = 0.005;
// Minimum ratio delta (in ratio units) considered a meaningful change.
export const RATIO_CHANGE_THRESHOLD = 0.0001;

// Ratio view types. The API stores the Sushi/xSushi ratio as the canonical value;
// "xsushi_sushi" is its inverse (1 / ratio), shown growing over time.
export const RATIO_TYPES = {
  XSUSHI_SUSHI: 'xsushi_sushi',
  SUSHI_XSUSHI: 'sushi_xsushi',
};

// Period presets for client-side filtering. `days: null` means "all history".
// Default is "All" because distributions happen rarely (monthly/quarterly).
export const PERIODS = [
  { id: 'all', label: 'All', days: null },
  { id: '1y', label: '1y', days: 365 },
  { id: '3m', label: '3m', days: 90 },
];
export const DEFAULT_PERIOD = 'all';

// WETH heatmap bar settings.
export const WETH_MAX = 30;
export const WETH_MARKERS = [10, 20];

// Backend API endpoints.
export const ENDPOINTS = {
  RATIO_DATA: '/api/ratio-data',
  BALANCE: '/api/balance',
};

// External links.
export const LINKS = {
  BOT: 'https://t.me/xsushi_ratio_changes_bot',
  GITHUB: 'https://github.com/petervs2/xsushi',
  CHART: 'https://xsushi.mywire.org',
};

// SSR data injected by the FastAPI backend into index.html (see main.py root()).
// Shape: { ratioData: [{timestamp, ratio}], balanceData: {balance_usd, weth_balance} }
export function getInitialData() {
  return typeof window !== 'undefined' ? window.__INITIAL_DATA__ : undefined;
}
