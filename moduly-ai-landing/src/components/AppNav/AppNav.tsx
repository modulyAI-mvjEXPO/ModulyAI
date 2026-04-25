import { signOut } from '../../lib/auth';
import { ButtonColorful } from '../ui/button-colorful';
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
                        <ButtonColorful
                            onClick={handleSignOut}
                            label="Sign Out"
                        />
                    )}
                </div>
            </div>
        </nav>
    );
}
