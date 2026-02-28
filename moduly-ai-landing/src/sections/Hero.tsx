import './Hero.css';

export function Hero() {
    return (
        <section className="hero" id="hero">
            <div className="hero-bg">
                <div className="hero-gradient"></div>
                <div className="hero-pattern"></div>
            </div>
            <div className="hero-container">
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="badge-dot"></span>
                        <span>Smart Education Platform</span>
                    </div>

                    <h1 className="hero-title">
                        <span className="title-main">MODULY AI</span>
                    </h1>

                    <p className="hero-tagline">
                        Study smarter. <span className="text-accent">Module by module.</span>
                    </p>

                    <p className="hero-description">
                        An AI-powered smart education platform designed exclusively for VTU students
                        — structured around syllabus, modules, PYQs, and exam performance.
                    </p>

                    <div className="hero-visual">
                        <div className="visual-card">
                            <div className="visual-header">
                                <div className="visual-dots">
                                    <span></span><span></span><span></span>
                                </div>
                                <span className="visual-title">Study Session</span>
                            </div>
                            <div className="visual-content">
                                <div className="visual-row">
                                    <span className="visual-label">Subject</span>
                                    <span className="visual-value">Data Structures</span>
                                </div>
                                <div className="visual-row">
                                    <span className="visual-label">Module</span>
                                    <span className="visual-value">Trees & Graphs</span>
                                </div>
                                <div className="visual-row highlight">
                                    <span className="visual-label">AI Status</span>
                                    <span className="visual-value accent">Ready to assist</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hero-stats">
                    <div className="stat-item">
                        <span className="stat-number">VTU</span>
                        <span className="stat-label">Focused</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                        <span className="stat-number">AI</span>
                        <span className="stat-label">Powered</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                        <span className="stat-number">0%</span>
                        <span className="stat-label">Hallucination</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
