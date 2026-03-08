import { useState, useCallback, useRef } from 'react';

export interface SearchResult {
  commit: {
    hash: string;
    shortHash: string;
    message: string;
    body: string;
    author: string;
    email: string;
    date: string;
    timestamp: number;
    files: string[];
    diff: string;
    additions: number;
    deletions: number;
  };
  score: number;
  relevantLines: string[];
}

export interface SearchFilters {
  author?: string;
  since?: string;
  until?: string;
  files?: string;
  limit: number;
}

export interface UseSearchReturn {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  lastQuery: string;
  search: (query: string, filters?: Partial<SearchFilters>) => Promise<void>;
  clear: () => void;
}

export function useSearch(): UseSearchReturn {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string, filters: Partial<SearchFilters> = {}) => {
    if (!query.trim()) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setLastQuery(query);

    const params = new URLSearchParams({ q: query });
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.author) params.set('author', filters.author);
    if (filters.since) params.set('since', filters.since);
    if (filters.until) params.set('until', filters.until);
    if (filters.files) params.set('files', filters.files);

    try {
      const res = await fetch(`/api/search?${params}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as { results?: SearchResult[]; error?: string };

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results ?? []);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Search failed: ${msg}`);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setError(null);
    setHasSearched(false);
    setLastQuery('');
  }, []);

  return { results, loading, error, hasSearched, lastQuery, search, clear };
}
