# Phase 7 — Plan 07-01 Summary: Community Library

**Date:** 2026-03-17
**Duration:** ~30 min
**Status:** Complete

---

## Goal

Replace Library.tsx's hardcoded mock data with real Supabase queries, add user-aware doc management (removal requests), and expose the library to authenticated users through Dashboard.tsx.

---

## What Was Done

### Files Created
- `supabase/migrations/007_community_library.sql` — Two SQL objects:
  1. Public-read RLS policy on `documents` for `status = 'ready'` rows (allows non-owner reads)
  2. `removal_requests` table with `id`, `document_id` (FK), `requested_by`, `reason`, `created_at`

### Files Rewritten / Modified
- `src/pages/Library.tsx` — **Rewritten** from mock data to real Supabase integration:
  - Accepts `user: User` prop (passed from Dashboard)
  - Queries `documents` table for `status = 'ready'` rows via Supabase client
  - Client-side filtering: subject/module inferred from title keywords via `inferSubject()` / `inferModule()`
  - Client-side docType inference via `inferDocType()` (no new DB column needed)
  - Search/filter state (subject, module, docType, searchQuery)
  - Loading, error, and empty states
  - "Remove" button visible only to the document's uploader; inserts a row into `removal_requests`
  - Pagination logic retained

- `src/pages/Library.css` — **Appended** `lib-remove-btn` styles (red/warning tone, hover, disabled, dark-mode variants)

- `src/pages/Dashboard.tsx` — **Updated** line 213: `<Library />` → `<Library user={user} />`

---

## TypeScript Checks

- `npx tsc --noEmit` — ✅ clean
- `npx tsc -p tsconfig.functions.json --noEmit` — ✅ clean

---

## Requirements Satisfied

- ✅ **LIB-01**: Library page shows real documents from Supabase (not mock data)
- ✅ **LIB-02**: User can filter by subject, module, and document type
- ✅ **LIB-03**: User can request removal of their own documents (recorded in `removal_requests`)

---

## Pending (manual / out-of-band)

- **Migration 007 must be applied manually via Supabase Dashboard** (SQL file is at `supabase/migrations/007_community_library.sql`).  
  Until applied: public-read for other users' docs will not work; `removal_requests` insert will fail with "relation does not exist".

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| No `document_type` column added | Avoids touching upload flow; keyword inference is sufficient for demo |
| Subject/module from title keywords | `subjects`/`modules` FK tables don't exist; keyword inference matches demo data naming |
| `removal_requests` table (not soft-delete) | Keeps data integrity; admin reviews via Supabase dashboard |
| `lib-remove-btn` CSS appended (not new file) | Single-CSS-per-page convention maintained |
| Phase delivered as 1 plan (not 2) | Library rewrite + migration + CSS were tightly coupled; splitting would add no value |

---

## Next

Phase 8: Demo Hardening (DEMO-01 through DEMO-05)
