# Project Research Summary

**Project:** Moduly AI — AI-Powered Study Platform for VTU Engineering Students
**Domain:** EdTech / AI Study Platform (RAG-based)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

Moduly AI is a VTU-specific AI study platform with a functioning React 19 + Supabase SPA (auth, uploads, UI prototypes all working) that needs its AI backbone wired up in ~2 weeks for a judged Project Expo. The core technical challenge is building a RAG (Retrieve-Augment-Generate) pipeline on a near-zero LLM budget using free-tier providers — NVIDIA NIM for embeddings and OpenRouter for chat completions — with Supabase pgvector for vector storage. The existing codebase provides significant leverage: all page UIs are prototyped, auth works, file uploads work, and VTU academic data is hardcoded. What's missing is entirely backend AI integration.

The recommended approach is **vertical slices over horizontal layers**: build Study Mode end-to-end first (even with basic RAG), then Exam Mode, then polish — rather than perfecting the RAG pipeline in isolation. The stack additions are minimal: `pdf-parse` for PDF extraction, NVIDIA NIM API for embeddings, OpenRouter API for LLM completions, and Supabase pgvector (already available as an extension). No new infrastructure services are needed — everything runs through existing Supabase + Netlify Functions. A custom text chunker (~50 lines) replaces the heavyweight LangChain dependency.

The critical risks are: (1) **free LLM provider unreliability during live demo** — mitigated by a multi-provider fallback chain with cached demo responses as the ultimate safety net, (2) **RAG retrieval quality** — mitigated by metadata filtering, proper chunk sizing, and testing with real VTU content, and (3) **scope creep killing the 2-week deadline** — mitigated by strict feature prioritization where PYQ frequency analysis, Study Kit context control, and curriculum awareness are all "if time permits" features, not blockers. The project's competitive moat is VTU-specific curriculum awareness and PYQ intelligence, not general AI quality.

## Key Findings

### Recommended Stack

The existing stack (React 19, TypeScript 5.9, Vite 7, Supabase, Netlify Functions, Utho S3) is locked and sufficient. Only AI/LLM additions are needed, and they're deliberately minimal — two API integrations and one npm package. See [STACK.md](./STACK.md) for full details.

**Core technologies:**
- **Supabase pgvector** (built-in extension): Vector storage and similarity search — zero new infrastructure, uses existing Supabase instance with `match_documents` RPC function and HNSW indexing
- **NVIDIA NV-EmbedQA E5 v5** (1024 dims): QA-optimized embeddings via free-tier API — specifically finetuned for question-answering retrieval, directly matches the study/exam use case
- **OpenRouter** (OpenAI-compatible API): LLM chat completions with free models — SSE streaming, multi-model fallback, single API for multiple providers
- **pdf-parse v2.4.5**: PDF text extraction — pure TypeScript, serverless-compatible, works in Netlify Functions
- **Custom text chunker** (~50 lines): Recursive character splitter (500 chars, 50 overlap) — replaces LangChain.js entirely, zero external dependency

**Explicitly rejected:** LangChain.js (massive dependency for trivial utility), Pinecone/Weaviate (unnecessary external vector DB), OpenAI APIs (not free), Vercel AI SDK (wrong deployment target), Ollama (no GPU in serverless).

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis including competitor comparison and dependency graph.

**Must have (P0 — no demo without these):**
- **RAG Pipeline (basic)** — The single most important deliverable. PDF extraction → chunking → embeddings → vector search. Everything else depends on this.
- **Study Mode AI Chat** — Replace hardcoded responses with real LLM calls grounded via RAG. UI already exists.

**Must have (P1 — transforms prototype into product):**
- **Exam Mode AI Chat** — LLM-generated PYQ answers with mark-based formatting. Shares RAG pipeline with Study Mode.
- **Community Library (real data)** — Replace mock data with Supabase queries. Filtering by subject/module/type.
- **Mark-Based Answer Formatting** — Prompt engineering only (no new code), calibrates answer depth per VTU mark allocation.
- **Structured Exam Answers** — VTU exam-formatted output. Also prompt engineering.

