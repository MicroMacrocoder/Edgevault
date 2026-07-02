import { useState, useEffect, useCallback } from 'react';

export interface CotDataPoint {
  market: string;
  commercialBias: 'bullish' | 'bearish' | 'neutral';
  commercialNetPosition: number;
  retailBias: 'bullish' | 'bearish' | 'neutral';
  retailNetPosition: number;
  lastUpdate: Date;
}

const CACHE_KEY = 'cot_data_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export function useCotData(market?: string) {
  const [data, setData] = useState<CotDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCotData = useCallback(async () => {
    try {
      // Check cache first (browser only)
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            if (market) {
              setData(cachedData.filter((d: CotDataPoint) => d.market === market));
            } else {
              setData(cachedData);
            }
            setLoading(false);
            return;
          }
        }
      }

      // Fetch from API
      const url = market ? `/api/cot-data?market=${market}` : '/api/cot-data';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch COT data');

      const result = await response.json();
      const cotData = result.data || [];

      // Cache the result (browser only)
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            data: cotData,
            timestamp: Date.now(),
          })
        );
      }

      setData(cotData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('COT data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    fetchCotData();
    const interval = setInterval(fetchCotData, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchCotData]);

  return { data, loading, error, refetch: fetchCotData };
}
