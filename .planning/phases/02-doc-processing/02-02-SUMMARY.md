# Plan 02-02 Summary: Processing Pipeline (Sync + Background Functions)

**Status**: Complete
**Duration**: ~20 minutes

## What Was Done

### Sync Function (`netlify/functions/process-document.mts`)
- Accepts POST only (405 for other methods)
- Validates required fields: `title`, `filePath`, `fileType`, `userId` (400 with descriptive error if missing)
- Optional fields: `subjectId`, `moduleId`, `fileSize`
- Creates document row in Supabase with `status='processing'` via `createServerSupabaseClient()`
- Triggers background function via fire-and-forget `fetch()` (not awaited)
- Uses `process.env.URL` / `DEPLOY_URL` / localhost fallback for base URL
- Returns 202 Accepted with `{ documentId }`
- Full error handling: 400, 405, 500 with descriptive messages
- CORS headers on all responses

### Background Function (`netlify/functions/process-document-background.mts`)
- Filename ends with `-background` for Netlify's 15-minute timeout
- Receives `{ documentId, filePath }` from sync function
- Downloads PDF from Utho S3 via `GetObjectCommand` + `transformToByteArray()`
- Extracts text via `extractPdfText()` (Phase 1 deliverable)
- Detects scanned PDFs (`isScanned`) → sets `status='no_text'` and returns early
- Chunks text via `chunkText()` with default options (500 chars, 50 overlap)
- Embeds each chunk sequentially via `getEmbedding()` (NVIDIA NIM)
- Stores chunks in `document_chunks` with metadata: `{ chunk_index, page_count }`
- Updates document `status='ready'` with `chunk_count` on success
- Updates document `status='failed'` on any error (with nested try-catch for status update)
- Always returns `{ statusCode: 200 }` (status tracked in DB, not HTTP response)
- Comprehensive console logging for debugging

### Netlify Redirects (`netlify.toml`)
- Added `/process-document` → `/.netlify/functions/process-document`
- Added `/process-document-background` → `/.netlify/functions/process-document-background`
- Existing redirects (get-upload-url, list-files) preserved

### TypeScript Build Infrastructure (`tsconfig.functions.json`)
- Created `tsconfig.functions.json` for Netlify function type-checking
- Includes `netlify/functions` and `src/lib/ai` (for imports)
- Excludes `**/*.test.ts` to avoid DOM type conflicts
- Node.js types only (no DOM), ES2022 target, strict mode
- Added as reference in root `tsconfig.json`

## Architecture

```
Frontend → POST /process-document
              ↓
         process-document.mts (sync, 10s limit)
              ↓ insert document row (status='processing')
              ↓ fire-and-forget fetch
              ↓ return 202 { documentId }
              ↓
         process-document-background.mts (async, 15-min limit)
              ↓ download PDF from S3
              ↓ extractPdfText()
              ↓ chunkText()
              ↓ for each chunk: getEmbedding() → insert document_chunks
              ↓ update document status='ready'
```

## Verification
- All 34 tests pass (`npx vitest run`) — no new tests for this plan (server functions)
- TypeScript compiles clean across all 3 tsconfigs (`tsc -b --noEmit`)
- Both function files exist and contain handler exports
- netlify.toml contains all 4 redirects
- No `any` types (one `as unknown as string` for pgvector embedding cast)
- All type imports use `import type` syntax
- Proper error handling at every stage

## Deviations

### Added tsconfig.functions.json (not in plan)
The plan didn't account for TypeScript compilation of `.mts` files — no existing tsconfig covered `netlify/functions/`. Created `tsconfig.functions.json` with Node.js types and added it as a project reference so `tsc -b` checks the functions.

### No unit tests for server functions
These functions are integration-heavy (S3 + Supabase + NVIDIA NIM) and are tested via manual/E2E testing on Netlify. The plan did not specify TDD for these tasks (`tdd="true"` was not set on tasks 1-3). All composable logic (chunker, pdf-extract, embedding) has full test coverage from 02-01.

## Files Created/Modified
- `netlify/functions/process-document.mts` — **CREATED** (107 lines)
- `netlify/functions/process-document-background.mts` — **CREATED** (134 lines)
- `netlify.toml` — **MODIFIED** (added 2 redirects)
- `tsconfig.functions.json` — **CREATED** (functions build config)
- `tsconfig.json` — **MODIFIED** (added functions reference)

## Manual Step Required
Migrations 005 and 006 must be applied via the Supabase Dashboard SQL editor before deploying these functions (if not already done during 02-01).
