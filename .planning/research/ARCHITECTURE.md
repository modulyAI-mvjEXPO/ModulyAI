# Architecture Research

**Domain:** AI-powered VTU study platform — RAG integration with existing Supabase + Netlify SPA
**Researched:** 2026-03-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React 19 SPA (Vite 7)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │ Study     │ │ Exam      │ │ Library   │ │ Dashboard │    │
│  │ Mode      │ │ Mode      │ │ Browser   │ │ + Auth    │    │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘    │
│        │              │              │              │         │
│        └──────────────┴──────┬───────┴──────────────┘         │
│                              │                                │
├──────────────────────────────┴────────────────────────────────┤
│                    Netlify Functions (API)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Chat     │  │ PYQ      │  │ Doc      │  │ Upload   │     │
│  │ (SSE)    │  │ Solve    │  │ Process  │  │ Handler  │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       │              │              │              │          │
├───────┴──────────────┴──────────────┴──────────────┴──────────┤
│                     External Services                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Supabase │  │ OpenRout │  │ NVIDIA   │  │ Utho S3  │     │
│  │ (DB+Vec) │  │ er (LLM) │  │ NIM(Emb) │  │ (Files)  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **React SPA** | UI, state management, SSE consumption, document selection | Existing — needs backend wiring |
| **Chat Function** | RAG retrieval + LLM prompt construction + SSE streaming | New Netlify Function — `/.netlify/functions/chat` |
| **PYQ Solve Function** | PYQ-specific prompting (question-by-question or full paper) | New Netlify Function — `/.netlify/functions/pyq-solve` |
| **Doc Process Function** | PDF parsing → chunking → embedding → pgvector storage | New Netlify Background Function — `/.netlify/functions/process-document-background` |
| **Upload Handler** | File upload to Utho S3 + trigger doc processing | Existing — extend to trigger processing pipeline |
| **Supabase** | Auth, profiles, documents metadata, vector storage (pgvector) | Existing (auth/profiles) + new tables (documents, document_chunks) |
| **OpenRouter** | LLM chat completions for Study Mode and Exam Mode | New integration — OpenAI-compatible API |
| **NVIDIA NIM** | Embedding generation for document chunks and queries | New integration — REST API |
| **Utho S3** | Raw file storage for uploaded PDFs/images | Existing — no changes needed |

## Recommended Project Structure

```
moduly-ai-landing/
├── src/
│   ├── components/          # React UI components (existing)
│   ├── pages/               # Page components (existing)
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client (existing)
│   │   ├── vtuData.ts       # VTU academic data (existing)
│   │   ├── ai/
│   │   │   ├── llm.ts       # OpenRouter + NVIDIA LLM client
│   │   │   ├── embeddings.ts # NVIDIA embedding client
│   │   │   ├── chunker.ts   # Text chunking utility
│   │   │   ├── rag.ts       # RAG retrieval (pgvector query)
│   │   │   └── prompts.ts   # System prompts for Study/Exam modes
│   │   └── storage.ts       # Utho S3 client (existing)
│   ├── hooks/
│   │   ├── useChat.ts       # SSE streaming chat hook
│   │   └── useLibrary.ts    # Library document queries
│   └── types/
│       └── ai.ts            # Types for AI features
├── netlify/
│   └── functions/
│       ├── chat.ts                          # Study Mode chat (SSE streaming)
│       ├── pyq-solve.ts                     # Exam Mode PYQ solver (SSE streaming)
│       ├── process-document-background.ts   # Document processing pipeline (background)
│       ├── upload.ts                        # File upload (existing)
│       └── library.ts                       # Library document listing
└── supabase/
    └── migrations/
        ├── 001_documents.sql                # documents table
        └── 002_document_chunks.sql          # document_chunks + pgvector + match_documents RPC
```

### Structure Rationale

