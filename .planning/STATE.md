# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** VTU students get AI-generated, syllabus-aware answers grounded in their own uploaded documents and community-shared resources
**Current focus:** Phase 4+ (next — AI Foundation + Document Processing + Study Mode Core complete)

## Current Position

Phase: 9 — COMPLETE
Plan: 09-01 (Visual Redesign: New Theme System) complete
Status: All 9 phases complete. Project ready for demo.
Last activity: 2026-03-17 — Phase 9 CSS rewrite complete (26 files, brutalist design system)

Progress: [██████████] 100% (9 of 9 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~20 minutes
- Total execution time: ~245 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 — AI Foundation | 2 | ~50 min | ~25 min |
| 02 — Document Processing | 3 | ~90 min | ~30 min |
| 03 — Study Mode Core | 2 | ~30 min | ~15 min |
| 04 — Study Enhancement | 2/2 | ~30 min | ~15 min |
| 05 — Exam Mode | 2/2 | ~45 min | ~22 min |
  | 06 — PYQ Intelligence | 1/1 | ~30 min | ~30 min |
  | 07 — Community Library | 1/1 | ~30 min | ~30 min |

**Recent Trend:**
  - Last 10 plans: ..., 04-01 (~15 min), 04-02 (~15 min), 05-01 (~20 min), 05-02 (~25 min), 06-01 (~30 min), 07-01 (~30 min)
  - Trend: Steady ~15–30 min/plan

*Updated after each plan completion*

## Phase 1 Deliverables

### Files Created
- `moduly-ai-landing/vitest.config.ts` — test runner config
- `moduly-ai-landing/src/lib/ai/types.ts` — 8 AI type exports
- `moduly-ai-landing/src/lib/ai/supabase-server.ts` — server-side Supabase client
- `moduly-ai-landing/src/lib/ai/embedding.ts` — embedding client (NVIDIA NIM + fallback)
- `moduly-ai-landing/src/lib/ai/embedding.test.ts` — 7 embedding tests
- `moduly-ai-landing/src/lib/ai/llm.ts` — LLM client (OpenRouter + NVIDIA NIM, streaming)
- `moduly-ai-landing/src/lib/ai/llm.test.ts` — 8 LLM tests
- `moduly-ai-landing/supabase/migrations/001-004` — 4 SQL migration files

### Live Supabase State
- pgvector v0.8.0 enabled
- `documents` table with RLS (3 policies)
- `document_chunks` table with vector(1024), HNSW index, RLS (3 policies)
- `match_documents` RPC (cosine similarity search)

### Test Coverage
- 15 tests, all passing
- TypeScript strict compilation clean

## Phase 2 Deliverables

### Files Created/Modified
- `moduly-ai-landing/supabase/migrations/005_add_document_status.sql` — status column, chunk_count, file_size, updated_at
- `moduly-ai-landing/supabase/migrations/006_match_documents_filtered.sql` — filtered vector search RPC
- `moduly-ai-landing/src/lib/ai/types.ts` — Added DocumentStatus, TextChunk, PdfExtractionResult, DocumentRow
- `moduly-ai-landing/src/lib/ai/chunker.ts` — sentence-aware text chunking (500 chars, 50 overlap)
- `moduly-ai-landing/src/lib/ai/chunker.test.ts` — 10 chunker tests
- `moduly-ai-landing/src/lib/ai/pdf-extract.ts` — PDF text extraction (pdf-parse v2)
- `moduly-ai-landing/src/lib/ai/pdf-extract.test.ts` — 9 PDF extraction tests
- `moduly-ai-landing/netlify/functions/process-document.mts` — sync processing trigger (202 Accepted)
- `moduly-ai-landing/netlify/functions/process-document-background.mts` — background PDF→vectors pipeline
- `moduly-ai-landing/tsconfig.functions.json` — TypeScript config for Netlify functions
- `moduly-ai-landing/netlify.toml` — Added process-document redirects
- `moduly-ai-landing/src/components/FileUpload.tsx` — userId prop, process-document call, drag-drop UI
- `moduly-ai-landing/src/pages/UploadDocs.tsx` — Supabase-driven document list with status polling
- `moduly-ai-landing/src/pages/UploadDocs.css` — Badge styles, spinner, dropzone-active, messages

### Supabase State (requires manual migration)
- Migration 005: `status`, `chunk_count`, `file_size`, `updated_at` columns on documents
- Migration 006: `match_documents_filtered` RPC with document/subject filtering

### Test Coverage
- 34 tests total, all passing (15 + 10 chunker + 9 pdf-extract)
- TypeScript strict compilation clean across all 3 tsconfigs

### Processing Pipeline Architecture
```
Upload → POST /process-document (sync, 10s) → insert doc row → fire-and-forget
         → process-document-background (async, 15min) → download → extract → chunk → embed → store
```

## Phase 3 Deliverables

### Files Created/Modified
- `moduly-ai-landing/src/lib/ai/types.ts` — Added ChatRequest, ChatResponse, RagChunk types
- `moduly-ai-landing/netlify/functions/chat.mts` — **CREATED** (141 lines, full RAG chat function)
- `moduly-ai-landing/netlify.toml` — Added /chat redirect (now 5 redirects total)
- `moduly-ai-landing/src/pages/StudyMode.tsx` — **REWRITTEN** (~539 lines; Supabase doc loading, /chat API, progressive reveal)
- `moduly-ai-landing/src/pages/StudyMode.css` — **MODIFIED** (added .sm-cursor, @keyframes sm-blink, .sm-docs-loading, .sm-docs-empty)

### Key Architecture

**Chat endpoint (03-01):**
```
POST /chat → chat.mts
  → getEmbedding(message) → match_documents_filtered RPC
  → buildSystemPrompt(chunks, mark, strict)
  → chatCompletion({ stream: false }) → { response, sources }
```

**Frontend integration (03-02):**
```
StudyMode.tsx:
  → useEffect: fetch 'ready' docs from Supabase → mapDocRow → sidebar
  → sendMessage: chatWithAI() → POST /chat with documentIds, mark, strict, history
  → Progressive reveal: revealingId + revealedLen + setTimeout (3 chars/12ms)
  → Error handling: show error as AI message in chat
```

**Key decisions:**
- No real SSE streaming (Netlify Functions = buffered). Client-side progressive reveal instead.
- `stream: false` on LLM call. True SSE deferred to Phase 8 (Edge Functions).
- STUDY-02 ("user sees text appearing progressively") satisfied via typing animation.

### Test Coverage
- 34 tests total, all passing (no new tests in Phase 3 — frontend integration)
- TypeScript strict compilation clean across all 3 tsconfigs

### Requirements Satisfied
- ✅ STUDY-01: User can ask questions and get AI-grounded answers from their documents
- ✅ STUDY-02: User sees text appearing progressively (client-side animation)

## Phase 4 Deliverables (Complete)

### Plan 04-01 — Mark Calibration + Study Kit Polish (COMPLETE)

**Files Modified:**
- `netlify/functions/chat.mts` — Added `MARK_INSTRUCTIONS` map (2M/5M/8M/10M), updated `buildSystemPrompt`
- `src/pages/StudyMode.tsx` — `useNavigate` import, `5M` added to MARKS, `+ Add` navigates to `/upload-docs`, All/None doc toggles, zero-docs warning chip
- `src/pages/StudyMode.css` — `sm-chip--warn`, `sm-section-actions`, `sm-text-btn` styles

**Requirements:**
- ✅ STUDY-04: Per-mark answer calibration (2M/5M/8M/10M)
- ✅ STUDY-03 (partial): Doc selection UX (+ Add navigates, All/None toggles, zero-docs warning)

### Plan 04-02 — VTU Curriculum Awareness (COMPLETE)

STUDY-05 implementation:
- `SubjectProfile` type + `SUBJECT_PROFILES` constant in `chat.mts` for DSA / Computer Networks / DBMS
- `buildSystemPrompt` extended with `subjectId` → VTU curriculum injection (modules, exam pattern, high-frequency topics)
- Subject selector `<select>` in `StudyMode.tsx` sidebar (between Source Docs and Active Topics)
- `getTopicsForSubject(subjectId)` replaces static `INITIAL_TOPICS`, with `useEffect` to reset on subject change
- `subjectId` passed through `chatWithAI` → POST `/chat` → `buildSystemPrompt`
- `sm-subject-select` CSS class added (dark/light mode, custom chevron)

**Requirements:**
- ✅ STUDY-05: VTU curriculum awareness for 3 demo subjects (DSA, CN, DBMS)

## Phase 5 Deliverables (In Progress)

### Plan 05-01 — Exam Mode PYQ Single Question Solve (COMPLETE)

**Files Modified:**
- `src/lib/ai/types.ts` — Added `ExamRequest` and `ExamResponse` types
- `netlify/functions/exam-solve.mts` — **CREATED** (~165 lines, single-shot exam answer function)
- `netlify.toml` — Added `/exam-solve` redirect (now 6 redirects)
- `src/pages/ExamMode.tsx` — **REWRITTEN** (~270 lines; mock removed, real AI wired)

**Requirements:**
- ✅ EXAM-01: PYQ single question solve with mark-calibrated exam-ready answers

### Plan 05-02 — Full Paper Mode (Batch Solve) (COMPLETE)

**Files Modified:**
- `src/pages/ExamMode.tsx` — Added `paperMode` state, `parseQuestions` helper, tab toggle, paper panel, and `solvePaper` batch logic.
- `src/pages/ExamMode.css` — Appended `.em-mode-tabs`, `.em-paper-panel`, `.em-answer-block`, etc., with light mode overrides.

**Requirements:**
- ✅ EXAM-02: User can paste an entire paper, which is parsed and solved sequentially, rendering a continuous answer sheet.

## Phase 6 Deliverables (Complete)

### Plan 06-01 — PYQ Intelligence: Topic Frequency Analysis (COMPLETE)

**Files Modified:**
- `src/lib/ai/types.ts` — Added `PyqIntelligenceRequest`, `PyqTopicPattern`, `PyqModuleWeightage`, `PyqIntelligenceResponse`
- `netlify/functions/pyq-intelligence.mts` — **CREATED** (250 lines, keyword-rule PYQ analysis function)
- `netlify.toml` — Added `/pyq-intelligence` redirect (now 7 redirects)
- `src/pages/ExamMode.tsx` — Added `fetchPyqIntelligence()`, analysis state + `useEffect`, dynamic cards/bars with fallback

**Requirements:**
- ✅ EXAM-04: Topic frequency analysis from uploaded PYQ docs, shown as ranked cards + module weightage bars in ExamMode

## Phase 7 Deliverables (Complete)

### Plan 07-01 — Community Library: Real Supabase Data + Removal Requests (COMPLETE)

**Files Created:**
- `supabase/migrations/007_community_library.sql` — Public-read RLS for `status='ready'` docs + `removal_requests` table

**Files Modified:**
- `src/pages/Library.tsx` — **Rewritten** (real Supabase queries, `user: User` prop, keyword-based subject/module/type inference, loading/error/empty states, removal request insert, pagination)
- `src/pages/Library.css` — **Appended** `lib-remove-btn` styles (red tone, hover, disabled, dark mode)
- `src/pages/Dashboard.tsx` — `<Library />` → `<Library user={user} />`

**Requirements:**
- ✅ LIB-01: Library displays real documents from Supabase
- ✅ LIB-02: User can filter by subject, module, and document type
- ✅ LIB-03: User can request removal of their own uploaded documents

**Pending (manual):**
- Migration 007 must be applied via Supabase Dashboard before public-read / removal_requests work end-to-end

---

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8 phases derived from 26 requirements following RAG dependency chain
- [Roadmap]: Phases 5, 6, 7 are independent and can be parallelized after Phase 3
- [Roadmap]: Fine granularity — Study Mode split into Core (Phase 3) + Enhancement (Phase 4)
- [Phase 1]: NVIDIA NIM as primary embedding provider (1024-dim, nv-embedqa-e5-v5)
- [Phase 1]: OpenRouter as primary LLM provider (free tier models)
- [Phase 1]: Vitest for testing (globals mode, node environment)
- [Phase 2]: pdf-parse v2 API (class-based, not v1 function-based)
- [Phase 2]: Sync + background function pattern for document processing
- [Phase 2]: Supabase-driven document list (removed S3 list-files dependency)
- [Phase 2]: Status polling via useRef<setInterval> (3s interval, auto-stop)
- [Phase 3]: No real SSE streaming — Netlify Functions (AWS Lambda) buffer responses
- [Phase 3]: Client-side progressive reveal (~250 chars/sec) satisfies STUDY-02
- [Phase 3]: stream: false on LLM, true SSE deferred to Phase 8 (Edge Functions)
- [Phase 3]: google/gemini-2.0-flash-exp:free as default model, temperature 0.7, max_tokens 2048

  - [Phase 4-01]: MARK_INSTRUCTIONS map for per-mark calibration (2M/5M/8M/10M)
  - [Phase 4-01]: `useNavigate` used for + Add button (not `window.location`)
  - [Phase 4-01]: All/None doc toggles use immutable map over setDocs
  - [Phase 4-02]: SUBJECT_PROFILES inline in chat.mts (not separate file — small enough)
  - [Phase 4-02]: curriculumSection injected between markInstruction and strictInstruction in system prompt
  - [Phase 4-02]: getTopicsForSubject uses if-chains (not map) for readability
  - [Phase 5-01]: exam-solve.mts is single-shot (no history) — each question independent
  - [Phase 5-01]: MARK_INSTRUCTIONS for exam uses 2M/5M/10M/15M (differs from chat: 2M/5M/8M/10M)
  - [Phase 5-01]: max_tokens: 3000 for exam answers (vs 2048 in chat.mts)
  - [Phase 5-01]: No progressive reveal in ExamMode (answers appear all at once)
  - [Phase 5-01]: renderMarkdown() inline regex (no library) — adequate for exam answer formatting
  - [Phase 5-01]: void sendMessage() in JSX event handlers for async useCallback pattern

  - [Phase 7-01]: No `document_type` column — type inferred client-side from title keywords (avoids changing upload flow)
  - [Phase 7-01]: Subject/module also inferred from title keywords (no FK tables exist)
  - [Phase 7-01]: `removal_requests` table (not soft-delete) — admin reviews via Supabase dashboard
  - [Phase 7-01]: Phase delivered as 1 plan (rewrite + migration + CSS tightly coupled)
  - [Phase 5-02]: `solvePaper` executes sequentially to avoid free-tier LLM rate limits
  - [Phase 5-02]: Batch mode uses a global mark setting for all questions as a demo simplification

  - [Phase 6-01]: Keyword-rule engine chosen over AI-based analysis — fast, zero LLM cost, demo-safe
  - [Phase 6-01]: Fallback patterns/weightage returned when no PYQ docs found (demo never breaks)
  - [Phase 6-01]: maxDocuments=20 caps chunk queries at 2400 rows max
  - [Phase 6-01]: Top 6 patterns, top 4 module weightage entries returned (matches UI slots)
  - [Phase 6-01]: `hits` computed internally but stripped before API response

  - [Phase 8-01]: `sanitizeError()` helper strips raw API errors — returns generic message unless "quota" keyword detected
  - [Phase 8-01]: `DEMO_CACHE` map keyed by `question.trim().toLowerCase()` — exact match only (5 pre-scripted entries per function)
  - [Phase 8-01]: Cache fallback activated in inner try/catch — outer catch uses `sanitizeError()` for non-demo errors
  - [Phase 8-01]: `warm.mts` always returns 200 — frontend fires fire-and-forget, doesn't need to know if it failed
  - [Phase 8-01]: `void fetch('/warm', { method: 'POST' })` in Dashboard useEffect — satisfies no-floating-promises in strict TS
  - [Phase 8-01]: DEMO_CACHE lives in function files (not llm.ts) — demo/domain-specific, not a shared utility

### Pending Todos

- Apply SQL migrations 005, 006, 007 via Supabase Dashboard (if not already done)

### Blockers/Concerns

- [Timeline]: ~2 weeks to Project Expo — strict deadline, no flexibility
- [Risk]: Free LLM providers may be unreliable during live demo — mitigated by DEMO-01/DEMO-04
- [Pending]: SQL migrations 005 + 006 must be applied before document processing will work end-to-end

## Session Continuity

Last session: 2026-03-17
Stopped at: Phase 9 complete — all CSS files rewritten to brutalist design system
Project status: **All 9 phases complete. Project ready for demo.**

## Roadmap Evolution

- 2026-03-17: Phase 9 COMPLETE (Visual Redesign: New Theme System)
  - CSS vars: --primary #ff3333, --secondary #ffff00, --accent #0066ff, --radius 0px, hard box shadows
  - Fonts: DM Sans (sans) + Space Mono (mono) via Google Fonts
  - WavyBackground: canvas-based animated waves (simplex-noise) in Hero section
  - All 26 CSS files rewritten to brutalist design system
  - TypeScript checks passed: npx tsc --noEmit ✅, npx tsc -p tsconfig.functions.json --noEmit ✅
