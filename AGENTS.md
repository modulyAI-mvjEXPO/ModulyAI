# AGENTS.md — Moduly AI Landing

Guidelines for AI coding agents working in this repository.

## Project Overview

Moduly AI is an AI-powered study platform for VTU (Visvesvaraya Technological University) students.
This repo contains a **Vite + React 19 + TypeScript 5.9** single-page application deployed on Netlify.
There is no routing library — navigation is state-driven via `useState<AppView>` in `App.tsx`.

## Build / Lint / Dev Commands

All commands run from `moduly-ai-landing/`.

| Command              | What it does                                             |
|----------------------|----------------------------------------------------------|
| `npm run dev`        | Start Vite dev server on port 5173                       |
| `npm run build`      | Type-check (`tsc -b`) then build to `dist/`              |
| `npm run lint`       | ESLint (flat config) on all `*.ts` and `*.tsx` files     |
| `npm run preview`    | Serve the production build locally                       |
| `npm run netlify`    | Netlify Dev (port 8888, proxies to Vite on 5173)         |

### Testing

**No test framework is configured.** There are no test files, no Vitest/Jest/Playwright dependencies.
If you add tests, use Vitest (it integrates natively with the existing Vite toolchain).

### Type Checking

Run `npx tsc -b` (or `npm run build`) to type-check. TypeScript strict mode is enabled
with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`, and `forceConsistentCasingInFileNames`.

## Project Structure

```
moduly-ai-landing/
  src/
    App.tsx               # Root component — view routing via state
    main.tsx              # Entry point (ReactDOM.createRoot)
    index.css             # Global design system (CSS custom properties)
    components/           # Reusable UI (AuthModal, ThemeToggle, FileUpload, AppNav)
    context/              # React Context providers (ThemeContext only)
    lib/                  # Non-UI utilities (supabase client, auth, profile, vtuData)
    pages/                # Authenticated app views (Dashboard, StudyMode, ExamMode, etc.)
    sections/             # Landing page sections (Hero, Header, Footer, etc.)
  netlify/functions/      # Serverless functions (get-upload-url, list-files)
  public/                 # Static assets and SPA _redirects
```

## Code Style

### Imports

Order imports as follows (no blank lines between groups unless readability requires it):

1. React imports — `import { useState, useEffect } from 'react';`
2. Type-only imports — `import type { User } from '@supabase/supabase-js';`
3. Local modules — context, lib, components, pages (relative paths, no aliases)
4. CSS — always last: `import './Component.css';`

Use `import type { ... }` for type-only imports (`verbatimModuleSyntax` is enforced).
Do not use path aliases — all imports are relative (e.g., `'../lib/auth'`).
No barrel/index files exist; import each module directly by filename.

### Components

- **Always use named `function` declarations**, never arrow function components:
  ```tsx
  // Correct
  export function MyComponent({ title }: MyComponentProps) { ... }

  // Wrong
  export const MyComponent = ({ title }: MyComponentProps) => { ... };
  ```
- Arrow functions are used only for event handlers, callbacks, and helpers inside components.
- All components are functional (no class components).

### Props Typing

Define a dedicated interface directly above the component:

```tsx
interface CardProps {
  title: string;
  onClick: () => void;
}

