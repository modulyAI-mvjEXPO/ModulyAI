import { useState, useEffect, useRef } from 'react';
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
  const [view, setView] = useState<AppView>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isManualSignOut = useRef(false);

  const handleSignOut = () => {
    isManualSignOut.current = true;
    setCurrentUser(null);
    setView('landing');
  };

  const handleOnboardingComplete = () => setView('dashboard');

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      // Safety timeout: transition to landing if init takes too long (e.g. 15s)
      const safetyTimeout = setTimeout(() => {
        if (mounted && view === 'loading') {
          console.warn('Auth initialization timed out, defaulting to landing.');
          setView('landing');
        }
      }, 15000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) {
          clearTimeout(safetyTimeout);
          return;
        }

        if (session?.user) {
          setCurrentUser(session.user);
          try {
            // Profile fetch also needs a timeout safeguard (12s)
            const profile = await Promise.race([
              getProfile(session.user.id),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000))
            ]);

            if (!mounted) return;
            setView(profile?.onboarding_complete === false ? 'onboarding' : 'dashboard');
          } catch (profileErr) {
            console.error('Profile fetch failed during init:', profileErr);
            setView('dashboard'); // Fallback to dashboard if profile fails
          }
        } else {
          setView('landing');
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        if (mounted) setView('landing');
      } finally {
        clearTimeout(safetyTimeout);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Ignore events immediately after a manual sign-out to prevent re-login
        if (isManualSignOut.current && (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION')) {
          isManualSignOut.current = false;
          return;
        }

        if (session?.user) {
          setCurrentUser(session.user);
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            try {
              // Wrap with 15s timeout
              const profile = await Promise.race([
                  getProfile(session.user.id),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000))
              ]);
              if (!mounted) return;
              setView(profile?.onboarding_complete === false ? 'onboarding' : 'dashboard');
            } catch (err) {
              console.error('onAuthStateChange profile fetch error:', err);
              setView('dashboard');
            }
          }
        } else {
          setCurrentUser(null);
          setView('landing');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p className="app-loading-text">MODULY AI</p>
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
