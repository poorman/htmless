# Contributing to HTMLess

Thanks for your interest in contributing to HTMLess. This guide covers everything you need to get started.

## Prerequisites

- **Node.js 20+** (check with `node -v`)
- **pnpm 9+** (install: `corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** (for PostgreSQL and Redis)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/pbieda/htmless.git
cd htmless

# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
pnpm --filter @htmless/core prisma migrate dev

# Seed the database with default data
pnpm --filter @htmless/core prisma db seed

# Start the API server (port 3000)
pnpm --filter @htmless/core dev

# In another terminal — start the admin UI (port 3101)
pnpm --filter @htmless/admin dev
```

Default login: `admin@htmless.com` / `admin123`

## Project Structure

```
htmless/
  packages/
    core/           @htmless/core — Express API server
      src/
        api/
          cma/      Content Management API (editors, automation)
          cda/      Content Delivery API (public, read-only)
          preview/  Preview API (draft reads with scoped tokens)
        auth/       JWT auth, RBAC, rate limiting
        audit/      Audit logging middleware
        blocks/     Block definition registry and validation
        cache/      Redis caching layer
        content/    Entry CRUD, versioning, publishing
        events/     Internal event bus
        extensions/ Extension/plugin router
        media/      Asset management, uploads, storage
        schema/     Content type and field registry
        spaces/     Multi-tenant space isolation
        webhooks/   Webhook dispatch, signing, retries
      prisma/       Schema, migrations, seed
      tests/        API integration tests
    admin/          @htmless/admin — Next.js admin dashboard
      src/
        app/        App Router pages (login, dashboard, etc.)
        components/ Shared UI components
        features/   Feature-specific modules
        lib/        API client, utilities
    worker/         @htmless/worker — Background job processor (BullMQ)
      src/
        jobs/       Job definitions
        queues/     Queue configuration
        runners/    Job runner implementations
```

## Development Workflow

### Branches

- `main` is the stable branch. Never push directly to main.
- Create feature branches from `main`: `git checkout -b feat/my-feature`
- Use prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`

### Commits

Write clear, concise commit messages. Focus on what changed and why.

```
feat: add webhook retry backoff with exponential delay

fix: prevent duplicate entries when slug already exists

refactor: extract rate limiter into shared middleware
```

### Pull Requests

1. Keep PRs focused on a single change.
2. Include a description of what changed and why.
3. Make sure CI passes (build, typecheck, tests).
4. Link related issues if applicable.

## Code Style

- **TypeScript strict mode** is enforced (`strict: true` in tsconfig).
- **ESM only** — all packages use `"type": "module"` with NodeNext module resolution.
- **Express patterns** — routes go in `src/api/{surface}/`, middleware in dedicated directories.
- **Prisma** — the single source of truth for the database schema lives in `packages/core/prisma/schema.prisma`.
- **Zod** — request validation uses Zod schemas defined alongside route handlers.
- **No `any`** — use explicit types. If you must escape, use `unknown` and narrow.

## Testing

### Running tests

Tests require a running API server with a seeded database:

```bash
# Make sure DB is running and seeded
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @htmless/core prisma migrate dev
pnpm --filter @htmless/core prisma db seed

# Start the API on port 3100 for tests
PORT=3100 pnpm --filter @htmless/core dev &

# Run the test suite
pnpm --filter @htmless/core test
```

### Writing tests

Tests live in `packages/core/tests/` and use Node.js built-in `node:test` runner with `node:assert/strict`.

- Use the helpers in `tests/helpers.ts` for HTTP requests and auth.
- Group tests with `describe()` blocks by API surface or feature.
- Each test should be independent — clean up any data you create.

## Architecture

HTMLess exposes three API surfaces with strict separation:

| Surface     | Path           | Purpose                                     | Auth                    |
|-------------|----------------|---------------------------------------------|-------------------------|
| **CMA**     | `/cma/v1`      | Content management for editors & automation  | JWT (user) or API token |
| **CDA**     | `/cda/v1`      | Content delivery, read-only, cacheable       | API token (optional)    |
| **Preview** | `/preview/v1`  | Draft-inclusive reads for preview frontends   | Preview token (scoped)  |

### Key concepts

- **Spaces** — multi-tenant isolation. Every content type, entry, asset, and token is scoped to a space.
- **Content types** — schema definitions with typed fields (text, richtext, number, boolean, date, media, reference, json, slug, enum).
- **Entries** — content records with draft/published versioning and ETag concurrency control.
- **Blocks** — structured content blocks with JSON Schema validation and reusable patterns.
- **API tokens** — scoped machine tokens for CI/CD, frontends, and integrations.
- **Preview tokens** — short-lived tokens scoped to specific entries or routes.
- **Webhooks** — event-driven HTTP callbacks with HMAC signing and automatic retries.
- **Audit logs** — immutable record of all CMA write operations.

### Auth system

- User authentication via JWT (login endpoint returns a signed token).
- RBAC with four built-in roles: admin, editor, author, viewer.
- Role bindings are per-space — a user can be admin in one space and viewer in another.
- API tokens carry explicit scopes (e.g., `cda:read`, `cma:write`).
- Rate limiting is applied per-IP on login and per-token on API routes.

### Database

- PostgreSQL with Prisma ORM.
- Schema lives at `packages/core/prisma/schema.prisma`.
- Migrations are managed with `prisma migrate dev` (development) and `prisma migrate deploy` (CI/production).

See [CONTRIBUTING-DEV.md](CONTRIBUTING-DEV.md) for the detailed developer workflow.
