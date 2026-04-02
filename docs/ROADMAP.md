# HTMLess — Roadmap

_Last updated: 2026-04-02_

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
- [ ] Publish JSON Schema for content types
- [x] Basic admin UI shell (Next.js, login, navigation)

## Phase 2 — Editorial Core
> Goal: Draft/publish workflow, versioning, preview, scheduling

- [x] Draft/publish separation (entry_versions + entry_state)
- [x] Version history + autosave
- [x] Preview token issuance + Preview API reads
- [ ] Scheduling (publishAt with background job)
- [x] Link resolution rules (published-only CDA, draft-aware Preview)
- [x] ETag/If-Match concurrency control on CMA writes
- [ ] Admin UI: content editor with draft/publish controls
- [ ] Admin UI: version history viewer
- [ ] Admin UI: preview button (generates token, opens preview URL)

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
