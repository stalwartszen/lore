import { embed, cosineSimilarity } from '../embeddings/index.js';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

export interface EmbeddedCommit {
  id: string;
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
  embedding: number[];
}

export interface SearchMatch {
  commit: Omit<EmbeddedCommit, 'embedding'>;
  score: number;
  relevantLines: string[];
}

export interface SearchEngineOptions {
  anthropicApiKey?: string;
  groqApiKey?: string;
}

export type RerankProvider = 'groq' | 'claude' | 'none';

export class SearchEngine {
  private anthropic: Anthropic | null;
  private groq: Groq | null;
  readonly rerankProvider: RerankProvider;

  constructor(options: SearchEngineOptions = {}) {
    this.anthropic = options.anthropicApiKey ? new Anthropic({ apiKey: options.anthropicApiKey }) : null;
    this.groq = options.groqApiKey ? new Groq({ apiKey: options.groqApiKey }) : null;
    // Prefer Groq (faster + cheaper) over Claude
    if (this.groq) this.rerankProvider = 'groq';
    else if (this.anthropic) this.rerankProvider = 'claude';
    else this.rerankProvider = 'none';
  }

  async search(
    query: string,
    commits: EmbeddedCommit[],
    options: { limit?: number; author?: string; since?: string; until?: string; files?: string[] } = {}
  ): Promise<SearchMatch[]> {
    const { limit = 10 } = options;

    if (commits.length === 0) return [];

    const queryEmbedding = await embed(query);

    // Score and filter
    const scored = commits
      .filter(c => {
        if (options.author && !c.author.toLowerCase().includes(options.author.toLowerCase())) return false;
        if (options.since && new Date(c.date) < new Date(options.since)) return false;
        if (options.until && new Date(c.date) > new Date(options.until)) return false;
        if (options.files?.length && !options.files.some(f => c.files.some(cf => cf.includes(f)))) return false;
        return true;
      })
      .map(c => ({ commit: c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    let results: SearchMatch[] = scored.map(({ commit, score }) => {
      const { embedding: _emb, ...rest } = commit;
      return { commit: rest, score, relevantLines: this.extractRelevantLines(query, commit.diff) };
    });

    if (this.rerankProvider !== 'none' && results.length > 2) {
      try { results = await this.rerank(query, results); } catch { /* fall back to embedding-only order */ }
    }

    return results.slice(0, limit);
  }

  private async rerank(query: string, results: SearchMatch[]): Promise<SearchMatch[]> {
    const list = results.map((r, i) =>
      `[${i}] ${r.commit.shortHash} — ${r.commit.message}\nFiles: ${r.commit.files.slice(0, 4).join(', ')}\nDiff: ${r.commit.diff.slice(0, 200)}`
    ).join('\n---\n');

    const prompt = `Git search query: "${query}"\n\nRank these commits by relevance. Return ONLY a JSON array of indices, e.g. [2,0,4]. Max 10.\n\n${list}`;

    let text = '';
    if (this.rerankProvider === 'groq' && this.groq) {
      const res = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      });
      text = res.choices[0]?.message?.content ?? '';
    } else if (this.rerankProvider === 'claude' && this.anthropic) {
      const res = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      });
      text = res.content[0]?.type === 'text' ? res.content[0].text : '';
    }

    try {
      const match = text.match(/\[[\d,\s]+\]/);
      if (!match) return results;
      const indices = JSON.parse(match[0]) as number[];
      const reranked: SearchMatch[] = [];
      for (const i of indices) { if (results[i]) reranked.push(results[i]!); }
      const seen = new Set(indices);
      results.forEach((r, i) => { if (!seen.has(i)) reranked.push(r); });
      return reranked;
    } catch { return results; }
  }

  private extractRelevantLines(query: string, diff: string): string[] {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['when', 'what', 'where', 'that', 'this', 'with', 'from', 'have', 'were'].includes(w));
    return diff.split('\n')
      .filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
      .filter(l => words.some(w => l.toLowerCase().includes(w)))
      .slice(0, 6);
  }
}
