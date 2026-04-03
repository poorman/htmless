/**
 * HTMLess API integration tests.
 *
 * Runs against a live API instance.
 * Configure with env vars:
 *   API_URL   — base URL (default http://localhost:3100)
 *   SPACE_ID  — default space id (required — printed by seed script)
 *
 * Run:
 *   SPACE_ID=<id> tsx tests/api.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  api,
  authGet,
  authPost,
  authPatch,
  authDelete,
  getAdminToken,
  getSpaceId,
  uniqueSlug,
  ADMIN_EMAIL,
  API_URL,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Shared state populated by `before` hooks
// ---------------------------------------------------------------------------

let token: string;
let spaceId: string;

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════

describe('Auth', () => {
  it('Login succeeds with correct credentials', async () => {
    const res = await api<{ token: string; user: { email: string } }>('/cma/v1/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'admin123' },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'response should include a JWT token');
    assert.equal(res.body.user.email, ADMIN_EMAIL);
  });

  it('Login fails with wrong password', async () => {
    const res = await api('/cma/v1/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'wrong-password' },
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as Record<string, unknown>).error, 'invalid_credentials');
  });

  it('Login fails with missing email', async () => {
    const res = await api('/cma/v1/auth/login', {
      method: 'POST',
      body: { password: 'admin123' },
    });

    assert.equal(res.status, 400);
    assert.equal((res.body as Record<string, unknown>).error, 'validation_error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════════════

describe('Schema', () => {
  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  it('List schemas requires auth and X-Space-Id', async () => {
    // No auth at all
    const noAuth = await api('/cma/v1/schemas/types');
    assert.equal(noAuth.status, 401, 'should reject unauthenticated request');

    // Auth but no X-Space-Id
    const noSpace = await api('/cma/v1/schemas/types', { token });
    assert.equal(noSpace.status, 400, 'should reject request without X-Space-Id');
  });

  it('List schemas returns article type with fields', async () => {
    const res = await authGet<{ items: Array<{ key: string; fields: Array<{ key: string }> }>; total: number }>('/cma/v1/schemas/types');

    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 1, 'should have at least one content type');

    const article = res.body.items.find((t) => t.key === 'article');
    assert.ok(article, 'article content type should exist');

    const fieldKeys = article.fields.map((f) => f.key);
    assert.ok(fieldKeys.includes('title'), 'should have title field');
    assert.ok(fieldKeys.includes('slug'), 'should have slug field');
    assert.ok(fieldKeys.includes('excerpt'), 'should have excerpt field');
    assert.ok(fieldKeys.includes('body'), 'should have body field');
    assert.ok(fieldKeys.includes('featuredImage'), 'should have featuredImage field');
  });

  // --- CRUD lifecycle for a temporary content type ---

  const tempTypeKey = `test-type-${Date.now()}`;
  let tempFieldKey: string;

  it('Create a new content type', async () => {
    const res = await authPost<{ key: string; id: string; name: string }>(
      '/cma/v1/schemas/types',
      { key: tempTypeKey, name: 'Test Type', description: 'Temporary type for tests' },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.key, tempTypeKey);
    assert.ok(res.body.id, 'should return id');
  });

  it('Add a field to the content type', async () => {
    tempFieldKey = 'test_field';
    const res = await authPost<{ key: string; id: string }>(
      `/cma/v1/schemas/types/${tempTypeKey}/fields`,
      { key: tempFieldKey, name: 'Test Field', type: 'text', required: false },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.key, tempFieldKey);
    assert.ok(res.body.id, 'should return field id');
  });

  it('Delete the content type', async () => {
    const res = await authDelete(`/cma/v1/schemas/types/${tempTypeKey}`);
    assert.equal(res.status, 204);

    // Confirm it is gone
    const verify = await authGet(`/cma/v1/schemas/types/${tempTypeKey}`);
    assert.equal(verify.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Entries
// ═══════════════════════════════════════════════════════════════════════════

describe('Entries', () => {
  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  // Track entry ids for cleanup
  const entriesToCleanup: string[] = [];
  after(async () => {
    for (const id of entriesToCleanup) {
      await authDelete(`/cma/v1/entries/${id}`).catch(() => {});
    }
  });

  const slug1 = uniqueSlug('entry');
  let entryId: string;
  let currentEtag: string;

  it('Create entry succeeds with valid data', async () => {
    const res = await authPost<{
      id: string;
      slug: string;
      latestVersion: { etag: string; data: Record<string, unknown> };
    }>('/cma/v1/entries', {
      contentTypeKey: 'article',
      slug: slug1,
      data: {
        title: 'Test Article',
        slug: slug1,
        excerpt: 'An excerpt',
        body: '<p>Hello world</p>',
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.slug, slug1);
    assert.ok(res.body.id, 'should return entry id');
    assert.ok(res.body.latestVersion.etag, 'should include an etag');

    entryId = res.body.id;
    currentEtag = res.body.latestVersion.etag;
    entriesToCleanup.push(entryId);
  });

  it('Create entry rejects duplicate slug (409)', async () => {
    const res = await authPost('/cma/v1/entries', {
      contentTypeKey: 'article',
      slug: slug1,
      data: { title: 'Duplicate', slug: slug1, body: '<p>dup</p>' },
    });

    assert.equal(res.status, 409);
    assert.equal((res.body as Record<string, unknown>).error, 'conflict');
  });

  it('Get single entry returns data + versions', async () => {
    const res = await authGet<{
      id: string;
      versions: Array<{ id: string; kind: string; data: Record<string, unknown>; etag: string }>;
    }>(`/cma/v1/entries/${entryId}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, entryId);
    assert.ok(Array.isArray(res.body.versions), 'should include versions array');
    assert.ok(res.body.versions.length >= 1, 'should have at least one version');
    assert.ok(res.headers.get('etag'), 'should return ETag header');
  });

  it('Save draft with If-Match succeeds', async () => {
    const res = await authPost<{ etag: string; data: Record<string, unknown> }>(
      `/cma/v1/entries/${entryId}/save-draft`,
      {
        data: {
          title: 'Updated Title',
          slug: slug1,
          excerpt: 'Updated excerpt',
          body: '<p>Updated body</p>',
        },
      },
      undefined,
      { 'If-Match': `"${currentEtag}"` },
    );

    assert.equal(res.status, 200);
    assert.ok(res.body.etag, 'should return new etag');
    assert.notEqual(res.body.etag, currentEtag, 'new etag should differ from old');
    currentEtag = res.body.etag;
  });

  it('Save draft with wrong If-Match returns 412', async () => {
    const res = await authPost(
      `/cma/v1/entries/${entryId}/save-draft`,
      {
        data: {
          title: 'Should Fail',
          slug: slug1,
          body: '<p>conflict</p>',
        },
      },
      undefined,
      { 'If-Match': '"totally-wrong-etag"' },
    );

    assert.equal(res.status, 412);
    assert.equal((res.body as Record<string, unknown>).error, 'precondition_failed');
  });

  it('Publish requires If-Match header (428 without)', async () => {
    const res = await authPost(`/cma/v1/entries/${entryId}/publish`, {});

    assert.equal(res.status, 428);
    assert.equal((res.body as Record<string, unknown>).error, 'precondition_required');
  });

  it('Publish succeeds with correct If-Match', async () => {
    const res = await authPost<{ status: string; etag: string }>(
      `/cma/v1/entries/${entryId}/publish`,
      {},
      undefined,
      { 'If-Match': `"${currentEtag}"` },
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'published');
    assert.ok(res.body.etag, 'should return published etag');
    currentEtag = res.body.etag;
  });

  it('Unpublish succeeds', async () => {
    const res = await authPost<{ status: string }>(`/cma/v1/entries/${entryId}/unpublish`, {});

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'draft');
  });

  it('List versions returns history', async () => {
    const res = await authGet<{
      items: Array<{ id: string; kind: string }>;
      total: number;
    }>(`/cma/v1/entries/${entryId}/versions`);

    assert.equal(res.status, 200);
    // We created 1 initial draft + 1 save-draft + 1 published version = 3
    assert.ok(res.body.total >= 3, `should have at least 3 versions, got ${res.body.total}`);
    assert.ok(Array.isArray(res.body.items));
  });

  it('Revert to previous version', async () => {
    // Get versions to pick an older one
    const versionsRes = await authGet<{
      items: Array<{ id: string; kind: string; data: Record<string, unknown> }>;
    }>(`/cma/v1/entries/${entryId}/versions`);

    assert.equal(versionsRes.status, 200);

    // Pick the oldest version (last in desc order)
    const oldestVersion = versionsRes.body.items[versionsRes.body.items.length - 1];
    assert.ok(oldestVersion, 'should have at least one version to revert to');

    const res = await authPost<{
      revertedFrom: string;
      etag: string;
      data: Record<string, unknown>;
    }>(`/cma/v1/entries/${entryId}/revert`, { versionId: oldestVersion.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.revertedFrom, oldestVersion.id);
    assert.ok(res.body.etag, 'should return new etag after revert');
    currentEtag = res.body.etag;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CDA (Content Delivery API)
// ═══════════════════════════════════════════════════════════════════════════

describe('CDA', () => {
  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  const cdaSlug = uniqueSlug('cda');
  let cdaEntryId: string;
  let cdaEtag: string;

  // Create and publish an entry for CDA tests
  before(async () => {
    // Create
    const create = await authPost<{
      id: string;
      latestVersion: { etag: string };
    }>('/cma/v1/entries', {
      contentTypeKey: 'article',
      slug: cdaSlug,
      data: {
        title: 'CDA Test Article',
        slug: cdaSlug,
        body: '<p>CDA body</p>',
      },
    });
    assert.equal(create.status, 201);
    cdaEntryId = create.body.id;
    cdaEtag = create.body.latestVersion.etag;

    // Publish
    const pub = await authPost<{ etag: string }>(
      `/cma/v1/entries/${cdaEntryId}/publish`,
      {},
      undefined,
      { 'If-Match': `"${cdaEtag}"` },
    );
    assert.equal(pub.status, 200);
    cdaEtag = pub.body.etag;
  });

  after(async () => {
    // Cleanup
    await authDelete(`/cma/v1/entries/${cdaEntryId}`).catch(() => {});
  });

  it('Published entry appears in CDA', async () => {
    const res = await api<{
      items: Array<{ id: string; slug: string; data: Record<string, unknown> }>;
      pagination: { total: number };
    }>(`/cda/v1/content/article`, { spaceId });

    assert.equal(res.status, 200);
    const found = res.body.items.find((e) => e.id === cdaEntryId);
    assert.ok(found, 'published entry should appear in CDA listing');
    assert.equal(found!.slug, cdaSlug);
  });

  it('CDA returns Cache-Control and ETag headers', async () => {
    const res = await api(`/cda/v1/content/article`, { spaceId });

    assert.equal(res.status, 200);
    assert.ok(res.headers.get('cache-control'), 'should have Cache-Control header');
    assert.ok(
      res.headers.get('cache-control')!.includes('max-age'),
      'Cache-Control should include max-age',
    );
    assert.ok(res.headers.get('etag'), 'should have ETag header');
  });

  it('CDA supports ?slug= filter', async () => {
    const res = await api<{
      items: Array<{ slug: string }>;
      pagination: { total: number };
    }>(`/cda/v1/content/article?slug=${cdaSlug}`, { spaceId });

    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.total, 1, 'slug filter should return exactly one result');
    assert.equal(res.body.items[0].slug, cdaSlug);
  });

  it('Unpublished entry does not appear in CDA', async () => {
    // Unpublish
    const unpub = await authPost(`/cma/v1/entries/${cdaEntryId}/unpublish`, {});
    assert.equal(unpub.status, 200);

    const res = await api<{
      items: Array<{ id: string }>;
    }>(`/cda/v1/content/article?slug=${cdaSlug}`, { spaceId });

    assert.equal(res.status, 200);
    const found = res.body.items.find((e) => e.id === cdaEntryId);
    assert.ok(!found, 'unpublished entry should NOT appear in CDA');

    // Re-publish for subsequent tests that might need it
    // First save a fresh draft to get a valid etag
    const draftRes = await authPost<{ etag: string }>(
      `/cma/v1/entries/${cdaEntryId}/save-draft`,
      { data: { title: 'CDA Test Article', slug: cdaSlug, body: '<p>CDA body</p>' } },
    );
    assert.equal(draftRes.status, 200);

    const repub = await authPost<{ etag: string }>(
      `/cma/v1/entries/${cdaEntryId}/publish`,
      {},
      undefined,
      { 'If-Match': `"${draftRes.body.etag}"` },
    );
    assert.equal(repub.status, 200);
    cdaEtag = repub.body.etag;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Preview
// ═══════════════════════════════════════════════════════════════════════════

describe('Preview', () => {
  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  const previewSlug = uniqueSlug('preview');
  const previewSlug2 = uniqueSlug('preview2');
  let previewEntryId: string;
  let previewEntry2Id: string;
  let unscopedPreviewToken: string;
  let scopedPreviewToken: string;

  // Create two draft entries for preview tests
  before(async () => {
    const e1 = await authPost<{ id: string; latestVersion: { etag: string } }>('/cma/v1/entries', {
      contentTypeKey: 'article',
      slug: previewSlug,
      data: { title: 'Preview Draft', slug: previewSlug, body: '<p>draft content</p>' },
    });
    assert.equal(e1.status, 201);
    previewEntryId = e1.body.id;

    const e2 = await authPost<{ id: string; latestVersion: { etag: string } }>('/cma/v1/entries', {
      contentTypeKey: 'article',
      slug: previewSlug2,
      data: { title: 'Preview Draft 2', slug: previewSlug2, body: '<p>draft content 2</p>' },
    });
    assert.equal(e2.status, 201);
    previewEntry2Id = e2.body.id;
  });

  after(async () => {
    await authDelete(`/cma/v1/entries/${previewEntryId}`).catch(() => {});
    await authDelete(`/cma/v1/entries/${previewEntry2Id}`).catch(() => {});
  });

  it('Create preview token (unscoped)', async () => {
    const res = await authPost<{ token: string; id: string; spaceId: string }>(
      '/cma/v1/auth/preview-tokens',
      { expiresInSeconds: 600 },
    );

    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'should return raw token');
    assert.ok(res.body.token.startsWith('hlp_'), 'token should have hlp_ prefix');
    unscopedPreviewToken = res.body.token;
  });

  it('Preview returns draft content', async () => {
    const res = await api<{
      id: string;
      slug: string;
      data: Record<string, unknown>;
      status: string;
    }>(`/preview/v1/content/article/${previewEntryId}`, {
      token: unscopedPreviewToken,
      spaceId,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, previewEntryId);
    assert.equal(res.body.slug, previewSlug);
    assert.equal(res.body.data.title, 'Preview Draft');
    assert.equal(res.body.status, 'draft');
  });

  it('Create entry-scoped preview token', async () => {
    const res = await authPost<{ token: string; id: string; entryId: string }>(
      '/cma/v1/auth/preview-tokens',
      { entryId: previewEntryId, expiresInSeconds: 600 },
    );

    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.entryId, previewEntryId);
    scopedPreviewToken = res.body.token;
  });

  it('Preview with entry-scoped token can read scoped entry', async () => {
    const res = await api<{ id: string }>(`/preview/v1/content/article/${previewEntryId}`, {
      token: scopedPreviewToken,
      spaceId,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, previewEntryId);
  });

  it('Preview with entry-scoped token cannot read different entry (403)', async () => {
    const res = await api(`/preview/v1/content/article/${previewEntry2Id}`, {
      token: scopedPreviewToken,
      spaceId,
    });

    assert.equal(res.status, 403);
    assert.equal((res.body as Record<string, unknown>).error, 'preview_scope_denied');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security
// ═══════════════════════════════════════════════════════════════════════════

describe('Security', () => {
  before(async () => {
    token = await getAdminToken();
    spaceId = await getSpaceId();
  });

  let cdaOnlyToken: string;

  // Cleanup: track any API tokens we create (we can't easily delete them via
  // the API since there's no DELETE /api-tokens route, so we just let them expire).
  // For the expired token test we create one that expires immediately.

  it('Request without auth returns 401', async () => {
    const res = await api('/cma/v1/schemas/types', { spaceId });
    assert.equal(res.status, 401);
    assert.equal((res.body as Record<string, unknown>).error, 'authentication_required');
  });

  it('API token with cda:read scope cannot access CMA write routes', async () => {
    // Create an API token with only cda:read scope
    const createRes = await authPost<{ token: string; id: string; scopes: string[] }>(
      '/cma/v1/auth/api-tokens',
      { name: 'cda-read-only-test', scopes: ['cda:read'] },
    );
    assert.equal(createRes.status, 201);
    cdaOnlyToken = createRes.body.token;
    assert.ok(cdaOnlyToken.startsWith('hle_'), 'API token should have hle_ prefix');

    // Try to create a content type with the cda:read-only token
    const writeRes = await api('/cma/v1/schemas/types', {
      method: 'POST',
      token: cdaOnlyToken,
      spaceId,
      body: { key: 'should-fail', name: 'Should Fail' },
    });

    assert.equal(writeRes.status, 403);
    assert.equal((writeRes.body as Record<string, unknown>).error, 'insufficient_scope');
  });

  it('Expired token is rejected', async () => {
    // Create an API token that expires in 1 second
    const createRes = await authPost<{ token: string; id: string }>(
      '/cma/v1/auth/api-tokens',
      {
        name: 'expires-soon-test',
        scopes: ['cda:read'],
        expiresAt: new Date(Date.now() + 1000).toISOString(),
      },
    );
    assert.equal(createRes.status, 201);
    const expToken = createRes.body.token;

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Attempt to use the expired token
    const res = await api('/cma/v1/schemas/types', {
      token: expToken,
      spaceId,
    });

    assert.equal(res.status, 401);
    assert.equal((res.body as Record<string, unknown>).error, 'invalid_token');
  });
});
