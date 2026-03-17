# Phase 02: Document Processing Pipeline — Research

## Overview

Phase 2 transforms uploaded PDFs into searchable vector embeddings with visible status tracking. It bridges the gap between the raw file upload (Utho S3) and the AI foundation (pgvector schema + embedding client) built in Phase 1.

**Requirements covered**: RAG-01, RAG-02, RAG-03, RAG-05, RAG-06, RAG-07

## Current State Analysis

### What Phase 1 Delivered (Ready to Use)

| Asset | Location | Status |
|-------|----------|--------|
| `documents` table | `supabase/migrations/002` | Live in Supabase — **missing `status` column** |
| `document_chunks` table | `supabase/migrations/003` | Live — vector(1024), HNSW index, RLS |
| `match_documents` RPC | `supabase/migrations/004` | Live — cosine similarity search, **no metadata filter** |
| Embedding client | `src/lib/ai/embedding.ts` | Working — `getEmbedding(text)` → 1024-dim vector |
| Server Supabase client | `src/lib/ai/supabase-server.ts` | Working — service role key, bypasses RLS |
| AI types | `src/lib/ai/types.ts` | Working — EmbeddingRequest/Response, etc. |
| Vitest setup | `vitest.config.ts` | Working — 15 tests passing |

### What Exists But Needs Extension

| Asset | Location | Gap |
|-------|----------|-----|
| `get-upload-url.mjs` | `netlify/functions/` | Generates presigned URL for S3 upload — no Supabase integration |
| `list-files.mjs` | `netlify/functions/` | Lists S3 files — no document status, no Supabase query |
| `FileUpload.tsx` | `src/components/` | Uploads to S3, calls `onUploadSuccess` — doesn't create Supabase document row or trigger processing |
| `UploadDocs.tsx` | `src/pages/` | Shows uploads from S3, has removal button — no processing status, no Supabase integration |

### Schema Gaps to Fix

#### 1. `documents` table missing `status` column

Current schema (migration 002):
```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  subject_id uuid,
  module_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Missing**: `status` (processing/ready/failed/no_text), `chunk_count`, `updated_at`, `file_size`

**Action**: New migration (005) to add columns:
```sql
ALTER TABLE documents
  ADD COLUMN status text NOT NULL DEFAULT 'processing',
  ADD COLUMN chunk_count integer DEFAULT 0,
  ADD COLUMN file_size bigint,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
```

#### 2. `match_documents` RPC lacks metadata filtering

Current RPC returns ALL chunks sorted by similarity. Requirements (RAG-05) need filtering by subject and specific documents.

**Action**: New migration (006) to create enhanced RPC:
```sql
CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1024),
  filter_document_ids uuid[] DEFAULT NULL,
  filter_subject_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
```

This will JOIN with `documents` table and add WHERE clauses for document_ids and subject_id.

## Technical Approach

### 1. PDF Text Extraction

**Library choice: `pdf-parse`**

| Library | Size | Node.js | Netlify | Notes |
|---------|------|---------|---------|-------|
| `pdf-parse` | ~25KB (+ pdf.js bundled) | Yes | Yes | Most popular, wraps pdf.js, simple API |
| `pdfjs-dist` | ~2MB | Yes | Yes | Full pdf.js — overkill for text extraction |
| `pdf2json` | ~1MB | Yes | Partial | Heavier, returns structured JSON |
| `unpdf` | ~500KB | Yes | Yes | Modern alternative, uses pdf.js internally |

**Decision: `pdf-parse`** — minimal API (`pdf(buffer).then(data => data.text)`), lightweight, proven in serverless. Used in the architecture research recommendation.

**Scanned PDF detection (RAG-07)**: After extraction, check if `text.trim().length < 50`. If so, mark as `no_text`. This threshold catches PDFs that yield only page numbers or whitespace.

### 2. Text Chunking (RAG-02)

Requirements specify: 500 chars, 50 char overlap.

**Custom chunker** (no LangChain dependency — per architecture research anti-pattern):

```typescript
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  // Clean text: normalize whitespace, remove excessive newlines
  // Split into chunks respecting sentence boundaries where possible
  // Ensure overlap for retrieval quality
}
```

**Chunking strategy**:
1. Normalize whitespace (collapse multiple spaces/newlines)
2. Split at sentence boundaries where possible (prefer `.` `!` `?` followed by space)
3. If no sentence boundary within chunk window, split at word boundary
4. Overlap: last 50 chars of previous chunk prepended to next chunk
5. Skip chunks that are pure whitespace or < 20 chars

**Metadata per chunk**: `{ document_id, chunk_index, subject_id?, module_id? }`

### 3. Processing Pipeline Architecture

**Critical constraint**: Netlify Functions have a **10-second default timeout** (26s max for synchronous). PDF processing (extract + chunk + embed N chunks) can take 30-120 seconds.

**Solution: Netlify Background Functions**

Background functions have a **15-minute timeout** and run asynchronously. The function name must end with `-background` (e.g., `process-document-background.mts`).

**Pipeline flow**:
```
1. Frontend uploads PDF to S3 (existing flow)
2. Frontend calls new Netlify Function: POST /process-document
   Body: { title, filePath, fileType, subjectId?, moduleId?, userId }
