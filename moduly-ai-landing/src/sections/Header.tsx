
import './Header.css';

interface HeaderProps {
    onAuthOpen: () => void;
}

export function Header({ onAuthOpen }: HeaderProps) {
    return (
        <header className="header">
            <div className="header-container">
                <div className="logo">
                    <span className="logo-icon">M</span>
                    <span className="logo-text">MODULY AI</span>
                </div>
                <nav className="nav">
                    <a href="#problem" className="nav-link">Problem</a>
                    <a href="#solution" className="nav-link">Solution</a>
                    <a href="#features" className="nav-link">Features</a>
                    <a href="#tech-stack" className="nav-link">Tech Stack</a>
                </nav>
                <div className="header-actions">
                    <button className="header-cta" onClick={onAuthOpen}>
                        Get Started
                    </button>
                </div>
            </div>
        </header>
    );
}
