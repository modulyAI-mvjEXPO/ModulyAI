import { signOut } from '../../lib/auth';
import './AppNav.css';

interface AppNavProps {
    onSignOut?: () => void;
    showSignOut?: boolean;
}

export function AppNav({ onSignOut, showSignOut = true }: AppNavProps) {
    const handleSignOut = async () => {
        onSignOut?.();
        await signOut();
    };

    return (
        <nav className="app-nav">
            <div className="app-nav-inner">
                {/* Logo */}
                <div className="app-nav-logo">
                    <img className="app-nav-logo-icon" src="/logos/logo-transparent.png" alt="Moduly AI Logo" />
                    <span className="app-nav-logo-text">MODULY AI</span>
                </div>

                {/* Right side */}
                <div className="app-nav-actions">
                    {showSignOut && (
                        <button className="app-nav-signout" onClick={handleSignOut}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Sign Out
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
