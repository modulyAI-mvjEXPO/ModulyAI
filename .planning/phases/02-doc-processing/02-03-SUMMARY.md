# Plan 02-03 Summary: Frontend Integration

**Status**: Complete
**Duration**: ~25 minutes

## What Was Done

### Task 1: DocumentRow type (`src/lib/ai/types.ts`)
- Added `DocumentRow` type with all 12 columns from the `documents` table
- Uses `readonly` properties and references existing `DocumentStatus` union type
- Placed after `PdfExtractionResult` as specified

### Task 2: FileUpload.tsx — Processing trigger + UI rewrite
- Added `userId` prop to `FileUploadProps`
- Added optional `documentId` field to `UploadedFile` interface
- Added Step 3 in `handleUpload`: calls `POST /process-document` after S3 upload (non-blocking)
- Status set to `'Processing'` when documentId available, `'Cloud'` otherwise
- **UI improvement**: Rewrote JSX to use existing CSS dropzone classes (`.ud-dropzone`, `.ud-dropzone-icon`, `.ud-dropzone-content`, `.ud-file-input`, `.ud-submit-btn`) instead of ugly inline styles
- Added drag-and-drop support with `dragActive` state and event handlers (`handleDragOver`, `handleDragLeave`, `handleDrop`)

### Task 3: UploadDocs.tsx — Supabase-driven document list
- Fetches from Supabase `documents` table instead of S3 `list-files` endpoint
- Gets user via `supabase.auth.getUser()`
- Status polling every 3s for processing documents (auto-stops when none processing)
- `STATUS_DISPLAY` config maps each `DocumentStatus` to label/icon/badgeClass/message
- Auth guard: FileUpload only renders when `userId` is available
- Removed `handleRemove` and delete buttons (deferred to Phase 7 / LIB-03)
- Removed `getFileMeta` helper (replaced with simpler `getFileIcon` using `file_type` from DB)
- Shows chunk count for ready documents, explanatory messages for failed/no_text

### Task 4: UploadDocs.css — Status badges + UI styles
**From plan:**
- `ud-badge--ready` (green), `ud-badge--failed` (red), `ud-badge--no-text` (amber)
- `ud-badge-icon` base styling for icon sizing
- Processing spinner animation (`@keyframes ud-spin` on `.ud-badge--processing .ud-badge-icon`)
- `ud-item-status-msg` for failed/no_text explanatory text
- `:has(.ud-badge--no-text)` for amber-colored status messages

**Additional (from UI improvements in Tasks 2 & 3):**
- `ud-dropzone--active` for drag-over visual feedback (glow + scale)
- `ud-submit-btn:disabled` for disabled button state
- `ud-upload-msg`, `ud-upload-msg--error`, `ud-upload-msg--success` for upload feedback messages
- `ud-list-msg`, `ud-list-msg--error` for loading/error/empty state messages
- `ud-auth-msg` for the sign-in prompt

## Architecture

```
User drags/clicks to upload file
    ↓
FileUpload.tsx
    ↓ Step 1: GET /get-upload-url (pre-signed URL)
    ↓ Step 2: PUT to Utho S3
    ↓ Step 3: POST /process-document (non-blocking)
    ↓ Returns UploadedFile to parent
    ↓
UploadDocs.tsx
    ↓ fetchDocuments() — queries Supabase documents table
    ↓ STATUS_DISPLAY maps status → badge/icon/message
    ↓ pollingRef — polls every 3s when any doc is 'processing'
    ↓ Auto-stops polling when all resolved
```

## Verification
- TypeScript compiles clean across all 3 tsconfigs (`npx tsc -b --noEmit`)
- CSS file contains all required badge classes: `ud-badge--ready`, `ud-badge--failed`, `ud-badge--no-text`
- Processing spinner animation works via `@keyframes ud-spin`
- All 4 statuses display with appropriate icons: `hourglass_top` (processing), `check_circle` (ready), `error` (failed), `image_not_supported` (no_text)
- Failed and no_text statuses show user-friendly messages (RAG-07)
- Polling stops when no documents are in 'processing' status
- No `any` types (one `as ReadonlyArray<DocumentRow>` cast on Supabase response)
- All type imports use `import type` syntax

## Deviations

### FileUpload UI rewrite (beyond plan scope)
The plan specified adding `userId` prop and `/process-document` call only. The component was rewritten to use existing CSS dropzone classes and add drag-and-drop support. The old component used inline styles (`style={{ padding: '20px', border: '1px solid #ccc' }}`) with a basic `<input type="file">` — the rewrite uses the beautiful dark-themed styles already defined in `UploadDocs.css`. User explicitly requested UI improvements during integration.

### Extra CSS classes (beyond plan scope)
Task 4 added styles for classes introduced by the UI improvements in Tasks 2 & 3: dropzone active state, submit button disabled state, upload/list/auth messages. These were not in the original plan but were necessary for the improved components.

### Removed S3 list-files usage
The plan mentioned keeping `BACKEND` const for backwards compatibility. Since `UploadDocs.tsx` no longer calls `list-files` at all (fully Supabase-driven), the `BACKEND` const was removed entirely. FileUpload still uses `import.meta.env.VITE_BACKEND_URL` internally for S3 upload and process-document calls.

## Files Modified
- `src/lib/ai/types.ts` — **MODIFIED** (added DocumentRow type)
- `src/components/FileUpload.tsx` — **MODIFIED** (userId prop, process-document call, drag-drop UI)
- `src/pages/UploadDocs.tsx` — **MODIFIED** (full rewrite: Supabase queries, status polling, auth guard)
- `src/pages/UploadDocs.css` — **MODIFIED** (added ~110 lines: badges, spinner, dropzone-active, messages)

## Success Criteria Met
- ✅ FileUpload triggers document processing after S3 upload (RAG-06 frontend trigger)
- ✅ Document list sourced from Supabase with real status data (RAG-06 display)
- ✅ Processing status visible with animated spinner indicator (RAG-06 visual feedback)
- ✅ Ready status shows chunk count for user confirmation (RAG-06)
- ✅ Failed status shows error message guiding the user (RAG-07)
- ✅ No-text status shows clear explanation about scanned PDFs (RAG-07)
- ✅ Status polling automatically refreshes until processing completes (RAG-06 real-time feedback)
- ✅ TypeScript strict compilation passes

## Manual Step Required
Migrations 005 and 006 must be applied via the Supabase Dashboard SQL editor before deploying (if not already done during 02-01/02-02).