3. Synchronous function:
   a. INSERT document row (status='processing') into Supabase
   b. Return { documentId } immediately (202 Accepted)
   c. Invoke background function with documentId
4. Background function (process-document-background):
   a. Download PDF from S3 URL
   b. Extract text with pdf-parse
   c. If text is empty/minimal → update status='no_text', return
   d. Chunk text (500 chars, 50 overlap)
   e. Embed all chunks via getEmbedding() (batched or sequential)
   f. INSERT chunks + embeddings into document_chunks
   g. UPDATE document status='ready', chunk_count=N
   h. On any error → UPDATE status='failed'
```

**Alternative considered: Direct processing in sync function**
- Pro: Simpler, no background function complexity
- Con: Will timeout on any PDF > ~5 pages
- **Rejected**: Too risky for demo reliability

**Alternative considered: Supabase Edge Functions**
- Pro: Direct database access, no separate deployment
- Con: Deno runtime (different from existing Node.js functions), team unfamiliarity
- **Rejected**: Consistency with existing Netlify Functions stack

### 4. Triggering the Background Function

Netlify background functions can be triggered by:
1. **Direct invocation** via `/.netlify/functions/process-document-background` — but this is an HTTP endpoint the client calls directly
2. **From another function** — the synchronous function can invoke the background function via an internal fetch call

**Recommended approach**: Two-function pattern
- `process-document.mts` (sync, 10s timeout) — creates document row, returns immediately, triggers background
- `process-document-background.mts` (async, 15-min timeout) — does the actual work

The sync function triggers the background function by making an HTTP call to it (or by having the client call the background function directly after the sync function returns).

**Simpler alternative**: Have the frontend call the background function directly:
1. Frontend calls `POST /process-document-background` with document details
2. Netlify immediately returns 202 Accepted
3. Background function runs asynchronously

This is simpler but means the document row insertion also happens in the background function, so the frontend won't have the `documentId` immediately. Trade-off: simpler architecture vs. immediate document ID.

**Decision**: Single background function approach. The frontend calls the background function directly. The function creates the document row first, then processes. The frontend polls for the document to appear in the documents table.

Actually, rethinking: the background function returns 202 immediately, so it can't return the documentId. We need the sync function to create the row and return the ID.

**Final decision**: Two-function pattern.
1. `process-document.mts` — sync, creates document row (status='processing'), returns `{ documentId }`, then fires off the background function
2. `process-document-background.mts` — background, receives `documentId`, downloads, extracts, chunks, embeds, stores

### 5. Embedding Batching

The existing `getEmbedding(text)` embeds a single text string. For a 20-page PDF with ~80 chunks, we need 80 embedding calls.

**Options**:
1. **Sequential calls**: Simple, 80 * ~200ms = 16 seconds — acceptable within 15-min limit
2. **Batch API**: NVIDIA NIM may support batch embedding in a single request — need to check
3. **Concurrent with limit**: `Promise.all` with concurrency limit (e.g., 5 at a time)

**Decision**: Start with sequential (simplest, reliable). If too slow, add concurrency limiting. NVIDIA NIM's batch API format should be tested — it may accept an array of texts in `input` field.

### 6. Status Tracking (RAG-06)

**Database**: `documents.status` column with values: `'processing' | 'ready' | 'failed' | 'no_text'`

**Frontend polling**:
- After upload triggers processing, frontend polls `GET /document-status?id={documentId}` every 3 seconds
- Or: query Supabase directly from the client (documents table has RLS SELECT policy for own documents)
- Display: spinner during 'processing', checkmark for 'ready', warning icon for 'no_text'/'failed'

**Decision**: Direct Supabase query from frontend (simpler, no new function needed):
```typescript
const { data } = await supabase
  .from('documents')
  .select('status')
  .eq('id', documentId)
  .single();
