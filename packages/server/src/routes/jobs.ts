import type { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance { prisma: PrismaClient; }
}

export const jobsRouter: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /api/jobs — list recent jobs
  fastify.get('/', async () => {
    return prisma.indexJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { repository: { select: { name: true } } },
    });
  });

  // GET /api/jobs/:id — get job status (for polling)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const job = await prisma.indexJob.findUnique({
      where: { id: request.params.id },
      include: { repository: { select: { name: true } } },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    return job;
  });
};
