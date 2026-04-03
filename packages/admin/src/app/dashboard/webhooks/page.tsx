'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

const WEBHOOK_EVENTS = [
  'entry.created',
  'entry.published',
  'entry.unpublished',
  'entry.deleted',
  'asset.created',
  'asset.updated',
  'asset.deleted',
  'schema.typeCreated',
  'schema.typeUpdated',
  'schema.typeDeleted',
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  signingSecret?: string;
  deliveryCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Delivery {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number;
  responseTimeMs: number;
  attempt: number;
  success: boolean;
  timestamp: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [deliveriesLoading, setDeliveriesLoading] = useState<string | null>(null);

  // Create form state
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ data: Webhook[] }>('/cma/v1/webhooks');
      setWebhooks(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newEvents.length === 0) {
      setError('Select at least one event');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await apiPost<Webhook>('/cma/v1/webhooks', {
        url: newUrl,
        events: newEvents,
        active: newActive,
      });
      if (res.signingSecret) {
        setCreatedSecret(res.signingSecret);
      }
      setNewUrl('');
      setNewEvents([]);
      setNewActive(true);
      setShowCreate(false);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(webhook: Webhook) {
    setError('');
    try {
      await apiPatch(`/cma/v1/webhooks/${webhook.id}`, { active: !webhook.active });
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  }

  async function handleDelete(id: string) {
    setError('');
    try {
      await apiDelete(`/cma/v1/webhooks/${id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  }

  async function toggleDeliveries(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!deliveries[id]) {
      setDeliveriesLoading(id);
      try {
        const res = await apiGet<{ data: Delivery[] }>(`/cma/v1/webhooks/${id}/deliveries`);
        setDeliveries((prev) => ({ ...prev, [id]: res.data ?? [] }));
      } catch {
        setDeliveries((prev) => ({ ...prev, [id]: [] }));
      } finally {
        setDeliveriesLoading(null);
      }
    }
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
    marginBottom: '0.75rem',
  };

  const badgeStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: 600,
    background: active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
    color: active ? 'var(--green)' : 'var(--red)',
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Webhooks</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage event notifications to external services
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>
          New Webhook
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

      {/* Signing secret reveal after creation */}
      {createdSecret && (
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
        }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.5rem' }}>
            Webhook created. Copy the signing secret now -- it will not be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{
              flex: 1,
              background: 'var(--bg)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              color: 'var(--text)',
              wordBreak: 'break-all',
            }}>
              {createdSecret}
            </code>
            <button
              onClick={() => copyToClipboard(createdSecret)}
              style={{ ...btnSecondary, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            >
              {copiedSecret ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create modal */}
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
            maxWidth: '520px',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>New Webhook</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Endpoint URL *
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Events *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.25rem 0',
                  }}>
                    <input
                      type="checkbox"
                      checked={newEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <code style={{ fontSize: '0.75rem' }}>{event}</code>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}>
                <div
                  onClick={() => setNewActive(!newActive)}
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: newActive ? 'var(--accent)' : 'var(--border)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: newActive ? '18px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </div>
                Active
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} style={btnSecondary}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{ ...btnPrimary, opacity: creating ? 0.6 : 1, cursor: creating ? 'not-allowed' : 'pointer' }}
              >
                {creating ? 'Creating...' : 'Create Webhook'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks list */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading webhooks...</p>
      ) : webhooks.length === 0 ? (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>No webhooks configured</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            Create a webhook to send event notifications to external services.
          </p>
        </div>
      ) : (
        <div>
          {webhooks.map((wh) => (
            <div key={wh.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <code style={{
                      fontSize: '0.85rem',
                      color: 'var(--accent-light)',
                      wordBreak: 'break-all',
                    }}>
                      {wh.url}
                    </code>
                    <span style={badgeStyle(wh.active)}>
                      {wh.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    {wh.events.map((ev) => (
                      <span key={ev} style={{
                        fontSize: '0.65rem',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-dim)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}>
                        {ev}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {wh.deliveryCount !== undefined && (
                      <span>{wh.deliveryCount} deliveries</span>
                    )}
                    <span>Created {formatDate(wh.createdAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
                  <button
                    onClick={() => handleToggle(wh)}
                    style={{ ...btnSecondary, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    {wh.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => toggleDeliveries(wh.id)}
                    style={{ ...btnSecondary, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    {expandedId === wh.id ? 'Hide' : 'Deliveries'}
                  </button>
                  <button onClick={() => handleDelete(wh.id)} style={btnDanger}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Deliveries panel */}
              {expandedId === wh.id && (
                <div style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border)',
                }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recent Deliveries</h4>
                  {deliveriesLoading === wh.id ? (
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Loading deliveries...</p>
                  ) : (deliveries[wh.id]?.length ?? 0) === 0 ? (
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No deliveries yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {deliveries[wh.id].map((del) => (
                        <div key={del.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg)',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                        }}>
                          <span style={badgeStyle(del.success)}>
                            {del.success ? 'OK' : 'Fail'}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {del.statusCode}
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                            {del.responseTimeMs}ms
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                            attempt {del.attempt}
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginLeft: 'auto' }}>
                            {formatDate(del.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
