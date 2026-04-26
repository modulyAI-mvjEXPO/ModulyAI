import './HowItWorks.css';

const steps = [
    {
        number: '01',
        title: 'Sign Up',
        description: 'Create account with your academic details — semester, branch, and university.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        )
    },
    {
        number: '02',
        title: 'Upload Documents',
        description: 'Add your notes, worksheets, PYQs, and any study material. Supports PDFs and documents.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
        )
    },
    {
        number: '03',
        title: 'AI Processing',
        description: 'System cleans, categorizes, and indexes your materials by subject and module.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
        )
    },
    {
        number: '04',
        title: 'Select Study Kit',
        description: 'Choose specific documents for your session. AI only uses what you select.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
        )
    },
    {
        number: '05',
        title: 'AI Assistance',
        description: 'Get summaries, questions, and answers — all grounded in your selected materials.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        )
    },
    {
        number: '06',
        title: 'Exam Ready',
        description: 'Output is syllabus-accurate, College-formatted, and exam-oriented.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
        )
    }
];

export function HowItWorks() {
    return (
        <section className="how-it-works section" id="how-it-works">
            <div className="container">
                <div className="section-header">
                    <span className="badge">System Flow</span>
                    <h2>How MODULY AI Works</h2>
                    <div className="divider"></div>
                    <p>
                        A systematic approach from document upload to exam-ready preparation.
                    </p>
                </div>

                <div className="steps-grid">
                    {steps.map((step, index) => (
                        <div key={index} className="step-card">
                            <div className="step-number">{step.number}</div>
                            <div className="step-icon">{step.icon}</div>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                            {index < steps.length - 1 && (
                                <div className="step-connector">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M19 12l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
