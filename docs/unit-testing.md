# HTMLess Unit Testing / Revision Checklist

_Last updated: 2026-04-03_

## Purpose

This file is a shared verification checklist for Codex, Claude, or any other AI agent working on HTMLess.

Use it as:

- the current source of truth for what was actually verified
- a list of missing or incorrect implementations compared to the docs
- a test plan for the next implementation passes

Do not delete completed findings. Mark them done and add brief evidence.

## Verification Environment

All checks below were run from Docker containers.

Infra:

- `docker compose -f docker-compose.dev.yml up -d`
- Postgres container: `htmless_postgres`
- Redis container: `htmless_redis`

App-side verification used ephemeral Node containers, for example:

```bash
docker run --rm -v /home/pbieda/sites/htmless:/app -w /app node:20-bookworm bash -lc 'corepack enable >/dev/null 2>&1 && pnpm --filter @htmless/core build'
docker run --rm -v /home/pbieda/sites/htmless:/app -w /app node:20-bookworm bash -lc 'corepack enable >/dev/null 2>&1 && pnpm --filter @htmless/admin build'
docker run --rm -v /home/pbieda/sites/htmless:/app -w /app/packages/core --network host node:20-bookworm bash -lc 'corepack enable >/dev/null 2>&1 && export $(grep -v "^#" .env | xargs) && pnpm dev'
```

## High-Level Status

Implemented and smoke-tested in Docker:

- CMA login
- schema list/read
- entry list/read
- save draft
- publish
- preview token creation
- preview read
- API token creation
- CDA read
- asset metadata creation
- webhook creation

Build status in Docker:

- `@htmless/admin`: builds successfully
- `@htmless/worker`: builds successfully
- `@htmless/core`: does **not** build successfully

## Critical Findings

### P0

- [x] Fix `@htmless/core` TypeScript build before adding more features.
  **RESOLVED 2026-04-03:** `pnpm --filter @htmless/core build` now passes clean.
  Fixes: cast all `req.params.*` as `string`, add `IRouter` type annotation to all routers,
  fix ioredis ESM import via `createRequire`, add missing Prisma `include` clauses.

- [x] Restrict preview tokens to their declared `entryId` and/or `route`.
  **RESOLVED 2026-04-03:** Auth middleware now passes `previewEntryId` and `previewRoute`
  to `AuthContext`. Preview content routes enforce scope via `checkPreviewScope()` —
  entry-scoped tokens can only read that entry, route-scoped tokens check path match.
  Listing is blocked for entry-scoped tokens.

- [ ] Implement webhook dispatch, signing, retries, and delivery logging.
  Evidence: webhook creation works, but publish events create zero delivery rows.
  `packages/worker/src/index.ts` is still a placeholder.

- [x] Replace placeholder admin UI with real feature routes or remove dead navigation.
  **RESOLVED 2026-04-03:** Built all dashboard pages — content listing, content editor
  (with draft/publish/schedule/preview), schema listing, schema editor, media library.
  Dashboard layout with auth guard and sidebar nav. API helper library.

### P1

- [x] Enforce RBAC and space membership.
  **RESOLVED 2026-04-03:** Added `requirePermission()` middleware in `auth/rbac.ts`.
  Checks user's role bindings in the requested space against required permissions.
  Wired into CMA index: schemas require `schema.admin|entry.read`, entries require
  `entry.read|entry.create`, assets require `asset.upload|entry.read`, webhooks require
  `webhook.manage`. Users without any role binding in a space get 403.

- [x] Require optimistic concurrency on publish if docs continue to claim `If-Match` is required.
  **RESOLVED 2026-04-03:** Publish now requires `If-Match` header (returns 428 without it),
  and validates ETag against current draft version (returns 412 on mismatch).

- [ ] Decide whether CDA is public by default or token-gated by configuration, then implement consistently.
  Evidence: `GET /cda/v1/content/article?slug=hello-world` succeeds with no bearer token as long as `x-space-id` is present.

- [ ] Implement real asset upload/storage flow.
  Evidence: current CMA assets route accepts JSON metadata only, not multipart uploads, provider storage, transforms, or delivery URLs.

- [ ] Implement actual event bus usage.
  Evidence: `packages/core/src/events/emitter.ts` defines events, but content/schema/asset/webhook routes do not wire it into durable job processing.

## Feature-by-Feature Review Against Docs

### 1. Schema Builder

Docs:

- `docs/SPEC.md`
- `docs/design.md`

Current state:

- Backend schema CRUD exists for content types and fields.
- Admin schema builder UI does not exist.
- No drag-and-drop ordering UI, no live preview, no relationship mapper.

Needed:

- [ ] Build schema UI in admin
- [ ] Add tests for content type CRUD
- [ ] Add tests for field CRUD and ordering
- [ ] Validate field definitions more strictly by type

### 2. Instant API

Docs:

- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`

Current state:

- REST routes exist for CMA/CDA/Preview.
- GraphQL does not exist.
- Response shaping is partial: `fields` and `include` exist on CDA/Preview content routes.

Needed:

- [ ] Implement GraphQL or remove GraphQL claims from docs/README
- [ ] Add tests for `fields` projection
- [ ] Add tests for `include` reference resolution
- [ ] Add tests for cache headers and ETag behavior

### 3. Webhooks + Automations

Docs:

- `docs/SPEC.md`
- `docs/DATA_FLOW.md`
- `docs/SECURITY.md`

Current state:

- Webhook records can be created/read/updated/deleted.
- No actual outbound delivery, retry policy, HMAC signing execution, or delivery log creation after publish.

Needed:

- [ ] Implement queue + worker delivery
- [ ] Sign payloads with timestamp
- [ ] Retry on failure
- [ ] Persist every attempt in `webhook_deliveries`
- [ ] Add end-to-end publish -> delivery integration test

### 4. Admin UI

Docs:

- `docs/design.md`

Current state:

- Landing page, login page, and dashboard page exist.
- Dashboard stats are hardcoded placeholders.
- No auth guard around dashboard.
- Sidebar links target routes that do not exist.
- No schema builder, content editor, media library, tokens screen, or webhook screen.

Needed:

- [ ] Replace placeholder stats with API-backed data
- [ ] Add route protection
- [ ] Implement or remove dead sidebar links
- [ ] Add Playwright or equivalent UI smoke tests

### 5. Multi-Site / Spaces

Docs:

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`

Current state:

- Prisma models and route filters use `spaceId`.
- Clients must manually send `x-space-id`.
- No membership enforcement beyond trusting the caller.

Needed:

- [ ] Validate that authenticated user belongs to requested space
- [ ] Prevent token reuse across unrelated spaces
- [ ] Add tests for cross-space isolation

### 6. Roles / Capabilities / Token Auth

Docs:

- `docs/SPEC.md`
- `docs/SECURITY.md`

Current state:

- JWT login works.
- API token creation works.
- Preview token creation works.
- Actual capability checks from roles are not implemented.
- Preview token scope is not enforced.

Needed:

- [ ] Implement role/capability middleware based on `RoleBinding.permissions`
- [ ] Add tests for denied access by role
- [ ] Add tests for preview token scope leakage
- [ ] Add tests for expired token rejection

### 7. Editorial Workflow / Versioning / Preview

Docs:

- `docs/SPEC.md`
- `docs/DATA_FLOW.md`

Current state:

- Entry create/list/read/save-draft/publish/unpublish exists.
- Version records are created.
- Preview reads draft versions.
- `schedule`, `revert`, and dedicated `versions` endpoints from docs are missing.
- Publish does not require `If-Match`.
- Entry creation does not validate payload against schema.

Needed:

- [ ] Add schema validation for entry data
- [ ] Add required-field enforcement before publish
- [ ] Add `schedule`, `revert`, and versions endpoints or update docs
- [ ] Add tests for draft vs published version separation
- [ ] Add tests for publish concurrency contract

### 8. Media Library + Asset Delivery

Docs:

- `docs/SPEC.md`
- `docs/DATA_FLOW.md`
- `docs/design.md`

Current state:

- Asset metadata CRUD exists.
- No multipart upload handling.
- No file storage provider abstraction.
- No transform URLs.
- No admin media library UI.

Needed:

- [ ] Support multipart upload
- [ ] Persist actual files
- [ ] Generate delivery URLs and transform params
- [ ] Add media UI
- [ ] Add upload/content-type/size validation tests

### 9. Structured Blocks + Patterns

Docs:

- `docs/SPEC.md`

Current state:

- Entries can store JSON in `data`.
- No block registry routes.
- No block validation.
- No patterns feature.

Needed:

- [ ] Add block definition models/routes
- [ ] Validate block trees
- [ ] Add pattern CRUD
- [ ] Add tests for invalid block payload rejection

### 10. Extensibility / Custom APIs

Docs:

- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`

Current state:

- Event bus type exists only as a local helper.
- No extension manifests.
- No `/cma/v1/ext/{extensionKey}/...` routes.

Needed:

- [ ] Either implement extension surface or remove claims from docs
- [ ] Add event subscribers tied to real side effects

## Concrete Test Cases To Add

### API

- [ ] Login succeeds with seeded admin credentials
- [ ] Login fails with wrong password
- [ ] Schema list requires auth and `x-space-id`
- [ ] Entry create rejects duplicate slug
- [ ] Save draft returns `412` on bad `If-Match`
- [ ] Publish creates a new published version
- [ ] Preview returns draft version, not published version
- [ ] Preview token cannot read another entry
- [ ] CDA respects `fields`
- [ ] CDA respects `include`
- [ ] CDA `ETag` returns `304` on matching `If-None-Match`
- [ ] Asset create rejects missing required properties
- [ ] Webhook publish creates delivery rows

### Security

- [ ] User without role binding cannot access a space
- [ ] API token with `cda:read` cannot call CMA routes
- [ ] Preview token cannot call CMA routes
- [ ] Expired API token is rejected
- [ ] Expired preview token is rejected
- [ ] Cross-space entry lookup is rejected

### Admin

- [ ] `/login` submits to live API and stores token
- [ ] `/dashboard` requires auth
- [ ] Every visible sidebar link resolves to a real route
- [ ] Dashboard stats reflect live API values

## Docs That Need Revision If Code Is Not Updated

- [ ] `README.md`: remove or qualify GraphQL, visual schema builder, webhook engine, media transforms, version history claims if not implemented immediately
- [ ] `docs/SPEC.md`: mark missing endpoints/features as planned instead of implemented
- [ ] `docs/design.md`: current admin is a placeholder, not the described product
- [ ] `docs/ARCHITECTURE.md`: worker/webhook stack is aspirational today, not fully operational
- [ ] `docs/SECURITY.md`: object auth, property auth, RBAC, and preview scoping are not fully enforced

## Suggested Execution Order

1. Make `@htmless/core` compile cleanly.
2. Fix security gaps: RBAC, preview scoping, publish concurrency contract.
3. Implement webhook delivery worker and delivery logs.
4. Add automated API tests for currently working routes.
5. Build real admin routes for schema/content/media/webhooks/tokens.
6. Only then expand docs/marketing claims.

