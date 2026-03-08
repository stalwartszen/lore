import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient; }
}

export const statsRouter: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  fastify.get('/', async () => {
    const [totalRepos, totalCommits, totalSearches, recentSearches, topQueries] = await Promise.all([
      prisma.repository.count(),
      prisma.commit.count(),
      prisma.searchLog.count(),
      prisma.searchLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.searchLog.groupBy({
        by: ['query'],
        _count: { query: true },
        orderBy: { _count: { query: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalRepos,
      totalCommits,
      totalSearches,
      recentSearches,
      topQueries: topQueries.map(q => ({ query: q.query, count: q._count.query })),
    };
  });
};
