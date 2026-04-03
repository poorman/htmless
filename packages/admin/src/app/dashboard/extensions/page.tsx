'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface Extension {
  id: string;
  name: string;
  key: string;
  version: string;
  description?: string;
  routes?: { path: string; method?: string }[];
  hooks?: { event: string; handler?: string }[];
  createdAt: string;
  updatedAt: string;
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  // Register form
  const [manifestJson, setManifestJson] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    loadExtensions();
  }, []);

  async function loadExtensions() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ data: Extension[] }>('/cma/v1/extensions');
      setExtensions(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    setError('');
    try {
      const manifest = JSON.parse(manifestJson);
      await apiPost('/cma/v1/extensions', manifest);
      setManifestJson('');
      setShowRegister(false);
      await loadExtensions();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON: ' + err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register extension');
      }
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await apiDelete(`/cma/v1/extensions/${id}`);
      setExtensions((prev) => prev.filter((ext) => ext.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete extension');
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

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

  const btnDanger: React.CSSProperties = {
    padding: '0.4rem 0.75rem',
    background: 'transparent',
    color: 'var(--red)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    fontWeight: 500,
    fontSize: '0.75rem',
    cursor: 'pointer',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
    transition: 'border-color 0.15s',
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Extensions</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage registered extensions and plugins
          </p>
        </div>
        <button onClick={() => setShowRegister(true)} style={btnPrimary}>
          Register Extension
        </button>
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

      {/* Register modal */}
      {showRegister && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <form onSubmit={handleRegister} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Register Extension</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Paste the extension manifest JSON below.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <textarea
                value={manifestJson}
                onChange={(e) => setManifestJson(e.target.value)}
                placeholder={`{
  "name": "My Extension",
  "key": "my-extension",
  "version": "1.0.0",
  "description": "Adds custom functionality",
  "routes": [],
  "hooks": []
}`}
                required
                rows={14}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowRegister(false)} style={btnSecondary}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={registering}
                style={{ ...btnPrimary, opacity: registering ? 0.6 : 1, cursor: registering ? 'not-allowed' : 'pointer' }}
              >
                {registering ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Extensions grid */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading extensions...</p>
      ) : extensions.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>No extensions registered</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Register an extension to add custom routes, hooks, and functionality.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {extensions.map((ext) => (
            <div
              key={ext.id}
              style={cardStyle}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{ext.name}</h3>
                  <code style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-light)',
                    background: 'var(--bg)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginTop: '0.25rem',
                  }}>
                    {ext.key}
                  </code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: 'var(--text-dim)',
                    background: 'var(--bg-elevated)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                  }}>
                    v{ext.version}
                  </span>
                  <button onClick={() => handleDelete(ext.id)} style={btnDanger}>
                    Delete
                  </button>
                </div>
              </div>

              {ext.description && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {ext.description}
                </p>
              )}

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>{ext.routes?.length ?? 0} route{(ext.routes?.length ?? 0) !== 1 ? 's' : ''}</span>
                <span>{ext.hooks?.length ?? 0} hook{(ext.hooks?.length ?? 0) !== 1 ? 's' : ''}</span>
                <span style={{ marginLeft: 'auto' }}>{formatDate(ext.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
