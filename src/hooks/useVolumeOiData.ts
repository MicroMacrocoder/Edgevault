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
      const url = market ? `/api/volume-oi?symbol=${market}` : '/api/volume-oi';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch Volume/OI data');

      const result = await response.json();
      
      // Group data by symbol and calculate trends
      const dataBySymbol: Record<string, any[]> = {};
      (result.data || []).forEach((item: any) => {
        if (!dataBySymbol[item.symbol]) dataBySymbol[item.symbol] = [];
        dataBySymbol[item.symbol].push(item);
      });
      
      // Transform API response to component format
      const volumeOiData: VolumeOiData[] = Object.entries(dataBySymbol).map(([symbol, records]) => {
        const sorted = records.sort((a: any, b: any) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime());
        const latest = sorted[0];
        const previous = sorted[1] || latest;
        
        const volumeChange = ((latest.volume - previous.volume) / previous.volume) * 100;
        const oiChange = ((latest.open_interest - previous.open_interest) / previous.open_interest) * 100;
        
        const volumeTrendValue: 'increasing' | 'decreasing' | 'stable' = volumeChange > 5 ? 'increasing' : volumeChange < -5 ? 'decreasing' : 'stable';
        const oiTrendValue: 'increasing' | 'decreasing' | 'stable' = oiChange > 5 ? 'increasing' : oiChange < -5 ? 'decreasing' : 'stable';
        
        return {
          market: symbol,
          volumeTrend: volumeTrendValue,
          volumeChange,
          oiTrend: oiTrendValue,
          oiChange,
          lastUpdate: new Date(latest.updated_at || latest.trade_date),
        };
      });

      // Cache the result (browser only)
      if (typeof window !== 'undefined') {
        const cacheData = volumeOiData.map(item => ({
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
