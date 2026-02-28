import { useState } from 'react';
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
import './App.css';

function App() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;
