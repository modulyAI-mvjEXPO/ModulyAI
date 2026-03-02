import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';
import { signOut } from '../lib/auth';
import { StudyMode } from './StudyMode';
import './Dashboard.css';

type DashboardPage = 'overview' | 'study' | 'exam' | 'library' | 'upload' | 'settings';

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}

const NAV_MAIN: { icon: string; label: string; page: DashboardPage }[] = [
  { icon: 'dashboard',     label: 'Overview',   page: 'overview' },
  { icon: 'school',        label: 'Study Mode', page: 'study'    },
  { icon: 'assignment',    label: 'Exam Mode',  page: 'exam'     },
  { icon: 'library_books', label: 'Library',    page: 'library'  },
];
const NAV_TOOLS: { icon: string; label: string; page: DashboardPage }[] = [
  { icon: 'upload_file', label: 'Upload Docs', page: 'upload'   },
  { icon: 'settings',    label: 'Settings',    page: 'settings' },
];

const QUICK_ACTIONS = [
  {
    icon:        'play_arrow',
    bgIcon:      'play_circle',
    title:       'Start Study Session',
    desc:        'Resume from where you left off in Data Structures.',
    color:       'primary',
  },
  {
    icon:        'quiz',
    bgIcon:      'analytics',
    title:       'Analyse PYQs',
    desc:        'AI analysis of Previous Year Questions.',
    color:       'teal',
  },
  {
    icon:        'upload_file',
    bgIcon:      'cloud_upload',
    title:       'Upload Documents',
    desc:        'Add notes or syllabus for AI processing.',
    color:       'purple',
  },
];

const STATS = [
  { value: '124',  label: 'Total Notes',    gradient: false },
  { value: '450+', label: 'Total PYQs',     gradient: false },
  { value: '89',   label: 'Important Qs',   gradient: true  },
  { value: '12',   label: 'Recent Uploads', gradient: false },
];

