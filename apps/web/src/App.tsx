import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Commit {
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
}

interface SearchResult {
  commit: Commit;
  score: number;
  relevantLines: string[];
}

interface Repository {
  id: string;
  name: string;
  path: string;
  totalCommits: number;
  isIndexing: boolean;
  lastIndexed: string | null;
}

interface ServerStats {
  totalRepos: number;
  totalCommits: number;
  totalSearches: number;
  recentSearches: Array<{ query: string; createdAt: string }>;
  topQueries: Array<{ query: string; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function avatarColor(name: string): string {
  const colors = ['#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#f78166', '#39d353'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length]!;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.75 ? '#3fb950' : score >= 0.55 ? '#d29922' : '#58a6ff';
  const barWidth = Math.min(100, Math.max(0, pct));
  return (
    <span className="score-badge" style={{ borderColor: color, color }}>
      <span
        className="score-bar-fill"
        style={{ width: `${barWidth}%`, background: color }}
      />
      <span className="score-text">{pct}%</span>
    </span>
  );
}

// ─── Diff Viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ diff, relevantLines }: { diff: string; relevantLines: string[] }) {
  const relevantSet = new Set(relevantLines);

  if (!diff.trim()) {
    return <p className="diff-empty">No diff available for this commit.</p>;
  }

  const lines = diff.split('\n');

  return (
    <div className="diff-viewer">
      {lines.map((line, i) => {
        let cls = 'diff-line';
        if (line.startsWith('+++') || line.startsWith('---')) cls += ' diff-file-header';
        else if (line.startsWith('+')) cls += ' diff-add';
        else if (line.startsWith('-')) cls += ' diff-del';
        else if (line.startsWith('@@')) cls += ' diff-hunk';
        else if (line.startsWith('diff ') || line.startsWith('index ')) cls += ' diff-meta';

        if (relevantSet.has(line)) cls += ' diff-highlight';

        return (
          <div key={i} className={cls}>
            <span className="diff-ln">{i + 1}</span>
            <span className="diff-text">{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Commit Card ─────────────────────────────────────────────────────────────

function CommitCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: SearchResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { commit, score, relevantLines } = result;
  const color = avatarColor(commit.author);

  return (
    <div className={`commit-card ${isExpanded ? 'expanded' : ''}`}>
      <div
        className="commit-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        <div className="commit-header-left">
          <div className="author-avatar" style={{ background: color + '22', borderColor: color + '55', color }}>
            {initials(commit.author)}
          </div>
          <div className="commit-title-group">
            <span className="commit-hash">{commit.shortHash}</span>
            <span className="commit-message">{commit.message}</span>
          </div>
        </div>
        <div className="commit-header-right">
          <ScoreBar score={score} />
          <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div className="commit-meta">
        <span className="meta-author">{commit.author}</span>
        <span className="meta-sep">·</span>
        <span className="meta-date" title={commit.date}>{formatRelativeDate(commit.date)}</span>
        <span className="meta-sep">·</span>
        <span className="meta-date">{commit.date.slice(0, 10)}</span>
        {(commit.additions > 0 || commit.deletions > 0) && (
          <>
            <span className="meta-sep">·</span>
            {commit.additions > 0 && <span className="stat-add">+{commit.additions}</span>}
            {commit.deletions > 0 && <span className="stat-del">−{commit.deletions}</span>}
          </>
        )}
      </div>

      {commit.files.length > 0 && (
        <div className="commit-files">
          {commit.files.slice(0, 6).map((f) => (
            <span key={f} className="file-chip">{f}</span>
          ))}
          {commit.files.length > 6 && (
            <span className="file-chip file-chip-more">+{commit.files.length - 6} more</span>
          )}
        </div>
      )}

      {relevantLines.length > 0 && !isExpanded && (
        <div className="relevant-lines">
          {relevantLines.slice(0, 4).map((line, i) => (
            <div key={i} className={`relevant-line ${line.startsWith('+') ? 'add' : 'del'}`}>
              {line.length > 100 ? line.slice(0, 100) + '…' : line}
            </div>
          ))}
        </div>
      )}

      {commit.body && !isExpanded && (
        <p className="commit-body">
          {commit.body.trim().slice(0, 160)}{commit.body.length > 160 ? '…' : ''}
        </p>
      )}

      {isExpanded && (
        <div className="commit-expanded">
          {commit.body && (
            <div className="commit-body-full">
              <h4>Commit Message</h4>
              <pre>{commit.body.trim()}</pre>
            </div>
          )}
          <div className="diff-section">
            <h4>Diff</h4>
            <DiffViewer diff={commit.diff} relevantLines={relevantLines} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  author: string;
  since: string;
  until: string;
  limit: string;
  repositoryId: string;
}

function FilterBar({
  filters,
  repos,
  onChange,
}: {
  filters: Filters;
  repos: Repository[];
  onChange: (f: Filters) => void;
}) {
  const update =
    (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filter-bar">
      {repos.length > 1 && (
        <label className="filter-field">
          <span>Repository</span>
          <select value={filters.repositoryId} onChange={update('repositoryId')}>
            <option value="">All repos</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="filter-field">
        <span>Author</span>
        <input type="text" placeholder="any" value={filters.author} onChange={update('author')} />
      </label>
      <label className="filter-field">
        <span>Since</span>
        <input type="date" value={filters.since} onChange={update('since')} />
      </label>
      <label className="filter-field">
        <span>Until</span>
        <input type="date" value={filters.until} onChange={update('until')} />
      </label>
      <label className="filter-field">
        <span>Results</span>
        <select value={filters.limit} onChange={update('limit')}>
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  stats,
  repos,
  onQueryClick,
}: {
  stats: ServerStats | null;
  repos: Repository[];
  onQueryClick: (q: string) => void;
}) {
  return (
    <aside className="sidebar">
      {repos.length > 0 && (
        <section className="sidebar-section">
          <h3 className="sidebar-title">Repositories</h3>
          {repos.map((r) => (
            <div key={r.id} className="sidebar-repo">
              <div className="sidebar-repo-name">
                {r.name}
                {r.isIndexing && <span className="indexing-dot" title="Indexing..." />}
              </div>
              <div className="sidebar-repo-meta">
                {r.totalCommits.toLocaleString()} commits
                {r.lastIndexed && ` · ${formatRelativeDate(r.lastIndexed)}`}
              </div>
            </div>
          ))}
        </section>
      )}

      {stats && stats.topQueries.length > 0 && (
        <section className="sidebar-section">
          <h3 className="sidebar-title">Popular searches</h3>
          {stats.topQueries.slice(0, 8).map((q, i) => (
            <button
              key={i}
              className="sidebar-query"
              onClick={() => onQueryClick(q.query)}
              title={`Searched ${q.count}x`}
            >
              <span className="sidebar-query-text">{q.query}</span>
              <span className="sidebar-query-count">{q.count}</span>
            </button>
          ))}
        </section>
      )}

      {stats && stats.recentSearches.length > 0 && (
        <section className="sidebar-section">
          <h3 className="sidebar-title">Recent searches</h3>
          {stats.recentSearches.slice(0, 5).map((s, i) => (
            <button
              key={i}
              className="sidebar-query"
              onClick={() => onQueryClick(s.query)}
            >
              <span className="sidebar-query-text">{s.query}</span>
              <span className="sidebar-query-count muted">{formatRelativeDate(s.createdAt)}</span>
            </button>
          ))}
        </section>
      )}
    </aside>
  );
}

// ─── Rotating placeholder ─────────────────────────────────────────────────────

const EXAMPLE_QUERIES = [
  'when did we remove rate limiting from auth',
  'who introduced the feature flag system',
  'every database migration in Q1',
  'when was the payment flow refactored',
  'who added the retry logic to the queue',
  'when did we switch from REST to GraphQL',
  'who removed the legacy caching layer',
];

function useRotatingPlaceholder(): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % EXAMPLE_QUERIES.length), 3500);
    return () => clearInterval(id);
  }, []);
  return EXAMPLE_QUERIES[idx] ?? EXAMPLE_QUERIES[0]!;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ provider: string; durationMs: number } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    author: '',
    since: '',
    until: '',
    limit: '10',
    repositoryId: '',
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const placeholder = useRotatingPlaceholder();

  // Load server data on mount
  useEffect(() => {
    const loadServerData = async () => {
      try {
        const [statsRes, reposRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/repositories'),
        ]);
        if (statsRes.ok) {
          const s = await statsRes.json() as ServerStats;
          setStats(s);
        }
        if (reposRes.ok) {
          const r = await reposRes.json() as Repository[];
          setRepos(r);
        }
        setServerOnline(true);
      } catch {
        setServerOnline(false);
      }
    };

    void loadServerData();
    inputRef.current?.focus();

    // Poll for indexing updates every 5s
    const id = setInterval(() => { void loadServerData(); }, 5000);
    return () => clearInterval(id);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setHasSearched(true);
      setExpandedHash(null);
      setSearchMeta(null);

      const params = new URLSearchParams({ q, limit: filters.limit });
      if (filters.repositoryId) params.set('repositoryId', filters.repositoryId);
      if (filters.author) params.set('author', filters.author);
      if (filters.since) params.set('since', filters.since);
      if (filters.until) params.set('until', filters.until);

      try {
        const res = await fetch(`/api/search?${params}`, {
          signal: abortRef.current.signal,
        });
        const data = (await res.json()) as {
          results?: SearchResult[];
          error?: string;
          provider?: string;
          durationMs?: number;
        };

        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.results ?? []);
          if (data.provider !== undefined && data.durationMs !== undefined) {
            setSearchMeta({ provider: data.provider, durationMs: data.durationMs });
          }
        }

        // Refresh stats after a search (async)
        fetch('/api/stats')
          .then(r => r.json())
          .then((s: unknown) => setStats(s as ServerStats))
          .catch(() => {});
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Search failed. Is the Lore server running?');
        }
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void search(query);
  };

  const handleQueryClick = (q: string) => {
    setQuery(q);
    void search(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setSearchMeta(null);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-text">Lore</span>
            <span className="logo-tagline">team git memory</span>
          </div>
          <div className="header-right">
            {serverOnline !== null && (
              <span className={`server-badge ${serverOnline ? 'online' : 'offline'}`}>
                <span className="server-dot" />
                {serverOnline ? 'Server online' : 'Server offline'}
              </span>
            )}
            {stats && (
              <div className="header-stats">
                <span className="stat-pill">
                  {stats.totalRepos} repo{stats.totalRepos !== 1 ? 's' : ''}
                </span>
                <span className="stat-pill">
                  {stats.totalCommits.toLocaleString()} commits
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <Sidebar stats={stats} repos={repos} onQueryClick={handleQueryClick} />

        {/* Main content */}
        <main className="app-main">
          <div className="search-container">
            <form onSubmit={handleSubmit} className="search-form">
              <div className="search-bar">
                <span className="search-icon">⌕</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={() => {
                      setQuery('');
                      setResults([]);
                      setHasSearched(false);
                      setSearchMeta(null);
                      inputRef.current?.focus();
                    }}
                  >
                    ✕
                  </button>
                )}
                <button
                  type="submit"
                  className="search-btn"
                  disabled={loading || !query.trim()}
                >
                  {loading ? <span className="spinner" /> : 'Search'}
                </button>
              </div>

              <div className="search-options">
                <button
                  type="button"
                  className={`filter-toggle ${showFilters ? 'active' : ''}`}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  Filters
                </button>
                <span className="search-hint">Enter to search · Esc to clear</span>
                {searchMeta && (
                  <span className="search-timing">
                    {searchMeta.durationMs}ms
                    {searchMeta.provider !== 'none' && (
                      <> · re-ranked by <strong>{searchMeta.provider}</strong></>
                    )}
                  </span>
                )}
              </div>

              {showFilters && (
                <FilterBar filters={filters} repos={repos} onChange={setFilters} />
              )}
            </form>

            {/* Example queries shown before first search */}
            {!hasSearched && (
              <div className="examples">
                <p className="examples-label">Try searching for:</p>
                <div className="example-chips">
                  {[
                    'when did we add authentication',
                    'who refactored the database layer',
                    'every time we changed the API',
                    'when was rate limiting removed',
                    'initial setup of CI/CD pipeline',
                  ].map((ex) => (
                    <button
                      key={ex}
                      className="example-chip"
                      onClick={() => {
                        setQuery(ex);
                        void search(ex);
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="results-section">
            {error && (
              <div className="error-banner">
                <strong>Error:</strong> {error}
                {error.includes('server running') && (
                  <p className="error-hint">
                    Start with: <code>docker compose up -d</code>
                  </p>
                )}
              </div>
            )}

            {hasSearched && !loading && !error && results.length === 0 && (
              <div className="empty-state">
                <p className="empty-title">No results found</p>
                <p className="empty-sub">
                  Try different keywords or remove filters.{' '}
                  {repos.length === 0 && (
                    <>Add a repo first: <code>lore add-repo /path/to/repo</code></>
                  )}
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div className="results-header">
                <span className="results-count">
                  {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
                  <em>"{query}"</em>
                </span>
                {expandedHash && (
                  <button className="collapse-btn" onClick={() => setExpandedHash(null)}>
                    Collapse all
                  </button>
                )}
              </div>
            )}

            <div className="results-list">
              {results.map((result) => (
                <CommitCard
                  key={result.commit.hash}
                  result={result}
                  isExpanded={expandedHash === result.commit.hash}
                  onToggle={() =>
                    setExpandedHash((h) =>
                      h === result.commit.hash ? null : result.commit.hash
                    )
                  }
                />
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <span>
          Lore · Local embeddings via <code>all-MiniLM-L6-v2</code> · Team server
        </span>
      </footer>
    </div>
  );
}