**Should have (P2 — if time permits):**
- **PYQ Frequency Analysis** — High demo impact, independent of RAG pipeline. Parse past papers, generate topic frequency charts.
- **Study Kit Context Control** — UI exists, needs RAG filter integration.
- **VTU Curriculum Awareness** — Enrich system prompts with syllabus details for 2-3 demo subjects.

**Defer (post-expo):**
- Real-time collaboration, flashcard generation, video content, offline support, mind maps, gamification, multi-language, plagiarism detection

### Architecture Approach

The architecture is a standard RAG pipeline layered onto the existing SPA + serverless stack. The React SPA communicates with Netlify Functions via HTTP/SSE, which in turn call external AI services (OpenRouter for LLM, NVIDIA NIM for embeddings) and Supabase (pgvector for retrieval, Postgres for metadata). Document processing is async via Netlify Background Functions (15-min timeout), while chat is streaming via SSE. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full data flows and schema.

**Major components:**
1. **Chat Function** (`chat.ts`) — RAG retrieval + LLM prompt construction + SSE streaming for Study Mode
2. **PYQ Solve Function** (`pyq-solve.ts`) — Exam Mode-specific prompting with mark-based formatting
3. **Doc Process Background Function** (`process-document-background.ts`) — PDF parsing → chunking → embedding → pgvector storage (async)
4. **Library Function** (`library.ts`) — Document listing with subject/type filtering from Supabase
5. **AI Utilities** (`lib/ai/`) — Shared code: LLM client, embedding client, chunker, RAG retriever, prompt templates

**Key architectural decisions:**
- Process documents at upload time (not query time) — embeddings are pre-computed
- Separate Netlify Functions per feature (not one monolithic API)
- SSE streaming keeps connections alive past serverless timeout
- Shared RAG pipeline between Study Mode and Exam Mode (different prompts, same retrieval)

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for full catalog including integration gotchas, performance traps, and security checklist.

1. **Free LLM provider fails during live demo** — Build multi-provider fallback chain (OpenRouter → NVIDIA NIM → cached demo responses) from day one. Pre-cache exact demo flow responses. Warm up APIs 30 min before demo.
2. **RAG returns irrelevant chunks** — Always filter by metadata (subject, selected docs) before vector search. Set similarity threshold ≥0.7. Test with real VTU content, not lorem ipsum.
3. **Netlify Function timeouts on RAG+LLM chain** — Use SSE streaming (connection stays alive as data flows). Pre-warm functions. Full chain is ~10s without streaming — right at the timeout edge.
4. **Document processing fails silently** — Track status (`processing`/`ready`/`failed`/`no_text`) in documents table. Detect scanned PDFs (empty text extraction) and communicate clearly to user.
5. **Scope creep kills the 2-week deadline** — Build vertical slices. Daily demo check: "Can I demo what I have today?" Cut features ruthlessly if behind by day 10. Pre-decide cut order: PYQ analysis → RAG (fall back to general AI) → Exam Mode entirely.
6. **Prompt engineering neglected** — Write VTU-specific system prompts as the first LLM task, not the last. Include subject name, modules, exam pattern, mark allocation in prompts. Budget 2-3 hours per mode for iteration.

## Implications for Roadmap

Based on research, suggested phase structure follows the dependency chain from ARCHITECTURE.md with scope-creep guardrails from PITFALLS.md:

### Phase 1: Database Schema + AI Utilities Foundation
**Rationale:** Everything depends on the Supabase schema (documents + document_chunks tables) and the core AI utility functions (embedding client, chunker, RAG retriever). These have zero external dependencies and can be built and tested in isolation. Architecture research shows this is the foundation for Phases 2-5.
**Delivers:** Supabase migrations (pgvector extension, tables, HNSW index, `match_documents` RPC, RLS policies), NVIDIA embedding client, custom text chunker, LLM client with OpenRouter + NVIDIA NIM fallback.
**Addresses features:** None directly visible to user — pure infrastructure.
**Avoids pitfalls:** Sets up status tracking in documents table from the start (prevents silent processing failures). Establishes fallback chain pattern early (prevents demo-day LLM failures).

