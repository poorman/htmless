'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

interface SpaceInfo {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export default function SettingsPage() {
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Codegen state
  const [tsTypes, setTsTypes] = useState<string | null>(null);
  const [generatingTypes, setGeneratingTypes] = useState(false);
  const [copiedTypes, setCopiedTypes] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const [spaceRes, userRes] = await Promise.allSettled([
        apiGet<SpaceInfo>('/cma/v1/space'),
        apiGet<UserInfo>('/cma/v1/auth/me'),
      ]);
      if (spaceRes.status === 'fulfilled') setSpace(spaceRes.value);
      if (userRes.status === 'fulfilled') setUser(userRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTypes() {
    setGeneratingTypes(true);
    setError('');
    setTsTypes(null);
    try {
      const res = await apiGet<{ code: string } | string>('/cma/v1/codegen/typescript');
      if (typeof res === 'string') {
        setTsTypes(res);
      } else if (typeof res === 'object' && res !== null) {
        setTsTypes((res as { code?: string; types?: string }).code ?? (res as { types?: string }).types ?? JSON.stringify(res, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate types');
    } finally {
      setGeneratingTypes(false);
    }
  }

  function copyTypes() {
    if (!tsTypes) return;
    navigator.clipboard.writeText(tsTypes);
    setCopiedTypes(true);
    setTimeout(() => setCopiedTypes(false), 2000);
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.3rem',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'var(--text)',
    marginBottom: '1rem',
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

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Settings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Space configuration and developer tools
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

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading settings...</p>
      ) : (
        <>
          {/* Space info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Space</h3>
            {space ? (
              <div>
                <div>
                  <p style={labelStyle}>Name</p>
                  <p style={valueStyle}>{space.name}</p>
                </div>
                <div>
                  <p style={labelStyle}>Slug</p>
                  <p style={valueStyle}>
                    <code style={{
                      background: 'var(--bg-elevated)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      color: 'var(--accent-light)',
                    }}>
                      {space.slug}
                    </code>
                  </p>
                </div>
                <div>
                  <p style={labelStyle}>Space ID</p>
                  <p style={{ ...valueStyle, marginBottom: 0 }}>
                    <code style={{
                      background: 'var(--bg-elevated)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      color: 'var(--text-dim)',
                    }}>
                      {space.id}
                    </code>
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Unable to load space info</p>
            )}
          </div>

          {/* User info */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>User</h3>
            {user ? (
              <div>
                <div>
                  <p style={labelStyle}>Name</p>
                  <p style={valueStyle}>{user.name}</p>
                </div>
                <div>
                  <p style={labelStyle}>Email</p>
                  <p style={{ ...valueStyle, marginBottom: 0 }}>{user.email}</p>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Unable to load user info</p>
            )}
          </div>

          {/* TypeScript codegen */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>TypeScript Types</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Generate TypeScript interfaces from your content schema
                </p>
              </div>
              <button
                onClick={handleGenerateTypes}
                disabled={generatingTypes}
                style={{ ...btnPrimary, opacity: generatingTypes ? 0.6 : 1, cursor: generatingTypes ? 'not-allowed' : 'pointer' }}
              >
                {generatingTypes ? 'Generating...' : 'Generate Types'}
              </button>
            </div>

            {tsTypes && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Generated output</span>
                  <button
                    onClick={copyTypes}
                    style={{ ...btnSecondary, padding: '0.3rem 0.65rem', fontSize: '0.7rem' }}
                  >
                    {copiedTypes ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: 'var(--text)',
                  overflowX: 'auto',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  whiteSpace: 'pre',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  {tsTypes}
                </pre>
              </div>
            )}
          </div>

          {/* API links */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>API</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '100px' }}>Health</span>
                <code style={{
                  fontSize: '0.8rem',
                  color: 'var(--accent-light)',
                  background: 'var(--bg)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}>
                  GET /api/health
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '100px' }}>CDA Base</span>
                <code style={{
                  fontSize: '0.8rem',
                  color: 'var(--accent-light)',
                  background: 'var(--bg)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}>
                  /api/cda/v1/
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '100px' }}>CMA Base</span>
                <code style={{
                  fontSize: '0.8rem',
                  color: 'var(--accent-light)',
                  background: 'var(--bg)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}>
                  /api/cma/v1/
                </code>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
