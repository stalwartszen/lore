export { GitExtractor } from './git/index.js';
export { SearchEngine } from './search/engine.js';
export { embed, embedBatch, cosineSimilarity, buildEmbeddingText, loadEmbeddingModel } from './embeddings/index.js';
export type { Commit, SearchResult, LoreConfig, EmbeddingRow } from './types/index.js';
export type { EmbeddedCommit, SearchMatch, SearchEngineOptions, RerankProvider } from './search/engine.js';
export type { GitExtractOptions } from './git/index.js';