- **`lib/ai/`**: All AI-related utilities isolated in one directory. Easy to find, test, and modify. Separated from existing code.
- **`hooks/`**: React hooks for consuming AI features. `useChat` handles SSE stream state; `useLibrary` handles document queries.
- **`netlify/functions/`**: Each function is a single responsibility. Chat and PYQ solving are separate because they have different prompting strategies. Document processing is a background function (long-running).
- **`supabase/migrations/`**: SQL migrations for new tables. Keeps schema changes versioned and reproducible.

## Architectural Patterns

### Pattern 1: RAG Pipeline (Retrieve-Augment-Generate)

**What:** Query user question → embed query → search pgvector for similar chunks → inject chunks into LLM prompt → stream response.

**When to use:** Every Study Mode and Exam Mode interaction where the user has selected library documents for context.

**Trade-offs:**
- Pro: Grounded answers using actual study materials
- Pro: Reduces hallucination
- Con: Adds latency (embed query ~200ms + vector search ~50ms)
- Con: Quality depends heavily on chunking and retrieval

**Data Flow:**
```
User Question
    ↓
Embed query (NVIDIA NIM) → 1024-dim vector
    ↓
Search pgvector (match_documents RPC) → top 5 relevant chunks
    ↓
Construct prompt: system prompt + VTU context + retrieved chunks + user question
    ↓
Stream to LLM (OpenRouter) → SSE response back to client
```

### Pattern 2: SSE Streaming Through Serverless

**What:** Netlify Function proxies LLM streaming response to the React client via Server-Sent Events.

**When to use:** All chat interactions (Study Mode and Exam Mode).

**Trade-offs:**
- Pro: Real-time token-by-token display (good UX for chat)
- Pro: Connection stays alive as long as data flows (avoids timeout)
- Con: Netlify's serverless may buffer SSE chunks
- Con: Error handling is more complex than request-response

**Implementation:**
```
React (EventSource/fetch) ←—SSE—→ Netlify Function ←—SSE—→ OpenRouter API
```

### Pattern 3: Background Processing for Document Ingestion

**What:** When a document is uploaded, trigger a Netlify Background Function to parse, chunk, embed, and store vectors.

**When to use:** Every document upload.

**Trade-offs:**
- Pro: Upload returns immediately (async processing)
- Pro: Background functions have 15-min timeout (large documents OK)
- Con: User must wait for processing to complete before RAG works on that document
- Con: Need to track processing status (pending/complete/failed)

## Data Flow

### Study Mode Chat Flow

```
Student selects subject + optionally selects library documents
    ↓
Student types question
    ↓
React calls Netlify Function: POST /chat
  Body: { question, subjectId, selectedDocIds[], conversationHistory[] }
    ↓
Netlify Function:
  1. Embed question → NVIDIA NIM API → 1024-dim vector
  2. Query pgvector: match_documents(embedding, threshold=0.7, count=5,
       filter={subject, docIds})
  3. Build system prompt:
       - VTU syllabus context (subject, modules from vtuData.ts)
       - Retrieved document chunks
       - Conversation history
       - Instructions: "You are a VTU study assistant..."
  4. Stream to OpenRouter → SSE tokens
    ↓
React: useChat hook consumes SSE stream → renders tokens incrementally
```

### Exam Mode PYQ Solver Flow

```
Student selects subject + PYQ paper (from pre-loaded bank or library)
    ↓
Student chooses: "Solve question-by-question" or "Full model answer paper"
    ↓
React calls Netlify Function: POST /pyq-solve
  Body: { mode: "single"|"full", questions[], subjectId, selectedDocIds[] }
    ↓
Netlify Function:
  1. If RAG enabled: embed question(s) → retrieve relevant chunks
  2. Build prompt:
       - VTU exam context (subject, marks scheme, module mapping)
       - Retrieved chunks (if any)
       - Question(s) to solve
       - Instructions for answer format (marks-based length)
  3. Stream to OpenRouter → SSE tokens
    ↓
React: renders answer(s) with proper formatting
```

