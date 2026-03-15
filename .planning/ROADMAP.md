# Roadmap: Moduly AI

## Overview

Transform the existing Moduly AI prototype (React 19 SPA with working auth, uploads, and UI mockups) into a demo-ready AI study platform for VTU students. The journey follows the RAG pipeline dependency chain: build the AI/vector foundation first, wire up document processing, then deliver Study Mode and Exam Mode as vertical slices, add the community library with real data, and harden everything for a live Project Expo demo. Every phase delivers observable capability — no horizontal "all models then all APIs" layers.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: AI Foundation** - Supabase pgvector schema, embedding client, LLM client with multi-provider fallback
- [ ] **Phase 2: Document Processing Pipeline** - PDF extraction, chunking, embedding, and status tracking from upload to searchable vectors
- [ ] **Phase 3: Study Mode Core** - AI chat with RAG-grounded answers and real-time streaming, replacing mock responses
- [ ] **Phase 4: Study Mode Enhancement** - Study Kit document selection, mark-based answer depth, and VTU curriculum awareness
- [ ] **Phase 5: Exam Mode** - PYQ solver with question-by-question and full paper modes, VTU-formatted answers
- [ ] **Phase 6: PYQ Intelligence** - Topic frequency analysis across past exam papers
- [ ] **Phase 7: Community Library** - Real document browsing with filtering and removal requests from Supabase
- [ ] **Phase 8: Demo Hardening** - Multi-provider fallback chain, cached responses, error handling, and pre-warming for live demo

## Phase Details

### Phase 1: AI Foundation
**Goal**: The database schema and AI utility layer exist so all downstream features can store/retrieve vectors and call LLMs
**Depends on**: Nothing (first phase)
**Requirements**: RAG-04, RAG-08
**Success Criteria** (what must be TRUE):
  1. Supabase has pgvector extension enabled with document_chunks table, HNSW index, and a `match_documents` RPC function that returns chunks by cosine similarity
  2. A Netlify Function can call NVIDIA NIM embedding API and receive a 1024-dimensional vector back
  3. If NVIDIA NIM embedding API is unavailable, the system automatically falls back to an alternative embedding provider and returns a valid vector
  4. A Netlify Function can call OpenRouter for LLM chat completions and receive a streamed response
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — pgvector schema, AI types, server Supabase client, Vitest setup
- [ ] 01-02-PLAN.md — Embedding client (NVIDIA NIM + fallback) and LLM client (OpenRouter + fallback) with tests

### Phase 2: Document Processing Pipeline
**Goal**: When a user uploads a PDF, it is automatically processed into searchable vector embeddings with visible status tracking
**Depends on**: Phase 1
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-05, RAG-06, RAG-07
**Success Criteria** (what must be TRUE):
  1. User uploads a text-based PDF and it appears as "processing" then transitions to "ready" in the UI
  2. The uploaded PDF's text is extracted, split into overlapping chunks, embedded as 1024-dim vectors, and stored in Supabase pgvector with subject/document metadata
  3. A scanned PDF with no extractable text shows status "no_text" with a clear user-facing message explaining why it can't be processed
  4. Vector search results can be filtered by metadata (subject, specific documents) before similarity ranking
**Plans**: TBD

Plans:
- [ ] 02-01: PDF extraction and text chunking pipeline
- [ ] 02-02: Background function for embedding and pgvector storage
- [ ] 02-03: Processing status tracking and frontend status display

### Phase 3: Study Mode Core
**Goal**: Users can chat with AI about any VTU subject and receive real, RAG-grounded answers streamed in real-time (replacing hardcoded mock responses)
**Depends on**: Phase 2
**Requirements**: STUDY-01, STUDY-02
**Success Criteria** (what must be TRUE):
  1. User sends a question in Study Mode and receives an AI-generated answer that references content from their uploaded documents (not hardcoded mock text)
  2. AI responses stream in real-time via SSE — user sees text appearing progressively, not waiting for a full response to load
  3. If no relevant documents are available, AI still responds using general knowledge with a note that no study materials were found
**Plans**: TBD

Plans:
- [ ] 03-01: Chat Netlify Function with RAG retrieval and SSE streaming
- [ ] 03-02: Frontend useChat hook and Study Mode integration

