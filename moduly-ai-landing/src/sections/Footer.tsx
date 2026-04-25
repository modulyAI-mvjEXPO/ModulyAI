import './Footer.css';

export function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-main">
                    <div className="footer-brand">
                        <div className="footer-logo">
                            <img className="logo-icon" src="/logos/logo-transparent.png" alt="Moduly AI Logo" />
                            <span className="logo-text">MODULY AI</span>
                        </div>
                        <p className="footer-tagline">Study smarter. Module by module.</p>
                    </div>

                    <div className="footer-info">
                        <div className="footer-badge">VTU FOCUSED</div>
                        <p className="footer-category">Smart Education</p>
                    </div>
                </div>

                <div className="footer-divider"></div>

                <div className="footer-bottom">
                    <p className="footer-copyright">
                        Designed and developed for VTU engineering students
                    </p>
                    <p className="footer-meta">
                        An AI-powered learning system designed for examination excellence
                    </p>
                </div>
            </div>
        </footer>
    );
}
