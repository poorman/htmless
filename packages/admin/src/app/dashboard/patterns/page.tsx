'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface BlockInstance {
  typeKey: string;
  attrs: Record<string, unknown>;
  children?: BlockInstance[];
}

interface Pattern {
  id: string;
  title: string;
  description?: string;
  blockTree: BlockInstance[];
  typeKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createTypeKeys, setCreateTypeKeys] = useState('');
  const [createBlockTree, setCreateBlockTree] = useState('[\n  {\n    "typeKey": "heading",\n    "attrs": { "level": 2, "text": "Section Title" }\n  },\n  {\n    "typeKey": "paragraph",\n    "attrs": { "text": "Your content here..." }\n  }\n]');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadPatterns();
  }, []);

  async function loadPatterns() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ items?: Pattern[]; data?: Pattern[] }>('/cma/v1/blocks/patterns');
      setPatterns(res.items ?? res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim()) return;

    let parsedTree: BlockInstance[];
    try {
      parsedTree = JSON.parse(createBlockTree);
      if (!Array.isArray(parsedTree)) {
        setError('Block tree must be a JSON array');
        return;
      }
    } catch {
      setError('Invalid JSON in block tree');
      return;
    }

    const typeKeysArr = createTypeKeys.trim()
      ? createTypeKeys.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined;

    setCreating(true);
    setError('');
    try {
      await apiPost('/cma/v1/blocks/patterns', {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        blockTree: parsedTree,
        typeKeys: typeKeysArr,
      });
      showSuccess('Pattern created');
      setShowCreate(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateTypeKeys('');
      setCreateBlockTree('[\n  {\n    "typeKey": "heading",\n    "attrs": { "level": 2, "text": "Section Title" }\n  },\n  {\n    "typeKey": "paragraph",\n    "attrs": { "text": "Your content here..." }\n  }\n]');
      await loadPatterns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pattern');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await apiDelete(`/cma/v1/blocks/patterns/${id}`);
      showSuccess('Pattern deleted');
      setExpandedId(null);
      await loadPatterns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pattern');
    }
  }

  function countBlocks(tree: BlockInstance[]): number {
    let count = 0;
    for (const block of tree) {
      count += 1;
      if (block.children && block.children.length > 0) {
        count += countBlocks(block.children);
      }
    }
    return count;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
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

  const btnDanger: React.CSSProperties = {
    ...btnSecondary,
    color: 'var(--red)',
    borderColor: 'rgba(239,68,68,0.3)',
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Patterns</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Reusable block layouts for content creation.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>
          New Pattern
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

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <form onSubmit={handleCreate} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Create New Pattern</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Title *
              </label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Blog Post Layout"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Description
              </label>
              <input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Brief description of this pattern..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Applicable Content Types
              </label>
              <input
                value={createTypeKeys}
                onChange={(e) => setCreateTypeKeys(e.target.value)}
                placeholder="article, page (comma-separated, or leave empty for all)"
                style={inputStyle}
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Leave empty to make this pattern available for all content types.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Block Tree (JSON) *
              </label>
              <textarea
                value={createBlockTree}
                onChange={(e) => setCreateBlockTree(e.target.value)}
                rows={12}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: '1.5' }}
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                An array of block instances. Each block has typeKey, attrs, and optional children.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{ ...btnPrimary, opacity: creating ? 0.6 : 1, cursor: creating ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Creating...' : 'Create Pattern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patterns Grid */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading patterns...</p>
      ) : patterns.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>No patterns yet</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Create your first pattern to define reusable block layouts.
          </p>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>
            New Pattern
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}>
          {patterns.map((pattern) => {
            const isExpanded = expandedId === pattern.id;
            const blockCount = countBlocks(pattern.blockTree ?? []);
            const blockTypes = Array.isArray(pattern.blockTree)
              ? [...new Set(pattern.blockTree.map((b) => b.typeKey))]
              : [];

            return (
              <div
                key={pattern.id}
                onClick={() => setExpandedId(isExpanded ? null : pattern.id)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
                    {pattern.title}
                  </p>
                  <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-dim)',
                    background: 'var(--bg-elevated)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}>
                    {blockCount} block{blockCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {pattern.description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '0.65rem' }}>
                    {pattern.description}
                  </p>
                )}

                {/* Block type tags */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: isExpanded ? '0.75rem' : 0 }}>
                  {blockTypes.map((type) => (
                    <span key={type} style={{
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      color: 'var(--accent-light)',
                      background: 'rgba(99,102,241,0.1)',
                      padding: '0.12rem 0.4rem',
                      borderRadius: '4px',
                    }}>
                      {type}
                    </span>
                  ))}
                  {pattern.typeKeys && pattern.typeKeys.length > 0 && (
                    <>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', alignSelf: 'center' }}>|</span>
                      {pattern.typeKeys.map((tk) => (
                        <span key={tk} style={{
                          fontSize: '0.65rem',
                          fontWeight: 500,
                          color: 'var(--green)',
                          background: 'rgba(34,197,94,0.1)',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '4px',
                        }}>
                          {tk}
                        </span>
                      ))}
                    </>
                  )}
                </div>

                {/* Expanded view */}
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
                      Block Tree
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
                      maxHeight: '250px',
                      lineHeight: '1.5',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {JSON.stringify(pattern.blockTree, null, 2)}
                    </pre>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        Created {formatDate(pattern.createdAt)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(pattern.id);
                        }}
                        style={{ ...btnDanger, padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                      >
                        Delete
                      </button>
                    </div>
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
