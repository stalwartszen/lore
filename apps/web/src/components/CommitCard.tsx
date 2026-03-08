import React from 'react';

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

interface CommitCardProps {
  result: SearchResult;
  isExpanded: boolean;
  onToggle: () => void;
}

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

export function CommitCard({ result, isExpanded, onToggle }: CommitCardProps) {
  const { commit, score, relevantLines } = result;
  const pct = Math.round(score * 100);
  const scoreColor = score >= 0.75 ? '#3fb950' : score >= 0.55 ? '#d29922' : '#58a6ff';

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
          <span className="commit-hash">{commit.shortHash}</span>
          <span className="commit-message">{commit.message}</span>
        </div>
        <div className="commit-header-right">
          <span
            className="score-badge"
            style={{ borderColor: scoreColor, color: scoreColor }}
          >
            {pct}%
          </span>
          <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      <div className="commit-meta">
        <span className="meta-author">{commit.author}</span>
        <span className="meta-sep">·</span>
        <span className="meta-date" title={commit.date}>
          {formatRelativeDate(commit.date)}
        </span>
        <span className="meta-sep">·</span>
        <span className="meta-date">{commit.date.slice(0, 10)}</span>
        {(commit.additions > 0 || commit.deletions > 0) && (
          <>
            <span className="meta-sep">·</span>
            {commit.additions > 0 && (
              <span className="stat-add">+{commit.additions}</span>
            )}
            {commit.deletions > 0 && (
              <span className="stat-del">−{commit.deletions}</span>
            )}
          </>
        )}
      </div>

      {commit.files.length > 0 && (
        <div className="commit-files">
          {commit.files.slice(0, 6).map((f) => (
            <span key={f} className="file-chip">
              {f}
            </span>
          ))}
          {commit.files.length > 6 && (
            <span className="file-chip file-chip-more">
              +{commit.files.length - 6} more
            </span>
          )}
        </div>
      )}

      {relevantLines.length > 0 && !isExpanded && (
        <div className="relevant-lines">
          {relevantLines.slice(0, 4).map((line, i) => (
            <div
              key={i}
              className={`relevant-line ${line.startsWith('+') ? 'add' : 'del'}`}
            >
              {line.length > 100 ? line.slice(0, 100) + '…' : line}
            </div>
          ))}
        </div>
      )}

      {commit.body && !isExpanded && (
        <p className="commit-body">
          {commit.body.trim().slice(0, 160)}
          {commit.body.length > 160 ? '…' : ''}
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
