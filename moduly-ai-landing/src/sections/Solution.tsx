import './Solution.css';

export function Solution() {
    return (
        <section className="solution section" id="solution">
            <div className="container">
                <div className="section-header">
                    <span className="badge">The Solution</span>
                    <h2>A Syllabus-Aware AI Built for VTU</h2>
                    <div className="divider"></div>
                    <p>
                        MODULY organizes learning the way VTU students actually study and write exams.
                    </p>
                </div>

                <div className="solution-flow">
                    <div className="flow-item">
                        <div className="flow-number">1</div>
                        <div className="flow-content">
                            <h3>Subject</h3>
                            <p>Select your subject from the VTU curriculum</p>
                        </div>
                    </div>

                    <div className="flow-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </div>

                    <div className="flow-item">
                        <div className="flow-number">2</div>
                        <div className="flow-content">
                            <h3>Module</h3>
                            <p>Focus on specific syllabus modules</p>
                        </div>
                    </div>

                    <div className="flow-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </div>

                    <div className="flow-item">
                        <div className="flow-number">3</div>
                        <div className="flow-content">
                            <h3>Exam</h3>
                            <p>VTU-style answers and prep</p>
                        </div>
                    </div>
                </div>

                <div className="solution-cards">
                    <div className="solution-card">
                        <div className="card-icon verified">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4" />
                                <path d="M21 12c0 6-4 9-9 9s-9-3-9-9 4-9 9-9 9 3 9 9z" />
                            </svg>
                        </div>
                        <h4>Verified Documents Only</h4>
                        <p>AI works exclusively on your uploaded notes, worksheets, and approved materials. No random internet data.</p>
                    </div>

                    <div className="solution-card">
                        <div className="card-icon accuracy">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                        </div>
                        <h4>Zero Hallucination</h4>
                        <p>Controlled AI that refuses to guess. Every answer is grounded in your selected study materials.</p>
                    </div>

                    <div className="solution-card">
                        <div className="card-icon structure">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18M9 21V9" />
                            </svg>
                        </div>
                        <h4>Syllabus Structured</h4>
                        <p>Everything organized by VTU syllabus structure. Subject, semester, module — always in context.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
