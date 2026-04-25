import { useState, useEffect, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DocumentRow } from '../lib/ai/types';
import { ButtonColorful } from '../components/ui/button-colorful';
import './Library.css';

/* ─── Display helpers ────────────────────────────────────────────────────── */

function inferDocType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('question paper') || t.includes('pyq') || t.includes('previous year') || t.includes(' qp')) return 'PYQ';
  if (t.includes('mind map') || t.includes('concept map') || t.includes('diagram')) return 'Mind Map';
  if (t.includes('lab manual') || t.includes('laboratory')) return 'Lab Manual';
  return 'Notes';
}

function getDocTypeColor(type: string): string {
  if (type === 'PYQ') return 'amber';
  if (type === 'Mind Map') return 'rose';
  if (type === 'Lab Manual') return 'teal';
  return 'violet';
}

function getDocTypeIcon(type: string): string {
  if (type === 'PYQ') return 'quiz';
  if (type === 'Mind Map') return 'account_tree';
  if (type === 'Lab Manual') return 'science';
  return 'menu_book';
}

function getIconBgVar(type: string): number {
  if (type === 'PYQ') return 3;
  if (type === 'Mind Map') return 4;
  if (type === 'Lab Manual') return 2;
  return 1;
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function inferSubject(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('data struct') || t.includes('tree') || t.includes('graph') || t.includes('sorting') || t.includes('algorithm') || t.includes('binary') || t.includes('heap') || t.includes('hash')) return 'Data Structures';
  if (t.includes('operating system') || t.includes(' os ') || t.includes('paging') || t.includes('segmentation') || t.includes('process') || t.includes('scheduling') || t.includes('deadlock')) return 'Operating Systems';
  if (t.includes('discrete') || t.includes('graph theory') || t.includes('combinatorics') || t.includes('logic') || t.includes('boolean')) return 'Discrete Math';
  if (t.includes('network') || t.includes('tcp') || t.includes('ip ') || t.includes('http') || t.includes('osi') || t.includes('protocol')) return 'Computer Networks';
  if (t.includes('database') || t.includes('dbms') || t.includes('sql') || t.includes('normaliz') || t.includes('er diagram') || t.includes('relational')) return 'Database Mgmt';
  return 'General';
}

