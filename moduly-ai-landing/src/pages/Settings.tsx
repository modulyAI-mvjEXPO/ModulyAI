import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { getProfile, upsertProfile } from '../lib/profile';
import './Settings.css';

interface SettingsProps {
    user: User;
}

const MARKING_SCHEMES = [
    'VTU 2022 Scheme (NEP)',
    'VTU 2018 Scheme (CBCS)',
    'Autonomous',
];

const SEMESTERS = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];

const DEFAULT_SUBJECTS = [
    'Data Structures',
    'Operating Systems',
    'Database Mgmt',
    'Computer Networks',
];

type AppearanceTheme = 'light' | 'dark' | 'system';

const applyTheme = (theme: AppearanceTheme) => {
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
};

const parseSemester = (semStr: string): number | null => {
    const match = semStr.match(/Sem\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
};

const formatSemester = (sem: number | null): string => {
    return sem != null ? `Sem ${sem}` : 'Sem --';
};

export function Settings({ user }: SettingsProps) {
    const [activeTab, setActiveTab] = useState('profile');

    const [fullName, setFullName] = useState(
        user.user_metadata?.display_name || user.email?.split('@')[0] || 'Student'
    );
    const [username, setUsername] = useState(
        user.user_metadata?.username || 'user_guest'
    );
    const [bio, setBio] = useState('');
    const [markingScheme, setMarkingScheme] = useState(MARKING_SCHEMES[0]);
    const [semester, setSemester] = useState('Sem 6');
    const [subjects, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);

    const [answerFormat, setAnswerFormat] = useState('8 Marks');
    const [answerStyle, setAnswerStyle] = useState('Concise');
    const [aiMode, setAiMode] = useState(false);
    const [appearance, setAppearance] = useState<AppearanceTheme>(
        (document.documentElement.getAttribute('data-theme') as AppearanceTheme) || 'system'
    );

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [saveMessage, setSaveMessage] = useState('');

    const [newSubjectInput, setNewSubjectInput] = useState('');
    const [showSubjectInput, setShowSubjectInput] = useState(false);

    const email = user.email || 'student@vtu.edu.in';

    useEffect(() => {
        applyTheme(appearance);
    }, [appearance]);

    useEffect(() => {
        const loadProfile = async () => {
            const data = await getProfile(user.id);

            if (data) {
                if (data.full_name) setFullName(data.full_name);
                if (data.display_name) setFullName(data.full_name ?? data.display_name);
                if (data.display_name) setUsername(data.display_name);
                if (data.bio) setBio(typeof data.bio === 'string' ? data.bio : '');
                if (data.course) setMarkingScheme(data.course);
                if (data.semester != null) setSemester(formatSemester(data.semester));
                if (data.subjects && data.subjects.length > 0) setSubjects(data.subjects);
            }
        };
        void loadProfile();
    }, [user.id]);

    useEffect(() => {
        if (appearance !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [appearance]);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');

        const semNum = parseSemester(semester);

        const { error } = await upsertProfile(user.id, {
            full_name: fullName,
            display_name: username,
            bio: bio,
            semester: semNum,
            subjects,
        });

        setIsSaving(false);

        if (error) {
            setSaveStatus('error');
            setSaveMessage('Failed to save changes. Please try again.');
        } else {
            setSaveStatus('success');
            setSaveMessage('Changes saved successfully!');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const removeSubject = (sub: string) => {
        setSubjects(subjects.filter((s) => s !== sub));
    };

    const handleAddSubject = () => {
        const trimmed = newSubjectInput.trim();
        if (trimmed && !subjects.includes(trimmed)) {
            setSubjects([...subjects, trimmed]);
        }
        setNewSubjectInput('');
        setShowSubjectInput(false);
    };

    const scrollToSection = (id: string) => {
        setActiveTab(id);
        setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    };

    return (
        <div className="settings-shell">
            {/* ── Left Sidebar Sub-Nav ── */}
            <aside className="settings-sidebar">
                <div className="settings-sidebar-group">
                    <h3 className="settings-sidebar-heading">Account</h3>
                    <button
                        className={`settings-nav-btn ${activeTab === 'profile' ? 'settings-nav-btn--active' : ''}`}
                        onClick={() => scrollToSection('profile')}
                    >
                        <span className="material-icons-outlined">person</span>
                        Profile
                    </button>
                    <button
                        className={`settings-nav-btn ${activeTab === 'academic' ? 'settings-nav-btn--active' : ''}`}
                        onClick={() => scrollToSection('academic')}
                    >
                        <span className="material-icons-outlined">school</span>
                        Academic Info
                    </button>
                    <button className="settings-nav-btn" disabled title="Coming soon">
                        <span className="material-icons-outlined">verified_user</span>
                        Security
                    </button>
                </div>

                <div className="settings-divider" />

                <div className="settings-sidebar-group">
                    <h3 className="settings-sidebar-heading">App Preferences</h3>
                    <button
                        className={`settings-nav-btn ${activeTab === 'ai-prefs' ? 'settings-nav-btn--active' : ''}`}
                        onClick={() => scrollToSection('ai-prefs')}
                    >
                        <span className="material-icons-outlined">psychology</span>
                        AI & Study
                    </button>
                    <button
                        className={`settings-nav-btn ${activeTab === 'appearance' ? 'settings-nav-btn--active' : ''}`}
                        onClick={() => scrollToSection('appearance')}
                    >
                        <span className="material-icons-outlined">palette</span>
                        Appearance
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="settings-content">
                <div className="settings-container">

                    {/* Profile Section */}
                    <section id="profile" className="settings-section">
                        <div className="settings-section-header">
                            <div>
                                <h2 className="settings-section-title">Public Profile</h2>
                                <p className="settings-section-desc">Manage your personal information and college verification status.</p>
                            </div>
                            <button
                                className="btn btn-primary settings-btn-save"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                <span className="material-icons-outlined settings-btn-icon">
                                    {isSaving ? 'hourglass_empty' : saveStatus === 'success' ? 'check' : 'save'}
                                </span>
                                {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Changes'}
                            </button>
                        </div>

                        {saveStatus === 'error' && (
                            <div className="settings-alert settings-alert--error">
                                <span className="material-icons-outlined">error</span>
                                {saveMessage}
                            </div>
                        )}

                        <div className="settings-panel settings-panel-padding">
                            <div className="profile-flex">
                                <div className="profile-avatar-col">
                                    <div className="profile-avatar-wrap">
                                        <div className="profile-avatar">
                                            {fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="profile-avatar-overlay">
                                            <span className="material-icons-outlined">edit</span>
                                        </div>
                                    </div>
                                    <span className="profile-avatar-hint">Allowed *.jpeg, *.jpg, *.png</span>
                                </div>

                                <div className="profile-form-grid">
                                    <div>
                                        <label className="settings-label" htmlFor="fullName">Full Name</label>
                                        <input
                                            id="fullName"
                                            title="Full Name"
                                            placeholder="Full Name"
                                            type="text"
                                            className="settings-input"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="settings-label" htmlFor="username">Username</label>
                                        <input
                                            id="username"
                                            title="Username"
                                            placeholder="Username"
                                            type="text"
                                            className="settings-input"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                    <div className="profile-form-full">
                                        <label className="settings-label" htmlFor="email">College Email</label>
                                        <div className="settings-input-wrapper">
                                            <input
                                                id="email"
                                                title="College Email"
                                                placeholder="College Email"
                                                type="email"
                                                className="settings-input settings-input--disabled"
                                                value={email}
                                                disabled
                                            />
                                            <span className="material-icons-outlined settings-input-icon">mail</span>
                                            <span className="settings-input-badge">
                                                <span className="material-icons-outlined settings-badge-icon">verified</span>
                                                Verified
                                            </span>
                                        </div>
                                        <p className="settings-input-hint">Contact administrator to change your verified academic email.</p>
                                    </div>
                                    <div className="profile-form-full">
                                        <label className="settings-label" htmlFor="bio">Bio</label>
                                        <textarea
                                            id="bio"
                                            title="Bio"
                                            placeholder="Tell us about yourself..."
                                            className="settings-textarea"
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="settings-divider" />

                    {/* Academic Configuration Section */}
                    <section id="academic" className="settings-section">
                        <div className="settings-academics-header">
                            <h2 className="settings-section-title-sm">Academic Configuration</h2>
                            <p className="settings-section-desc">Update your current syllabus context to get personalized AI responses.</p>
                        </div>

                        <div className="academic-cards">
                            <div className="academic-card group">
                                <div className="academic-card-bg-icon">
                                    <span className="material-icons-outlined">account_balance</span>
                                </div>
                                <h3 className="academic-card-eyebrow">University / College</h3>
                                <div className="academic-card-title">
                                    VTU Belagavi
                                    <span className="material-icons-outlined">check_circle</span>
                                </div>
                                <div className="academic-card-content">
                                    <label className="settings-label settings-label--small" htmlFor="markingScheme">Marking Scheme</label>
                                    <select
                                        id="markingScheme"
                                        title="Marking Scheme"
                                        className="academic-scheme-select"
                                        value={markingScheme}
                                        onChange={(e) => setMarkingScheme(e.target.value)}
                                    >
                                        {MARKING_SCHEMES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="academic-card">
                                <div className="academic-card-bg-icon">
                                    <span className="material-icons-outlined">school</span>
                                </div>
                                <h3 className="academic-card-eyebrow">Course Details</h3>
                                <div className="academic-card-content settings-margin-top-sm">
                                    <div className="academic-detail-row">
                                        <span className="academic-detail-label">Degree</span>
                                        <span className="academic-detail-value">B.E.</span>
                                    </div>
                                    <div className="academic-detail-row">
                                        <span className="academic-detail-label">Branch</span>
                                        <span className="academic-detail-value">Computer Science</span>
                                    </div>
                                    <div className="academic-detail-row">
                                        <label htmlFor="semester" className="academic-detail-label">Semester</label>
                                        <select
                                            id="semester"
                                            title="Semester"
                                            className="academic-small-select"
                                            value={semester}
                                            onChange={(e) => setSemester(e.target.value)}
                                        >
                                            {SEMESTERS.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="settings-panel settings-panel-padding-sm">
                            <h3 className="academic-subjects-header">
                                <span className="material-icons-outlined">book</span>
                                Active Subjects ({semester})
                            </h3>
                            <div className="academic-tags">
                                {subjects.map((subject) => (
                                    <div key={subject} className="academic-tag">
                                        {subject}
                                        <button
                                            className="academic-tag-close"
                                            onClick={() => removeSubject(subject)}
                                            aria-label={`Remove ${subject}`}
                                        >
                                            <span className="material-icons-outlined">close</span>
                                        </button>
                                    </div>
                                ))}

                                {showSubjectInput ? (
                                    <div className="academic-tag academic-tag--input">
                                        <input
                                            type="text"
                                            className="academic-tag-input"
                                            placeholder="Subject name"
                                            value={newSubjectInput}
                                            onChange={(e) => setNewSubjectInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddSubject();
                                                if (e.key === 'Escape') {
                                                    setShowSubjectInput(false);
                                                    setNewSubjectInput('');
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            className="academic-tag-add-confirm"
                                            onClick={handleAddSubject}
                                            aria-label="Confirm add subject"
                                        >
                                            <span className="material-icons-outlined">check</span>
                                        </button>
                                        <button
                                            className="academic-tag-close"
                                            onClick={() => {
                                                setShowSubjectInput(false);
                                                setNewSubjectInput('');
                                            }}
                                            aria-label="Cancel"
                                        >
                                            <span className="material-icons-outlined">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="academic-tag-add"
                                        onClick={() => setShowSubjectInput(true)}
                                    >
                                        <span className="material-icons-outlined">add</span>
                                        Add Subject
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    <div className="settings-divider" />

                    {/* AI & Study Preferences Section */}
                    <section id="ai-prefs" className="settings-section">
                        <div className="settings-academics-header">
                            <h2 className="settings-section-title-sm">AI & Study Preferences</h2>
                            <p className="settings-section-desc">Fine-tune how MODULY AI generates answers and study materials.</p>
                        </div>

                        <div className="settings-panel pref-panel-wrapper">
                            <div className="pref-row">
                                <div className="pref-info">
                                    <h4 className="pref-title">Default Answer Format</h4>
                                    <p className="pref-desc">Set the preferred length for AI generated answers based on marks.</p>
                                    <div className="pref-actions">
                                        {['2 Marks', '8 Marks', '10 Marks'].map((mark) => (
                                            <button
                                                key={mark}
                                                className={`pref-btn-mark ${answerFormat === mark ? 'pref-btn-mark--active' : ''}`}
                                                onClick={() => setAnswerFormat(mark)}
                                            >
                                                {mark}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pref-row">
                                <div className="pref-info">
                                    <h4 className="pref-title">Answer Style</h4>
                                    <p className="pref-desc">Choose between point-wise concise answers or detailed paragraph explanations.</p>
                                </div>
                                <div className="pref-btn-group">
                                    <button
                                        className={`pref-btn-style ${answerStyle === 'Concise' ? 'pref-btn-style--active' : ''}`}
                                        onClick={() => setAnswerStyle('Concise')}
                                    >
                                        Concise
                                    </button>
                                    <button
                                        className={`pref-btn-style ${answerStyle === 'Detailed' ? 'pref-btn-style--active' : ''}`}
                                        onClick={() => setAnswerStyle('Detailed')}
                                    >
                                        Detailed
                                    </button>
                                </div>
                            </div>

                            <div className="pref-row">
                                <div className="pref-info">
                                    <h4 className="pref-title">AI Access Mode</h4>
                                    <p className="pref-desc">
                                        <span className="pref-highlight">Strict Mode</span> limits AI to only provided syllabus content.
                                        <span className="pref-normal">Extended Mode</span> allows external web knowledge.
                                    </p>
                                </div>
                                <div>
                                    <label htmlFor="aiMode" className="pref-toggle-wrap">
                                        <span className="sr-only">Toggle AI Access Mode</span>
                                        <input
                                            id="aiMode"
                                            title="AI Access Mode"
                                            type="checkbox"
                                            className="pref-toggle-checkbox"
                                            checked={aiMode}
                                            onChange={() => setAiMode(!aiMode)}
                                        />
                                        <span className="pref-toggle-label" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Appearance Section */}
                    <section id="appearance" className="settings-section">
                        <h3 className="appearance-heading">Appearance</h3>
                        <div className="appearance-grid">
                            <button
                                className={`appearance-btn ${appearance === 'light' ? 'appearance-btn--active' : ''}`}
                                onClick={() => setAppearance('light')}
                            >
                                {appearance === 'light' && (
                                    <div className="appearance-btn-check">
                                        <span className="material-icons-outlined">check</span>
                                    </div>
                                )}
                                <div className="appearance-preview appearance-preview--light">
                                    <div className="preview-top" />
                                    <div className="preview-left" />
                                    <div className="appearance-preview-icon">
                                        <span className="material-icons-outlined">light_mode</span>
                                    </div>
                                </div>
                                <span className="appearance-label">Light Mode</span>
                            </button>

                            <button
                                className={`appearance-btn ${appearance === 'dark' ? 'appearance-btn--active' : ''}`}
                                onClick={() => setAppearance('dark')}
                            >
                                {appearance === 'dark' && (
                                    <div className="appearance-btn-check">
                                        <span className="material-icons-outlined">check</span>
                                    </div>
                                )}
                                <div className="appearance-preview appearance-preview--dark">
                                    <div className="preview-top" />
                                    <div className="preview-left" />
                                    <div className="appearance-preview-icon">
                                        <span className="material-icons-outlined">dark_mode</span>
                                    </div>
                                </div>
                                <span className="appearance-label">Dark Mode</span>
                            </button>

                            <button
                                className={`appearance-btn ${appearance === 'system' ? 'appearance-btn--active' : ''}`}
                                onClick={() => setAppearance('system')}
                                title="Follow your operating system preference"
                            >
                                {appearance === 'system' && (
                                    <div className="appearance-btn-check">
                                        <span className="material-icons-outlined">check</span>
                                    </div>
                                )}
                                <div className="appearance-preview appearance-preview--system">
                                    <div className="appearance-preview-icon">
                                        <span className="material-icons-outlined">contrast</span>
                                    </div>
                                </div>
                                <span className="appearance-label">System Default</span>
                            </button>
                        </div>
                    </section>

                    <footer className="settings-footer">
                        <p>© 2026 MODULY AI. Advanced Academic Settings.</p>
                    </footer>
                </div>
            </main>
        </div>
    );
}
