import './TechStack.css';

const techStack = [
    {
        category: 'Frontend',
        items: ['React', 'TypeScript'],
        description: 'Modern, type-safe UI development'
    },
    {
        category: 'Backend & Auth',
        items: ['Supabase'],
        description: 'PostgreSQL database with built-in authentication'
    },
    {
        category: 'Storage',
        items: ['Cloudflare R2'],
        description: 'Scalable object storage for documents'
    },
    {
        category: 'AI Model',
        items: ['Kimi K 2.5 via OpenRouter'],
        description: 'Advanced language model with document context'
    },
    {
        category: 'Architecture',
        items: ['Controlled Document-Based AI'],
        description: 'AI restricted to user-selected content only'
    }
];

export function TechStack() {
    return (
        <section className="tech-stack section" id="tech-stack">
            <div className="container">
                <div className="section-header">
                    <span className="badge">Technology</span>
                    <h2>Tech Stack</h2>
                    <div className="divider"></div>
                    <p>
                        Built with modern, production-ready technologies.
                    </p>
                </div>

                <div className="tech-grid">
                    {techStack.map((tech, index) => (
                        <div key={index} className="tech-item">
                            <div className="tech-category">{tech.category}</div>
                            <div className="tech-items">
                                {tech.items.map((item, itemIndex) => (
                                    <span key={itemIndex} className="tech-tag">{item}</span>
                                ))}
                            </div>
                            <p className="tech-description">{tech.description}</p>
                        </div>
                    ))}
                </div>

                <div className="architecture-note">
                    <div className="note-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </div>
                    <div className="note-content">
                        <h4>Architecture Principle</h4>
                        <p>
                            MODULY AI implements a controlled RAG (Retrieval-Augmented Generation) architecture
                            where the AI model only accesses documents explicitly selected by the user for each session.
                            This ensures accuracy and eliminates hallucination.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
