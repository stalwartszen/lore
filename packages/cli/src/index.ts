#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(os.homedir(), '.lore', 'config.json');

interface CliConfig {
  serverUrl: string;
}

function loadCliConfig(): CliConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as CliConfig;
    }
  } catch { /* ignore */ }
  return { serverUrl: 'http://localhost:3000' };
}

function saveCliConfig(config: Partial<CliConfig>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = loadCliConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, ...config }, null, 2));
}

async function api(endpoint: string, options?: RequestInit): Promise<unknown> {
  const config = loadCliConfig();
  const url = `${config.serverUrl}${endpoint}`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function printDivider(): void {
  console.log(chalk.gray('  ' + '─'.repeat(62)));
}

// SEARCH command
program
  .command('search <query>')
  .description('Search git history in natural language')
  .option('-n, --limit <n>', 'number of results', '10')
  .option('-r, --repo <id>', 'filter by repository ID')
  .option('--author <name>', 'filter by author')
  .option('--since <date>', 'commits after date (YYYY-MM-DD)')
  .option('--until <date>', 'commits before date (YYYY-MM-DD)')
  .option('--files <pattern>', 'filter by file path')
  .action(async (
    query: string,
    opts: { limit: string; repo?: string; author?: string; since?: string; until?: string; files?: string }
  ) => {
    const spinner = ora({ text: 'Searching...', color: 'cyan' }).start();
    try {
      const params = new URLSearchParams({ q: query, limit: opts.limit });
      if (opts.repo) params.set('repositoryId', opts.repo);
      if (opts.author) params.set('author', opts.author);
      if (opts.since) params.set('since', opts.since);
      if (opts.until) params.set('until', opts.until);
      if (opts.files) params.set('files', opts.files);

      const data = await api(`/api/search?${params}`) as {
        results: Array<{
          commit: {
            shortHash: string;
            message: string;
            author: string;
            date: string;
            files: string[];
            diff: string;
            additions: number;
            deletions: number;
          };
          score: number;
          relevantLines: string[];
        }>;
        provider: string;
        durationMs: number;
      };

      spinner.stop();

      if (data.results.length === 0) {
        console.log(chalk.yellow(`\n  No results for "${query}"\n`));
        return;
      }

      const providerBadge = data.provider !== 'none' ? chalk.dim(` · re-ranked by ${data.provider}`) : '';
      console.log(chalk.bold(`\n  "${query}"`) + chalk.gray(`  ${data.results.length} results · ${data.durationMs}ms${providerBadge}\n`));
      console.log(chalk.gray('  ' + '─'.repeat(60) + '\n'));

      for (const r of data.results) {
        const score = Math.round(r.score * 100);
        const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.gray;
        console.log(chalk.bold.cyan(`  ${r.commit.shortHash}`) + '  ' + chalk.white(r.commit.message));
        console.log(
          chalk.gray(`  ${r.commit.author} · ${formatDate(r.commit.date)} · `) +
          scoreColor(`${score}% match`)
        );
        if (r.commit.files.length) {
          console.log(chalk.dim(`  ${r.commit.files.slice(0, 4).join('  ')}`));
        }
        if (r.commit.additions > 0 || r.commit.deletions > 0) {
          const adds = r.commit.additions > 0 ? chalk.green(`+${r.commit.additions}`) : '';
          const dels = r.commit.deletions > 0 ? chalk.red(`-${r.commit.deletions}`) : '';
          console.log(`  ${adds}${adds && dels ? chalk.gray(' / ') : ''}${dels}`);
        }
        if (r.relevantLines.length) {
          for (const line of r.relevantLines.slice(0, 3)) {
            const color = line.startsWith('+') ? chalk.green : chalk.red;
            console.log(chalk.gray('  │ ') + color(line.slice(0, 100)));
          }
        }
        console.log();
      }
    } catch (err) {
      spinner.fail(chalk.red(`${err instanceof Error ? err.message : String(err)}`));
      if (String(err).includes('ECONNREFUSED')) {
        console.log(chalk.dim(`\n  Is the Lore server running? Start with: docker compose up -d\n`));
      }
      process.exit(1);
    }
  });

// REPOS command
program
  .command('repos')
  .description('List indexed repositories')
  .action(async () => {
    try {
      const repos = await api('/api/repositories') as Array<{
        id: string;
        name: string;
        path: string;
        totalCommits: number;
        isIndexing: boolean;
        lastIndexed: string | null;
      }>;
      if (!repos.length) {
        console.log(chalk.gray('\n  No repositories indexed yet.\n'));
        console.log(chalk.dim('  Add one: lore add-repo /path/to/repo\n'));
        return;
      }
      console.log(chalk.bold('\n  Repositories\n'));
      printDivider();
      for (const r of repos) {
        const status = r.isIndexing ? chalk.yellow(' (indexing...)') : '';
        console.log(`  ${chalk.cyan(r.id.slice(0, 8))}  ${chalk.bold(r.name)}${status}`);
        console.log(chalk.gray(`           ${r.path}`));
        console.log(chalk.gray(`           ${r.totalCommits.toLocaleString()} commits  ·  last indexed: ${r.lastIndexed ? formatDate(r.lastIndexed) : 'never'}`));
        console.log();
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`));
      if (String(err).includes('ECONNREFUSED')) {
        console.log(chalk.dim(`  Is the Lore server running? Start with: docker compose up -d\n`));
      }
      process.exit(1);
    }
  });

// ADD-REPO command
program
  .command('add-repo <path>')
  .description('Add and index a repository')
  .option('--name <name>', 'repository name (defaults to folder name)')
  .action(async (repoPath: string, opts: { name?: string }) => {
    const name = opts.name ?? path.basename(repoPath);
    const spinner = ora(`Adding ${name}...`).start();
    try {
      const repo = await api('/api/repositories', {
        method: 'POST',
        body: JSON.stringify({ name, path: repoPath }),
      }) as { id: string; name: string };
      spinner.succeed(chalk.green(`Repository added: ${repo.name} (${repo.id.slice(0, 8)})`));
      console.log(chalk.gray('\n  Indexing started in background. Check progress: lore status\n'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

// STATUS command
program
  .command('status')
  .description('Show server status and recent indexing jobs')
  .action(async () => {
    try {
      const [stats, jobs] = await Promise.all([
        api('/api/stats') as Promise<{ totalRepos: number; totalCommits: number; totalSearches: number }>,
        api('/api/jobs') as Promise<Array<{
          id: string;
          status: string;
          indexedCommits: number;
          totalCommits: number;
          repository: { name: string };
        }>>,
      ]);

      console.log(chalk.bold('\n  Lore Server Status\n'));
      printDivider();
      console.log(`  Repositories : ${chalk.cyan(stats.totalRepos)}`);
      console.log(`  Commits      : ${chalk.cyan(stats.totalCommits.toLocaleString())}`);
      console.log(`  Searches     : ${chalk.cyan(stats.totalSearches.toLocaleString())}`);
      printDivider();

      if (jobs.length) {
        console.log(chalk.bold('\n  Recent Jobs\n'));
        for (const j of jobs.slice(0, 5)) {
          const statusColor =
            j.status === 'COMPLETED' ? chalk.green :
            j.status === 'RUNNING' ? chalk.yellow :
            j.status === 'FAILED' ? chalk.red : chalk.gray;
          const progress = j.totalCommits > 0 ? chalk.gray(` (${j.indexedCommits}/${j.totalCommits})`) : '';
          console.log(`  ${statusColor(j.status.padEnd(10))}  ${j.repository.name}${progress}`);
        }
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${err instanceof Error ? err.message : String(err)}\n`));
      if (String(err).includes('ECONNREFUSED')) {
        console.log(chalk.dim(`  Is the Lore server running? Start with: docker compose up -d\n`));
      }
      process.exit(1);
    }
  });

