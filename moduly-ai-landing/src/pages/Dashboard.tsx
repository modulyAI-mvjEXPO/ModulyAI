import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { signOut } from '../lib/auth';
import { StudyMode } from './StudyMode';
import { ExamMode } from './ExamMode';
import { Library } from './Library';
import { UploadDocs } from './UploadDocs';
import { Settings } from './Settings';
import './Dashboard.css';

type DashboardPage = 'overview' | 'study' | 'exam' | 'library' | 'upload' | 'settings';

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}

const NAV_MAIN: { icon: string; label: string; page: DashboardPage }[] = [
  { icon: 'dashboard', label: 'Overview', page: 'overview' },
  { icon: 'school', label: 'Study Mode', page: 'study' },
  { icon: 'assignment', label: 'Exam Mode', page: 'exam' },
  { icon: 'library_books', label: 'Library', page: 'library' },
];


const QUICK_ACTIONS: { icon: string; bgIcon: string; title: string; desc: string; color: string; page: DashboardPage }[] = [
  {
    icon: 'play_arrow',
    bgIcon: 'play_circle',
    title: 'Start Study Session',
    desc: 'Resume from where you left off in Data Structures.',
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

const STATS = [
  { value: '124', label: 'Total Notes', gradient: false },
  { value: '450+', label: 'Total PYQs', gradient: false },
  { value: '89', label: 'Important Qs', gradient: true },
  { value: '12', label: 'Recent Uploads', gradient: false },
];

const SESSIONS = [
  { subject: 'Data Structures', module: 'Module 3: Trees & Graphs', date: 'Mar 1, 2025', mode: 'Learning' },
  { subject: 'Operating Systems', module: 'Module 1: Introduction', date: 'Feb 28, 2025', mode: 'Quiz' },
  { subject: 'Database Mgmt', module: 'Module 4: Normalization', date: 'Feb 26, 2025', mode: 'Learning' },
];

export function Dashboard({ user, onSignOut }: DashboardProps) {
  const [activePage, setActivePage] = useState<DashboardPage>('overview');

  useEffect(() => {
    void fetch('/warm', { method: 'POST' });
  }, []);

  const displayName = user.user_metadata?.display_name
    ?? user.email?.split('@')[0]
    ?? 'Student';
  const firstName = displayName.split(' ')[0];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Close dropdown if clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.db-brand-nav-wrap')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    setIsSigningOut(true);
    // Fire and forget: do not await the backend logout
    void signOut();
    
    // Optimistic UI update: Wait 300ms for visual feedback, then force the redirect
    setTimeout(() => {
      onSignOut();
    }, 300);
  };

  return (
    <div className="db-shell">
      {/* ── Top header (Full Width) ── */}
      <header className="db-header">
        <div className="db-header-left">
          <div className="db-brand-nav-wrap">
            {/* Brand */}
            <div 
              className="db-brand db-brand--clickable" 
              onClick={() => { setActivePage('overview'); setDropdownOpen(false); }}
              role="button"
              tabIndex={0}
            >
              <div className="db-brand-logo">M</div>
              <span className="db-brand-name">MODULY AI</span>
            </div>
            
            {/* Nav Dropdown Trigger */}
            <button 
              className={`db-nav-trigger ${dropdownOpen ? 'db-nav-trigger--active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(o => !o); }}
              aria-label="Toggle navigation menu"
              {...{ 'aria-expanded': dropdownOpen }}
            >
              <span className="material-icons-outlined">expand_more</span>
            </button>

            {/* Nav Dropdown Menu */}
            {dropdownOpen && (
              <div className="db-nav-dropdown">
                {NAV_MAIN.map(item => (
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

            <button className="db-notif-btn" aria-label="Settings" onClick={() => setActivePage('settings')}>
              <span className="material-icons-outlined">settings</span>
            </button>

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
          <StudyMode user={user} onNavigate={(page) => setActivePage(page as DashboardPage)} />
        )}
        {activePage === 'exam' && (
          <ExamMode user={user} />
        )}
        {activePage === 'library' && (
          <Library user={user} onNavigate={(page) => setActivePage(page as DashboardPage)} />
        )}
        {activePage === 'upload' && (
          <UploadDocs user={user} />
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
                    <circle className="db-ring-fill" cx="24" cy="24" r="18"
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
              <button 
                key={a.title} 
                className={`db-action-card db-action-card--${a.color}`}
                onClick={() => setActivePage(a.page)}
              >
                <span className={`material-icons-outlined db-action-bg-icon`}>{a.bgIcon}</span>
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
        </main>
    </div>
  );
}
