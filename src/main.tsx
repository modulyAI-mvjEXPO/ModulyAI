import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const savedTheme = localStorage.getItem('moduly_theme') || 'dark';
  if (savedTheme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch (err) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
