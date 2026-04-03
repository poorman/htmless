# HTMLess — Roadmap

_Last updated: 2026-04-03_

## Vision

Build the cleanest, fastest headless CMS that makes Strapi look bloated. Open source core, paid hosting, plugin marketplace. WordPress-inspired authoring UX without the theme baggage.

---

## Phase 1 — Foundation
> Goal: API skeleton, schema registry, entry CRUD, auth system

- [x] Monorepo setup (Node.js + Next.js workspaces)
- [x] PostgreSQL + Prisma schema (core tables)
- [x] Docker-compose dev environment (postgres, redis, api, admin)
- [x] CMA API skeleton (`/cma/v1/...`)
- [x] CDA API skeleton (`/cda/v1/...`)
- [x] Preview API skeleton (`/preview/v1/...`)
- [x] Schema registry MVP (content types, fields, taxonomies)
- [x] Entry CRUD (draft-only, no publish yet)
- [x] RBAC + user auth (login, sessions/JWT)
- [x] Scoped API tokens (machine tokens for builds/integrations)
- [x] Publish JSON Schema for content types
- [x] Basic admin UI shell (Next.js, login, navigation)

## Phase 2 — Editorial Core
> Goal: Draft/publish workflow, versioning, preview, scheduling

- [x] Draft/publish separation (entry_versions + entry_state)
- [x] Version history + autosave
- [x] Preview token issuance + Preview API reads
- [x] Scheduling (publishAt with background job)
- [x] Link resolution rules (published-only CDA, draft-aware Preview)
- [x] ETag/If-Match concurrency control on CMA writes
- [x] Admin UI: content editor with draft/publish controls
- [x] Admin UI: version history viewer
- [x] Admin UI: preview button (generates token, opens preview URL)

## Phase 3 — Media Pipeline
> Goal: Upload, metadata, transforms, CDN-ready delivery

- [ ] Media library CRUD (upload, metadata, alt/caption)
- [ ] Upload flows (multipart + resumable/presigned)
- [ ] Storage provider abstraction (local, S3-compatible)
- [ ] Asset metadata (EXIF extraction, dimensions)
- [ ] Delivery URLs with transform params (`?w=800&h=450&fit=crop&fm=webp`)
- [ ] Caching limits and abuse prevention
- [ ] Admin UI: media library (upload, browse, search)
- [ ] Admin UI: inline media picker in content editor

## Phase 4 — Structured Content Blocks
> Goal: Block registry, validation, patterns, portable rich content

- [ ] Block definition registry (key, version, attributesSchema)
- [ ] Block validation on entry save
- [ ] Block versioning strategy (pin/migrate/deprecate)
- [ ] Reusable patterns/templates
- [ ] Core blocks: paragraph, heading, image, callout, embed, list, code
- [ ] Admin UI: block-based content editor
- [ ] Admin UI: pattern picker
- [ ] Renderer SDK contract (block → component mapping)

## Phase 5 — Integrations & Extensibility
> Goal: Event bus, webhooks, custom endpoints, plugin system

- [ ] Internal event bus (entry.published, asset.created, etc.)
- [ ] Extension manifest spec (namespaced endpoints, hooks, fields)
- [ ] Webhook engine (registration, signing, TTL, retries)
- [ ] Webhook delivery logs (`GET /cma/v1/webhooks/{id}/deliveries`)
- [ ] `include=` and `fields=` query shaping with bounds
- [ ] GraphQL layer (optional, introspection in dev)
- [ ] Admin UI: webhook management
- [ ] Admin UI: extension manager

## Phase 6 — Hardening & DX
> Goal: Production-ready, auditable, developer-friendly

- [ ] Audit logs (who changed what, when)
- [ ] Policy test harness ("simulate authorization")
- [ ] Rate limiting per token/IP
- [ ] Schema codegen tooling (TypeScript types from content types)
- [ ] CLI tool (`htmless init`, `htmless migrate`, `htmless deploy`)
- [ ] One-command deployment (`docker compose up`)
- [ ] Documentation site
- [ ] Contributor guide

## Phase 7 — Open Source CMS Reality Check
> Goal: Close the gap between roadmap claims and a truly usable open source headless CMS

- [ ] Make `@htmless/core` compile cleanly in Docker and CI
- [ ] Add CI for `build`, `typecheck`, and core API smoke tests
- [ ] Enforce real RBAC from `roles` + `role_bindings`, not just JWT presence
- [ ] Enforce space membership on every CMA/CDA/Preview request
- [ ] Enforce preview-token scope to the requested `entryId` and/or `route`
- [ ] Bring publish flow in line with docs: `If-Match`, concurrency, and required-field validation
- [ ] Validate entry payloads against content-type schema on create/save/publish
- [ ] Ship the missing editorial endpoints or downgrade claims in docs:
  `schedule`, `revert`, version history routes, and publishability checks