### Document Upload + Processing Flow

```
Student uploads PDF/image via Library UI
    ↓
React calls existing upload function → file stored in Utho S3
    ↓
Upload function saves document metadata to Supabase:
  INSERT INTO documents (user_id, filename, file_url, status='processing', ...)
    ↓
Triggers Netlify Background Function: process-document-background
  Input: { documentId, fileUrl }
    ↓
Background Function:
  1. Download file from Utho S3
  2. Extract text: pdf-parse getText() (PDF) or skip (images — no OCR for expo)
  3. Chunk text: custom recursive splitter (500 chars, 50 overlap)
  4. Batch embed chunks: NVIDIA NIM API (all chunks in one request)
  5. Store chunks + embeddings: INSERT INTO document_chunks
  6. Update document status: UPDATE documents SET status='ready'
    ↓
React: polls document status → shows "Processing..." then "Ready"
```

### Library Browse Flow

```
Student opens Library page
    ↓
React calls Netlify Function: GET /library?subject=X&type=notes
    ↓
Netlify Function: query Supabase
  SELECT * FROM documents WHERE status='ready' ORDER BY created_at DESC
    ↓
React: renders document cards (filename, uploader, type, date, subject)
    ↓
Student selects documents → these become available as RAG context in Study/Exam Mode
```

## Supabase Schema Additions

### New Tables

```sql
-- Documents metadata (extends existing upload tracking)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,            -- 'pdf', 'image', 'text'
  doc_type TEXT NOT NULL,             -- 'notes', 'question_paper', 'lab_manual', 'textbook'
  subject TEXT,                       -- subject code/name from vtuData
  semester INTEGER,
  branch TEXT,
  status TEXT DEFAULT 'processing',   -- 'processing', 'ready', 'failed'
  page_count INTEGER,
  chunk_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with vector embeddings (see STACK.md for full schema)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1024),
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all documents (community library)
CREATE POLICY "documents_read" ON documents FOR SELECT
  TO authenticated USING (status = 'ready');

-- Users can insert their own documents
CREATE POLICY "documents_insert" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chunks readable by all authenticated users
CREATE POLICY "chunks_read" ON document_chunks FOR SELECT
  TO authenticated USING (true);
```

## Build Order (Dependencies)

The build order is dictated by what depends on what:

```
Phase 1: Foundation (no dependencies)
├── Supabase schema (documents + document_chunks + pgvector + RPC)
├── Custom text chunker utility
└── NVIDIA embedding client utility

Phase 2: Document Pipeline (depends on Phase 1)
├── pdf-parse integration
├── Document processing background function
└── Upload handler extension (trigger processing)

Phase 3: RAG Retrieval (depends on Phase 1)
├── Query embedding function
├── pgvector similarity search via match_documents RPC
└── RAG context builder (format chunks for prompt injection)

Phase 4: LLM Integration (depends on Phase 3)
├── OpenRouter client + NVIDIA NIM fallback
├── System prompt templates (Study Mode + Exam Mode)
├── SSE streaming function for chat
└── SSE streaming function for PYQ solving

Phase 5: Frontend Wiring (depends on Phase 4)
├── useChat hook (SSE stream consumer)
├── Study Mode backend connection
├── Exam Mode backend connection
├── Library browse + document selection
└── Document processing status polling

Phase 6: Polish (depends on Phase 5)
├── UI refinement across all pages
├── Error handling + loading states
├── Demo preparation (curated content, fallback responses)
└── Performance optimization
```

**Critical path:** Phase 1 → Phase 2+3 (parallel) → Phase 4 → Phase 5 → Phase 6

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (Expo) | Current architecture is fine. pgvector handles <10K chunks easily. Free LLM APIs sufficient. |
| 100-1K users | Monitor OpenRouter rate limits. Consider caching common queries. Add connection pooling for Supabase. |
| 1K-10K users | Upgrade to paid LLM providers. Add Redis caching for frequent RAG queries. Consider dedicated embedding service. |
| 10K+ users | Migrate to managed vector DB (Pinecone/Weaviate). Background job queue (BullMQ). CDN for static assets. |

