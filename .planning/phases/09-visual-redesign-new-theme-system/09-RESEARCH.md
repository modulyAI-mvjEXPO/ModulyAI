# Phase 9 Research: Visual Redesign — New Theme System

**Date:** 2026-03-17

## Source Material

`E:\Programming\PROJECT EXPO\ModulyAI\new-theme\prompt.txt` — defines:
- `:root` CSS variables (light mode)
- `.dark` CSS variables (dark mode) — **must convert to `[data-theme="dark"]`**
- `@theme inline` block — Tailwind v4 directive, **skip entirely**
- `WavyBackground` React component (canvas-based animated waves)
- `simplex-noise` npm dependency

---

## New Design System

### Palette (Light Mode)
| Variable | Value | Purpose |
|---|---|---|
| `--primary` | `#ff3333` | Brand red — main CTAs, headings |
| `--secondary` | `#ffff00` | Brand yellow — accents, highlights |
| `--accent` | `#0066ff` | Brand blue — links, interactive |
| `--background` | `#ffffff` | Page background |
| `--foreground` | `#000000` | Primary text |
| `--muted` | `#f0f0f0` | Subtle backgrounds |
| `--muted-foreground` | `#333333` | Secondary text |
| `--border` | `#000000` | All borders |
| `--card` | `#ffffff` | Card background |
| `--card-foreground` | `#000000` | Card text |
| `--radius` | `0px` | No border radius anywhere |

### Palette (Dark Mode)
| Variable | Value |
|---|---|
| `--primary` | `#ff6666` |
| `--secondary` | `#ffff33` |
| `--accent` | `#3399ff` |
| `--background` | `#000000` |
| `--foreground` | `#ffffff` |
| `--border` | `#ffffff` |
| `--card` | `#333333` |
| `--muted` | `#333333` |
| `--muted-foreground` | `#cccccc` |

### Shadow System (Flat/Brutalist)
- Hard box shadow: `4px 4px 0px var(--foreground)` (or `4px 4px 0px #000` in light mode)
- No blur, no spread
- Dark mode: `4px 4px 0px var(--foreground)` = `4px 4px 0px #fff`
- Hover: typically offset shifts to `2px 2px` or removed to simulate "pressed" effect

### Typography
- `--font-sans: 'DM Sans', sans-serif` → body text
- `--font-mono: 'Space Mono', monospace` → code, labels, mono elements
- Fonts loaded via Google Fonts in `index.html`
- Remove Inter import

---

## Current Codebase — Variable Mapping

### Variable Name Translation
| Old (current) | New (brutalist) |
|---|---|
| `--color-primary` | → bridge alias for `--primary` |
| `--color-secondary` | → bridge alias for `--secondary` |
| `--color-accent` | → bridge alias for `--accent` |
| `--color-background` | → bridge alias for `--background` |
| `--color-surface` | → bridge alias for `--card` |
| `--color-surface-elevated` | → bridge alias for `--muted` |
| `--color-text-primary` | → bridge alias for `--foreground` |
| `--color-text-secondary` | → bridge alias for `--muted-foreground` |
| `--color-text-tertiary` | → bridge alias for `--muted-foreground` (lighter) |
| `--color-border` | → bridge alias for `--border` |
| `--color-border-subtle` | → bridge alias for `--muted` |
| `--shadow-sm/md/lg/xl/card` | → flat hard shadows |
| `--font-family` | → `var(--font-sans)` |
| `--border-radius-*` | → `0px` |

**Strategy:** Add new variables + bridge aliases so per-page CSS keeps working without a full find-replace.

---

## Dark Mode Selector Fix

`prompt.txt` uses `.dark {}` — **project uses `[data-theme="dark"]`**.  
`ThemeContext.tsx` sets `document.documentElement.setAttribute('data-theme', 'dark')`.  
All dark mode overrides must use `[data-theme="dark"]`, not `.dark`.

---

## WavyBackground Adaptation Notes

### Removals from original source
1. Remove `"use client";` — Next.js only, not needed in Vite/React
2. Remove `import { cn } from "@/lib/utils"` — no such utility
3. Replace all `cn(...)` calls with plain string concatenation or template literals

### cn() usage in component
```tsx
// Original
className={cn("h-screen flex flex-col items-center justify-center", containerClassName)}
className={cn("relative z-10", className)}

// Replacement (no Tailwind, use inline styles + custom classes)
className={["wavy-bg-container", containerClassName].filter(Boolean).join(' ')}
className={["wavy-bg-content", className].filter(Boolean).join(' ')}
```

### Tailwind class → CSS class strategy
All Tailwind classes must be converted to custom CSS or inline styles:
- `h-screen flex flex-col items-center justify-center` → CSS class `wavy-bg-container`
- `absolute inset-0 z-0` → inline styles or CSS class `wavy-bg-canvas`
- `relative z-10` → CSS class `wavy-bg-content`

### TypeScript fixes needed
- `ctx: any`, `canvas: any` → acceptable for canvas operations (keep as-is with a comment)
- `children?: any` → change to `children?: React.ReactNode`
- `[key: string]: any` in props type → remove spread props or accept as `Record<string, unknown>`
- `animationId` declared outside `useEffect` → must be inside or useRef for proper cleanup

### Hero integration
- `WavyBackground` wraps the entire `<section className="hero">` content
- Wave colors: use theme-aware colors (primary/accent) set via props
- `backgroundFill`: use `var(--background)` equivalent (#ffffff light / #000000 dark)
- The hero's existing z-index layering (hero-bg = z:0, hero-container = z:1) is compatible

---

## CSS File Inventory (24 files)

### Global (rewrite :root block)
1. `src/index.css` — 360 lines, full design system — **PRIMARY TARGET**
2. `src/App.css` — minimal app-level

### Landing Sections
3. `src/sections/Hero.css` — 280 lines, gradient bg, glassmorphism card
4. `src/sections/Header.css` — 128 lines, blur backdrop
5. `src/sections/Footer.css`
6. `src/sections/Features.css`
7. `src/sections/HowItWorks.css`
8. `src/sections/Modes.css`
9. `src/sections/Solution.css`
10. `src/sections/Problem.css`
11. `src/sections/TechStack.css`
12. `src/sections/Scope.css`
13. `src/sections/Comparison.css`
14. `src/sections/CTA.css`

### App Pages
15. `src/pages/StudyMode.css`
16. `src/pages/ExamMode.css`
17. `src/pages/Library.css`
18. `src/pages/Dashboard.css`
19. `src/pages/UploadDocs.css`
20. `src/pages/Onboarding.css`
21. `src/pages/Settings.css`

### Components
22. `src/components/AuthModal.css` — 886 lines, deep glassmorphism — **MAJOR REWRITE**
23. `src/components/AppNav/AppNav.css`
24. `src/components/ThemeToggle.css`

---

## package.json State
- `simplex-noise` NOT present → must `npm install simplex-noise` before build
- All other dependencies present (React 18, TypeScript, Vite)

---

## Key Constraints Reminder
- No `"use client"` directive
- No `cn()` utility (no `src/lib/utils.ts`)
- No Tailwind CSS
- No shadcn/ui
- Dark mode selector: `[data-theme="dark"]` not `.dark`
- `verbatimModuleSyntax` → `import type` for type-only imports
- `dangerouslySetInnerHTML` rendering pattern unchanged
