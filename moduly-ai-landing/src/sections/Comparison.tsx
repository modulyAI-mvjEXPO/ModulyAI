import './Comparison.css';

const comparisons = [
    {
        aspect: 'Syllabus Structure',
        generic: 'No awareness of College syllabus or modules',
        moduly: 'Built around College syllabus, organized by modules'
    },
    {
        aspect: 'Data Sources',
        generic: 'Uses entire internet, often unreliable',
        moduly: 'Only your verified, uploaded documents'
    },
    {
        aspect: 'Answer Accuracy',
        generic: 'Hallucinations and fabricated information',
        moduly: 'Zero hallucination — grounded in your content'
    },
    {
        aspect: 'Question Format',
        generic: 'Generic questions, no exam pattern',
        moduly: '2M / 8M / 10M College exam format'
    },
    {
        aspect: 'PYQ Analysis',
        generic: 'No exam intelligence capabilities',
        moduly: 'Repeated questions and importance scoring'
    },
    {
        aspect: 'Design Focus',
        generic: 'General-purpose, one size fits all',
        moduly: 'College-first design for engineering students'
    }
];

export function Comparison() {
    return (
        <section className="comparison section" id="comparison">
            <div className="container">
                <div className="section-header">
                    <span className="badge">The Difference</span>
                    <h2>Why MODULY AI is Different</h2>
                    <div className="divider"></div>
                    <p>
                        A purpose-built platform versus generic AI tools.
                    </p>
                </div>

                <div className="comparison-table">
                    <div className="comparison-header">
                        <div className="header-aspect">Aspect</div>
                        <div className="header-generic">Generic AI Tools</div>
                        <div className="header-moduly">MODULY AI</div>
                    </div>

                    {comparisons.map((item, index) => (
                        <div key={index} className="comparison-row">
                            <div className="row-aspect">{item.aspect}</div>
                            <div className="row-generic">
                                <span className="status-icon negative">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </span>
                                {item.generic}
                            </div>
                            <div className="row-moduly">
                                <span className="status-icon positive">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </span>
                                {item.moduly}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
