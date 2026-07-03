import { useState, useEffect, useCallback } from 'react';

export interface CurrencyStrengthData {
  currency: string;
  strength: number;
  trend: 'up' | 'down' | 'neutral';
  lastUpdate: Date;
}

const CACHE_KEY = 'currency_strength_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useCurrencyStrength() {
  const [data, setData] = useState<CurrencyStrengthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrencyStrength = useCallback(async () => {
    try {
      // Check cache first (browser only)
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setData(cachedData);
            setLoading(false);
            return;
          }
        }
      }

      // Fetch from API
      const response = await fetch('/api/currency-strength');
      if (!response.ok) throw new Error('Failed to fetch currency strength');

      const result = await response.json();
      
      // Transform API response to component format
      const strengthData: CurrencyStrengthData[] = Object.entries(result.strength || {}).map(([currency, strength]) => {
        const numStrength = strength as number;
        const trendValue: 'up' | 'down' | 'neutral' = numStrength > 0 ? 'up' : numStrength < 0 ? 'down' : 'neutral';
        return {
          currency,
          strength: numStrength,
          trend: trendValue,
          lastUpdate: new Date(result.timestamp),
        };
      });

      // Cache the result (browser only)
      if (typeof window !== 'undefined') {
        const cacheData = strengthData.map(item => ({
          ...item,
          lastUpdate: item.lastUpdate.toISOString(),
        }));
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            data: cacheData,
            timestamp: Date.now(),
          })
        );
      }

      setData(strengthData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Currency strength fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrencyStrength();
    const interval = setInterval(fetchCurrencyStrength, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchCurrencyStrength]);

  return { data, loading, error, refetch: fetchCurrencyStrength };
}
