import { AppNav } from '../components/AppNav/AppNav';
import './Dashboard.css';

interface DashboardProps {
    onSignOut: () => void;
}

export function Dashboard({ onSignOut }: DashboardProps) {
    return (
        <div className="dashboard-page">
            <AppNav onSignOut={onSignOut} />

            {/* Floating background orbs */}
            <div className="db-orb db-orb-1" />
            <div className="db-orb db-orb-2" />
            <div className="db-orb db-orb-3" />

            {/* Centered WIP card */}
            <div className="db-center">
                <div className="db-card">
                    <div className="db-glow-ring" />
                    <div className="db-icon">🚧</div>
                    <h1 className="db-title">Work in Progress</h1>
                    <p className="db-subtitle">
                        We're building something extraordinary for you.
                        <br />
                        The studyspace is almost ready — stay tuned!
                    </p>
                    <div className="db-tags">
                        <span className="db-tag">AI Tutor</span>
                        <span className="db-tag">Smart Notes</span>
                        <span className="db-tag">VTU Focus</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
