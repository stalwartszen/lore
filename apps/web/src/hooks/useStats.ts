import { useState, useEffect } from 'react';

export interface IndexStats {
  totalCommits: number;
  lastIndexed: string;
  dbSize: string;
}

export function useStats() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as IndexStats | { error: string };

        if (cancelled) return;

        if ('error' in data) {
          setError(data.error);
        } else {
          setStats(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
