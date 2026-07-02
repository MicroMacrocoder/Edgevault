import { useState, useEffect, useCallback } from 'react';

export interface VolumeOiData {
  market: string;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  volumeChange: number;
  oiTrend: 'increasing' | 'decreasing' | 'stable';
  oiChange: number;
  lastUpdate: Date;
}

const CACHE_KEY = 'volume_oi_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function useVolumeOiData(market?: string) {
  const [data, setData] = useState<VolumeOiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVolumeOiData = useCallback(async () => {
    try {
      // Check cache first (browser only)
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            if (market) {
              setData(cachedData.filter((d: VolumeOiData) => d.market === market));
            } else {
              setData(cachedData);
            }
            setLoading(false);
            return;
          }
        }
      }

      // Fetch from API
      const url = market ? `/api/volume-oi?market=${market}` : '/api/volume-oi';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch Volume/OI data');

      const result = await response.json();
      const volumeOiData = result.data || [];

      // Cache the result (browser only)
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            data: volumeOiData,
            timestamp: Date.now(),
          })
        );
      }

      setData(volumeOiData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Volume/OI data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    fetchVolumeOiData();
    const interval = setInterval(fetchVolumeOiData, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchVolumeOiData]);

  return { data, loading, error, refetch: fetchVolumeOiData };
}
