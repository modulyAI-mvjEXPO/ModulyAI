import './Modes.css';

export function Modes() {
    return (
        <section className="modes section" id="modes">
            <div className="container">
                <div className="section-header">
                    <span className="badge">Core Modes</span>
                    <h2>Two Modes for Complete Preparation</h2>
                    <div className="divider"></div>
                    <p>
                        Switch between learning and exam practice, both powered by controlled AI.
                    </p>
                </div>

                <div className="modes-grid">
                    {/* Study Mode */}
                    <div className="mode-card study-mode">
                        <div className="mode-header">
                            <div className="mode-icon study">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                </svg>
                            </div>
                            <div className="mode-title">
                                <h3>Study Mode</h3>
                                <span className="mode-tag">Learn & Understand</span>
                            </div>
                        </div>

                        <div className="mode-body">
                            <p className="mode-description">
                                Deep learning focused on understanding concepts, with AI assistance
                                restricted to your uploaded materials.
                            </p>

                            <ul className="mode-features">
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Upload notes, worksheets, and lecture content</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>AI organizes and summarizes materials</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>VTU-style questions generated (2M / 8M / 10M)</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Live AI chat limited to selected documents</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Create study kits for focused sessions</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Exam Mode */}
                    <div className="mode-card exam-mode">
                        <div className="mode-header">
                            <div className="mode-icon exam">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                    <path d="M9 14l2 2 4-4" />
                                </svg>
                            </div>
                            <div className="mode-title">
                                <h3>Exam Mode</h3>
                                <span className="mode-tag">Practice & Perform</span>
                            </div>
                        </div>

                        <div className="mode-body">
                            <p className="mode-description">
                                Exam-focused preparation with PYQ analysis and VTU marking scheme
                                aligned answer writing practice.
                            </p>

                            <ul className="mode-features">
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Upload and analyze previous year questions</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Identify repeated and important questions</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Answer writing in VTU marking scheme format</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Exam-oriented preparation workflow</span>
                                </li>
                                <li>
                                    <span className="feature-icon">+</span>
                                    <span>Importance scoring for question prioritization</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
