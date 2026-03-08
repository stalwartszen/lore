# Lore

> Your team's git memory. Search any repository's history in plain English.

```bash
lore search "when did we remove rate limiting from auth"
lore search "who introduced the feature flag system"
lore search "every database migration in Q1"
```

Lore runs as a **team server** — one instance indexes your repos, the whole team searches via web UI or CLI. AI-powered re-ranking via Groq (fast) or Claude (smart). Embeddings run locally.

## Quick start (Docker)

```bash
# Clone and start
git clone https://github.com/stalwartszen/lore
cd lore
cp .env.example .env

# Add API keys for smarter re-ranking (optional)
echo "GROQ_API_KEY=gsk_..." >> .env

docker compose up -d

# Add a repo to index
lore config --server http://localhost:3000
lore add-repo /path/to/your/repo

# Open the web UI
open http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Team                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Web UI   │  │ CLI      │  │ API      │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       └──────────────┼─────────────┘           │
│                      │                          │
│            ┌─────────▼──────────┐              │
│            │  Lore Server       │              │
│            │  Fastify REST API  │              │
│            └─────────┬──────────┘              │
│                      │                          │
│         ┌────────────┼──────────────┐          │
│         │            │              │           │
│    ┌────▼─────┐ ┌────▼─────┐ ┌────▼──────┐   │
│    │  MySQL   │ │ Groq API │ │ Claude API│   │
│    │ (Prisma) │ │ (rerank) │ │ (rerank) │   │
│    └──────────┘ └──────────┘ └───────────┘   │
└─────────────────────────────────────────────────┘
```

## Project structure

```
lore/
├── packages/
│   ├── server/          # Fastify server + Prisma + MySQL
│   ├── core/            # shared types, embeddings, git extraction (no DB)
│   └── cli/             # CLI client that talks to server API
├── apps/
│   └── web/             # React web UI (served by server in production)
├── prisma/
│   └── schema.prisma    # Prisma schema (MySQL)
└── docker-compose.yml   # MySQL + Lore server
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/repositories` | List all repositories |
| POST | `/api/repositories` | Add a repository |
| DELETE | `/api/repositories/:id` | Remove a repository |
| POST | `/api/repositories/:id/reindex` | Trigger re-index |
| GET | `/api/search?q=...` | Search commits |
| GET | `/api/jobs` | List indexing jobs |
| GET | `/api/jobs/:id` | Get job status |
| GET | `/api/stats` | Server statistics |
| GET | `/health` | Health check |

## Re-ranking providers

Lore uses local AI embeddings for search (no API key needed). Optionally add an AI key for smarter re-ranking:

| Provider | Model | Speed | Quality |
|----------|-------|-------|---------|
| **Groq** (recommended) | llama-3.3-70b | Fast | High |
| **Claude** | claude-sonnet-4-6 | Medium | Highest |
| None | — | Fastest | Good |

Set in `.env`: `GROQ_API_KEY=...` or `ANTHROPIC_API_KEY=...`

## Development

```bash
git clone https://github.com/stalwartszen/lore
cd lore
pnpm install
cp .env.example .env

# Start MySQL (or use docker compose up mysql)
docker compose up mysql -d

# Run migrations
pnpm db:migrate

# Start server in dev mode
pnpm --filter @lore/server dev

# Start web UI in dev mode (separate terminal)
pnpm --filter @lore/web dev
```

## Built by

Kushal Bauskar ([@stalwartszen](https://github.com/stalwartszen)) · [stalwartszen@gmail.com](mailto:stalwartszen@gmail.com)
