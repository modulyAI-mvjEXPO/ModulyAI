# AGENTS.md - Moduly AI Landing

## Project Overview

Moduly AI is a React + TypeScript SPA for VTU (Visvesvaraya Technological University) students.
It includes a landing page (neo-brutalist style) and a dashboard app (glassmorphism style) with
study/exam modes, file uploads, and Supabase authentication. Deployed on Netlify.

## Tech Stack

- **Framework**: React 19 with Vite 7 (no Next.js, no SSR)
- **Language**: TypeScript 5.9 (strict mode, `verbatimModuleSyntax`)
- **Styling**: Tailwind CSS 3 + co-located CSS files (one `.css` per component/page)
- **Backend**: Supabase (auth, database), Netlify Functions (serverless, `.mjs`)
- **Storage**: Utho Object Storage (S3-compatible) via pre-signed URLs
- **Icons**: Material Icons Outlined (dashboard), inline SVGs (landing/auth)
- **Utilities**: `clsx` + `tailwind-merge` via `cn()` helper in `src/lib/utils.ts`

## Build / Dev / Lint Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run build        # TypeScript check + Vite production build (tsc -b && vite build)
npm run lint         # ESLint across all .ts/.tsx files
npm run preview      # Preview production build locally
npm run netlify      # Netlify dev server with functions (port 8888)
```

There is **no test framework** configured. No test runner, no test files.
If adding tests, use Vitest (natural pairing with Vite):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
# Add to package.json scripts: "test": "vitest run", "test:watch": "vitest"
# Single test: npx vitest run src/lib/auth.test.ts
```

## Project Structure

```
src/
  main.tsx              # Entry point (StrictMode + createRoot)
  App.tsx               # Root component, auth state machine, view routing
  App.css               # App-level styles
  index.css             # Tailwind directives + CSS custom properties (light/dark themes)
  components/           # Shared/reusable components
    AuthModal.tsx        # Auth flow (login/signup/OTP)
    FileUpload.tsx       # S3 upload component
    ThemeToggle.tsx      # Light/dark toggle
    AppNav/              # Sub-directory for multi-file components
      AppNav.tsx
      AppNav.css
    demo.tsx             # WavyBackground demo wrapper
    ui/                  # UI primitives (wavy-background)
  sections/             # Landing page sections (Header, Hero, Problem, Solution, etc.)
  pages/                # Dashboard pages (Dashboard, StudyMode, ExamMode, Library, etc.)
  context/              # React contexts (ThemeContext)
  lib/                  # Business logic, API clients, data
    supabase.ts          # Supabase client singleton
    auth.ts              # Auth functions (signUp, signIn, verifyOtp, etc.)
    profile.ts           # Profile CRUD (getProfile, upsertProfile)
    vtuData.ts           # Static VTU college/course/subject data
    utils.ts             # cn() utility
  assets/               # Static assets
netlify/
  functions/            # Netlify serverless functions (.mjs)
    get-upload-url.mjs   # Pre-signed S3 upload URL generator
    list-files.mjs       # List uploaded files
```

## TypeScript Configuration

- **Target**: ES2022, **Module**: ESNext, **JSX**: react-jsx
- **Strict mode** enabled: `strict`, `noUnusedLocals`, `noUnusedParameters`
- `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`
- `verbatimModuleSyntax` enabled: use `import type { X }` for type-only imports
- `erasableSyntaxOnly`: no enums, no namespaces, no parameter properties
- **Path alias**: `@/*` maps to `./src/*`

## Code Style & Conventions

### Imports

Order (observed convention, no auto-enforced sorting):
1. React imports (`import { useState, useEffect } from 'react'`)
2. Type-only imports (`import type { User } from '@supabase/supabase-js'`)
3. Internal context/lib (`from '../context/ThemeContext'`, `from '../lib/auth'`)
4. Component imports (`from './sections/Header'`)
5. CSS imports (`import './App.css'`)

Use `import type { ... }` for type-only imports (enforced by `verbatimModuleSyntax`).

### Components

- **Named exports** for all components: `export function Dashboard() {}` (not default exports)
  - Exception: `App.tsx` uses `export default App`
