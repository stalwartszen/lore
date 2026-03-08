export interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  body: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
  files: string[];
  diff: string; // unified diff, truncated to 2000 chars
  additions: number;
  deletions: number;
}

export interface IndexedCommit extends Commit {
  embedding: number[]; // 384-dim from all-MiniLM-L6-v2
}

export interface SearchResult {
  commit: Commit;
  score: number; // cosine similarity 0-1
  relevantLines: string[]; // lines from diff most relevant to query
}

export type RerankProvider = 'claude' | 'groq' | 'none';

export interface LoreConfig {
  repoPath: string;
  dbPath: string; // defaults to .lore/index.db in repo root
  anthropicApiKey?: string;
  groqApiKey?: string;
  rerankProvider?: RerankProvider; // auto-detected if not set
  maxCommits?: number; // default 10000
}

export interface IndexStats {
  totalCommits: number;
  lastIndexed: string;
  dbSize: string;
}

export interface EmbeddingRow {
  hash: string;
  embedding: number[];
}
