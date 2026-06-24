// Data hook for ratio history.
//
// SSR-aware: if the FastAPI backend injected `window.__INITIAL_DATA__.ratioData`
// (bot requests get server-rendered data for SEO), we use it directly and skip
// the client fetch — matching the original App.js behaviour. Regular users fetch
// `/api/ratio-data` on mount.

import { useEffect, useState, useCallback } from 'react';
import { ENDPOINTS, getInitialData } from '../constants';
import { processRawData } from '../utils/ratio';

const SSR_DATA = getInitialData()?.ratioData;

export function useRatioData() {
  const [data, setData] = useState(() => (SSR_DATA ? processRawData(SSR_DATA) : []));
  const [loading, setLoading] = useState(!SSR_DATA);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINTS.RATIO_DATA);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setData(processRawData(raw));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // SSR already provided the data — no client fetch needed.
    if (SSR_DATA) return;
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