- [ ] Replace JSON-only asset metadata CRUD with real uploads, storage, and delivery URLs
- [ ] Turn webhook records into a real system: queue, dispatcher, HMAC signing, retries, delivery logs
- [ ] Wire the internal event bus to actual side effects and background jobs
- [ ] Decide and document whether CDA is public-by-default or token-gated-by-default
- [ ] Build the missing admin routes linked from dashboard:
  content, schema, media, webhooks, tokens, settings
- [ ] Replace placeholder dashboard stats with live API-backed data
- [ ] Add route protection in admin so dashboard pages require auth
- [ ] Add automated API tests for login, schema CRUD, entry workflow, preview, assets, and webhooks
- [ ] Add security tests for cross-space isolation, token expiry, insufficient scope, and preview leakage
- [ ] Add browser-level smoke tests for login and main admin flows
- [ ] Remove or revise product claims that are not implemented yet:
  GraphQL, visual schema builder, webhook engine, media transforms, scheduling UI, extension manager
- [ ] Publish a contributor-friendly local dev workflow that works fully in Docker
- [ ] Define the minimum "v1 open source CMS" release checklist and block release until all required items pass

## Phase 8 — Best-In-Class Product Features
> Goal: Add the advanced product capabilities that would make HTMLess the best open source headless CMS, not just a competent one

- [ ] Visual schema builder with drag-and-drop ordering, inline editing, and live API preview
- [ ] True block editor with reusable blocks, nested blocks, patterns, and portable rendering contracts
- [ ] Localization / multi-language content with per-field translation support
- [ ] Content relationships with reverse lookups, reference browsing, and relation integrity tools
- [ ] Slug rules, redirects, and URL management for multi-site content
- [ ] Editorial collaboration features: comments, mentions, approvals, assignment, and publish checklists
- [ ] Scheduled publishing and scheduled unpublishing with timezone-aware workflows
- [ ] Content diff viewer for draft vs published and version-to-version comparisons
- [ ] Content duplication, branching, and bulk operations for editors and agencies
- [ ] Taxonomies, collections, menus, and reusable global content entries
- [ ] Powerful search and filtering in admin across entries, assets, schemas, and users
- [ ] Media transforms with focal points, responsive variants, and image presets
- [ ] Asset usage tracking so editors can see where media is referenced before deleting it
- [ ] CDN-friendly static preview URLs and frontend framework starter kits
- [ ] GraphQL API with introspection, typed schema generation, and persisted queries
- [ ] SDKs for TypeScript and frontend frameworks to make integration dead simple
- [ ] Plugin / extension system with installable modules, custom fields, and admin UI extensions
- [ ] Marketplace-ready extension packaging and permissions model
- [ ] Importers for WordPress, Contentful, Sanity, CSV, JSON, and Google Sheets
- [ ] Export tools for entries, schemas, media metadata, and full-project backups
- [ ] AI-assisted schema generation, content modeling suggestions, and migration helpers
- [ ] AI-assisted content operations: summaries, metadata generation, alt text, and content cleanup
- [ ] Granular caching and invalidation controls for high-scale frontends
- [ ] Multi-environment workflow: local, staging, production schemas and content promotion
- [ ] Space templates / project starters for blogs, docs, SaaS apps, agencies, and ecommerce content
- [ ] White-label and agency management features for running many client spaces from one install
- [ ] Public docs portal and example gallery that make HTMLess easy to adopt without sales calls

---

## Monetization Track (Parallel)

### SaaS Hosting (Primary)
- [ ] Multi-tenant hosted infrastructure
- [ ] Free tier (self-host only)
- [ ] $29/mo — small apps
- [ ] $99/mo — growing SaaS
- [ ] $299+/mo — scale

### Plugin Marketplace
- [ ] Developer SDK for building extensions
- [ ] Marketplace listing + review process
- [ ] 20-30% revenue share model
- [ ] Categories: AI integrations, payments, analytics, SEO

### Enterprise Features (Paywall)
- [ ] SSO (SAML, OIDC)
- [ ] Advanced RBAC (field-level permissions)
- [ ] Audit log export
- [ ] Multi-region hosting
- [ ] SLA + priority support

### Templates / Starters
- [ ] SaaS boilerplate ($49-$199)
- [ ] Blog engine starter
- [ ] AI dashboard template
- [ ] E-commerce content starter

---

## Viral Feature (The "WTF" Moment)

One of these ships in Phase 2-3 as a differentiator:
- [ ] AI auto-generates CMS schema from a natural language prompt
- [ ] Paste JSON → full backend created instantly
- [ ] Google Sheets → CMS sync (import/live-connect)

---

## Growth Engine

| Channel           | Action                                       |
|--------------------|----------------------------------------------|
| GitHub             | Open source core, star-driven growth         |
| SEO                | "Headless CMS for Next.js", "Strapi alternative" |
| Product Hunt       | Launch at Phase 2 completion                 |
| Hacker News        | Show HN post with live demo                  |
| Dev.to / Hashnode  | Technical deep-dives on architecture         |
| YouTube            | "Build X with HTMLess" tutorial series        |
