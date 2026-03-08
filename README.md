# Lore

<div align="center">

**Your team's git memory. Search any repository's history in plain English.**

[![CI](https://github.com/stalwartszen/lore/actions/workflows/ci.yml/badge.svg)](https://github.com/stalwartszen/lore/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748)](https://www.prisma.io/)

[Report Bug](https://github.com/stalwartszen/lore/issues/new) · [Request Feature](https://github.com/stalwartszen/lore/issues/new) · [Discussions](https://github.com/stalwartszen/lore/discussions)

</div>

---

## What is Lore?

Lore is an open-source, self-hosted **team git history search engine**. It indexes your repositories using local AI embeddings and lets your entire team search commit history in plain English — not by guessing keywords, but by meaning.

```bash
lore search "when did we remove rate limiting from auth"
lore search "who introduced the feature flag system and why"
lore search "every time someone touched the payment flow"
lore search "database migrations that affected the users table"
```

One person runs the Lore server. The whole team searches via the **web UI** or **CLI**. No API keys required for basic use — embeddings run entirely on your machine.

---

## Features

### Semantic Search
- **Natural language queries** — search by meaning, not just keywords
- **Local AI embeddings** — `all-MiniLM-L6-v2` runs entirely on your machine, zero data sent externally
- **AI re-ranking** — optional Groq (`llama-3.3-70b`) or Claude (`claude-sonnet-4-6`) for smarter results
- **Relevant diff preview** — see exactly which lines of code relate to your query
- **Filter by author, date, file path** — narrow results precisely

### Team Server
- **Multi-repository** — index as many repos as your team needs
- **Background indexing** — add a repo and search while it indexes in the background
- **Incremental updates** — only new commits are re-indexed on each run
- **REST API** — integrate with any tool, script, or CI pipeline
- **Search history & analytics** — see what your team searches for most

### Self-Hosted & Private
- **Docker Compose** — one command to start MySQL + Lore server
- **MySQL backend** — Prisma ORM with production-grade relational storage
- **Your data stays yours** — no telemetry, no cloud sync, no vendor lock-in

### Developer Experience
- **TypeScript first** — strict mode throughout, end-to-end type safety
- **Turborepo monorepo** — fast incremental builds across all packages
- **Fastify** — high-performance REST API with built-in schema validation
- **CLI client** — scriptable, pipeable, beautiful terminal output

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | >= 24.0 |
| Docker Compose | >= 2.0 |
| Node.js | >= 20.0.0 |
| pnpm | >= 9.0.0 |

### One-Command Start (Docker)

```bash
# Clone the repository
git clone https://github.com/stalwartszen/lore.git
cd lore

# Configure environment
cp .env.example .env
# Optional: add GROQ_API_KEY or ANTHROPIC_API_KEY for smarter re-ranking

# Start MySQL + Lore server
docker compose up -d

# Install CLI globally
npm install -g @lore/cli

# Add a repository and start indexing
lore add-repo /path/to/your/repo

# Search!
lore search "when did we add authentication middleware"
```

Open **http://localhost:3000** for the web UI.

### Local Development

```bash
git clone https://github.com/stalwartszen/lore.git
cd lore

# Use the correct Node.js version
nvm use

# Install all workspace dependencies
pnpm install

# Start MySQL only (no server)
docker compose up mysql -d

# Set up environment
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start all services in dev/watch mode
pnpm dev
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Clients                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Web UI      │  │  CLI         │  │  REST API        │  │
│  │  React + Vite│  │  @lore/cli   │  │  (curl / scripts)│  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┼─────────────────────┘           │
│                           │                                  │
│               ┌───────────▼────────────┐                    │
│               │   Lore Server          │                    │
│               │   Fastify REST API     │                    │
│               │   @lore/server         │                    │
│               └───────────┬────────────┘                    │
│                           │                                  │
│          ┌────────────────┼──────────────────┐              │
│          │                │                  │               │
│   ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼──────┐      │
│   │   MySQL     │  │  Groq API   │  │  Claude API  │      │
│   │  (Prisma)   │  │  llama-3.3  │  │  sonnet-4-6  │      │
│   └─────────────┘  └─────────────┘  └──────────────┘      │
│                                                              │
│   ┌───────────────────────────────────────────────────┐     │
│   │  @lore/core (shared, framework-agnostic)          │     │
│   │  GitExtractor · SearchEngine · Local Embeddings   │     │
│   └───────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
lore/
├── apps/
│   └── web/              # React 18 + Vite — web UI
├── packages/
│   ├── core/             # GitExtractor, SearchEngine, embeddings (no DB)
│   ├── server/           # Fastify server + Prisma ORM + REST routes
│   └── cli/              # CLI client (pure REST API consumer)
├── prisma/
│   └── schema.prisma     # MySQL schema: Repository, Commit, IndexJob, SearchLog
├── docker-compose.yml    # MySQL 8 + Lore server
└── Dockerfile
```

### Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| API Server | Fastify | High throughput, schema validation, TypeScript-native |
| ORM | Prisma | Type-safe queries, migrations, MySQL support |
| Database | MySQL 8 | Battle-tested, production-grade storage |
| Embeddings | all-MiniLM-L6-v2 | 384-dim vectors, runs locally via `@xenova/transformers` |
| Re-ranking | Groq / Claude | Optional — dramatically improves result quality |
| Git | simple-git | Reliable Node.js git wrapper |
| Monorepo | Turborepo | Incremental builds, task orchestration |
| Language | TypeScript 5.3 (strict) | End-to-end type safety |
| Web UI | React 18 + Vite | Fast HMR, minimal bundle |

---

## API Reference

All endpoints return JSON. No authentication is required by default — add JWT middleware for production deployments.

### Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repositories` | List all repositories |
| `POST` | `/api/repositories` | Add a repository and trigger indexing |
| `GET` | `/api/repositories/:id` | Get repository details |
| `DELETE` | `/api/repositories/:id` | Remove a repository and all its data |
| `POST` | `/api/repositories/:id/reindex` | Trigger a full re-index |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=...` | Search commits with natural language |

**Query parameters:** `q` (required), `repositoryId`, `limit` (1–50, default 10), `author`, `since` (ISO date), `until` (ISO date), `files` (comma-separated patterns)

### Jobs & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs` | List recent indexing jobs |
| `GET` | `/api/jobs/:id` | Poll job progress |
| `GET` | `/api/stats` | Server-wide statistics and top queries |
| `GET` | `/health` | Health check |

### Example Requests

```bash
# Search across all repos
curl "http://localhost:3000/api/search?q=remove+rate+limiting&limit=5"

# Filter by author and date
curl "http://localhost:3000/api/search?q=auth+refactor&author=john&since=2024-01-01"

# Poll indexing job progress
curl "http://localhost:3000/api/jobs/clxyz123"
```

---

## CLI Reference

```bash
lore search <query>                      # Search git history
lore search <query> --limit 5            # Limit results
lore search <query> --author john        # Filter by author
lore search <query> --since 2024-01-01   # Filter by date
lore search <query> --files src/auth     # Filter by file path
lore search <query> --repo <id>          # Specific repository

lore repos                               # List indexed repositories
lore add-repo <path>                     # Add and index a repository
lore add-repo <path> --name "My API"     # With a custom name
lore status                              # Server status + recent jobs

lore config --server http://...          # Point CLI at remote server
lore config                              # Show current CLI config
```

---

## Re-ranking Providers

Lore uses local AI embeddings for all search — no API key needed. Add a provider key to enable smarter re-ranking that significantly improves result quality.

| Provider | Model | Latency | Quality | Cost |
|----------|-------|---------|---------|------|
| **Groq** *(recommended)* | `llama-3.3-70b-versatile` | ~200ms | ★★★★ | Free tier available |
| **Anthropic** | `claude-sonnet-4-6` | ~800ms | ★★★★★ | Pay-per-use |
| None | — | ~50ms | ★★★ | Free |

```bash
# Set in .env
GROQ_API_KEY=gsk_...           # preferred — fast + free tier
ANTHROPIC_API_KEY=sk-ant-...   # alternative — highest quality
```

---

## Roadmap

### v0.2.0 — Auth & Access Control
- [ ] JWT-based authentication and API tokens
- [ ] User accounts with per-repository permissions
- [ ] Admin dashboard for managing users and repos
- [ ] Read-only public sharing links for individual repos

### v0.3.0 — Smarter Search
- [ ] Cross-repository search with relevance blending
- [ ] Saved searches and commit diff alerts
- [ ] Code snippet search (search inside diffs directly)
- [ ] Semantic commit clustering by topic

### v0.4.0 — Integrations
- [ ] GitHub / GitLab webhook for automatic incremental indexing
- [ ] Slack bot (`/lore search "..."` from any channel)
- [ ] VS Code extension
- [ ] GitHub Actions integration for CI search

### v1.0.0 — Production Ready
- [ ] High-availability multi-instance mode
- [ ] Vector database backend (pgvector / Qdrant) for very large repos
- [ ] SAML / OIDC SSO
- [ ] Audit logs and GDPR-compliant data exports

See [open milestones](https://github.com/stalwartszen/lore/milestones) for detailed tracking.

---

## Contributing

We welcome contributions of all kinds — from bug reports and documentation to new features and integrations. Please read the [Contributing Guide](CONTRIBUTING.md) before getting started.

**Key contribution areas:**
- Search quality (ranking algorithms, diff extraction, relevance)
- Integrations (GitHub webhooks, Slack, VS Code)
- Performance at scale (large repos, high concurrency)
- Authentication and access control
- Tests and documentation

---

## Community

- **GitHub Discussions**: [Discussions](https://github.com/stalwartszen/lore/discussions) — RFCs, Q&A, show-and-tell
- **Issues**: [GitHub Issues](https://github.com/stalwartszen/lore/issues) — Bug reports and feature requests
- **Email**: [stalwartszen@gmail.com](mailto:stalwartszen@gmail.com) — Direct contact

---

## License

Lore is open-source software licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Kushal Bauskar ([@stalwartszen](https://github.com/stalwartszen)).

---

<div align="center">

Built by [Kushal Bauskar](https://github.com/stalwartszen) and the open-source community.

**[Star us on GitHub](https://github.com/stalwartszen/lore)** if Lore saves your team time.

Questions? [stalwartszen@gmail.com](mailto:stalwartszen@gmail.com)

</div>