### Phase 2: Document Processing Pipeline
**Rationale:** Must be able to process documents into embeddings before RAG retrieval works. Depends on Phase 1 schema and utilities. Uses Netlify Background Function for async processing.
**Delivers:** PDF text extraction (pdf-parse), document processing background function, upload handler extension to trigger processing, processing status polling on frontend.
**Addresses features:** Extends existing Document Upload with AI processing capability.
**Avoids pitfalls:** Handles scanned PDFs gracefully (detect + communicate). Batch embeds chunks in single API call (avoids rate limits). Uses background function (avoids 10s timeout).

### Phase 3: Study Mode End-to-End
**Rationale:** Study Mode AI Chat is the P0 feature and the core demo moment. Depends on Phase 1 (RAG retrieval) and Phase 2 (processed documents to retrieve from). This is the first vertical slice — judges see a working AI study assistant.
**Delivers:** Chat Netlify Function with SSE streaming, `useChat` React hook, Study Mode wired to real LLM with RAG context, VTU-specific system prompts with mark-based formatting.
**Addresses features:** Study Mode AI Chat (P0), Mark-Based Answer Formatting (P1), partial VTU Curriculum Awareness.
**Avoids pitfalls:** SSE streaming avoids function timeouts. System prompts written early with VTU context (not generic "helpful assistant"). Fallback to cached responses if LLM fails.

### Phase 4: Exam Mode + Library
**Rationale:** Exam Mode shares the RAG pipeline from Phase 3 — only needs different system prompts and response formatting. Library needs real Supabase queries (schema exists from Phase 1). These are both P1 features that complete the "product" feel. Can be built in parallel if needed.
**Delivers:** PYQ Solve Netlify Function, Exam Mode wired to real LLM with structured answer formatting, Library browse with real data and subject/type filtering, document selection for RAG context.
**Addresses features:** Exam Mode AI Chat (P1), Structured Exam Answers (P1), Community Library real data (P1).
**Avoids pitfalls:** Curate text-based demo PYQs (avoids image-based PYQ failure). Add "paste question" fallback for scanned papers.

### Phase 5: Enhancement Features (if time permits)
**Rationale:** These are P2 features that add differentiation for judges but aren't required for a working demo. Only attempt if Phases 1-4 are solid by day 10.
**Delivers:** PYQ Frequency Analysis (topic frequency charts from parsed papers), Study Kit Context Control (filter RAG by selected documents), VTU Curriculum Awareness (enriched system prompts for 2-3 demo subjects).
**Addresses features:** PYQ Frequency Analysis (P2), Study Kit Context Control (P2), VTU Curriculum Awareness (P2).
**Avoids pitfalls:** PYQ Frequency Analysis is independent of RAG — can work even if RAG has quality issues. Acts as fallback demo-wow-factor.

### Phase 6: Demo Polish + Hardening
**Rationale:** Last 2-3 days. No new features. Focus entirely on making what exists demo-worthy: error handling, loading states, empty states, mobile responsiveness, cached demo responses, rehearsed demo flow.
**Delivers:** Comprehensive error handling across all AI features, loading/typing indicators, demo-ready curated content, fallback responses, pre-warmed functions, rehearsed demo script.
**Addresses features:** Dashboard Stats real data (P3), general polish.
**Avoids pitfalls:** Addresses all UX pitfalls (no loading state, generic errors, blank states). Final security check (API keys not in frontend). Demo rehearsal catches issues before judges see them.

### Phase Ordering Rationale

- **Phase 1 before everything:** Schema and utilities are foundation dependencies — nothing else can be built or tested without them. Architecture research confirms this.
- **Phase 2 before Phase 3:** RAG retrieval needs documents to retrieve from. Processing pipeline must work before chat can be meaningful.
- **Phase 3 before Phase 4:** Study Mode is P0 (critical path). Exam Mode reuses Phase 3 infrastructure. If Phase 3 slips, Phase 4 still has a working template to follow.
- **Phase 4 is two independent features:** Library and Exam Mode don't depend on each other — can be parallelized or one can be cut if time is tight.
- **Phase 5 is entirely optional:** These are "add depth" features. The demo works without them. Include only if ahead of schedule.
- **Phase 6 is non-negotiable:** Demo polish is what separates "working prototype" from "impressive product" for judges. Reserve at minimum 2 days.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Document Processing):** Netlify Background Function naming conventions (`-background.ts` suffix), pdf-parse v2 API patterns (v2 rewrite changed everything), NVIDIA batch embedding limits. Test with actual VTU PDFs early.
- **Phase 3 (Study Mode):** SSE streaming through Netlify Functions — may have buffering issues. Needs hands-on testing. System prompt engineering for VTU content requires iteration with real questions.

