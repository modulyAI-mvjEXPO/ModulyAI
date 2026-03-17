# Plan 02-01 Summary: Schema Extensions + Types + Chunker + PDF Extraction

**Status**: Complete
**Duration**: ~45 minutes (across multiple sessions)

## What Was Done

### SQL Migration 005 (`supabase/migrations/005_add_document_status.sql`)
- Adds `status text NOT NULL DEFAULT 'processing'` to documents table
- Adds `chunk_count integer DEFAULT 0`, `file_size bigint`, `updated_at timestamptz`
- Adds CHECK constraint for valid status values: `processing`, `ready`, `failed`, `no_text`
- Adds UPDATE RLS policy for authenticated users on own documents

### SQL Migration 006 (`supabase/migrations/006_match_documents_filtered.sql`)
- Creates `match_documents_filtered` RPC with `filter_document_ids` and `filter_subject_id` parameters
- JOINs `document_chunks` with `documents` table to filter by subject
- Only returns chunks from documents with `status = 'ready'`
- Preserves existing `match_documents` RPC (no breaking change)

### Document Processing Types (`src/lib/ai/types.ts`)
- `DocumentStatus` union: `'processing' | 'ready' | 'failed' | 'no_text'`
- `TextChunk` type: `{ readonly content: string; readonly chunkIndex: number }`
- `PdfExtractionResult` type: `{ readonly text: string; readonly pageCount: number; readonly isScanned: boolean }`

### Text Chunker (`src/lib/ai/chunker.ts`)
- Exports `chunkText(text, options?)` — pure function, no side effects
- Sentence-boundary-aware splitting (`.`, `!`, `?` followed by space/newline)
- Falls back to word boundaries, then hard split
- Overlapping chunks for context continuity (default: 500 chars, 50 overlap)
- Whitespace normalization, minimum chunk length filtering (20 chars)

### Chunker Tests (`src/lib/ai/chunker.test.ts`) — 10 tests
1. Splits text into chunks of approximately chunkSize characters
2. Creates overlapping chunks
3. Prefers splitting at sentence boundaries
4. Falls back to word boundaries when no sentence boundary
5. Normalizes whitespace
6. Skips chunks shorter than 20 chars
7. Returns empty array for empty/whitespace-only input
8. Returns single chunk for text shorter than chunkSize
9. Assigns sequential chunkIndex starting from 0
10. Uses default values (500 chars, 50 overlap) when no options provided

### PDF Extraction (`src/lib/ai/pdf-extract.ts`)
- Exports `extractPdfText(buffer: Buffer): Promise<PdfExtractionResult>`
- Uses pdf-parse v2 API: `new PDFParse({ data })` → `.getText()` → `.destroy()`
- Converts Buffer to Uint8Array for v2 compatibility
- Scanned PDF detection: text < 50 chars → `isScanned: true`
- Proper cleanup via `finally` block (always calls `destroy()`)
- Descriptive error wrapping on failure

### PDF Extraction Tests (`src/lib/ai/pdf-extract.test.ts`) — 9 tests
1. Returns text content from a valid PDF buffer
2. Constructs PDFParse with data as Uint8Array
3. Returns pageCount from TextResult.total
4. Marks isScanned=true when extracted text is < 50 chars
5. Marks isScanned=false when extracted text is >= 50 chars
6. Throws descriptive error when getText fails
7. Trims the extracted text
8. Calls destroy after successful extraction
9. Calls destroy even when getText throws

## Verification
- All 34 tests pass (`npx vitest run`) — 15 original + 10 chunker + 9 pdf-extract
- TypeScript compiles clean (`tsc --noEmit`)
- No `any` types in any file
- All type imports use `import type` syntax
- pdf-parse v2.4.5 listed in package.json dependencies

## Deviations

### pdf-parse v2 API (vs Plan)
The plan assumed pdf-parse v1 API (default export, function call). The installed v2.4.5 has a completely different class-based API:
- **Plan**: `import pdfParse from 'pdf-parse'` → `pdfParse(buffer)`
- **Actual**: `import { PDFParse } from 'pdf-parse'` → `new PDFParse({ data })` → `.getText()`
- v2 returns `TextResult` with `.text` and `.total` (not `.numpages`)
- v2 requires explicit `.destroy()` cleanup
- `@types/pdf-parse` (v1 types) was installed then removed due to conflicts

### Additional tests (9 vs 6 planned)
Added 3 extra tests beyond the plan's 6 to cover the v2 API properly:
- Constructor receives data as Uint8Array
- destroy() called after success
- destroy() called even on error (finally block)

## Manual Step Required
Migrations 005 and 006 must be applied via the Supabase Dashboard SQL editor before executing Plan 02-02.
