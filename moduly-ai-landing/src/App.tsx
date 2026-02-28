import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { ThemeProvider } from './context/ThemeContext';
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

function AppContent() {
  const [authOpen, setAuthOpen] = useState(false);
  const [view, setView] = useState<AppView>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Determine where to route after auth
  const resolveRoute = async (user: User) => {
    setCurrentUser(user);
    const profile = await getProfile(user.id);
    if (profile?.onboarding_complete) {
      setView('dashboard');
    } else {
      setView('onboarding');
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setView('landing');
  };

  const handleOnboardingComplete = () => {
    setView('dashboard');
  };

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveRoute(session.user);
      } else {
        setView('landing');
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setAuthOpen(false);
          await resolveRoute(session.user);
        } else if (event === 'SIGNED_OUT') {
          handleSignOut();
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Full-screen loading spinner while checking session
  if (view === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  // Post-auth pages (no landing page chrome)
  if (view === 'dashboard' && currentUser) {
    return <Dashboard onSignOut={handleSignOut} />;
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

  // Landing page (default)
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
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