Phases with standard patterns (skip deeper research):
- **Phase 1 (Foundation):** Supabase pgvector setup, embedding client, text chunker — all well-documented with official examples.
- **Phase 4 (Exam Mode + Library):** Reuses Phase 3 patterns. Library is standard Supabase CRUD.
- **Phase 6 (Polish):** Standard frontend hardening — no research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Verified via official docs (Supabase AI docs, NVIDIA NIM API, OpenRouter API, pdf-parse npm). All free tiers confirmed. Minimal new dependencies. |
| Features | **HIGH** | Full codebase analysis completed. Feature priorities based on existing UI state + dependency analysis + competitor research. Clear P0/P1/P2/P3 tiers. |
| Architecture | **HIGH** | Standard RAG pipeline on established infrastructure. Data flows follow well-documented patterns. Supabase pgvector + Netlify Functions architecture is battle-tested. |
| Pitfalls | **HIGH** | Pitfalls identified from official documentation (timeout behaviors, API limitations), domain knowledge (VTU scanned PYQs), and standard RAG failure modes. Recovery strategies documented. |

**Overall confidence:** HIGH — Research is grounded in official documentation and existing codebase analysis. The approach is standard (RAG pipeline) with well-documented tools. Risk is concentrated in free-tier reliability (mitigated by fallback chain) and time pressure (mitigated by strict prioritization).

### Gaps to Address

- **OpenRouter free model availability at demo time:** Free models change frequently. Cannot guarantee specific model will be available in 2 weeks. Mitigation: code against OpenAI-compatible API, swap model ID at demo time. Query `/api/v1/models` for current free options.
- **SSE streaming through Netlify Functions:** Documented as supported, but buffering behavior under load is unclear. Mitigation: test early in Phase 3. Fallback to non-streaming if problematic (shorter prompts, wait for full response).
- **Actual VTU PDF quality:** Many real VTU documents (especially PYQs) are scanned images. Cannot know the exact ratio of text-based vs scanned papers in the wild. Mitigation: curate demo document set with verified text-based PDFs. Add manual question input as fallback.
- **NVIDIA NIM rate limits under sustained use:** Free tier limits are documented but behavior under sustained batch processing (many uploads) is untested. Mitigation: pre-process all demo documents before expo. Rate limit is only a concern for live uploads during demo.

## Sources

### Primary (HIGH confidence)
- **Supabase AI & Vector docs** — pgvector setup, HNSW indexes, `match_documents` RPC, RLS policies, embedding dimension recommendations
- **NVIDIA NIM API docs** — `nv-embedqa-e5-v5` model card, embedding API endpoint, 1024-dim output, 512-token context, free tier confirmation
- **OpenRouter API docs** — SDK, OpenAI-compatible endpoints, SSE streaming patterns, free model discovery
- **pdf-parse npm (v2)** — Pure TypeScript rewrite, `getText()` API, serverless compatibility, Node 20+ requirement
- **Netlify Functions docs** — Timeout behavior (10s default, 26s max, 15-min background), SSE support, background function naming
- **Existing codebase** — Full analysis of StudyMode.tsx, ExamMode.tsx, Library.tsx, UploadDocs.tsx, Dashboard.tsx, vtuData.ts

### Secondary (MEDIUM confidence)
- **Competitor analysis** — Khanmigo, ChatPDF, Quizlet features (direct product analysis). NotebookLM (based on prior knowledge — fetch failed).
- **Community RAG patterns** — Chunking strategies, retrieval tuning, similarity threshold recommendations
- **VTU domain knowledge** — Exam patterns, mark allocation schemes, scanned vs text-based paper prevalence

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