function inferModule(title: string): string {
  const t = title.toLowerCase();
  const m = t.match(/mod(?:ule)?\s*(\d)/);
  if (m) return `Mod ${m[1]}`;
  if (t.includes('all') || t.includes('complete') || t.includes('full')) return 'All';
  return 'General';
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const SUBJECTS = ['All Subjects', 'Data Structures', 'Operating Systems', 'Discrete Math', 'Computer Networks', 'Database Mgmt'];
const MODULES = ['All Modules', 'Mod 1', 'Mod 2', 'Mod 3', 'Mod 4', 'Mod 5', 'All', 'General'];
const DOC_TYPES = ['Any Type', 'Notes', 'PYQ', 'Mind Map', 'Lab Manual'];

const PAGE_SIZE = 4;

/* ─── Component ──────────────────────────────────────────────────────────── */

interface LibraryProps {
  readonly user: User;
  onNavigate?: (page: string) => void;
}

export function Library({ user, onNavigate }: LibraryProps) {
  const [docs, setDocs] = useState<ReadonlyArray<DocumentRow>>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [removalPending, setRemovalPending] = useState<ReadonlySet<string>>(new Set());
  const [removalDone, setRemovalDone] = useState<ReadonlySet<string>>(new Set());
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [viewError, setViewError] = useState('');

  const [subject, setSubject] = useState('All Subjects');
  const [module, setModule] = useState('All Modules');
  const [docType, setDocType] = useState('Any Type');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchDocs = async () => {
      setLoading(true);
      try {
        const backendBase = import.meta.env.VITE_BACKEND_URL || '';
        
        // Use Promise.allSettled to fetch both independently
        const [uthoSettled, dbSettled] = await Promise.allSettled([
          fetch(`${backendBase}/list-files`, { signal: controller.signal }),
          supabase
            .from('documents')
            .select('id,title,file_type,file_size,created_at,user_id,status,chunk_count,file_path,subject_id,module_id,updated_at')
            .eq('status', 'ready')
            .order('created_at', { ascending: false })
        ]);

        if (!isMounted) return;

        let uthoFiles: ReadonlyArray<{ filename: string; size: number; lastModified: string }> = [];
        let uthoError = false;

        // Handle Utho result
        if (uthoSettled.status === 'fulfilled') {
          const res = uthoSettled.value;
          if (res.ok) {
            const data = await res.json();
            uthoFiles = data.files || [];
          } else {
            uthoError = true;
            console.error('Utho API returned error:', res.status);
          }
        } else {
          if (uthoSettled.reason?.name !== 'AbortError') {
            uthoError = true;
            console.error('Utho fetch rejected:', uthoSettled.reason);
          }
        }

        if (!isMounted) return;

        // Handle Supabase result
        let dbDocs: DocumentRow[] = [];
        if (dbSettled.status === 'fulfilled') {
          const { data, error: dbError } = dbSettled.value;
          if (!dbError) {
            dbDocs = data ?? [];
          } else {
            console.error('Supabase query error:', dbError);
          }
        } else {
          console.error('Supabase promise rejected:', dbSettled.reason);
        }

        if (uthoError && dbDocs.length === 0) {
          throw new Error('Failed to load documents from storage');
        }

        // 3. Merge: Utho files are the source of existence
        const dbMap = new Map(dbDocs.map(d => [d.file_path, d]));
        
        const mergedDocs: DocumentRow[] = uthoFiles.map(file => {
          const dbMatch = dbMap.get(file.filename);
          
          if (dbMatch) {
            return {
              ...dbMatch,
              file_size: file.size,
            } as DocumentRow;
          }

          return {
            id: `utho-${file.filename}`,
            user_id: 'unknown',
            title: file.filename.replace(/^\d+-/, ''),
            file_path: file.filename,
            file_type: file.filename.split('.').pop()?.toLowerCase() || 'unknown',
            subject_id: null,
            module_id: null,
            created_at: file.lastModified,
            status: 'ready',
            chunk_count: 0,
            file_size: file.size,
            updated_at: file.lastModified,
          } as DocumentRow;
        });

        // Add any DB docs that might be missing from Utho (optional, but let's stick to Utho as truth)
        // mergedDocs.sort...
        mergedDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setDocs(mergedDocs);
        setFetchError('');
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name === 'AbortError') return;
        console.error('Error fetching library documents:', e);
        setFetchError('Could not load documents from storage. Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchDocs();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const filtered = useMemo(() => {
    return docs.filter(doc => {
      if (subject !== 'All Subjects' && inferSubject(doc.title) !== subject) return false;
      if (module !== 'All Modules' && inferModule(doc.title) !== module) return false;
      if (docType !== 'Any Type' && inferDocType(doc.title) !== docType) return false;
      if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [docs, subject, module, docType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const requestRemoval = async (docId: string) => {
    setRemovalPending(prev => new Set([...prev, docId]));
    try {
      const { error } = await supabase
        .from('removal_requests')
        .insert({ document_id: docId, user_id: user.id });
      if (error) throw error;
      setRemovalDone(prev => new Set([...prev, docId]));
    } catch (e) {
      console.error('Error submitting removal request:', e);
    } finally {
      setRemovalPending(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleView = async (filePath: string) => {
    if (viewingDoc === filePath) return;
    setViewingDoc(filePath);
    setViewError('');
    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${backendBase}/get-view-url?filename=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to get view URL');
      const { url } = await res.json() as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Error opening file:', e);
      setViewError('Could not open file. Please try again.');
    } finally {
      setViewingDoc(null);
    }
  };

  return (
    <div className="lib-shell">
      {/* ── Page header ───────────────────────────────────── */}
      <div className="lib-page-header">
        <div className="lib-title-group">
          <h1 className="lib-title">
            Universal Library
            <span className="lib-badge-global">GLOBAL ACCESS</span>
          </h1>
          <p className="lib-subtitle">Browse academic resources contributed by the VTU student community.</p>
        </div>
        <div className="lib-header-actions">
          <button className="lib-btn-history">
            <span className="material-icons-outlined lib-btn-icon">history</span>
            History
          </button>
          <ButtonColorful
            onClick={() => onNavigate?.('upload')}
            label="Contribute"
          />
        </div>
      </div>

      {/* View error banner */}
      {viewError && (
        <div className="lib-view-error">
          <span className="material-icons-outlined">error_outline</span>
          {viewError}
          <button className="lib-view-error-close" onClick={() => setViewError('')}>✕</button>
        </div>
      )}

      {/* ── Filters panel ─────────────────────────────────── */}
      <div className="lib-filters">
        <div className="lib-filter-row lib-filter-row--single">
          <div className="lib-filter-group">
            <label className="lib-filter-label">Course Type</label>
            <select className="lib-select" aria-label="Course Type" defaultValue="B.E / B.Tech">
              <option>B.E / B.Tech</option>
              <option>M.Tech</option>
              <option>BCA</option>
            </select>
          </div>
          <div className="lib-filter-group">
            <label className="lib-filter-label">Subject</label>
            <select className="lib-select" aria-label="Subject" value={subject} onChange={handleFilter(setSubject)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="lib-filter-group">
            <label className="lib-filter-label">Module</label>
            <select className="lib-select" aria-label="Module" value={module} onChange={handleFilter(setModule)}>
              {MODULES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="lib-filter-group">
            <label className="lib-filter-label">Doc Type</label>
            <select className="lib-select" aria-label="Doc Type" value={docType} onChange={handleFilter(setDocType)}>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="lib-search-wrap">
            <span className="material-icons-outlined lib-search-icon">search</span>
            <input
              className="lib-search-input"
              type="text"
              placeholder="Search specific topic..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* ── Documents table ────────────────────────────────── */}
      <div className="lib-table-card">
        {/* Table head */}
        <div className="lib-table-head">
          <span className="lib-col-details">Document Details</span>
          <span className="lib-col-subject">Subject</span>
          <span className="lib-col-module">Module</span>
          <span className="lib-col-contributor">Contributor</span>
          <span className="lib-col-type">Type</span>
          <span className="lib-col-action"></span>
        </div>

        {/* Table body */}
        <div className="lib-table-body">
          {loading && (
            <div className="lib-empty">
              <span className="material-icons-outlined lib-empty-icon">hourglass_top</span>
              <p>Loading library…</p>
            </div>
          )}
          {!loading && fetchError && (
            <div className="lib-empty">
              <span className="material-icons-outlined lib-empty-icon">error_outline</span>
              <p>{fetchError}</p>
            </div>
          )}
          {!loading && !fetchError && filtered.length === 0 && (
            <div className="lib-empty">
              <span className="material-icons-outlined lib-empty-icon">folder_off</span>
              <p>{docs.length === 0 ? 'No documents in the library yet. Be the first to contribute!' : 'No documents found. Try adjusting your filters.'}</p>
            </div>
          )}
          {!loading && !fetchError && pageItems.map((doc, i) => {
            const docTypeStr = inferDocType(doc.title);
            const typeColor = getDocTypeColor(docTypeStr);
            const typeIcon = getDocTypeIcon(docTypeStr);
            const iconBgVar = getIconBgVar(docTypeStr);
            const isOwner = doc.user_id === user.id;
            const alreadyRequested = removalDone.has(doc.id);
            const isPending = removalPending.has(doc.id);

            return (
              <div key={doc.id} className={`lib-row ${i % 2 === 0 ? '' : 'lib-row--alt'}`}>
                {/* Doc details */}
                <div className="lib-col-details lib-doc-info">
                  <div className={`lib-doc-icon lib-doc-icon--var-${iconBgVar}`}>
                    <span className="material-icons-outlined">{typeIcon}</span>
                  </div>
                  <div>
                    <p className="lib-doc-title">{doc.title}</p>
                    <p className="lib-doc-meta">{formatSize(doc.file_size)} • {formatDate(doc.created_at)}</p>
                  </div>
                </div>

                {/* Subject */}
                <div className="lib-col-subject lib-cell">
                  <span className="lib-subject-text">{inferSubject(doc.title)}</span>
                </div>

                {/* Module */}
                <div className="lib-col-module lib-cell">
                  <span className="lib-module-badge">{inferModule(doc.title)}</span>
                </div>

                {/* Contributor */}
                <div className="lib-col-contributor lib-cell">
                  <span className="lib-contributor-dot lib-contributor-dot--var-1" />
                  <span className="lib-contributor-name">{isOwner ? 'You' : 'VTU Student'}</span>
                </div>

                {/* Type */}
                <div className="lib-col-type lib-cell">
                  <span className={`lib-type-badge lib-type-badge--${typeColor}`}>
                    <span className="material-icons-outlined lib-type-icon">{typeIcon}</span>
                    {docTypeStr}
                  </span>
                </div>

                {/* Action */}
                <div className="lib-col-action lib-cell">
                  {isOwner && (
                    <button
                      className="lib-remove-btn"
                      disabled={alreadyRequested || isPending}
                      onClick={() => void requestRemoval(doc.id)}
                      title="Request removal of this document"
                    >
                      {alreadyRequested ? 'Requested' : isPending ? '…' : 'Remove'}
                    </button>
                  )}
                  <ButtonColorful
                    onClick={() => void handleView(doc.file_path)}
                    label={viewingDoc === doc.file_path ? '…' : 'View'}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination footer */}
        <div className="lib-table-foot">
          <p className="lib-count">
            Showing <strong>{filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}</strong> to{' '}
            <strong>{Math.min(safePage * PAGE_SIZE, filtered.length)}</strong> of{' '}
            <strong>{filtered.length}</strong> results
          </p>
          <div className="lib-pagination">
            <button
              className="lib-page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <span className="material-icons-outlined">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`lib-page-btn ${safePage === p ? 'lib-page-btn--active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="lib-page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
            >
              <span className="material-icons-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