const SESSIONS = [
  { subject: 'Data Structures',  module: 'Module 3: Trees & Graphs', date: 'Mar 1, 2025',  mode: 'Learning' },
  { subject: 'Operating Systems',module: 'Module 1: Introduction',   date: 'Feb 28, 2025', mode: 'Quiz'     },
  { subject: 'Database Mgmt',    module: 'Module 4: Normalization',  date: 'Feb 26, 2025', mode: 'Learning' },
];

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState<DashboardPage>('overview');

  const displayName = user.user_metadata?.display_name
    ?? user.email?.split('@')[0]
    ?? 'Student';
  const firstName = displayName.split(' ')[0];

  const handleSignOut = async () => {
    await signOut();
    onSignOut();
  };

  return (
    <div className={`db-shell ${sidebarOpen ? 'db-shell--open' : ''}`}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="db-sidebar">
        <div>
          {/* Brand */}
          <div className="db-brand">
            <div className="db-brand-logo">M</div>
            <span className="db-brand-name">MODULY AI</span>
          </div>

          {/* Nav */}
          <nav className="db-nav">
            <p className="db-nav-label">Main</p>
            {NAV_MAIN.map(item => (
              <a
                key={item.label}
                href="#"
                className={`db-nav-item ${activePage === item.page ? 'db-nav-item--active' : ''}`}
                onClick={e => { e.preventDefault(); setActivePage(item.page); setSidebarOpen(false); }}
              >
                <span className="material-icons-outlined db-nav-icon">{item.icon}</span>
                {item.label}
              </a>
            ))}

            <p className="db-nav-label db-nav-label--mt">Tools</p>
            {NAV_TOOLS.map(item => (
              <a
                key={item.label}
                href="#"
                className={`db-nav-item ${activePage === item.page ? 'db-nav-item--active' : ''}`}
                onClick={e => { e.preventDefault(); setActivePage(item.page); setSidebarOpen(false); }}
              >
                <span className="material-icons-outlined db-nav-icon">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* User strip + theme toggle */}
        <div className="db-sidebar-footer">
          <div className="db-user-strip">
            <div className="db-user-avatar">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="db-user-info">
              <p className="db-user-name">{displayName}</p>
              <p className="db-user-email">{user.email}</p>
            </div>
          </div>

          <div className="db-sidebar-actions">
            <button className="db-theme-btn" onClick={toggleTheme}>
              <span className="material-icons-outlined">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
              Toggle Theme
            </button>
            <button className="db-signout-btn" onClick={handleSignOut}>
              <span className="material-icons-outlined">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="db-main">

        {/* Ambient blobs */}
        <div className="db-blob db-blob-1" />
        <div className="db-blob db-blob-2" />

        {/* ── Top header ── */}
        <header className="db-header">
          <div className="db-header-left">
            <button
              className="db-menu-btn"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle sidebar"
            >
              <span className="material-icons-outlined">menu</span>
            </button>

            <div className="db-subject-wrap">
              <select className="db-subject-select" aria-label="Select subject">
                <option>Data Structures</option>
                <option>Operating Systems</option>
                <option>Database Mgmt</option>
                <option>Computer Networks</option>
              </select>
              <span className="material-icons-outlined db-select-arrow">expand_more</span>
            </div>
            <span className="db-sem-badge">SEM 6</span>
          </div>

          <div className="db-header-right">
            <div className="db-search-wrap">
              <span className="material-icons-outlined db-search-icon">search</span>
              <input
                className="db-search"
                type="text"
                placeholder="Search modules, questions…"
                aria-label="Search"
              />
            </div>

            <button className="db-notif-btn" aria-label="Notifications">
              <span className="material-icons-outlined">notifications</span>
              <span className="db-notif-dot" />
            </button>

            <div className="db-avatar-ring">
              <div className="db-header-avatar">
                {firstName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        {activePage === 'study' && (
          <StudyMode user={user} />
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
                    B.E. Computer Science
                  </span>
                  <span className="db-dot" />
                  <span>Semester 6</span>
                  <span className="db-dot" />
                  <span className="db-hero-subjects">5 Active Subjects</span>
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
                    <circle className="db-ring-fill"  cx="24" cy="24" r="18"
                      strokeDasharray="113"
                      strokeDashoffset="28"
                    />
                  </svg>
                  <span className="db-ring-label">75%</span>
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
            {QUICK_ACTIONS.map(a => (
              <button key={a.title} className={`db-action-card db-action-card--${a.color}`}>
                <span className={`material-icons-outlined db-action-bg-icon`}>{a.bgIcon}</span>
                <div className="db-action-icon-wrap">
                  <span className="material-icons-outlined db-action-icon">{a.icon}</span>
                </div>
                <h3 className="db-action-title">{a.title}</h3>
                <p  className="db-action-desc">{a.desc}</p>
              </button>
            ))}
          </section>

          {/* Stats row */}
          <section className="db-stats-grid">
            {STATS.map(s => (
              <div key={s.label} className="db-stat-card">
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
              <a href="#" className="db-table-view-all">View All</a>
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr className="db-table-head-row">
                    <th>Subject</th>
                    <th>Module</th>
                    <th>Date</th>
                    <th>Mode</th>
                    <th className="db-table-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {SESSIONS.map(s => (
                    <tr key={s.subject} className="db-table-row">
                      <td className="db-table-subject">{s.subject}</td>
                      <td className="db-table-module">{s.module}</td>
                      <td className="db-table-date">{s.date}</td>
                      <td>
                        <span className={`db-mode-badge db-mode-badge--${s.mode.toLowerCase()}`}>
                          {s.mode}
                        </span>
                      </td>
                      <td className="db-table-right">
                        <button className="db-resume-btn">Resume</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="db-footer">
            © 2025 MODULY AI · Built for VTU Project Expo
          </footer>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="db-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
