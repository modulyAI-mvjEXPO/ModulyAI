import './Scope.css';

const mvpFeatures = [
    'Document upload and organization',
    'Study Mode with AI assistance',
    'Exam Mode with PYQ analysis',
    'VTU-style answer generation',
    'Library and document search',
    'Study kit creation and sessions',
    'Module-wise content organization',
    'Document-restricted AI chat'
];

const futureFeatures = [
    'Lecture transcription and notes',
    'Question prediction algorithms',
    'IA and semester progress trackers',
    'AI-based paper grading feedback',
    'Multi-university support',
    'Collaborative study groups',
    'Mobile application',
    'Offline mode support'
];

export function Scope() {
    return (
        <section className="scope section" id="scope">
            <div className="container">
                <div className="section-header">
                    <span className="badge">Project Scope</span>
                    <h2>MVP vs Future Development</h2>
                    <div className="divider"></div>
                    <p>
                        Clear distinction between what is built and what the system can evolve into.
                    </p>
                </div>

                <div className="scope-grid">
                    <div className="scope-card mvp">
                        <div className="scope-header">
                            <div className="scope-icon mvp-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <div>
                                <h3>MVP</h3>
                                <span className="scope-subtitle">What is Built</span>
                            </div>
                        </div>
                        <ul className="scope-list">
                            {mvpFeatures.map((feature, index) => (
                                <li key={index}>
                                    <span className="check-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <div className="scope-status">
                            <span className="status-badge implemented">Implemented</span>
                        </div>
                    </div>

                    <div className="scope-card future">
                        <div className="scope-header">
                            <div className="scope-icon future-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div>
                                <h3>Future Scope</h3>
                                <span className="scope-subtitle">Planned Evolution</span>
                            </div>
                        </div>
                        <ul className="scope-list">
                            {futureFeatures.map((feature, index) => (
                                <li key={index}>
                                    <span className="future-dot"></span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <div className="scope-status">
                            <span className="status-badge planned">Planned</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