export function Card({ title, onClick }: CardProps) { ... }
```

For trivial single-prop components, inline types are acceptable:

```tsx
export function ThemeProvider({ children }: { children: ReactNode }) { ... }
```

### Types vs Interfaces

- **Interfaces** for object shapes and props: `interface UserProfile { ... }`
- **Types** for unions, aliases, and utility types: `type AppView = 'landing' | 'onboarding' | 'dashboard'`

### Exports

- Use **named exports** everywhere.
- The only default export is `App.tsx` (required by Vite's template convention in `main.tsx`).
- Netlify functions export `handler`: `export const handler = async (event) => { ... }`

### Naming Conventions

| Element              | Convention       | Examples                                          |
|----------------------|------------------|---------------------------------------------------|
| Components/Pages     | PascalCase       | `AuthModal.tsx`, `Dashboard.tsx`, `Hero.tsx`       |
| Lib/utility files    | camelCase        | `auth.ts`, `profile.ts`, `vtuData.ts`             |
| Folders              | lowercase        | `components`, `pages`, `sections`, `lib`          |
| CSS files            | Match component  | `Dashboard.css` beside `Dashboard.tsx`            |
| Variables/functions  | camelCase        | `loginIdentifier`, `handleSignOut`                |
| Module-level consts  | UPPER_SNAKE_CASE | `BLOCKED_DOMAINS`, `PAGE_SIZE`, `NAV_MAIN`        |
| Types/Interfaces     | PascalCase       | `AppView`, `UserProfile`, `DashboardProps`        |
| Props interfaces     | `FooProps`       | `AuthModalProps`, `HeaderProps`, `SettingsProps`   |
| Event handlers       | `handle` prefix  | `handleLogin`, `handleUpload`, `handleKey`        |
| Boolean state        | Descriptive      | `isSubmitting`, `isTyping`, `sidebarOpen`         |
| CSS classes          | BEM + prefix     | `db-sidebar`, `sm-kit--open`, `em-mark-btn--active` |

CSS class prefixes by area: `db-` (dashboard), `sm-` (study mode), `em-` (exam mode),
`ob-` (onboarding), `lib-` (library), `ud-` (upload docs), `auth-` (auth modal).

### Styling

- **Vanilla CSS** with CSS custom properties — no Tailwind, CSS Modules, or styled-components.
- Global design tokens defined in `src/index.css` (colors, spacing, typography, shadows, transitions).
- One `.css` file co-located per component/page/section.
- Dark mode via `[data-theme="dark"]` selector on `<html>`, toggled through `ThemeContext`.
- Icons: Google Material Icons Outlined (`<span className="material-icons-outlined">`) and inline SVGs.
- Font: Inter (loaded from Google Fonts in `index.html`).

### Error Handling

- **Result objects** for auth/data operations — return `{ user, error }` or `{ data, error }` instead of throwing:
  ```ts
  const { data, error } = await supabase.auth.signUp({ ... });
  if (error) return { user: null, error: formatError(error) };
  ```
- **Try-catch** for network/I/O operations (file uploads, fetch calls) with `console.error` + user-facing state.
- **Guard returns** with `null` for optional data lookups (`getProfile`, `getEmailByUsername`).
- **UI error state** stored in component state (`errors`, `submitError`) and rendered conditionally.
- Translate raw errors to user-friendly messages via helper functions (see `formatError` in `lib/auth.ts`).

### State Management

- `useState` for all local state; `useContext` with `ThemeContext` for theme.
- No external state library (no Redux, Zustand, Jotai).
- Auth state managed via `supabase.auth.onAuthStateChange()` listener in `App.tsx`.
- Navigation is state-driven: `AppView` in `App.tsx`, `DashboardPage` in `Dashboard.tsx`.

## Environment Variables

**Client-side** (prefixed with `VITE_`, available via `import.meta.env`):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key
- `VITE_BACKEND_URL` — Backend API base URL (optional, defaults to `""`)

**Server-side** (used in Netlify Functions only):
- `UTHO_ENDPOINT`, `UTHO_REGION`, `UTHO_BUCKET_NAME`, `UTHO_ACCESS_KEY`, `UTHO_SECRET_KEY`

See `.env.example` for the template. Never commit `.env` files.

## Key Architecture Notes

- **No router library** — `App.tsx` switches views via `useState<AppView>`. Dashboard sub-pages
  use `useState<DashboardPage>`. Do not add React Router without explicit approval.
- **AI features are mocked** — `StudyMode` and `ExamMode` use hardcoded response generators,
  not real LLM calls.
- **Supabase** handles auth (email+OTP) and database (profiles table).
- **Netlify Functions** handle S3-compatible object storage (Utho) for file uploads.
- **ESLint flat config** (`eslint.config.js`) with `react-hooks` and `react-refresh` plugins.
- Build output goes to `dist/`; SPA routing handled by `public/_redirects`.
- VTU academic data (colleges, courses, subjects for CBCS 2021 scheme) lives in `lib/vtuData.ts`.
