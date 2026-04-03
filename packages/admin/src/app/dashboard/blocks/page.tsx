'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface BlockDefinition {
  id: string;
  key: string;
  title: string;
  description?: string;
  icon?: string;
  version: string;
  builtIn: boolean;
  attributesSchema: Record<string, unknown>;
  allowedChildren?: string[];
  createdAt: string;
  updatedAt: string;
}

const iconMap: Record<string, string> = {
  pilcrow: '\u00b6',
  heading: 'H',
  image: '\ud83d\uddbc',
  megaphone: '\ud83d\udce2',
  link: '\ud83d\udd17',
  list: '\u2630',
  code: '</>',
};

export default function BlocksPage() {
  const [definitions, setDefinitions] = useState<BlockDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadDefinitions();
  }, []);

  async function loadDefinitions() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ items?: BlockDefinition[]; data?: BlockDefinition[] }>('/cma/v1/blocks/definitions');
      setDefinitions(res.items ?? res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load block definitions');
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setError('');
    try {
      await apiPost('/cma/v1/blocks/definitions/seed');
      setSuccessMsg('Core blocks seeded successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadDefinitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed core blocks');
    } finally {
      setSeeding(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Block Definitions</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage the block types available for structured content.
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          style={{ ...btnPrimary, opacity: seeding ? 0.6 : 1 }}
        >
          {seeding ? 'Seeding...' : 'Seed Core Blocks'}
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

      {successMsg && (
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          color: 'var(--green)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading block definitions...</p>
      ) : definitions.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>No block definitions yet</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Click "Seed Core Blocks" to add the standard block types (paragraph, heading, image, etc.)
          </p>
          <button onClick={handleSeed} disabled={seeding} style={btnPrimary}>
            {seeding ? 'Seeding...' : 'Seed Core Blocks'}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {definitions.map((def) => {
            const isExpanded = expandedId === def.id;
            return (
              <div
                key={def.id}
                onClick={() => setExpandedId(isExpanded ? null : def.id)}
                style={{
                  ...cardStyle,
                  borderColor: isExpanded ? 'var(--accent)' : 'var(--border)',
                }}
                onMouseOver={(e) => {
                  if (!isExpanded) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                }}
                onMouseOut={(e) => {
                  if (!isExpanded) e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0,
                  }}>
                    {iconMap[def.icon ?? ''] ?? def.icon ?? def.key.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{def.title}</span>
                      {def.builtIn && (
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: 'var(--accent-light)',
                          background: 'rgba(99,102,241,0.1)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          Built-in
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                      <code style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        background: 'var(--bg)',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                      }}>
                        {def.key}
                      </code>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>v{def.version}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {def.description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: isExpanded ? '1rem' : 0 }}>
                    {def.description}
                  </p>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <p style={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '0.4rem',
                    }}>
                      Attributes Schema
                    </p>
                    <pre style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                      color: 'var(--text-muted)',
                      overflow: 'auto',
                      maxHeight: '200px',
                      lineHeight: '1.5',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {JSON.stringify(def.attributesSchema, null, 2)}
                    </pre>
                    {def.createdAt && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.6rem' }}>
                        Created {formatDate(def.createdAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
