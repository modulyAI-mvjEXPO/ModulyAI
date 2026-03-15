# Moduly AI

## What This Is

An AI-powered study platform built exclusively for VTU (Visvesvaraya Technological University) engineering students in India. Students select their college, course, branch, semester, and subject — then use AI-driven Study Mode (chat with RAG) and Exam Mode (PYQ solver) to learn and prepare for exams. A community library lets students share and access notes, question papers, lab manuals, and textbooks.

## Core Value

VTU students can get AI-generated, syllabus-aware answers to their subject questions and previous year exam papers — using their own uploaded documents and community-shared resources as context.

## Requirements

### Validated

- ✓ Landing page with 12 sections — existing
- ✓ Auth (email + OTP) via Supabase — existing
- ✓ Onboarding flow with VTU academic data (31 colleges, 16 courses, 6 branches across CSE/AIML/ECE/EEE/ME/ISE/Civil, 8 semesters) — existing
- ✓ Document upload to Utho S3 via Netlify Functions — existing
- ✓ Dashboard UI prototype — existing
- ✓ Settings page UI prototype — existing
- ✓ Library page UI prototype — existing
- ✓ Upload page UI prototype — existing
- ✓ Study Mode UI prototype (mocked AI responses) — existing
- ✓ Exam Mode UI prototype (mocked AI responses) — existing
- ✓ State-driven navigation system (no React Router) — existing
- ✓ CSS design system with custom properties — existing

### Active

- [ ] Study Mode — AI chat per subject using VTU syllabus context; students can browse modules or chat freely about any topic within their subject
- [ ] Study Mode RAG — AI references documents the user selects from the community library (vector DB + embeddings pipeline)
- [ ] Exam Mode — PYQ solver with two modes: question-by-question answers and full model answer paper generation
- [ ] Library — community document browsing; all uploaded documents visible to all users (notes, question papers, lab manuals, textbooks, video links)
- [ ] Library management — document listing with option to request removal (admin approval via Supabase console)
- [ ] LLM integration — direct API calls via Netlify Functions to free/cheap providers (OpenRouter free models, NVIDIA)
- [ ] RAG pipeline — vector database and embedding approach (completely unplanned, needs research and implementation)
- [ ] UI polish — existing prototype pages need visual refinement before backend integration
- [ ] PYQ bank — pre-loaded previous year question papers (images/PDFs already partially in Utho storage) accessible through Exam Mode

### Out of Scope

- Admin dashboard UI — using Supabase console directly for expo; admin dashboard planned post-expo
- Monetization / ads / payment integration — free for expo; freemium with ads planned for later
- Advanced moderation system — uploads are open for now; moderation planned post-expo
- Mobile app — web-only SPA for now
- Internet search in Study Mode — AI uses general knowledge + VTU syllabus + selected documents only; web search deferred

## Context

- **Existing codebase**: React 19 + TypeScript 5.9 + Vite 7 SPA in `moduly-ai-landing/` subdirectory
- **Deployment**: Netlify (frontend + serverless functions)
- **Auth & DB**: Supabase (email + OTP auth, profiles table)
- **Storage**: Utho R3 object storage (S3-compatible) for document uploads, connected via Netlify Functions
- **VTU data**: Hardcoded in `lib/vtuData.ts` — 31 colleges, 16 courses, subjects for 6 branches across 8 semesters
- **AI status**: Study Mode and Exam Mode exist as UI prototypes with hardcoded mock responses — no LLM connected
- **No test framework**: No testing infrastructure configured
- **No React Router**: Navigation handled via application state
- **Styling**: Vanilla CSS with CSS custom properties design system (no Tailwind, no CSS-in-JS)

## Constraints

- **Timeline**: ~2 weeks to Project Expo demo — judged competition requiring polished, working product
- **Budget**: Near-zero LLM costs — using free/cheap model providers (OpenRouter free tier, NVIDIA)
- **Tech stack**: React 19, TypeScript, Vite, Supabase, Netlify Functions, Utho S3 — all locked in
- **RAG complexity**: Vector DB/embedding approach completely unplanned — highest technical risk
- **LLM reliability**: Free model providers may have quality/rate-limit issues during live demo
- **Scope**: All 4 features (Study, Exam, Library, Upload-in-Library) must work for demo day

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Free/cheap LLM providers first (OpenRouter, NVIDIA) | Near-zero budget; upgrade models as userbase grows | — Pending |
| RAG with community library documents | Students want AI answers grounded in their actual study materials | — Pending |
| Supabase console as admin tool (no admin UI) | 2-week deadline; admin dashboard planned post-expo | — Pending |
| Open uploads, no moderation for expo | Simplify scope for deadline; moderation planned post-expo | — Pending |
| Upload integrated into Library (not separate mode) | Upload is a feature of the library, not a standalone mode | — Pending |
| Direct API calls from Netlify Functions | Simplest integration path; no middleware layer needed | — Pending |
| PYQ solver supports both question-by-question and full paper | Students need flexibility in how they study PYQs | — Pending |

---
*Last updated: 2026-03-15 after initialization*
