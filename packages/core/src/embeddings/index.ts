// Embeddings module — wraps @xenova/transformers for local embedding generation
// Model: Xenova/all-MiniLM-L6-v2 — 384-dimensional sentence embeddings

let pipeline: ((text: string | string[], options?: object) => Promise<EmbeddingOutput>) | null = null;

interface EmbeddingOutput {
  data: Float32Array;
  dims: number[];
  tolist(): number[][];
}

interface TransformersModule {
  pipeline: (
    task: string,
    model: string,
    options?: object,
  ) => Promise<(text: string | string[], options?: object) => Promise<EmbeddingOutput>>;
}

async function getTransformers(): Promise<TransformersModule> {
  // Dynamic import to avoid issues with CJS/ESM interop
  const mod = await import('@xenova/transformers');
  return mod as unknown as TransformersModule;
}

export async function loadEmbeddingModel(): Promise<void> {
  if (pipeline) return;

  const { pipeline: createPipeline } = await getTransformers();

  // Suppress verbose model loading output
  const originalLog = console.log;
  console.log = () => {};

  try {
    pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true, // use quantized model for faster inference + smaller download
    });
  } finally {
    console.log = originalLog;
  }
}

export async function embed(text: string): Promise<number[]> {
  if (!pipeline) {
    await loadEmbeddingModel();
  }

  const output = await pipeline!(text, {
    pooling: 'mean',
    normalize: true,
  });

  // output.data is a Float32Array; convert to regular number array
  return Array.from(output.data) as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  // Process one at a time to keep memory manageable
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

export function buildEmbeddingText(commit: {
  message: string;
  body: string;
  files: string[];
  diff: string;
}): string {
  const parts = [
    commit.message,
    commit.body,
    commit.files.join(', '),
    commit.diff.slice(0, 1000),
  ].filter(Boolean);

  return parts.join('\n');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i]! * b[i]!);
    normA += (a[i]! * a[i]!);
    normB += (b[i]! * b[i]!);
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
