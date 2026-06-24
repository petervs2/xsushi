// Data hook for the treasury balance (fees awaiting distribution).
//
// SSR-aware: uses `window.__INITIAL_DATA__.balanceData` when present (bot SEO
// path), otherwise fetches `/api/balance` on mount. Exposes `refetch` for retry.

import { useEffect, useState, useCallback } from 'react';
import { ENDPOINTS, getInitialData } from '../constants';

const SSR_DATA = getInitialData()?.balanceData;
const EMPTY_BALANCE = { balance_usd: 0, weth_balance: 0 };

export function useBalance() {
  const [balance, setBalance] = useState(() => SSR_DATA ?? null);
  const [loading, setLoading] = useState(!SSR_DATA);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINTS.BALANCE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBalance(data ?? EMPTY_BALANCE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (SSR_DATA) return;
    load();
  }, [load]);

  return { balance, loading, error, refetch: load };
}
