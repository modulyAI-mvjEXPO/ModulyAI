# Phase 01: AI Foundation — Validation Strategy

## Phase Goal
The database schema and AI utility layer exist so all downstream features can store/retrieve vectors and call LLMs.

## Requirements Covered
- **RAG-04**: Vector storage with pgvector (document_chunks table, HNSW index, match_documents RPC)
- **RAG-08**: Multi-provider fallback for AI services (embedding fallback, LLM fallback)

## Validation Matrix

### Success Criterion 1: pgvector Schema
**Requirement**: RAG-04
**Statement**: Supabase has pgvector extension enabled with `document_chunks` table, HNSW index, and a `match_documents` RPC function returning chunks by cosine similarity.

| Check | Type | Command / Method | Pass Condition |
|-------|------|-----------------|----------------|
| pgvector extension exists | automated | SQL: `SELECT * FROM pg_extension WHERE extname = 'vector';` | Returns 1 row |
| documents table exists | automated | SQL: `SELECT * FROM information_schema.tables WHERE table_name = 'documents';` | Returns 1 row |
| document_chunks table exists | automated | SQL: `SELECT * FROM information_schema.tables WHERE table_name = 'document_chunks';` | Returns 1 row |
| embedding column is vector(1024) | automated | SQL: check column type | Type is `USER-DEFINED` (vector) |
| HNSW index exists | automated | SQL: `SELECT * FROM pg_indexes WHERE indexname LIKE '%hnsw%';` | Returns 1 row |
| match_documents RPC works | automated | `supabase rpc match_documents` with test vector | Returns matching chunks sorted by similarity |
| RLS enabled on documents | automated | SQL: `SELECT relrowsecurity FROM pg_class WHERE relname = 'documents';` | Returns true |
| RLS enabled on document_chunks | automated | SQL: `SELECT relrowsecurity FROM pg_class WHERE relname = 'document_chunks';` | Returns true |
| Migration files exist | automated | `ls supabase/migrations/*.sql` | At least 1 SQL file |

### Success Criterion 2: Embedding Client
**Requirement**: RAG-04, RAG-08
**Statement**: A Netlify Function can call NVIDIA NIM embedding API and receive a 1024-dimensional vector back.

| Check | Type | Command / Method | Pass Condition |
|-------|------|-----------------|----------------|
| getEmbedding returns 1024-dim array | automated | `npx vitest run` — unit test | Test passes, array.length === 1024 |
| Correct API payload sent to NVIDIA NIM | automated | Unit test with mocked fetch | Payload matches NVIDIA NIM format |
| Handles API error gracefully | automated | Unit test with mocked 500 response | Falls back or throws descriptive error |
| embedding.ts exports getEmbedding | automated | TypeScript compilation | No type errors |
| Types file exports EmbeddingResponse | automated | TypeScript compilation | No type errors |

### Success Criterion 3: Embedding Fallback
**Requirement**: RAG-08
**Statement**: If NVIDIA NIM embedding API is unavailable, the system automatically falls back to an alternative embedding provider and returns a valid vector.

| Check | Type | Command / Method | Pass Condition |
|-------|------|-----------------|----------------|
| Fallback triggers on primary failure | automated | Unit test — mock primary 500, verify fallback called | Fallback provider called, valid vector returned |
| Fallback triggers on primary timeout | automated | Unit test — mock primary timeout | Fallback provider called within timeout |
| Fallback returns 1024-dim vector | automated | Unit test | array.length === 1024 |
| Both providers fail → descriptive error | automated | Unit test — mock both fail | Error message includes both provider names |

### Success Criterion 4: LLM Client with Streaming
**Requirement**: RAG-04, RAG-08
**Statement**: A Netlify Function can call OpenRouter for LLM chat completions and receive a streamed response.

| Check | Type | Command / Method | Pass Condition |
|-------|------|-----------------|----------------|
| chatCompletion returns streamed response | automated | Unit test with mocked SSE | ReadableStream with expected chunks |
| chatCompletion returns non-streamed response | automated | Unit test with mocked JSON | String response matches expected |
| Correct API payload to OpenRouter | automated | Unit test with mocked fetch | Payload matches OpenRouter format |
| LLM fallback triggers on primary failure | automated | Unit test — mock primary 500 | Fallback provider called |
| Handles streaming errors gracefully | automated | Unit test — mock mid-stream error | Error propagated cleanly |
| llm.ts exports chatCompletion | automated | TypeScript compilation | No type errors |

## Test File Mapping

| Source File | Test File | Key Behaviors Tested |
|-------------|-----------|---------------------|
| `src/lib/ai/embedding.ts` | `src/lib/ai/embedding.test.ts` | getEmbedding, fallback, error handling |
| `src/lib/ai/llm.ts` | `src/lib/ai/llm.test.ts` | chatCompletion, streaming, fallback |
| `src/lib/ai/types.ts` | (type-only, validated by tsc) | Type exports compile |
| `src/lib/ai/supabase-server.ts` | (simple client, validated by tsc) | Client creation compiles |
| `supabase/migrations/*.sql` | (validated by supabase db push) | Schema applies cleanly |

## Nyquist Coverage Summary

| Requirement | Success Criteria | Automated Checks | Coverage |
|-------------|-----------------|-------------------|----------|
| RAG-04 | SC1 (schema), SC2 (embedding), SC4 (LLM) | 9 + 5 + 6 = 20 checks | ✅ Full |
| RAG-08 | SC3 (embed fallback), SC4 (LLM fallback) | 4 + 1 = 5 checks | ✅ Full |

**Total automated checks**: 25
**Manual-only checks**: 0
**Nyquist compliance**: ✅ All success criteria have automated verification
