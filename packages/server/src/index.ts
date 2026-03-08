import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { repositoriesRouter } from './routes/repositories.js';
import { searchRouter } from './routes/search.js';
import { jobsRouter } from './routes/jobs.js';
import { statsRouter } from './routes/stats.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const prisma = new PrismaClient();

const fastify = Fastify({ logger: { transport: { target: 'pino-pretty' } } });

await fastify.register(cors, { origin: true });
await fastify.register(jwt, { secret: process.env['JWT_SECRET'] ?? 'lore-dev-secret' });

// Attach prisma to fastify
fastify.decorate('prisma', prisma);

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
await fastify.register(repositoriesRouter, { prefix: '/api/repositories' });
await fastify.register(searchRouter, { prefix: '/api/search' });
await fastify.register(jobsRouter, { prefix: '/api/jobs' });
await fastify.register(statsRouter, { prefix: '/api/stats' });

// Serve web UI (in production)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, '../../apps/web/dist');
if (fs.existsSync(webDir)) {
  await fastify.register((await import('@fastify/static')).default, {
    root: webDir,
    prefix: '/',
  });
}

const PORT = parseInt(process.env['PORT'] ?? '3000');
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n  Lore server running on http://localhost:${PORT}\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
