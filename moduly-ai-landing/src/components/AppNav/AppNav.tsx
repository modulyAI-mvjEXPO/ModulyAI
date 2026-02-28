import { useTheme } from '../../context/ThemeContext';
import { signOut } from '../../lib/auth';
import './AppNav.css';

interface AppNavProps {
    onSignOut?: () => void;
    showSignOut?: boolean;
}

export function AppNav({ onSignOut, showSignOut = true }: AppNavProps) {
    const { theme, toggleTheme } = useTheme();

    const handleSignOut = async () => {
        await signOut();
        onSignOut?.();
    };

    return (
        <nav className="app-nav">
            <div className="app-nav-inner">
                {/* Logo */}
                <div className="app-nav-logo">
                    <span className="app-nav-logo-icon">M</span>
                    <span className="app-nav-logo-text">MODULY AI</span>
                </div>

                {/* Right side */}
                <div className="app-nav-actions">
                    {/* Theme toggle */}
                    <button
                        className="app-nav-theme-btn"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? (
                            /* Sun icon */
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            /* Moon icon */
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

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
