# HTMLess Developer Workflow

Detailed development guide for contributors. For the quick-start version, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Docker Dev Environment

The dev environment uses Docker for PostgreSQL and Redis while running Node.js processes on the host for fast iteration.

### Starting services

```bash
# Start postgres (port 5434) and redis (port 6380)
docker compose -f docker-compose.dev.yml up -d

# Verify services are running
docker compose -f docker-compose.dev.yml ps
```

Default dev database connection:

```
postgresql://htmless:htmless_dev@localhost:5434/htmless
```

### Running everything in Docker

For a fully containerized environment (API + admin + worker + postgres + redis):

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f api
docker compose logs -f admin

# Stop everything
docker compose down
```

The production compose file exposes:
- API on port 3000 (configurable via `API_PORT`)
- Admin on port 3001 (configurable via `ADMIN_PORT`)

### Environment variables

Copy `.env.example` to `.env` for production settings. For development, the defaults work out of the box:

| Variable       | Default (dev)                                          | Description              |
|----------------|--------------------------------------------------------|--------------------------|
| `DATABASE_URL` | `postgresql://htmless:htmless_dev@localhost:5434/htmless` | PostgreSQL connection    |
| `REDIS_URL`    | `redis://localhost:6380`                               | Redis connection         |
| `JWT_SECRET`   | `dev-secret-change-in-production-please`               | JWT signing secret       |
| `PORT`         | `3000`                                                 | API server port          |
| `NODE_ENV`     | `development`                                          | Environment mode         |

## Adding a New API Route

All API routes live under `packages/core/src/api/` organized by surface (cma, cda, preview).

### Step by step

1. **Create the route file** (or add to an existing one):

```typescript
// packages/core/src/api/cma/my-feature.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';

const router = Router();

// Define request validation schema
const CreateMyFeatureSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

// GET /cma/v1/my-feature?spaceId=...
router.get('/', async (req, res) => {
  const spaceId = req.headers['x-space-id'] as string;
  if (!spaceId) {
    return res.status(400).json({ error: 'missing_space_id' });
  }

  const items = await prisma.myFeature.findMany({
    where: { spaceId },
  });

  res.json({ data: items });
});

// POST /cma/v1/my-feature
router.post('/', async (req, res) => {
  const spaceId = req.headers['x-space-id'] as string;
  const parsed = CreateMyFeatureSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'validation_error',
      details: parsed.error.flatten(),
    });
  }

  const item = await prisma.myFeature.create({
    data: { ...parsed.data, spaceId },
  });

  res.status(201).json({ data: item });
});

export default router;
```

2. **Register the route** in the surface index file:

```typescript
// packages/core/src/api/cma/index.ts
import myFeatureRouter from './my-feature.js';

router.use('/my-feature', requirePermission('my-feature.manage'), myFeatureRouter);
```

3. **Add the Prisma model** if needed (see "Database Migrations" below).

### Conventions

- Use Zod for request body validation.
- Return `{ data: ... }` for success responses.
- Return `{ error: 'error_code', message: '...' }` for errors.
- Use `x-space-id` header for space scoping (extracted by middleware on authenticated routes).
- Use `requirePermission()` to guard routes by RBAC permission.
- Emit events for side effects (webhooks, audit logging) rather than coupling directly.

## Adding a New Admin Page

The admin UI uses Next.js App Router at `packages/admin/src/app/`.

### Step by step

1. **Create a page file**:

```tsx
// packages/admin/src/app/dashboard/my-feature/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function MyFeaturePage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api('/cma/v1/my-feature')
      .then(res => res.json())
      .then(data => setItems(data.data));
  }, []);

  return (
    <div>
      <h1>My Feature</h1>
      {/* render items */}
    </div>
  );
}
```

2. **Add navigation** in the dashboard layout at `packages/admin/src/app/dashboard/layout.tsx`.

3. **Create shared components** in `packages/admin/src/components/` for reusable UI elements.

### Conventions

- Pages are `'use client'` components unless they only need server rendering.
- Use the `api()` helper from `src/lib/api.ts` for authenticated API calls.
- Keep feature-specific logic in `src/features/` and shared components in `src/components/`.

## Running Tests

### Integration tests

The test suite runs against a live API instance using Node.js built-in `node:test`.

