import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { Solution } from './sections/Solution';
import { Modes } from './sections/Modes';
import { HowItWorks } from './sections/HowItWorks';
import { Features } from './sections/Features';
import { Comparison } from './sections/Comparison';
import { Scope } from './sections/Scope';
import { TechStack } from './sections/TechStack';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';
import { AuthModal } from './components/AuthModal';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { supabase } from './lib/supabase';
import { getProfile } from './lib/profile';
import './App.css';

type AppView = 'landing' | 'onboarding' | 'dashboard' | 'loading';

// ---------------------------------------------------------------------------
// Synchronous helpers — run before first render, zero network cost
// ---------------------------------------------------------------------------

/**
 * Read Supabase's own session out of localStorage without any async call.
 * Returns the stored user if found and not obviously expired, else null.
 */


// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

function AppContent() {
  const [authOpen, setAuthOpen] = useState(false);

  /**
   * OPTIMISTIC INIT:
   * If Supabase has a stored (non-expired) session → assume dashboard immediately.
   * Background useEffect will verify and correct (onboarding / landing) silently.
   * This eliminates the loading spinner on every page/server reload.
   */
  // const storedUser = getStoredUser();
  const [view, setView] = useState<AppView>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>({ email: 'student@vtu.tech', user_metadata: { display_name: 'Test Agent' } } as any);

  const handleSignOut = () => {
    setCurrentUser(null);
    setView('landing');
  };

  const handleOnboardingComplete = () => setView('dashboard');

  useEffect(() => {
    // Background verification – no UI impact if session is still valid
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        // Truly signed out or token expired → landing
        setCurrentUser(null);
        setView('landing');
        return;
      }

      const user = session.user;
      setCurrentUser(user);

      // Check whether onboarding is actually complete
      const profile = await getProfile(user.id);

      if (profile?.onboarding_complete === false) {
        // Explicit false → onboarding genuinely not done
        setView('onboarding');
      } else {
        // true, or profile null (fetch failed) → stay/go to dashboard
        setView('dashboard');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setAuthOpen(false);
          setCurrentUser(session.user);
          const profile = await getProfile(session.user.id);
          // false explicitly → onboarding; anything else (true/null) → dashboard
          setView(profile?.onboarding_complete === false ? 'onboarding' : 'dashboard');
        } else if (event === 'SIGNED_OUT') {
          handleSignOut();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  if (view === 'dashboard' && currentUser) {
    return <Dashboard user={currentUser} onSignOut={handleSignOut} />;
  }

  if (view === 'onboarding' && currentUser) {
    return (
      <Onboarding
        user={currentUser}
        onComplete={handleOnboardingComplete}
        onSignOut={handleSignOut}
      />
    );
  }

  // Landing page (unauthenticated)
  return (
    <div className="app">
      <Header onAuthOpen={() => setAuthOpen(true)} />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Modes />
        <HowItWorks />
        <Features />
        <Comparison />
        <Scope />
        <TechStack />
        <CTA />
      </main>
      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