// CONFIG command
program
  .command('config')
  .description('Configure CLI settings')
  .option('--server <url>', 'set Lore server URL')
  .option('--show', 'show current config')
  .action((opts: { server?: string; show?: boolean }) => {
    if (opts.server) {
      saveCliConfig({ serverUrl: opts.server });
      console.log(chalk.green(`\n  Server URL set to: ${opts.server}\n`));
    } else {
      const config = loadCliConfig();
      console.log(chalk.bold('\n  Lore CLI Config\n'));
      printDivider();
      console.log(`  Server URL : ${chalk.cyan(config.serverUrl)}`);
      console.log(`  Config     : ${chalk.dim(CONFIG_PATH)}`);
      printDivider();
      console.log();
    }
  });

program
  .name('lore')
  .description('Semantic git history search — CLI client for Lore server')
  .version('0.1.0')
  .addHelpText('after', `
${chalk.bold('Quick start:')}
  ${chalk.cyan('docker compose up -d')}              Start Lore server + MySQL
  ${chalk.cyan('lore add-repo /path/to/repo')}       Index a repository
  ${chalk.cyan('lore search "remove rate limit"')}   Search commits
  ${chalk.cyan('lore repos')}                        List repositories
  ${chalk.cyan('lore status')}                       Server status + indexing jobs
  ${chalk.cyan('lore config --server http://...')}   Point CLI at a remote server
  `);

program.parse();