```bash
# 1. Ensure postgres and redis are running
docker compose -f docker-compose.dev.yml up -d

# 2. Run migrations and seed
pnpm --filter @htmless/core prisma migrate dev
pnpm --filter @htmless/core prisma db seed

# 3. Start API on test port
PORT=3100 pnpm --filter @htmless/core dev &

# 4. Run tests
pnpm --filter @htmless/core test

# 5. Stop the background API when done
kill %1
```

### Adding a test

Tests go in `packages/core/tests/api.test.ts`. Use the helpers from `tests/helpers.ts`:

```typescript
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { authGet, authPost, getAdminToken, getSpaceId } from './helpers.js';

describe('My Feature', () => {
  let token: string;
  let spaceId: string;

  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  it('creates a new item', async () => {
    const res = await authPost(`/cma/v1/my-feature`, token, spaceId, {
      name: 'Test Item',
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.data.id);
  });

  it('lists items', async () => {
    const res = await authGet(`/cma/v1/my-feature`, token, spaceId);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});
```

### Available test helpers

| Helper           | Description                                    |
|------------------|------------------------------------------------|
| `api(path, opts)` | Raw HTTP request to the API                   |
| `authGet(path, token, spaceId)` | Authenticated GET request        |
| `authPost(path, token, spaceId, body)` | Authenticated POST request |
| `authPatch(path, token, spaceId, body)` | Authenticated PATCH request |
| `authDelete(path, token, spaceId)` | Authenticated DELETE request     |
| `getAdminToken()` | Log in and return a JWT token                 |
| `getSpaceId()`    | Get the default space ID from seed data       |
| `uniqueSlug()`    | Generate a unique slug for test data          |

## Database Migrations

HTMLess uses Prisma for database schema management.

### Creating a migration

1. **Edit the schema** at `packages/core/prisma/schema.prisma`.

2. **Generate the migration**:

```bash
pnpm --filter @htmless/core prisma migrate dev --name describe_the_change
```

This creates a new SQL migration file in `packages/core/prisma/migrations/` and applies it to your dev database.

3. **Commit the migration file** alongside your schema changes.

### Applying migrations (production / CI)

```bash
pnpm --filter @htmless/core prisma migrate deploy
```

This applies pending migrations without generating new ones. Used in CI and production.

### Resetting the dev database

```bash
# Drop and recreate, re-run all migrations and seed
pnpm --filter @htmless/core prisma migrate reset
```

### Viewing the database

```bash
pnpm --filter @htmless/core prisma studio
```

Opens a browser-based database viewer at `http://localhost:5555`.

## Troubleshooting

### Port conflicts

The dev environment uses non-standard ports to avoid conflicts:

| Service    | Port  | Notes                  |
|------------|-------|------------------------|
| API        | 3000  | (3100 for tests)       |
| Admin UI   | 3101  |                        |
| PostgreSQL | 5434  | Host port (5432 inside container) |
| Redis      | 6380  | Host port (6379 inside container) |

If you see `EADDRINUSE`, check for stale processes:

```bash
lsof -i :3000
lsof -i :5434
```

### Database connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:5434
```

Make sure the dev containers are running:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

### Prisma client out of sync

If you see type errors after pulling new changes:

```bash
pnpm --filter @htmless/core exec prisma generate
```

### Migration drift

If `prisma migrate dev` complains about drift:

```bash
# Reset the dev database (destroys data)
pnpm --filter @htmless/core prisma migrate reset
```

### Redis connection issues

The dev compose maps Redis to port 6380. If the API cannot connect, verify `REDIS_URL` is set correctly:

```bash
REDIS_URL=redis://localhost:6380 pnpm --filter @htmless/core dev
```

### Admin UI API connection

The admin UI expects the API at `http://localhost:3000`. If you changed the API port, update the API base URL in `packages/admin/src/lib/api.ts`.

### Docker build failures

If Docker builds fail with out-of-date dependencies:

```bash
# Rebuild without cache
docker compose build --no-cache

# Or rebuild a specific service
docker compose build --no-cache api
```

### Tests fail with "connection refused"

The test suite expects the API running on port 3100. Start it before running tests:

```bash
PORT=3100 pnpm --filter @htmless/core dev &
# Wait a few seconds for startup, then:
pnpm --filter @htmless/core test
```
