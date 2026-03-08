# Contributing to Lore

Thank you for your interest in contributing to Lore! Whether you are fixing a bug, improving the search quality, adding an integration, or improving documentation — every contribution matters.

Please read this guide before contributing. It will save you time and help us review your work faster.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Good First Issues](#good-first-issues)
- [Getting Help](#getting-help)

---

## Code of Conduct

Lore is committed to providing a welcoming, inclusive, and harassment-free environment. By participating, you agree to treat everyone with respect.

Violations can be reported to **stalwartszen@gmail.com**. All reports will be handled confidentially.

---

## Reporting Bugs

Before filing a bug report:

1. **Search existing issues** to avoid duplicates
2. **Check the latest `main` branch** — the bug may already be fixed
3. **Reproduce the bug** with the minimal steps possible

When ready, open an issue with:
- A clear description of the bug
- Steps to reproduce it
- What you expected vs. what happened
- Your environment (OS, Node.js version, Docker version, MySQL version)
- Relevant logs or screenshots

**Security vulnerabilities must NOT be reported as public GitHub issues.** See [SECURITY.md](SECURITY.md).

---

## Suggesting Features

Before opening a feature request:

1. **Search existing issues and discussions** to avoid duplicates
2. **Check the roadmap** in `README.md`

Open a feature request and describe:
- The problem you are solving (the "why", not just the "what")
- Your proposed solution
- Alternatives you considered

For large or breaking changes, open a **GitHub Discussion** first to gather feedback before implementation.

---

## Development Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.0.0 |
| Docker | >= 24.0 |
| Docker Compose | >= 2.0 |
| Git | >= 2.40.0 |

### Step 1: Fork and Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/lore.git
cd lore

# Add upstream remote
git remote add upstream https://github.com/stalwartszen/lore.git
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Set Up Environment

```bash
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL
```

### Step 4: Start MySQL

```bash
docker compose up mysql -d
# Wait ~10s for MySQL to be ready
```

### Step 5: Run Migrations

```bash
pnpm db:migrate
pnpm db:generate
```

### Step 6: Start Dev Server

```bash
# All packages in watch mode
pnpm dev

# Or individually:
pnpm --filter @lore/server dev   # API server on :3000
pnpm --filter @lore/web dev      # Web UI on :5173
```

### Step 7: Run Tests

```bash
pnpm test
pnpm test:coverage
```

### Keeping Your Fork Up to Date

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

---

## Project Structure

```
lore/
├── apps/
│   └── web/              # React 18 + Vite — web UI
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── pages/
├── packages/
│   ├── core/             # Framework-agnostic shared logic
│   │   └── src/
│   │       ├── embeddings/   # Local AI embedding model
│   │       ├── git/          # Git extraction (simple-git wrapper)
│   │       ├── search/       # SearchEngine (cosine sim + re-ranking)
│   │       └── types/        # Shared TypeScript types
│   ├── server/           # Fastify REST API + Prisma
│   │   └── src/
│   │       ├── routes/       # repositories, search, jobs, stats
│   │       └── index.ts      # Server entry point
│   └── cli/              # CLI client (REST consumer)
│       └── src/
│           └── index.ts      # All commands
├── prisma/
│   └── schema.prisma     # MySQL schema
└── docker-compose.yml
```

**Key principle:** `packages/core` must remain framework-agnostic — no Fastify, no Prisma, no Express. It is a pure TypeScript library used by both the server and (potentially) other clients.

---

## Coding Standards

### TypeScript

- **Strict mode is required.** All `tsconfig.json` files enable `"strict": true`. Do not disable strict checks.
- **Avoid `any`.** Use `unknown` when the type is genuinely unknown, then narrow it.
- **Export types explicitly.** Use `export type { ... }` for type-only exports.
- **Document public APIs** with JSDoc. Internal implementation details do not need JSDoc.

### Async / Error Handling

- All async route handlers must catch errors and return appropriate HTTP status codes
- Never let unhandled promise rejections crash the server
- Background jobs (indexing) must update the `IndexJob` status to `FAILED` on error

### Database / Prisma

- Never write raw SQL — use Prisma's query API
- All schema changes require a migration: `prisma migrate dev --name describe-the-change`
- Never mutate the database directly in tests — use transactions or test-specific seed data

### File Organization

- One concern per file
- Route handlers in `packages/server/src/routes/`
- Shared logic in `packages/core/src/`
- TypeScript strict, no `any`, no `@ts-ignore`

---

## Branch Naming Conventions

| Prefix | Use Case | Example |
|--------|---------|---------|
| `feat/` | New features | `feat/jwt-authentication` |
| `fix/` | Bug fixes | `fix/search-empty-results` |
| `docs/` | Documentation only | `docs/api-reference` |
| `chore/` | Tooling, deps, config | `chore/update-prisma-5` |
| `refactor/` | Code restructuring | `refactor/search-engine` |
| `perf/` | Performance improvements | `perf/embedding-batch-size` |
| `test/` | Adding or fixing tests | `test/search-engine-unit` |

Branch names must be lowercase with hyphens. No spaces or special characters.

---

## Commit Message Format

Lore uses **Conventional Commits** for automatic changelog generation.

```
<type>(<scope>): <short description>

[optional body — explain WHY, not WHAT]

[optional footer — closes #issue]
```

### Types

| Type | When to Use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency, tooling changes |

### Scopes

- `core` — `packages/core`
- `server` — `packages/server`
- `cli` — `packages/cli`
- `web` — `apps/web`
- `search` — search logic or ranking
- `indexer` — git extraction or indexing pipeline
- `db` — Prisma schema or migrations
- `deps` — dependency updates

### Examples

```bash
feat(search): add file path filter to search API
fix(indexer): handle commits with binary files gracefully
docs(server): add API authentication examples
perf(search): batch embedding requests to reduce model load time
chore(deps): update @xenova/transformers to 2.18
```

---

## Pull Request Process

### Before Opening a PR

1. **Make sure there is an issue** for your change (except trivial fixes)
2. **Branch from `main`**
3. **Keep PRs focused** — one logical change per PR
4. **Ensure all checks pass locally:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

### Opening the PR

1. Push your branch: `git push origin feat/your-feature`
2. Open a PR against `main`
3. Use a title following Conventional Commits format
4. Fill in the PR template completely

### Review Process

- A maintainer will review within **5 business days**
- CI checks must pass before review
- At least **one approving review** required before merge
- Address review comments with new commits (do not force-push during review)

### Merging

PRs are merged using **Squash and Merge** to keep `main` history linear.

---

## Testing Requirements

All contributions must include tests. We use **Vitest**.

- Public functions in `packages/core` must have unit tests
- API routes in `packages/server` must have integration tests
- Target: **80% line coverage minimum** for new code

### Running Tests

```bash
# All packages
pnpm test

# Specific package
pnpm --filter @lore/core test
pnpm --filter @lore/server test

# With coverage
pnpm test:coverage
```

---

## Good First Issues

New to Lore? Look for issues labeled [`good first issue`](https://github.com/stalwartszen/lore/labels/good%20first%20issue). These have:
- A clear, well-defined scope
- No deep architectural knowledge required
- A maintainer available to guide you

**Comment on the issue before starting** to avoid duplicate effort.

---

## Getting Help

- **GitHub Discussions** — [Discussions](https://github.com/stalwartszen/lore/discussions)
- **Issue Comments** — Ask questions on the issue you are working on
- **Email** — [stalwartszen@gmail.com](mailto:stalwartszen@gmail.com)

---

Thank you for contributing to Lore. Your time and effort make this project better for every team that uses it.
