'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import type { BlockInstance } from './blocks-editor';

interface Pattern {
  id: string;
  title: string;
  description?: string;
  blockTree: BlockInstance[];
  typeKeys?: string[];
  createdAt: string;
}

interface PatternPickerProps {
  onSelect: (blocks: BlockInstance[]) => void;
  onClose: () => void;
  spaceId: string;
  typeKey?: string;
}

export default function PatternPicker({ onSelect, onClose, spaceId, typeKey }: PatternPickerProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPatterns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ items?: Pattern[]; data?: Pattern[] }>('/cma/v1/blocks/patterns');
      let all = res.items ?? res.data ?? [];
      // Filter by typeKey if provided
      if (typeKey) {
        all = all.filter((p) => {
          if (!p.typeKeys || p.typeKeys.length === 0) return true;
          return p.typeKeys.includes(typeKey);
        });
      }
      setPatterns(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  }, [spaceId, typeKey]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  function handleSelect(pattern: Pattern) {
    // Ensure blockTree is an array
    const tree = Array.isArray(pattern.blockTree) ? pattern.blockTree : [];
    onSelect(tree);
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Insert Pattern</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Select a pattern to insert its blocks into the editor.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '0.35rem 0.7rem',
            }}
          >
            Cancel
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            color: 'var(--red)',
            fontSize: '0.8rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
              Loading patterns...
            </p>
          ) : patterns.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                No patterns available
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                Create patterns from the Patterns page to reuse block layouts.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '0.75rem',
            }}>
              {patterns.map((pattern) => {
                const blockCount = countBlocks(pattern.blockTree ?? []);
                return (
                  <button
                    key={pattern.id}
                    onClick={() => handleSelect(pattern)}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg)';
                    }}
                  >
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>
                      {pattern.title}
                    </p>
                    {pattern.description && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                        {pattern.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        background: 'var(--bg-surface)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                      }}>
                        {blockCount} block{blockCount !== 1 ? 's' : ''}
                      </span>
                      {pattern.typeKeys && pattern.typeKeys.length > 0 && (
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--accent-light)',
                          background: 'rgba(99,102,241,0.1)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                        }}>
                          {pattern.typeKeys.join(', ')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
