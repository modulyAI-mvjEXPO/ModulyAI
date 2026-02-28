import './CTA.css';

export function CTA() {
    return (
        <section className="cta section">
            <div className="container">
                <div className="cta-content">
                    <div className="cta-badge">
                        <span className="badge-dot"></span>
                        <span>Project Expo 2026</span>
                    </div>

                    <h2>
                        MODULY AI is not just another AI tool
                    </h2>

                    <p className="cta-statement">
                        It is a <span className="highlight">syllabus-driven learning system</span> built to improve
                        how engineering students study, prepare, and perform.
                    </p>

                    <div className="cta-features">
                        <div className="cta-feature">
                            <span className="feature-check">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            VTU Syllabus Aligned
                        </div>
                        <div className="cta-feature">
                            <span className="feature-check">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            Document-Controlled AI
                        </div>
                        <div className="cta-feature">
                            <span className="feature-check">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            Exam Pattern Intelligence
                        </div>
                    </div>

                    <div className="cta-divider"></div>

                    <p className="cta-subtitle">Smart Education</p>
                </div>
            </div>
        </section>
    );
}
