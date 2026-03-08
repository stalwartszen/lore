import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { GitExtractor, embed, buildEmbeddingText } from '@lore/core';

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient; }
}

const AddRepoSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
  branch: z.string().default('main'),
});

export const repositoriesRouter: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /api/repositories — list all repos
  fastify.get('/', async () => {
    return prisma.repository.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, path: true, description: true, branch: true,
        isIndexing: true, lastIndexed: true, totalCommits: true, createdAt: true,
      },
    });
  });

  // POST /api/repositories — add a repo
  fastify.post('/', async (request, reply) => {
    const parseResult = AddRepoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.format() });
    }
    const body = parseResult.data;

    if (!fs.existsSync(body.path)) {
      return reply.status(400).send({ error: `Path does not exist: ${body.path}` });
    }
    if (!fs.existsSync(path.join(body.path, '.git'))) {
      return reply.status(400).send({ error: `Not a git repository: ${body.path}` });
    }

    const existing = await prisma.repository.findUnique({ where: { path: body.path } });
    if (existing) return reply.status(409).send({ error: 'Repository already added' });

    const repo = await prisma.repository.create({ data: body });

    // Trigger indexing in background
    void triggerIndex(prisma, repo.id, repo.path);

    return reply.status(201).send(repo);
  });

  // GET /api/repositories/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const repo = await prisma.repository.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { commits: true } } },
    });
    if (!repo) return reply.status(404).send({ error: 'Repository not found' });
    return repo;
  });

  // DELETE /api/repositories/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await prisma.repository.delete({ where: { id: request.params.id } });
    } catch {
      return reply.status(404).send({ error: 'Repository not found' });
    }
    return reply.status(204).send();
  });

  // POST /api/repositories/:id/reindex — trigger re-index
  fastify.post<{ Params: { id: string } }>('/:id/reindex', async (request, reply) => {
    const repo = await prisma.repository.findUnique({ where: { id: request.params.id } });
    if (!repo) return reply.status(404).send({ error: 'Repository not found' });

    void triggerIndex(prisma, repo.id, repo.path);
    return { message: 'Indexing started' };
  });
};

async function triggerIndex(prisma: PrismaClient, repoId: string, repoPath: string): Promise<void> {
  // Create a job record
  const job = await prisma.indexJob.create({
    data: { repositoryId: repoId, status: 'RUNNING', startedAt: new Date() },
  });

  await prisma.repository.update({ where: { id: repoId }, data: { isIndexing: true } });

  // Run indexing in background (don't await)
  runIndexing(prisma, repoId, repoPath, job.id).catch(async (err: unknown) => {
    await prisma.indexJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: String(err), completedAt: new Date() },
    });
    await prisma.repository.update({ where: { id: repoId }, data: { isIndexing: false } });
  });
}

async function runIndexing(prisma: PrismaClient, repoId: string, repoPath: string, jobId: string): Promise<void> {
  const extractor = new GitExtractor(repoPath);
  const hashes = await extractor.getCommitHashes({ maxCommits: 10000 });

  // Get already-indexed hashes
  const existing = await prisma.commit.findMany({
    where: { repositoryId: repoId },
    select: { hash: true },
  });
  const existingSet = new Set(existing.map(c => c.hash));
  const toIndex = hashes.filter(h => !existingSet.has(h));

  await prisma.indexJob.update({ where: { id: jobId }, data: { totalCommits: toIndex.length } });

  let indexed = 0;
  const BATCH = 10;

  for (let i = 0; i < toIndex.length; i += BATCH) {
    const batch = toIndex.slice(i, i + BATCH);
    const commits = await Promise.all(batch.map(h => extractor.getCommit(h)));

    for (const commit of commits) {
      if (!commit) continue;
      const text = buildEmbeddingText(commit);
      const embedding = await embed(text);

      await prisma.commit.upsert({
        where: { repositoryId_hash: { repositoryId: repoId, hash: commit.hash } },
        update: {},
        create: {
          repositoryId: repoId,
          hash: commit.hash,
          shortHash: commit.shortHash,
          message: commit.message,
          body: commit.body,
          author: commit.author,
          email: commit.email,
          date: new Date(commit.date),
          timestamp: commit.timestamp,
          files: commit.files,
          diff: commit.diff,
          additions: commit.additions,
          deletions: commit.deletions,
          embedding: embedding,
        },
      });

      indexed++;
    }

    await prisma.indexJob.update({
      where: { id: jobId },
      data: { indexedCommits: indexed },
    });
  }

  await prisma.indexJob.update({
    where: { id: jobId },
    data: { status: 'COMPLETED', completedAt: new Date(), indexedCommits: indexed, totalCommits: hashes.length },
  });
  await prisma.repository.update({
    where: { id: repoId },
    data: { isIndexing: false, lastIndexed: new Date(), totalCommits: hashes.length },
  });
}
