# Plan 01-01 Summary: Schema, Types, Testing Infrastructure

**Status**: Complete
**Duration**: ~30 minutes
**Commits**: `9f2d206` — `feat(01): add pgvector schema, AI types, testing infra (Plan 01-01)`

## What Was Done

### Testing Infrastructure
- Installed Vitest v4.1.0 with `test` and `test:watch` scripts
- Created `vitest.config.ts` (globals, node env, src/**/*.test.ts pattern)
- Added `"node"` to tsconfig.app.json types (for `process.env` in server-side code)
- Added `"vitest.config.ts"` to tsconfig.node.json include

### AI Type Definitions (`src/lib/ai/types.ts`)
- 8 type exports: `EmbeddingRequest`, `EmbeddingResponse`, `ChatMessage`, `ChatCompletionOptions`, `ChatCompletionResponse`, `StreamChunk`, `AIProviderError`, `AIProviderConfig`
- All properties use `readonly` and `ReadonlyArray`

### Server-Side Supabase Client (`src/lib/ai/supabase-server.ts`)
- `createServerSupabaseClient()` using service role key
- Checks both `SUPABASE_URL` and `VITE_SUPABASE_URL` env vars

### Database Schema (4 SQL migrations, applied to live Supabase)
- `001_enable_pgvector.sql` — pgvector v0.8.0 extension
- `002_create_documents_table.sql` — documents table with RLS (3 policies)
- `003_create_document_chunks_table.sql` — document_chunks with vector(1024), HNSW index, RLS (3 policies)
- `004_create_match_documents_rpc.sql` — match_documents RPC (cosine similarity search)

## Verification
- TypeScript compiles clean (`tsc -b --noEmit`)
- All 4 SQL migrations applied to live Supabase
- pgvector v0.8.0 confirmed, HNSW index confirmed, RLS enabled on both tables

## Deviations
None. Plan executed as written.
