import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/profile';
import type { UserProfile } from '../lib/profile';
import { StudyMode } from './StudyMode';
import { ExamMode } from './ExamMode';
import { Library } from './Library';
import { UploadDocs } from './UploadDocs';
import { Settings } from './Settings';
import { ButtonColorful } from '../components/ui/button-colorful';
import './Dashboard.css';

type DashboardPage = 'overview' | 'study' | 'exam' | 'library' | 'upload' | 'settings';

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}

interface StatItem {
  value: string;
  label: string;
  gradient: boolean;
}

interface RecentDoc {
  id: string;
  title: string;
  subject: string;
  date: string;
  fileType: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  'data-structures': 'Data Structures',
  'computer-networks': 'Computer Networks',
  'dbms': 'Database Mgmt',
  'operating-systems': 'Operating Systems',
};

const QUICK_ACTIONS: { icon: string; bgIcon: string; title: string; desc: string; color: string; page: DashboardPage }[] = [
  {
    icon: 'play_arrow',
    bgIcon: 'play_circle',
    title: 'Start Study Session',
    desc: 'Ask questions and get AI-powered explanations from your study materials.',
    color: 'primary',
    page: 'study',
  },
  {
    icon: 'quiz',
    bgIcon: 'analytics',
    title: 'Analyse PYQs',
    desc: 'AI analysis of Previous Year Questions.',
    color: 'teal',
    page: 'exam',
  },
  {
    icon: 'upload_file',
    bgIcon: 'cloud_upload',
    title: 'Upload Documents',
    desc: 'Add notes or syllabus for AI processing.',
    color: 'purple',
    page: 'upload',
  },
];

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const [activePage, setActivePage] = useState<DashboardPage>('overview');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentDocs, setRecentDocs] = useState<readonly RecentDoc[]>([]);
  const [stats, setStats] = useState<readonly StatItem[]>([
    { value: '0', label: 'Total Notes', gradient: false },
    { value: '0', label: 'Total PYQs', gradient: false },
    { value: '0', label: 'Important Qs', gradient: true },
    { value: '0', label: 'Recent Uploads', gradient: false },
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const backendBase = import.meta.env.VITE_BACKEND_URL || '';
    void fetch(`${backendBase}/warm`, { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const [profileData] = await Promise.all([getProfile(user.id)]);
      setProfile(profileData);
    };
    void loadData();
  }, [user.id]);

  useEffect(() => {
    const loadDocs = async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, file_type, subject_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Failed to load recent documents:', error.message);
        return;
      }

      const docs: RecentDoc[] = (data ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        subject: doc.subject_id
          ? (SUBJECT_LABELS[doc.subject_id] ?? doc.subject_id)
          : 'General',
        date: new Date(doc.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        fileType: doc.file_type,
      }));

      setRecentDocs(docs);

      const totalNotes = data?.length ?? 0;
      const pyqs = (data ?? []).filter(
        (d) => d.file_type === 'pyq' || d.title.toLowerCase().includes('pyq')
      ).length;
      const recentUploads = (data ?? []).filter((d) => {
        const docDate = new Date(d.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return docDate >= weekAgo;
      }).length;

      setStats([
        { value: String(totalNotes), label: 'Total Notes', gradient: false },
        { value: String(pyqs), label: 'Total PYQs', gradient: false },
        { value: '0', label: 'Important Qs', gradient: true },
        { value: String(recentUploads), label: 'Recent Uploads', gradient: false },
      ]);
    };
    void loadDocs();
  }, [user.id]);

  const displayName = profile?.display_name
    ?? profile?.full_name
    ?? user.user_metadata?.display_name
    ?? user.email?.split('@')[0]
    ?? 'Student';
  const firstName = displayName.split(' ')[0];

  const semesterStr = profile?.semester != null ? `Sem ${profile.semester}` : 'Sem --';
  const subjects = profile?.subjects ?? [];
  const activeSubjectCount = subjects.length || 5;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.db-brand-nav-wrap')) {
        setDropdownOpen(false);
      }
      if (!(e.target as Element).closest('.db-profile-wrap')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out failed:', error);
      }
    } finally {
      onSignOut();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setActivePage('study');
    }
  };

  const handleResume = () => {
    setActivePage('study');
  };

  const completedModules = recentDocs.length > 0 ? recentDocs.length : 0;
  const totalModules = activeSubjectCount;
  const progressPercent = totalModules > 0
    ? Math.round((completedModules / totalModules) * 100)
    : 0;
  const strokeDashoffset = Math.round(113 * (1 - progressPercent / 100));

  return (
    <div className="db-shell">
      {/* ── Top header (Full Width) ── */}
      <header className="db-header">
        <div className="db-header-left">
          <div className="db-brand-nav-wrap">
            <div
              className="db-brand db-brand--clickable"
              onClick={() => { setActivePage('overview'); setDropdownOpen(false); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActivePage('overview');
                  setDropdownOpen(false);
                }
              }}
            >
              <img className="db-brand-logo" src="/logos/logo-transparent.png" alt="Moduly AI Logo" />
              <span className="db-brand-name">MODULY AI</span>
            </div>

            <button
              className={`db-nav-trigger ${dropdownOpen ? 'db-nav-trigger--active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }}
              aria-label="Toggle navigation menu"
              aria-expanded={dropdownOpen ? 'true' : 'false'}
            >
              <span className="material-icons-outlined">expand_more</span>
            </button>

            {dropdownOpen && (
              <div className="db-nav-dropdown">
                {NAV_MAIN.map((item) => (
                  <button
                    key={item.label}
                    className={`db-dropdown-item ${activePage === item.page ? 'db-dropdown-item--active' : ''}`}
                    onClick={() => { setActivePage(item.page); setDropdownOpen(false); }}
                  >
                    <span className="material-icons-outlined db-dropdown-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
                <div className="db-dropdown-divider" />
                <button
                  className="db-dropdown-item db-dropdown-item--danger"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <span className="material-icons-outlined db-dropdown-icon">
                    {isSigningOut ? 'hourglass_empty' : 'logout'}
                  </span>
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>

          <div className="db-subject-wrap">
            <select className="db-subject-select" aria-label="Select subject">
              {subjects.length > 0 ? (
                subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              ) : (
                <>
                  <option>Data Structures</option>
                  <option>Operating Systems</option>
                  <option>Database Mgmt</option>
                  <option>Computer Networks</option>
                </>
              )}
            </select>
            <span className="material-icons-outlined db-select-arrow">expand_more</span>
          </div>
          <span className="db-sem-badge">{semesterStr}</span>
        </div>

        <div className="db-header-right">
          <div className="db-search-wrap">
            <span className="material-icons-outlined db-search-icon">search</span>
            <input
              className="db-search"
              type="text"
              placeholder="Search modules, questions…"
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Profile avatar with dropdown */}
          <div className="db-profile-wrap">
            <button
              className="db-avatar-ring"
              aria-label="Profile menu"
              aria-expanded={profileMenuOpen}
              onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(o => !o); }}
            >
              <div className="db-header-avatar">
                {firstName.charAt(0).toUpperCase()}
              </div>
            </button>

            {profileMenuOpen && (
              <div className="db-profile-dropdown">
                <div className="db-profile-dropdown-user">
                  <div className="db-profile-dropdown-avatar">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="db-profile-dropdown-name">{displayName}</p>
                    <p className="db-profile-dropdown-email">{user.email}</p>
                  </div>
                </div>
                <div className="db-profile-dropdown-divider" />
                <button
                  className="db-profile-dropdown-item"
                  onClick={() => { setActivePage('settings'); setProfileMenuOpen(false); }}
                >
                  <span className="material-icons-outlined">settings</span>
                  Settings
                </button>
                <button className="db-profile-dropdown-item">
                  <span className="material-icons-outlined">notifications</span>
                  Notifications
                  <span className="db-profile-dropdown-badge">0</span>
                </button>
                <div className="db-profile-dropdown-divider" />
                <button
                  className="db-profile-dropdown-item db-profile-dropdown-item--danger"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <span className="material-icons-outlined">
                    {isSigningOut ? 'hourglass_empty' : 'logout'}
                  </span>
                  {isSigningOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      {activePage === 'study' && (
        <StudyMode user={user} onNavigate={(page) => setActivePage(page as DashboardPage)} />
      )}
      {activePage === 'exam' && (
        <ExamMode user={user} />
      )}
      {activePage === 'library' && (
        <Library user={user} onNavigate={(page) => setActivePage(page as DashboardPage)} />
      )}
      {activePage === 'upload' && (
        <UploadDocs user={user} onNavigate={(page) => setActivePage(page as DashboardPage)} />
      )}
      {activePage === 'settings' && (
        <Settings user={user} />
      )}

      {/* ── Overview scrollable content ── */}
      <main className={`db-content ${activePage !== 'overview' ? 'db-content--hidden' : ''}`}>

        {/* Welcome hero */}
        <section className="db-hero">
          <div className="db-hero-blob" />
          <div className="db-hero-body">
            <div>
              <h1 className="db-hero-title">
                Welcome back, <span className="db-grad-text">{firstName}</span>
              </h1>
              <div className="db-hero-meta">
                <span className="db-hero-meta-item">
                  <span className="material-icons-outlined db-hero-meta-icon">school</span>
                  {profile?.course ?? 'B.E. Computer Science'}
                </span>
                <span className="db-dot" />
                <span>{semesterStr}</span>
                <span className="db-dot" />
                <span className="db-hero-subjects">{activeSubjectCount} Active Subjects</span>
              </div>
              <p className="db-hero-desc">
                Your learning path is structured:{' '}
                <strong>Subject → Module → Category</strong>. Ready to dive into today's modules?
              </p>
            </div>

            {/* Circular progress */}
            <div className="db-progress-ring-wrap">
              <div className="db-progress-ring">
                <svg className="db-ring-svg" viewBox="0 0 48 48">
                  <circle className="db-ring-track" cx="24" cy="24" r="18" />
                  <circle
                    className="db-ring-fill"
                    cx="24"
                    cy="24"
                    r="18"
                    strokeDasharray="113"
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <span className="db-ring-label">{progressPercent}%</span>
              </div>
              <div>
                <div className="db-ring-sub">Overall Syllabus</div>
                <div className="db-ring-val">Completed</div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="db-actions-grid">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.title}
              className={`db-action-card db-action-card--${a.color}`}
              onClick={() => setActivePage(a.page)}
            >
              <span className="material-icons-outlined db-action-bg-icon">{a.bgIcon}</span>
              <div className="db-action-icon-wrap">
                <span className="material-icons-outlined db-action-icon">{a.icon}</span>
              </div>
              <h3 className="db-action-title">{a.title}</h3>
              <p className="db-action-desc">{a.desc}</p>
            </button>
          ))}
        </section>

        {/* Stats row */}
        <section className="db-stats-grid">
          {stats.map((s) => (
            <div key={s.label} className={`db-stat-card ${s.gradient ? 'db-stat-card--amber' : ''}`}>
              {s.gradient && <div className="db-stat-glow" />}
              <span className={`db-stat-value ${s.gradient ? 'db-grad-text' : ''}`}>
                {s.value}
              </span>
              <span className="db-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* Recent sessions table */}
        <section className="db-table-card">
          <div className="db-table-header">
            <h2 className="db-table-title">Recent Study Sessions</h2>
            <ButtonColorful
              label="View All"
              onClick={() => setActivePage('library')}
              className="db-table-view-all"
              textColor="black"
            />
          </div>
          <div className="db-table-wrap">
            {recentDocs.length > 0 ? (
              <table className="db-table">
                <thead>
                  <tr className="db-table-head-row">
                    <th>Document</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="db-table-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="db-table-row">
                      <td className="db-table-subject">{doc.title}</td>
                      <td className="db-table-module">{doc.subject}</td>
                      <td className="db-table-date">{doc.date}</td>
                      <td>
                        <span className="db-mode-badge db-mode-badge--learning">
                          {doc.fileType}
                        </span>
                      </td>
                      <td className="db-table-right">
                        <ButtonColorful
                          label="Resume"
                          onClick={() => handleResume()}
                          className="db-resume-btn"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="db-table-empty">
                <div className="db-table-empty-msg">
                  <span className="material-icons-outlined">folder_open</span>
                  <p>No documents uploaded yet.</p>
                </div>
                <ButtonColorful
                  label="Upload Documents"
                  onClick={() => setActivePage('upload')}
                  className="db-table-empty-btn-new"
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const NAV_MAIN: { icon: string; label: string; page: DashboardPage }[] = [
  { icon: 'dashboard', label: 'Overview', page: 'overview' },
  { icon: 'school', label: 'Study Mode', page: 'study' },
  { icon: 'assignment', label: 'Exam Mode', page: 'exam' },
  { icon: 'library_books', label: 'Library', page: 'library' },
];