### Scaling Priorities

1. **First bottleneck:** LLM API rate limits — free tier will hit limits with concurrent users. Fix: upgrade to paid tier or add request queuing.
2. **Second bottleneck:** pgvector search latency with >100K chunks — Fix: partition by subject, tune HNSW parameters, or migrate to dedicated vector DB.

## Anti-Patterns

### Anti-Pattern 1: Processing Documents at Query Time

**What people do:** Parse and embed documents when the user asks a question.
**Why it's wrong:** Adds 5-30s latency to every query. Terrible UX. Wastes API calls re-processing the same document.
**Do this instead:** Process at upload time. Store embeddings in pgvector. Query-time retrieval is just a vector similarity search (~50ms).

### Anti-Pattern 2: Sending Entire Documents to LLM

**What people do:** Concatenate full document text into the LLM prompt.
**Why it's wrong:** Exceeds context window limits. Costs more tokens. Dilutes relevant information with noise.
**Do this instead:** RAG — retrieve only the top 5 most relevant chunks (2500 chars total) and inject those into the prompt.

### Anti-Pattern 3: Synchronous Document Processing in Upload Handler

**What people do:** Parse + chunk + embed in the same function that handles upload.
**Why it's wrong:** Upload function has 10s timeout. Large PDFs take 30s+ to process. Function times out, user gets error.
**Do this instead:** Upload handler stores file and triggers background function. Background function has 15-min timeout.

### Anti-Pattern 4: One Netlify Function for Everything

**What people do:** Single `api.ts` function that routes all requests.
**Why it's wrong:** No separation of concerns. Can't use background functions for some routes. Harder to debug and maintain.
**Do this instead:** Separate functions per feature: `chat.ts`, `pyq-solve.ts`, `process-document-background.ts`, `library.ts`.

## Integration Points

### External Services

| Service | Integration Pattern | Gotchas |
|---------|---------------------|---------|
| **OpenRouter** | OpenAI-compatible REST API + SSE | Free model availability changes. Always check `/api/v1/models` for current free options. Have NVIDIA NIM fallback ready. |
| **NVIDIA NIM** | REST API (`integrate.api.nvidia.com/v1/embeddings`) | Rate limits on free tier. Batch embed chunks (max per request varies). API key via `build.nvidia.com` account. |
| **Supabase pgvector** | RPC function (`match_documents`) via supabase-js | Must enable `vector` extension first. HNSW index creation can take time on large datasets. RLS policies must allow chunk reads. |
| **Utho S3** | AWS S3-compatible SDK (existing) | No changes needed. Document processing downloads from existing URLs. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React ↔ Netlify Functions | HTTP + SSE | Chat uses SSE streaming. Library/upload use standard REST. Auth token forwarded in headers. |
| Netlify Functions ↔ Supabase | supabase-js client (server-side) | Use service role key in functions for admin operations. Use user's JWT for RLS-protected queries. |
| Upload Handler ↔ Doc Processor | Netlify Background Function trigger | Upload inserts document row, then invokes background function with document ID. |
| Study Mode ↔ Exam Mode | Shared RAG pipeline | Both use the same embedding + retrieval + LLM code. Different system prompts and response formatting. |

## Sources

- Supabase AI & Vector documentation — pgvector setup, RPC patterns, RLS with vectors
- NVIDIA NIM API documentation — embedding endpoints, rate limits, batch processing
- OpenRouter API documentation — SSE streaming, free models, OpenAI compatibility
- Netlify Functions documentation — timeouts (10s default, 26s max, 15-min background), SSE support
- pdf-parse v2 documentation — serverless compatibility, getText() API

---
*Architecture research for: AI-powered VTU study platform (Moduly AI)*
*Researched: 2026-03-15*
