# Phase 01: AI Foundation — Research

## Overview

Phase 1 establishes the AI utility layer that all downstream features depend on. This includes:
1. Supabase pgvector schema for document chunk storage and similarity search
2. Embedding client (NVIDIA NIM primary, fallback provider)
3. LLM client (OpenRouter primary, NVIDIA NIM fallback) with SSE streaming

## Existing Codebase State

### What Exists
- **Supabase client**: `src/lib/supabase.ts` — browser-side client using `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Netlify Functions**: `netlify/functions/get-upload-url.mjs` and `list-files.mjs` — existing file upload functions (ESM `.mjs`)
- **Netlify config**: `netlify.toml` — build config, dev ports, function directory at `netlify/functions`
- **React app**: React 19 + TypeScript 5.9 + Vite 7, Supabase auth, Utho S3 storage
- **AI features**: Currently mocked with hardcoded responses — no real LLM integration

### What Does NOT Exist
- No `supabase/migrations/` directory
- No `src/lib/ai/` directory
- No pgvector extension enabled
- No document/chunk tables
- No embedding or LLM client code
- No server-side Supabase client (service role key)

## Technical Decisions

### 1. pgvector Schema

**Extension**: `vector` (pgvector) — enable via `CREATE EXTENSION IF NOT EXISTS vector;`

**Tables**:
- `documents` — parent table for uploaded documents
  - `id` (uuid PK), `user_id` (uuid FK → auth.users), `title` (text), `file_path` (text), `file_type` (text), `subject_id` (uuid nullable), `module_id` (uuid nullable), `created_at` (timestamptz)
- `document_chunks` — chunked text with embeddings
  - `id` (uuid PK), `document_id` (uuid FK → documents ON DELETE CASCADE), `content` (text), `embedding` (vector(1024)), `chunk_index` (integer), `metadata` (jsonb), `created_at` (timestamptz)

**Index**: HNSW index on `document_chunks.embedding` using cosine distance operator (`vector_cosine_ops`). HNSW chosen over IVFFlat because it works well without training and handles small-to-medium datasets (expected for student usage).

**RPC Function**: `match_documents(query_embedding vector(1024), match_threshold float, match_count int)` — returns chunks ordered by cosine similarity. Uses `1 - (embedding <=> query_embedding)` for similarity score.

**RLS Policies**: Enable RLS on both tables. Users can only read/write their own documents and chunks (via `auth.uid() = user_id` on documents, joined through document_id for chunks).

### 2. Embedding Client

**Primary**: NVIDIA NV-EmbedQA E5 v5
- Endpoint: `https://integrate.api.nvidia.com/v1/embeddings`
- Model: `nvidia/nv-embedqa-e5-v5`
- Dimensions: 1024
- Free tier available
- OpenAI-compatible API format

**Fallback**: Alternative embedding provider (e.g., a different model on the same NVIDIA NIM platform, or a local fallback)
- Must produce same 1024-dimensional vectors for compatibility
- Fallback triggers on: network error, 5xx response, timeout (>10s)

**Client Design**:
- `src/lib/ai/embedding.ts` — exports `getEmbedding(text: string): Promise<number[]>`
- Uses fetch API (no SDK dependency)
- Retry logic: 1 retry with 1s delay before falling to fallback
- Input truncation: Limit text to model's max token length

### 3. LLM Client

**Primary**: OpenRouter
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- OpenAI-compatible API format
- Model selection via `model` field (e.g., `google/gemini-2.0-flash-exp:free`)
- Supports streaming via `stream: true`

**Fallback**: NVIDIA NIM
- Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- Also OpenAI-compatible format
- Fallback triggers on: network error, 5xx response, timeout (>30s)

**Client Design**:
- `src/lib/ai/llm.ts` — exports `chatCompletion(messages, options): Promise<ReadableStream | string>`
- Streaming: Returns ReadableStream for SSE when `stream: true`
- Non-streaming: Returns parsed response string when `stream: false`
- Both providers use identical OpenAI-compatible format, simplifying fallback

### 4. Server-Side Supabase Client