- **Function declarations** preferred over arrow functions for components
- Props defined as inline interfaces near the component:
  ```tsx
  interface DashboardProps {
    user: User;
    onSignOut: () => void;
  }
  export function Dashboard({ user, onSignOut }: DashboardProps) { ... }
  ```
- Union types for view/page state: `type AppView = 'landing' | 'onboarding' | 'dashboard'`
- Each component/page gets its own co-located `.css` file imported at the top

### Naming Conventions

- **Files**: PascalCase for components/pages (`AuthModal.tsx`, `Dashboard.tsx`),
  camelCase for libs (`supabase.ts`, `vtuData.ts`)
- **Components**: PascalCase (`AuthModal`, `ThemeProvider`)
- **Hooks**: camelCase with `use` prefix (`useTheme`)
- **Functions**: camelCase (`signIn`, `getProfile`, `upsertProfile`)
- **Interfaces/Types**: PascalCase (`UserProfile`, `AuthResult`, `DashboardPage`)
- **Constants**: UPPER_SNAKE_CASE for static data arrays (`NAV_MAIN`, `QUICK_ACTIONS`, `BLOCKED_DOMAINS`)
- **CSS classes**: kebab-case with BEM-like prefixes (`db-sidebar`, `db-nav-item--active`,
  `auth-modal`, `hero-title`)

### Error Handling

- Async functions return result objects: `{ user: User | null; error: string | null }`
- User-facing errors are mapped from API errors via helper functions (see `formatError` in `auth.ts`)
- Supabase errors: log with `console.error`, return `null` or `{ error: message }`
- Use `try/catch` in serverless functions, return appropriate HTTP status codes
- Validation functions return `string | null` (error message or null for valid)

### State Management

- React `useState` + `useEffect` (no external state library)
- Context API for cross-cutting concerns (`ThemeContext`)
- View-based routing via state machine pattern (`type AppView = ...`, `useState<AppView>`)
- No React Router - navigation is state-driven

### Styling

- Two design systems coexist:
  - **Landing page**: Neo-brutalist (hard shadows, bold borders, high contrast)
  - **Dashboard**: Glassmorphism (blur, gradients, translucent panels)
- CSS custom properties defined in `src/index.css` with light/dark theme variants
- Tailwind used for utility classes; custom CSS for complex component styling
- `cn()` helper for conditional class merging: `cn("base-class", condition && "active")`
- Theme toggled via `data-theme` attribute on `<html>` element

### Environment Variables

- Client-side (Vite): prefix with `VITE_` (e.g., `VITE_SUPABASE_URL`)
- Server-side (Netlify Functions): no prefix (e.g., `UTHO_ENDPOINT`)
- Never commit `.env` - use `.env.example` as reference
- Required client vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Required server vars: `UTHO_ENDPOINT`, `UTHO_REGION`, `UTHO_BUCKET_NAME`,
  `UTHO_ACCESS_KEY`, `UTHO_SECRET_KEY`

## ESLint Configuration

- Flat config format (`eslint.config.js`)
- Extends: `@eslint/js` recommended, `typescript-eslint` recommended
- Plugins: `react-hooks` (recommended), `react-refresh` (vite)
- Scoped to `**/*.{ts,tsx}` files; `dist/` is ignored

## Netlify Deployment

- Build command: `npm run build`, publish dir: `dist/`
- Functions directory: `netlify/functions/`
- URL rewrites: `/get-upload-url` -> `/.netlify/functions/get-upload-url`
- Functions are plain ES modules (`.mjs`), not TypeScript

## Key Patterns to Follow

1. **No enums** - use union string types (`type View = 'a' | 'b'`)
2. **No class components** - functional components only
3. **No default exports** except `App.tsx`
4. **Validate at boundaries** - auth inputs validated before API calls
5. **Supabase client** is a singleton in `src/lib/supabase.ts` - import it, don't recreate
6. **Optimistic UI** - check localStorage for cached auth before async verification
7. **Profile upsert pattern** - try UPDATE first, INSERT if no rows affected
8. **JSDoc comments** on exported lib functions (see `auth.ts`, `profile.ts`)
