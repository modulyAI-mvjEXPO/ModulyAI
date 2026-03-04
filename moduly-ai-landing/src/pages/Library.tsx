import { useState, useMemo } from 'react';
import './Library.css';

/* ─── Static mock data ───────────────────────────────────────────────────── */
const ALL_DOCS = [
  {
    id: 1,
    title: 'Complete Binary Trees Guide',
    size: '2.4 MB',
    date: 'Oct 24, 2023',
    subject: 'Data Structures',
    module: 'Mod 3',
    contributor: 'Sarah J.',
    type: 'Notes',
    typeColor: 'violet',
    icon: 'menu_book',
    iconBgVar: 1,
    contributorColorVar: 1,
  },
  {
    id: 2,
    title: 'Paging & Segmentation Summary',
    size: '15 KB',
    date: 'Oct 22, 2023',
    subject: 'Operating Systems',
    module: 'Mod 4',
    contributor: 'Moduly AI',
    type: 'AI Summary',
    typeColor: 'teal',
    icon: 'auto_awesome',
    iconBgVar: 2,
    contributorColorVar: 2,
  },
  {
    id: 3,
    title: 'VTU Dec 2022 Question Paper',
    size: '1.1 MB',
    date: 'Oct 20, 2023',
    subject: 'Discrete Math',
    module: 'All',
    contributor: 'Admin',
    type: 'PYQ',
    typeColor: 'amber',
    icon: 'help_outline',
    iconBgVar: 3,
    contributorColorVar: 3,
  },
  {
    id: 4,
    title: 'Sorting Algorithms Mind Map',
    size: '3.2 MB',
    date: 'Sep 12, 2023',
    subject: 'Data Structures',
    module: 'Mod 2',
    contributor: 'Mike R.',
    type: 'Mind Map',
    typeColor: 'rose',
    icon: 'account_tree',
    iconBgVar: 4,
    contributorColorVar: 4,
  },
  {
    id: 5,
    title: 'Computer Networks Cheatsheet',
    size: '820 KB',
    date: 'Sep 5, 2023',
    subject: 'Computer Networks',
    module: 'Mod 1',
    contributor: 'Sarah J.',
    type: 'Notes',
    typeColor: 'violet',
    icon: 'menu_book',
    iconBgVar: 1,
    contributorColorVar: 1,
  },
  {
    id: 6,
    title: 'DBMS Normalization Quick Notes',
    size: '560 KB',
    date: 'Sep 1, 2023',
    subject: 'Database Mgmt',
    module: 'Mod 4',
    contributor: 'Moduly AI',
    type: 'AI Summary',
    typeColor: 'teal',
    icon: 'auto_awesome',
    iconBgVar: 2,
    contributorColorVar: 2,
  },
  {
    id: 7,
    title: 'VTU Jun 2023 OS Question Paper',
    size: '1.5 MB',
    date: 'Aug 28, 2023',
    subject: 'Operating Systems',
    module: 'All',
    contributor: 'Admin',
    type: 'PYQ',
    typeColor: 'amber',
    icon: 'help_outline',
    iconBgVar: 3,
    contributorColorVar: 3,
  },
  {
    id: 8,
    title: 'Graph Theory Concept Map',
    size: '2.1 MB',
    date: 'Aug 15, 2023',
    subject: 'Discrete Math',
    module: 'Mod 3',
    contributor: 'Mike R.',
    type: 'Mind Map',
    typeColor: 'rose',
    icon: 'account_tree',
    iconBgVar: 4,
    contributorColorVar: 4,
  },
];

const SUBJECTS = ['All Subjects', 'Data Structures', 'Operating Systems', 'Discrete Math', 'Computer Networks', 'Database Mgmt'];
const MODULES = ['All Modules', 'Mod 1', 'Mod 2', 'Mod 3', 'Mod 4', 'All'];
const DOC_TYPES = ['Any Type', 'Notes', 'AI Summary', 'PYQ', 'Mind Map'];

const PAGE_SIZE = 4;

const TYPE_ICON: Record<string, string> = {
  Notes: 'menu_book',
  'AI Summary': 'auto_awesome',
  PYQ: 'quiz',
  'Mind Map': 'account_tree',
};

export function Library() {
  const [subject, setSubject] = useState('All Subjects');
  const [module, setModule] = useState('All Modules');
  const [docType, setDocType] = useState('Any Type');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return ALL_DOCS.filter(d => {
      if (subject !== 'All Subjects' && d.subject !== subject) return false;
      if (module !== 'All Modules' && d.module !== module) return false;
      if (docType !== 'Any Type' && d.type !== docType) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [subject, module, docType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
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
          <p className="lib-subtitle">Browse 42,000+ academic resources contributed by the community.</p>
        </div>
        <div className="lib-header-actions">
          <button className="lib-btn-history">
            <span className="material-icons-outlined lib-btn-icon">history</span>
            History
          </button>
          <button className="lib-btn-contribute">
            <span className="material-icons-outlined lib-btn-icon">add</span>
            Contribute
          </button>
        </div>
      </div>

      {/* ── Filters panel ─────────────────────────────────── */}
      <div className="lib-filters">
        <div className="lib-filter-row">
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
        </div>
        <div className="lib-filter-row lib-filter-row--bottom">
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
          {pageItems.length === 0 ? (
            <div className="lib-empty">
              <span className="material-icons-outlined lib-empty-icon">folder_off</span>
              <p>No documents found. Try adjusting your filters.</p>
            </div>
          ) : pageItems.map((doc, i) => (
            <div key={doc.id} className={`lib-row ${i % 2 === 0 ? '' : 'lib-row--alt'}`}>
              {/* Doc details */}
              <div className="lib-col-details lib-doc-info">
                <div className={`lib-doc-icon lib-doc-icon--var-${doc.iconBgVar}`}>
                  <span className="material-icons-outlined">{doc.icon}</span>
                </div>
                <div>
                  <p className="lib-doc-title">{doc.title}</p>
                  <p className="lib-doc-meta">{doc.size} • {doc.date}</p>
                </div>
              </div>

              {/* Subject */}
              <div className="lib-col-subject lib-cell">
                <span className="lib-subject-text">{doc.subject}</span>
              </div>

              {/* Module */}
              <div className="lib-col-module lib-cell">
                <span className="lib-module-badge">{doc.module}</span>
              </div>

              {/* Contributor */}
              <div className="lib-col-contributor lib-cell">
                <span className={`lib-contributor-dot lib-contributor-dot--var-${doc.contributorColorVar}`} />
                <span className="lib-contributor-name">{doc.contributor}</span>
              </div>

              {/* Type */}
              <div className="lib-col-type lib-cell">
                <span className={`lib-type-badge lib-type-badge--${doc.typeColor}`}>
                  <span className="material-icons-outlined lib-type-icon">
                    {TYPE_ICON[doc.type] ?? 'description'}
                  </span>
                  {doc.type}
                </span>
              </div>

              {/* Action */}
              <div className="lib-col-action lib-cell">
                <button className="lib-view-btn">View</button>
              </div>
            </div>
          ))}
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