```

Poll every 3 seconds until status !== 'processing'.

**Supabase Realtime (considered but rejected)**:
- Pro: No polling, instant updates
- Con: Adds subscription complexity, channel management, another API surface
- Con: Polling every 3s is fine for this use case (processing takes 10-60 seconds)

### 7. Frontend Integration

#### Upload Flow Changes

Current `FileUpload.tsx` flow:
1. Get presigned URL → PUT file to S3 → call `onUploadSuccess` callback

New flow:
1. Get presigned URL → PUT file to S3 (unchanged)
2. Call new `POST /process-document` with file details
3. Receive `{ documentId }`
4. Start polling document status
5. Show status indicator (processing → ready / no_text / failed)

#### UploadDocs.tsx Changes

Current: Fetches from `list-files` (S3 listing)
New: Fetch from Supabase `documents` table (shows status, enables filtering)

#### Status Messages (RAG-07)

| Status | Icon | Message |
|--------|------|---------|
| processing | Spinner | "Processing document..." |
| ready | Check | "Ready for AI study" |
| no_text | Warning | "This PDF appears to be scanned/image-based. Text could not be extracted for AI processing." |
| failed | Error | "Processing failed. Please try uploading again." |

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| pdf-parse fails on some PDFs | Can't process certain uploads | Medium | Catch errors, mark as 'failed', user can re-upload |
| Embedding API rate limits during batch | Processing stalls | Medium | Sequential calls with delays, retry logic |
| Background function timeout (>15 min) | Very large PDFs fail | Low | Limit file size to 50MB, warn user |
| S3 download fails in background function | Can't access uploaded file | Low | Retry with backoff, mark as 'failed' |
| Status polling creates excessive queries | Supabase quota usage | Low | 3s interval is fine, stop polling after status resolves |

## Recommended Plan Breakdown

The original 3-plan structure from the roadmap is good but needs minor adjustment:

### Plan 02-01: Schema Updates + PDF Extraction + Chunking
**Scope**: Database migration for status/metadata columns, `pdf-parse` integration, text chunker utility, scanned PDF detection
**Files**: New migration SQL, `src/lib/ai/chunker.ts`, `src/lib/ai/pdf-extract.ts` (or combined), tests
**Why grouped**: These are pure utilities with no side effects — can be fully unit tested

### Plan 02-02: Processing Pipeline + Embedding Storage
**Scope**: `process-document.mts` (sync function), `process-document-background.mts` (background function), embedding batch logic, status updates, `match_documents_filtered` RPC
**Files**: Two Netlify functions, migration for enhanced RPC, tests
**Why grouped**: The core pipeline — depends on 02-01 utilities

### Plan 02-03: Frontend Integration + Status Display
**Scope**: Update `FileUpload.tsx` to trigger processing, update `UploadDocs.tsx` to show status from Supabase, polling hook, status messages, `netlify.toml` redirects
**Files**: Modified components/pages, new hook, CSS updates
**Why grouped**: All frontend changes — depends on 02-02 backend being available

This matches the original roadmap structure. The split is clean: utilities → backend pipeline → frontend wiring.

## Environment Variables Needed

Phase 2 requires these env vars (some already used by Phase 1):

| Variable | Used By | New? |
|----------|---------|------|
| `SUPABASE_URL` | process-document functions | Exists (Phase 1) |
| `SUPABASE_SERVICE_ROLE_KEY` | process-document functions | Exists (Phase 1) |
| `NVIDIA_NIM_API_KEY` | embedding calls in pipeline | Exists (Phase 1) |
| `UTHO_ENDPOINT` | downloading PDF from S3 | Exists (pre-Phase 1) |
| `UTHO_ACCESS_KEY` | downloading PDF from S3 | Exists (pre-Phase 1) |
| `UTHO_SECRET_KEY` | downloading PDF from S3 | Exists (pre-Phase 1) |
| `UTHO_BUCKET_NAME` | downloading PDF from S3 | Exists (pre-Phase 1) |

No new env vars needed for Phase 2.

## Dependencies to Install

| Package | Purpose | Size |
|---------|---------|------|
| `pdf-parse` | PDF text extraction | ~25KB (+pdf.js) |

No other new dependencies needed. The existing embedding client, Supabase client, and S3 SDK cover everything else.

## File Structure After Phase 2

```
moduly-ai-landing/
  src/lib/ai/
    chunker.ts              NEW — text chunking utility
    chunker.test.ts         NEW — chunker tests
    pdf-extract.ts          NEW — PDF text extraction wrapper
    pdf-extract.test.ts     NEW — PDF extraction tests
    embedding.ts            EXISTING — used by pipeline
    supabase-server.ts      EXISTING — used by pipeline
    types.ts                EXISTING — may add ProcessingStatus type
  netlify/functions/
    process-document.mts    NEW — sync function (create doc row, trigger bg)
    process-document-background.mts  NEW — background function (extract, chunk, embed, store)
    get-upload-url.mjs      EXISTING — unchanged
    list-files.mjs          EXISTING — may deprecate in favor of Supabase query
  supabase/migrations/
    005_add_document_status.sql      NEW — status, chunk_count, file_size, updated_at
    006_match_documents_filtered.sql NEW — enhanced RPC with metadata filtering
  src/components/
    FileUpload.tsx          MODIFIED — trigger processing after upload
  src/pages/
    UploadDocs.tsx          MODIFIED — show status from Supabase, polling
```

---
*Research completed: 2026-03-16*
*Ready for plan creation*
