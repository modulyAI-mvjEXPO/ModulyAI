import './Scope.css';

const mvpFeatures = [
    'Document upload and organization',
    'Study Mode with AI assistance',
    'Exam Mode with PYQ analysis',
    'College-style answer generation',
    'Library and document search',
    'Study kit creation and sessions',
    'Module-wise content organization',
    'Document-restricted AI chat'
];

const futureCategories = [
    {
        title: 'Advanced AI & Automation',
        icon: 'smart_toy',
        items: [
            'Lecture audio transcription + task extraction',
            'Auto task scheduling',
            'Live editable AI document',
            'Voice-based answering',
            'OCR-based written answer evaluation'
        ]
    },
    {
        title: 'Exam Intelligence (Advanced)',
        icon: 'analytics',
        items: [
            'Full IA & semester tracker',
            'Question prediction with probability scores',
            'Paper grading AI',
            'Performance analytics dashboards'
        ]
    },
    {
        title: 'Content Expansion',
        icon: 'play_circle',
        items: [
            'YouTube video summarization',
            'Podcast explanations (TTS)',
            'Slides & mind maps auto-generation'
        ]
    },
    {
        title: 'Platform & Scale',
        icon: 'devices',
        items: [
            'PWA + mobile app',
            'Multi-university support',
            'Collaborative study groups',
            'Faculty dashboards'
        ]
    },
    {
        title: 'Monetization Expansion',
        icon: 'monetization_on',
        items: [
            'Credit-based usage system',
            'Premium API bundles',
            'Institutional licenses'
        ]
    }
];

export function Scope() {
    return (
        <section className="scope section" id="scope">
            <div className="container">
                <div className="section-header">
                    <span className="badge">Project Roadmap</span>
                    <h2>MVP vs Future Development</h2>
                    <div className="divider"></div>
                    <p>
                        A clear roadmap highlighting our current deliverables and the expansive vision for Phase 2.
                    </p>
                </div>

                <div className="scope-layout">
                    {/* MVP Section */}
                    <div className="scope-card mvp">
                        <div className="scope-header">
                            <div className="scope-icon mvp-icon">
                                <span className="material-icons-outlined">task_alt</span>
                            </div>
                            <div>
                                <h3>Current MVP</h3>
                                <span className="scope-subtitle">What is Built & Deployed</span>
                            </div>
                            <div className="scope-status ms-auto">
                                <span className="status-badge implemented">Implemented</span>
                            </div>
                        </div>
                        <ul className="scope-list mvp-list">
                            {mvpFeatures.map((feature, index) => (
                                <li key={index}>
                                    <span className="check-icon">
                                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>done</span>
                                    </span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Future Scope Section */}
                    <div className="scope-card future">
                        <div className="scope-header">
                            <div className="scope-icon future-icon">
                                <span className="material-icons-outlined">rocket_launch</span>
                            </div>
                            <div>
                                <h3>Future Scope (Phase 2) 🚀</h3>
                                <span className="scope-subtitle">Post-Build-Deployment Plans</span>
                            </div>
                            <div className="scope-status ms-auto">
                                <span className="status-badge planned">Seeking Funding</span>
                            </div>
                        </div>
                        
                        <div className="future-grid">
                            {futureCategories.map((category, idx) => (
                                <div key={idx} className="future-category">
                                    <h4 className="future-cat-title">
                                        <span className="material-icons-outlined">{category.icon}</span>
                                        {category.title}
                                    </h4>
                                    <ul className="future-cat-list">
                                        {category.items.map((item, i) => (
                                            <li key={i}>
                                                <span className="future-dot"></span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
