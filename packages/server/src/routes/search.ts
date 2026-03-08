import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { SearchEngine } from '@lore/core';
import type { EmbeddedCommit } from '@lore/core';
import { z } from 'zod';

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient; }
}

const SearchSchema = z.object({
  q: z.string().min(1),
  repositoryId: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  files: z.string().optional(), // comma-separated
});

export const searchRouter: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  const engine = new SearchEngine({
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    groqApiKey: process.env['GROQ_API_KEY'],
  });

  // GET /api/search?q=...&repositoryId=...&limit=10
  fastify.get('/', async (request, reply) => {
    const start = Date.now();
    const params = SearchSchema.safeParse(request.query);
    if (!params.success) return reply.status(400).send({ error: params.error.format() });

    const { q, repositoryId, limit, author, since, until, files } = params.data;

    // Load commits with embeddings from DB
    const where: Record<string, unknown> = {};
    if (repositoryId) where['repositoryId'] = repositoryId;

    const rawCommits = await prisma.commit.findMany({
      where,
      select: {
        id: true, hash: true, shortHash: true, message: true, body: true,
        author: true, email: true, date: true, timestamp: true,
        files: true, diff: true, additions: true, deletions: true,
        embedding: true,
        repository: { select: { id: true, name: true } },
      },
    });

    if (rawCommits.length === 0) {
      return { results: [], total: 0, provider: engine.rerankProvider, durationMs: Date.now() - start };
    }

    // Map to EmbeddedCommit
    const commits: (EmbeddedCommit & { repositoryName: string })[] = rawCommits.map(c => ({
      id: c.id,
      hash: c.hash,
      shortHash: c.shortHash,
      message: c.message,
      body: c.body,
      author: c.author,
      email: c.email,
      date: c.date.toISOString(),
      timestamp: c.timestamp,
      files: c.files as string[],
      diff: c.diff,
      additions: c.additions,
      deletions: c.deletions,
      embedding: c.embedding as number[],
      repositoryName: c.repository.name,
    }));

    const results = await engine.search(q, commits, {
      limit,
      author,
      since,
      until,
      files: files ? files.split(',') : undefined,
    });

    const durationMs = Date.now() - start;

    // Log search asynchronously — don't block response
    void prisma.searchLog.create({
      data: {
        query: q,
        repositoryId: repositoryId ?? null,
        resultCount: results.length,
        durationMs,
        provider: engine.rerankProvider,
      },
    });

    return {
      results,
      total: results.length,
      provider: engine.rerankProvider,
      durationMs,
    };
  });
};
