'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import BlocksEditor, { BlockInstance } from './blocks-editor';
import PatternPicker from './pattern-picker';

interface Version {
  id: string;
  version: number;
  kind: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface ContentTypeInfo {
  key: string;
  name: string;
}

interface FieldDef {
  key: string;
  name: string;
  type: string;
}

interface Entry {
  id: string;
  slug: string;
  contentTypeKey: string;
  contentType?: ContentTypeInfo;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  versions?: Version[];
  _etag?: string;
}

const statusColors: Record<string, { color: string; bg: string }> = {
  draft: { color: 'var(--text-dim)', bg: 'rgba(113,113,122,0.15)' },
  published: { color: 'var(--green)', bg: 'rgba(34,197,94,0.15)' },
  scheduled: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.15)' },
  archived: { color: 'var(--red)', bg: 'rgba(239,68,68,0.15)' },
};

const versionKindLabels: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  scheduled: 'Scheduled',
};

export default function ContentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [blocksData, setBlocksData] = useState<Record<string, BlockInstance[]>>({});
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [patternTargetField, setPatternTargetField] = useState<string | null>(null);

  const spaceId = 'cmnibacxs0005crr6jxgrt3e8';

  const loadEntry = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Entry>(`/cma/v1/entries/${id}`);
      setEntry(data);

      // Try to load field definitions for the content type
      const typeKey = data.contentType?.key ?? data.contentTypeKey;
      let fields: FieldDef[] = [];
      if (typeKey) {
        try {
          const typeRes = await apiGet<{ fields?: FieldDef[] }>(`/cma/v1/schemas/types/${typeKey}`);
          fields = typeRes.fields ?? [];
          setFieldDefs(fields);
        } catch {
          // Schema fetch failed, proceed without field type info
        }
      }

      // Determine which fields are richtext/blocks based on schema
      const blockFieldKeys = new Set(
        fields.filter((f) => f.type === 'richtext' || f.type === 'blocks').map((f) => f.key)
      );

      // Flatten entry data into form strings + extract blocks data
      const latestData = data.versions && data.versions.length > 0
        ? (data.versions[0].data as Record<string, unknown>)
        : (data.data && typeof data.data === 'object' ? data.data : {});

      const flat: Record<string, string> = {};
      const blocks: Record<string, BlockInstance[]> = {};

      if (latestData && typeof latestData === 'object') {
        for (const [key, val] of Object.entries(latestData)) {
          if (blockFieldKeys.has(key) && Array.isArray(val)) {
            blocks[key] = val as BlockInstance[];
          } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'typeKey' in val[0]) {
            // Auto-detect blocks arrays even without schema info
            blocks[key] = val as BlockInstance[];
          } else {
            flat[key] = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
          }
        }
      }
      setFormData(flat);
      setBlocksData(blocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entry');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  // Build data object from form, trying to parse JSON where applicable
  function buildData(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(formData)) {
      // Try to parse JSON objects/arrays
      if ((val.startsWith('{') || val.startsWith('[')) && val.length > 1) {
        try {
          result[key] = JSON.parse(val);
          continue;
        } catch { /* use as string */ }
      }
      // Try numbers
      if (val !== '' && !isNaN(Number(val)) && val.trim() === val) {
        result[key] = Number(val);
      } else if (val === 'true') {
        result[key] = true;
      } else if (val === 'false') {
        result[key] = false;
      } else {
        result[key] = val;
      }
    }
    // Merge blocks data
    for (const [key, blocks] of Object.entries(blocksData)) {
      result[key] = blocks;
    }
    return result;
  }

  function handleBlocksChange(fieldKey: string, blocks: BlockInstance[]) {
    setBlocksData((prev) => ({ ...prev, [fieldKey]: blocks }));
  }

  function handleInsertPattern(fieldKey: string) {
    setPatternTargetField(fieldKey);
    setShowPatternPicker(true);
  }

  function handlePatternSelect(blocks: BlockInstance[]) {
    if (patternTargetField) {
      const existing = blocksData[patternTargetField] ?? [];
      setBlocksData((prev) => ({ ...prev, [patternTargetField]: [...existing, ...blocks] }));
    }
    setShowPatternPicker(false);
    setPatternTargetField(null);
  }

  async function handleSaveDraft() {
    if (!entry) return;
    setSaving(true);
    setError('');
    try {
      const extraHeaders: Record<string, string> = {};
      if (entry._etag) {
        extraHeaders['If-Match'] = entry._etag;
      }
      await apiPost(`/cma/v1/entries/${id}/save-draft`, { data: buildData() }, extraHeaders);
      showSuccess('Draft saved');
      await loadEntry();
    } catch (err) {
      if (err instanceof ApiError && err.status === 412) {
        setError('Conflict: entry was modified by another user. Please reload.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save draft');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError('');
    try {
      await apiPost(`/cma/v1/entries/${id}/publish`);
      showSuccess('Entry published');
      await loadEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setUnpublishing(true);
    setError('');
    try {
      await apiPost(`/cma/v1/entries/${id}/unpublish`);
      showSuccess('Entry unpublished');
      await loadEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish');
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleDate) return;
    setScheduling(true);
    setError('');
    try {
      await apiPost(`/cma/v1/entries/${id}/schedule`, { publishAt: new Date(scheduleDate).toISOString() });
      showSuccess('Entry scheduled');
      setShowSchedule(false);
      setScheduleDate('');
      await loadEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  }

  async function handlePreview() {
    try {
      const result = await apiPost<{ token: string }>('/cma/v1/preview-tokens', { entryId: id });
      const previewUrl = `/api/cda/v1/preview/${result.token}`;
      window.open(previewUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preview token');
    }
  }

  function handleFieldChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function addField() {
    const key = prompt('Enter field key:');
    if (!key || key.trim() === '') return;
    setFormData((prev) => ({ ...prev, [key.trim()]: '' }));
  }

  function removeField(key: string) {
    setFormData((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function isMultiline(val: string): boolean {
    return val.length > 120 || val.includes('\n') || val.startsWith('{') || val.startsWith('[');
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
  };

  const btnPrimary: React.CSSProperties = {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '0.5rem 1rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontWeight: 500,
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const btnDanger: React.CSSProperties = {
    ...btnSecondary,
    color: 'var(--red)',
    borderColor: 'rgba(239,68,68,0.3)',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading entry...</p>;
  }

  if (!entry) {
    return (
      <div>
        <p style={{ color: 'var(--red)', fontSize: '0.9rem', marginBottom: '1rem' }}>{error || 'Entry not found'}</p>
        <button onClick={() => router.push('/dashboard/content')} style={btnSecondary}>Back to Content</button>
      </div>
    );
  }

  const st = statusColors[entry.status] ?? statusColors.draft;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={() => router.push('/dashboard/content')}
            style={{ ...btnSecondary, padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginBottom: '0.75rem' }}
          >
            &larr; Back
          </button>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{entry.contentTypeKey} / </span>
            {entry.slug || entry.id}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handlePreview} style={btnSecondary}>Preview</button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            style={{ ...btnSecondary, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          {entry.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              disabled={unpublishing}
              style={{ ...btnDanger, opacity: unpublishing ? 0.6 : 1 }}
            >
              {unpublishing ? 'Unpublishing...' : 'Unpublish'}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={{ ...btnPrimary, background: 'var(--green)', opacity: publishing ? 0.6 : 1 }}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
          <button onClick={() => setShowSchedule(!showSchedule)} style={btnSecondary}>
            Schedule
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {/* Schedule Modal */}
      {showSchedule && (
        <div style={{ ...cardStyle, marginBottom: '1rem' }}>
          <form onSubmit={handleSchedule} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Publish At
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={scheduling}
              style={{ ...btnPrimary, background: 'var(--amber)', color: '#000', opacity: scheduling ? 0.6 : 1 }}
            >
              {scheduling ? 'Scheduling...' : 'Schedule Publish'}
            </button>
            <button type="button" onClick={() => setShowSchedule(false)} style={btnSecondary}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Editor */}
        <div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Fields</h3>
              <button onClick={addField} style={{ ...btnSecondary, padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}>
                + Add Field
              </button>
            </div>
            {Object.keys(formData).length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No fields. Click "Add Field" to start editing.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(formData).map(([key, val]) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                        {key}
                      </label>
                      <button
                        onClick={() => removeField(key)}
                        title="Remove field"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: '0.1rem 0.3rem',
                        }}
                      >
                        x
                      </button>
                    </div>
                    {isMultiline(val) ? (
                      <textarea
                        value={val}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        rows={Math.min(Math.max(val.split('\n').length, 3), 15)}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    ) : (
                      <input
                        value={val}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Block Editor Fields */}
          {Object.entries(blocksData).map(([fieldKey, blocks]) => {
            const fieldDef = fieldDefs.find((f) => f.key === fieldKey);
            const fieldLabel = fieldDef?.name ?? fieldKey;
            return (
              <div key={fieldKey} style={{ ...cardStyle, marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{fieldLabel}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                      {fieldDef?.type === 'richtext' ? 'Rich text (blocks)' : 'Block content'} field
                    </p>
                  </div>
                  <button
                    onClick={() => handleInsertPattern(fieldKey)}
                    style={{ ...btnSecondary, padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                  >
                    Insert Pattern
                  </button>
                </div>
                <BlocksEditor
                  blocks={blocks}
                  onChange={(updated) => handleBlocksChange(fieldKey, updated)}
                  spaceId={spaceId}
                />
              </div>
            );
          })}

          {/* Pattern Picker Modal */}
          {showPatternPicker && (
            <PatternPicker
              onSelect={handlePatternSelect}
              onClose={() => { setShowPatternPicker(false); setPatternTargetField(null); }}
              spaceId={spaceId}
              typeKey={entry?.contentType?.key ?? entry?.contentTypeKey}
            />
          )}

          {/* Version History */}
          {entry.versions && entry.versions.length > 0 && (
            <div style={{ ...cardStyle, marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Version History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {entry.versions.map((v, i) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.6rem 0.85rem',
                      background: i === 0 ? 'rgba(99,102,241,0.08)' : 'transparent',
                      borderRadius: '6px',
                      border: i === 0 ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        background: v.kind === 'published' ? 'rgba(34,197,94,0.15)' : v.kind === 'scheduled' ? 'rgba(245,158,11,0.15)' : 'rgba(113,113,122,0.15)',
                        color: v.kind === 'published' ? 'var(--green)' : v.kind === 'scheduled' ? 'var(--amber)' : 'var(--text-dim)',
                      }}>
                        {versionKindLabels[v.kind] ?? v.kind}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        v{v.version}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {formatDate(v.createdAt)}
                      </span>
                      {i !== 0 && (
                        <button
                          onClick={() => {
                            // Revert: load this version's data into the form
                            const blockFieldKeys = new Set(
                              fieldDefs.filter((f) => f.type === 'richtext' || f.type === 'blocks').map((f) => f.key)
                            );
                            const flat: Record<string, string> = {};
                            const blocks: Record<string, BlockInstance[]> = {};
                            if (v.data && typeof v.data === 'object') {
                              for (const [key, val] of Object.entries(v.data)) {
                                if (blockFieldKeys.has(key) && Array.isArray(val)) {
                                  blocks[key] = val as BlockInstance[];
                                } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'typeKey' in (val[0] as Record<string, unknown>)) {
                                  blocks[key] = val as BlockInstance[];
                                } else {
                                  flat[key] = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
                                }
                              }
                            }
                            setFormData(flat);
                            setBlocksData(blocks);
                            showSuccess(`Reverted to v${v.version}. Click "Save Draft" to persist.`);
                          }}
                          style={{ ...btnSecondary, padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                        >
                          Revert
                        </button>
                      )}
                      {i === 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 500 }}>Current</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={cardStyle}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.85rem' }}>Status</h4>
            <span style={{
              display: 'inline-block',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: st.color,
              background: st.bg,
              textTransform: 'capitalize',
            }}>
              {entry.status}
            </span>
          </div>

          <div style={cardStyle}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.85rem' }}>Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ID</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{entry.id}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Slug</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.slug || '--'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Content Type</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.contentTypeKey}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(entry.createdAt)}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Updated</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(entry.updatedAt)}</p>
              </div>
              {entry.publishedAt && (
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Published</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--green)' }}>{formatDate(entry.publishedAt)}</p>
                </div>
              )}
              {entry.scheduledAt && (
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scheduled For</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--amber)' }}>{formatDate(entry.scheduledAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