Netlify Functions need a service-role Supabase client (not the browser anon client):
- `src/lib/ai/supabase-server.ts` — uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars (not `VITE_` prefixed)
- Required for inserting embeddings and querying chunks from serverless functions

### 5. Environment Variables

New env vars needed (Netlify environment / `.env` for local dev):
- `NVIDIA_NIM_API_KEY` — for embedding and LLM fallback
- `OPENROUTER_API_KEY` — for primary LLM
- `SUPABASE_URL` — server-side (same value as VITE_SUPABASE_URL but accessed without VITE_ prefix in functions)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side admin access

## Architecture Patterns

### File Structure
```
src/lib/ai/
  embedding.ts      — getEmbedding() with fallback
  llm.ts            — chatCompletion() with fallback and streaming
  supabase-server.ts — server-side Supabase client
  types.ts          — shared AI types (EmbeddingResponse, ChatMessage, etc.)

supabase/migrations/
  001_enable_pgvector.sql
  002_create_documents_table.sql
  003_create_document_chunks_table.sql
  004_create_match_documents_rpc.sql

netlify/functions/
  (existing: get-upload-url.mjs, list-files.mjs)
  (new functions added in later phases)
```

### Error Handling Pattern
All AI clients follow the same pattern:
1. Try primary provider
2. On failure (network, 5xx, timeout), log warning
3. Try fallback provider
4. On fallback failure, throw descriptive error

### Streaming Pattern
LLM streaming uses Server-Sent Events (SSE):
- Netlify Functions return `Content-Type: text/event-stream`
- Client reads with `EventSource` or manual `ReadableStream` parsing
- Each chunk: `data: {"choices":[{"delta":{"content":"..."}}]}\n\n`
- End signal: `data: [DONE]\n\n`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Free LLM tier unreliability | Degraded UX | Multi-provider fallback chain |
| NVIDIA NIM API changes | Broken embeddings | Pin model version, abstract behind interface |
| pgvector index performance | Slow queries at scale | HNSW index, monitor with EXPLAIN ANALYZE |
| Netlify function cold starts | Slow first request | Keep functions lightweight, no heavy SDKs |
| Embedding dimension mismatch | Query failures | Enforce 1024-dim in types and validation |

## Standard Stack Alignment

- **No heavy SDKs**: Using raw `fetch` for all API calls (no `openai` npm package)
- **TypeScript strict**: All AI types fully typed, no `any`
- **Existing patterns**: Follow existing Netlify Function style (ESM, `.mjs` or `.ts`)
- **Supabase conventions**: Use Supabase client library for DB operations, raw SQL only for migrations

## Validation Architecture

### Test Strategy

**Unit Tests (Vitest)**:
- Embedding client: Mock fetch, verify correct API payload construction, verify fallback triggers on error, verify 1024-dim output type
- LLM client: Mock fetch, verify message formatting, verify streaming response parsing, verify fallback triggers
- Type validation: Ensure all AI types are properly constrained

**Integration Tests (against real APIs — manual/CI)**:
- Embedding: Send real text, receive real 1024-dim vector
- LLM: Send real prompt, receive streamed response
- Supabase: Insert chunk with embedding, query with match_documents RPC

**Schema Validation**:
- SQL migrations can be validated by running `supabase db push` or applying to a local Supabase instance
- Verify: pgvector extension exists, tables created, RPC function works, RLS policies enforce user isolation

### Verification Commands
- `npx vitest run src/lib/ai/` — unit tests for AI clients
- `npx supabase db push` — apply migrations to Supabase (requires Supabase CLI)
- Manual: `curl` the embedding endpoint with test text, verify 1024-dim response
- Manual: `curl` the LLM endpoint with test prompt, verify streamed response

### Nyquist Coverage Requirements
Every success criterion must have at least one automated verification:
1. "pgvector extension + document_chunks table + HNSW index + match_documents RPC" → SQL migration files + schema test
2. "Netlify Function calls NVIDIA NIM embedding API → 1024-dim vector" → Unit test with mocked fetch + integration test
3. "Fallback to alternative embedding provider on failure" → Unit test simulating primary failure
4. "Netlify Function calls OpenRouter for LLM chat completions → streamed response" → Unit test with mocked fetch + streaming test
