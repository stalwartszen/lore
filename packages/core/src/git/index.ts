import { simpleGit } from 'simple-git';
import type { Commit } from '../types/index.js';

export interface GitExtractOptions {
  maxCommits?: number;
  since?: string;
  branch?: string;
}

export class GitExtractor {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  // Returns commit hashes present in the repo
  async getCommitHashes(options: GitExtractOptions = {}): Promise<string[]> {
    const git = simpleGit(this.repoPath);
    const args: string[] = ['--all', '--no-merges', '--format=%H'];
    if (options.maxCommits) args.push(`--max-count=${options.maxCommits}`);
    if (options.since) args.push(`--since=${options.since}`);

    const result = await git.raw(['log', ...args]);
    return result.split('\n').filter(h => h.trim().length === 40);
  }

  async getCommit(hash: string): Promise<Commit | null> {
    const git = simpleGit(this.repoPath);
    try {
      // Get commit metadata
      const format = await git.raw(['show', hash, '--no-patch', '--format=%H|%h|%s|%b|%an|%ae|%aI|%at']);
      const lines = format.split('\n').filter(l => l.trim());
      const firstLine = lines[0];
      if (!firstLine) return null;

      const parts = firstLine.split('|');
      if (parts.length < 8) return null;

      const [fullHash, shortHash, message, body, author, email, date, tsStr] = parts;

      // Get diff
      let diff = '';
      let additions = 0;
      let deletions = 0;
      let files: string[] = [];

      try {
        diff = await git.raw(['show', hash, '--unified=2', '--no-color', '--', '*.ts', '*.js', '*.py', '*.go', '*.rs', '*.java', '*.rb', '*.php', '*.cs', '*.cpp', '*.c', '*.md']);
        diff = diff.slice(0, 4000);

        const stat = await git.raw(['show', hash, '--stat', '--no-patch', '--no-color']);
        const addM = stat.match(/(\d+) insertion/);
        const delM = stat.match(/(\d+) deletion/);
        additions = addM ? parseInt(addM[1]!) : 0;
        deletions = delM ? parseInt(delM[1]!) : 0;

        const nameOnly = await git.raw(['show', hash, '--name-only', '--no-patch', '--no-color']);
        files = nameOnly.split('\n').filter(f => f.trim() && !f.match(/^(commit|Author|Date|Merge)/)).slice(0, 30);
      } catch { /* skip diff on error */ }

      return {
        hash: fullHash ?? hash,
        shortHash: shortHash ?? hash.slice(0, 7),
        message: (message ?? '').trim(),
        body: (body ?? '').trim(),
        author: author ?? 'Unknown',
        email: email ?? '',
        date: date ?? new Date().toISOString(),
        timestamp: parseInt(tsStr ?? '0') || Math.floor(Date.now() / 1000),
        files,
        diff,
        additions,
        deletions,
      };
    } catch {
      return null;
    }
  }
}
