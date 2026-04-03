'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';

const API_TOKEN_SCOPES = [
  { value: 'cda:read', label: 'Content Delivery (read)' },
  { value: 'cma:read', label: 'Content Management (read)' },
  { value: 'cma:write', label: 'Content Management (write)' },
];

interface ApiTokenResponse {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  expiresAt?: string;
}

interface PreviewTokenResponse {
  token: string;
  expiresAt: string;
}

export default function TokensPage() {
  const [error, setError] = useState('');

  // API token form
  const [tokenName, setTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState<string[]>([]);
  const [tokenExpiry, setTokenExpiry] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Preview token form
  const [previewEntryId, setPreviewEntryId] = useState('');
  const [previewRoute, setPreviewRoute] = useState('');
  const [previewTtl, setPreviewTtl] = useState('3600');
  const [creatingPreview, setCreatingPreview] = useState(false);
  const [createdPreview, setCreatedPreview] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  function toggleScope(scope: string) {
    setTokenScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (tokenScopes.length === 0) {
      setError('Select at least one scope');
      return;
    }
    setCreatingToken(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: tokenName,
        scopes: tokenScopes,
      };
      if (tokenExpiry) {
        body.expiresAt = new Date(tokenExpiry).toISOString();
      }
      const res = await apiPost<ApiTokenResponse>('/cma/v1/auth/api-tokens', body);
      setCreatedToken(res.token);
      setTokenName('');
      setTokenScopes([]);
      setTokenExpiry('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API token');
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleCreatePreview(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPreview(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        ttl: parseInt(previewTtl, 10) || 3600,
      };
      if (previewEntryId.trim()) body.entryId = previewEntryId.trim();
      if (previewRoute.trim()) body.route = previewRoute.trim();
      const res = await apiPost<PreviewTokenResponse>('/cma/v1/auth/preview-tokens', body);
      setCreatedPreview(res.token);
      setPreviewEntryId('');
      setPreviewRoute('');
      setPreviewTtl('3600');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preview token');
    } finally {
      setCreatingPreview(false);
    }
  }

  function copyToClipboard(text: string, type: 'token' | 'preview') {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.85rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '0.55rem 1.1rem',
    background: 'var(--accent)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '0.55rem 1.1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontWeight: 500,
    fontSize: '0.85rem',
    cursor: 'pointer',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
  };

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>API Tokens</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Create tokens for API access and content previews
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: 'var(--red)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Created API token reveal */}
      {createdToken && (
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.5rem' }}>
            API token created. Copy it now -- it will not be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              flex: 1,
              background: 'var(--bg)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text)',
              wordBreak: 'break-all',
            }}>
              {createdToken}
            </code>
            <button
              onClick={() => copyToClipboard(createdToken, 'token')}
              style={{ ...btnSecondary, padding: '0.4rem 0.75rem', fontSize: '0.75rem', flexShrink: 0 }}
            >
              {copiedToken ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setCreatedToken(null)}
            style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Created preview token reveal */}
      {createdPreview && (
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.5rem' }}>
            Preview token created. Copy it now -- it will not be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              flex: 1,
              background: 'var(--bg)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: 'var(--text)',
              wordBreak: 'break-all',
            }}>
              {createdPreview}
            </code>
            <button
              onClick={() => copyToClipboard(createdPreview, 'preview')}
              style={{ ...btnSecondary, padding: '0.4rem 0.75rem', fontSize: '0.75rem', flexShrink: 0 }}
            >
              {copiedPreview ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setCreatedPreview(null)}
            style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* API Token creation form */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Create API Token</h3>
        <form onSubmit={handleCreateToken}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Name *</label>
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="My API Token"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Scopes *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {API_TOKEN_SCOPES.map((scope) => (
                <label key={scope.value} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.2rem 0',
                }}>
                  <input
                    type="checkbox"
                    checked={tokenScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <code style={{ fontSize: '0.8rem', color: 'var(--accent-light)' }}>{scope.value}</code>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>-- {scope.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Expiry (optional)</label>
            <input
              type="date"
              value={tokenExpiry}
              onChange={(e) => setTokenExpiry(e.target.value)}
              style={{ ...inputStyle, maxWidth: '220px', colorScheme: 'dark' }}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
              Leave empty for a non-expiring token.
            </p>
          </div>

          <button
            type="submit"
            disabled={creatingToken}
            style={{ ...btnPrimary, opacity: creatingToken ? 0.6 : 1, cursor: creatingToken ? 'not-allowed' : 'pointer' }}
          >
            {creatingToken ? 'Creating...' : 'Create API Token'}
          </button>
        </form>
      </div>

      {/* Preview Token creation form */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Create Preview Token</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          Generate a short-lived token for previewing draft or unpublished content.
        </p>
        <form onSubmit={handleCreatePreview}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Entry ID (optional)</label>
              <input
                value={previewEntryId}
                onChange={(e) => setPreviewEntryId(e.target.value)}
                placeholder="cla1b2c3..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Route (optional)</label>
              <input
                value={previewRoute}
                onChange={(e) => setPreviewRoute(e.target.value)}
                placeholder="/blog/my-draft"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>TTL (seconds) *</label>
            <input
              type="number"
              value={previewTtl}
              onChange={(e) => setPreviewTtl(e.target.value)}
              min="60"
              max="86400"
              required
              style={{ ...inputStyle, maxWidth: '180px' }}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
              How long the preview token remains valid (60-86400 seconds).
            </p>
          </div>

          <button
            type="submit"
            disabled={creatingPreview}
            style={{ ...btnPrimary, opacity: creatingPreview ? 0.6 : 1, cursor: creatingPreview ? 'not-allowed' : 'pointer' }}
          >
            {creatingPreview ? 'Creating...' : 'Create Preview Token'}
          </button>
        </form>
      </div>
    </>
  );
}
