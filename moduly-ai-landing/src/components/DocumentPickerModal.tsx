import { useState, useEffect, useCallback } from 'react';
import type { DocumentRow } from '../lib/ai/types';
import { supabase } from '../lib/supabase';
import './DocumentPickerModal.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds: Set<string>;
  onSave: (selected: DocumentRow[]) => void;
}

interface S3File {
  readonly filename: string;
  readonly size: number;
  readonly lastModified: string;
}

type MergedDoc = DocumentRow & {
  readonly source: 'supabase' | 'utho';
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractTitle(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1] ?? filePath;
  return filename
    .replace(/^\d+-/, '')
    .replace(/_/g, ' ')
    .replace(/\.(pdf|docx?)$/i, '');
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DocumentPickerModal({ isOpen, onClose, initialSelectedIds, onSave }: DocumentPickerModalProps) {
  const [merged, setMerged] = useState<MergedDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // ── Fetch and merge data ─────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';

      // 1. Fetch parsed docs from Supabase using the frontend client
      const { data: supaData, error: supaErr } = await supabase
        .from('documents')
        .select('*');
        
      if (supaErr) throw new Error(`Supabase query failed: ${supaErr.message}`);

      // 2. Fetch all S3 files from backend list-files endpoint
      const s3Res = await fetch(`${backendBase}/list-files`);
      if (!s3Res.ok) throw new Error('S3 fetch failed');
      const s3Data = await s3Res.json();

      const supabaseDocs: DocumentRow[] = supaData || [];
      const s3Files: S3File[] = Array.isArray(s3Data?.files) ? s3Data.files : [];

      // Build a set of file_paths that are already in Supabase
      const parsedPaths = new Set(supabaseDocs.map(d => d.file_path));

      // Merge: Supabase docs first, then unparsed S3 files
      const supaEntries: MergedDoc[] = supabaseDocs.map(d => ({ ...d, source: 'supabase' as const }));

      const uthoEntries: MergedDoc[] = s3Files
        .filter(f => f.filename.endsWith('.pdf') || f.filename.endsWith('.doc') || f.filename.endsWith('.docx'))
        .filter(f => !parsedPaths.has(f.filename))
        .map(f => ({
          id: `utho-${f.filename}`,
          user_id: '',
          title: extractTitle(f.filename),
          file_path: f.filename,
          file_type: f.filename.endsWith('.pdf') ? 'application/pdf' : 'application/msword',
          subject_id: null,
          module_id: null,
          created_at: f.lastModified,
          status: 'processing' as const,
          chunk_count: 0,
          file_size: f.size,
          updated_at: f.lastModified,
          source: 'utho' as const,
        }));

      setMerged([...supaEntries, ...uthoEntries]);
    } catch (err) {
      console.error('DocumentPickerModal fetch error:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sync selection from parent ───────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedIds));
      fetchDocuments();
    }
  }, [isOpen, initialSelectedIds, fetchDocuments]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleDoc = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map(d => d.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    const selected = merged.filter(d => selectedIds.has(d.id));
    onSave(selected);
    onClose();
  };

  // ── Filtering ────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? merged.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
    : merged;

  const parsedCount = filtered.filter(d => d.source === 'supabase').length;
  const unparsedCount = filtered.filter(d => d.source === 'utho').length;

  if (!isOpen) return null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="dp-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dp-header">
          <div className="dp-header-top">
            <h2 className="dp-title">
              <span className="material-icons-outlined dp-title-icon">library_books</span>
              Document Library
            </h2>
            <button className="dp-close-btn" onClick={onClose} title="Close">
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <p className="dp-subtitle">
            Select documents to include in your study session.
            {unparsedCount > 0 && (
              <span className="dp-unparsed-note">
                {' '}{unparsedCount} unparsed admin upload{unparsedCount !== 1 ? 's' : ''} will be processed when you start.
              </span>
            )}
          </p>
        </div>

        {/* Search + Actions */}
        <div className="dp-toolbar">
          <div className="dp-search">
            <span className="material-icons-outlined dp-search-icon">search</span>
            <input
              className="dp-search-input"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="dp-search-clear" onClick={() => setSearch('')}>
                <span className="material-icons-outlined">close</span>
              </button>
            )}
          </div>
          <div className="dp-toolbar-actions">
            <button className="dp-text-btn" onClick={selectAll}>Select All</button>
            <button className="dp-text-btn" onClick={selectNone}>Clear</button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="dp-tabs">
          <span className="dp-tab dp-tab--active">
            All ({filtered.length})
          </span>
          {parsedCount > 0 && (
            <span className="dp-tab">
              <span className="dp-tab-dot dp-tab-dot--ready" />
              Parsed ({parsedCount})
            </span>
          )}
          {unparsedCount > 0 && (
            <span className="dp-tab">
              <span className="dp-tab-dot dp-tab-dot--unparsed" />
              Admin Uploads ({unparsedCount})
            </span>
          )}
        </div>

        {/* Document List */}
        <div className="dp-list">
          {loading ? (
            <div className="dp-loading">
              <span className="material-icons-outlined dp-spin">sync</span>
              <p>Loading documents...</p>
            </div>
          ) : error ? (
            <div className="dp-error">
              <span className="material-icons-outlined">error_outline</span>
              <p>{error}</p>
              <button className="dp-retry-btn" onClick={() => { void fetchDocuments(); }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="dp-empty">
              <span className="material-icons-outlined">folder_off</span>
              <p>{search ? 'No documents match your search.' : 'No documents available.'}</p>
            </div>
          ) : (
            filtered.map(doc => {
              const isSelected = selectedIds.has(doc.id);
              const isUnparsed = doc.source === 'utho';
              const isPdf = doc.file_type === 'application/pdf';

              return (
                <button
                  key={doc.id}
                  className={`dp-item ${isSelected ? 'dp-item--selected' : ''} ${isUnparsed ? 'dp-item--unparsed' : ''}`}
                  onClick={() => toggleDoc(doc.id)}
                >
                  <div className={`dp-check ${isSelected ? 'dp-check--on' : ''}`}>
                    {isSelected && <span className="material-icons-outlined dp-check-icon">check</span>}
                  </div>
                  <span className={`material-icons-outlined dp-item-icon ${isPdf ? 'dp-item-icon--pdf' : 'dp-item-icon--doc'}`}>
                    {isPdf ? 'picture_as_pdf' : 'description'}
                  </span>
                  <div className="dp-item-info">
                    <span className="dp-item-name">{doc.title}</span>
                    <span className="dp-item-meta">
                      {isUnparsed ? (
                        <>
                          <span className="dp-badge dp-badge--unparsed">Admin Upload · Unparsed</span>
                          {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                        </>
                      ) : (
                        <>
                          {doc.chunk_count > 0 && <span className="dp-badge dp-badge--ready">{doc.chunk_count} chunks</span>}
                          {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                          {doc.created_at ? ` · ${timeAgo(doc.created_at)}` : ''}
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="dp-footer">
          <span className="dp-selection-count">
            {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="dp-footer-actions">
            <button className="dp-cancel-btn" onClick={onClose}>Cancel</button>
            <button className="dp-save-btn" onClick={handleSave}>
              <span className="material-icons-outlined">check</span>
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