### Phase 4: Study Mode Enhancement
**Goal**: Study Mode becomes VTU-aware with document selection, mark-calibrated answers, and curriculum context
**Depends on**: Phase 3
**Requirements**: STUDY-03, STUDY-04, STUDY-05
**Success Criteria** (what must be TRUE):
  1. User can select specific uploaded documents (Study Kit) and only chunks from those documents are used in RAG retrieval
  2. User can specify mark allocation (2M, 5M, 8M, 10M) and AI calibrates answer depth — a 2M answer is concise while a 10M answer is detailed with examples
  3. AI responses for at least 2-3 demo subjects demonstrate curriculum awareness by referencing specific VTU module topics and exam patterns
**Plans**: TBD

Plans:
- [ ] 04-01: Study Kit document selection and RAG filtering
- [ ] 04-02: Mark-based prompt engineering and VTU system prompts

### Phase 5: Exam Mode
**Goal**: Users can solve PYQs with AI-generated, VTU-formatted answers in both question-by-question and full paper modes
**Depends on**: Phase 3
**Requirements**: EXAM-01, EXAM-02, EXAM-03, EXAM-05
**Success Criteria** (what must be TRUE):
  1. User inputs a PYQ question and receives an AI-generated answer grounded in uploaded study materials
  2. User can upload or select a full question paper and receive a complete model answer paper with all questions answered
  3. AI-generated exam answers follow VTU formatting with marking schemes, step-by-step solutions, and section headers
  4. User can manually paste/type a question when working with image-based question papers that can't be parsed
**Plans**: TBD

Plans:
- [ ] 05-01: PYQ solve Netlify Function with exam-specific prompting
- [ ] 05-02: Full paper mode and manual question input

### Phase 6: PYQ Intelligence
**Goal**: Users can see which topics appear most frequently across past exam papers to focus their study
**Depends on**: Phase 2
**Requirements**: EXAM-04
**Success Criteria** (what must be TRUE):
  1. System parses multiple past papers for a subject and displays a topic frequency analysis showing which topics appear most often across exams
  2. Frequency data is presented in a visual format (chart or ranked list) that helps students prioritize study topics
**Plans**: TBD

Plans:
- [ ] 06-01: PYQ parsing and topic frequency analysis

### Phase 7: Community Library
**Goal**: Users can browse, filter, and manage real community-uploaded documents from Supabase (replacing mock data)
**Depends on**: Phase 1
**Requirements**: LIB-01, LIB-02, LIB-03
**Success Criteria** (what must be TRUE):
  1. Library page displays all uploaded documents with real data from Supabase (not hardcoded/mock data)
  2. User can filter library documents by subject, module, and document type (notes, question papers, lab manuals, textbooks)
  3. User can request removal of a document they uploaded, and the request is recorded for admin review via Supabase console
**Plans**: TBD

Plans:
- [ ] 07-01: Library Netlify Function and real data integration
- [ ] 07-02: Filtering and document removal requests

### Phase 8: Demo Hardening
**Goal**: The live demo is bulletproof — every AI feature gracefully handles failures with fallbacks, cached responses, and polished UX
**Depends on**: Phases 3, 4, 5, 6, 7
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05
**Success Criteria** (what must be TRUE):
  1. If all LLM providers fail, the demo still works using pre-cached responses for the exact demo flow
  2. All AI features display user-friendly error messages instead of raw API errors when something goes wrong
  3. Chat interfaces show typing/loading indicators while waiting for AI responses
  4. API connections are pre-warmed before the demo so there are no cold start delays
**Plans**: TBD

Plans:
- [ ] 08-01: Multi-provider fallback chain and cached demo responses
- [ ] 08-02: Error handling, loading states, and API pre-warming

## Progress

**Execution Order:**
Phases execute in numeric order. Note: Phases 5, 6, and 7 have independent dependencies and can potentially be parallelized.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. AI Foundation | 0/2 | Not started | - |
| 2. Document Processing Pipeline | 0/3 | Not started | - |
| 3. Study Mode Core | 0/2 | Not started | - |
| 4. Study Mode Enhancement | 0/2 | Not started | - |
| 5. Exam Mode | 0/2 | Not started | - |
| 6. PYQ Intelligence | 0/1 | Not started | - |
| 7. Community Library | 0/2 | Not started | - |
| 8. Demo Hardening | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-16*
*Last updated: 2026-03-16*
