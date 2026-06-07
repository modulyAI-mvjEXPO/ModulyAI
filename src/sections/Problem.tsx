import './Problem.css';

const problems = [
    {
        icon: '📄',
        title: 'Scattered Study Materials',
        description: 'College study materials are fragmented across PDFs, websites, WhatsApp groups, and random drives. Students waste hours searching instead of studying.'
    },
    {
        icon: '📚',
        title: 'No Module-Wise Organization',
        description: 'Standard learning resources lack College syllabus structure. Students struggle to map content to specific modules for focused preparation.'
    },
    {
        icon: '📝',
        title: 'Underutilized PYQs',
        description: 'Previous year questions contain patterns and repeated topics, but students lack tools to analyze and leverage this valuable data systematically.'
    },
    {
        icon: '🤖',
        title: 'Generic AI Hallucinations',
        description: 'ChatGPT and similar tools generate plausible but often incorrect answers. They ignore College syllabus structure and exam patterns entirely.'
    }
];

export function Problem() {
    return (
        <section className="problem section" id="problem">
            <div className="container">
                <div className="section-header">
                    <span className="badge">The Challenge</span>
                    <h2>Real Problems College Students Face</h2>
                    <div className="divider"></div>
                    <p>
                        Engineering students spend more time organizing resources than actually learning.
                        Current tools fail to address the structured nature of College exams.
                    </p>
                </div>

                <div className="problem-grid">
                    {problems.map((problem, index) => (
                        <div key={index} className="problem-card">
                            <div className="problem-icon">{problem.icon}</div>
                            <h3>{problem.title}</h3>
                            <p>{problem.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
