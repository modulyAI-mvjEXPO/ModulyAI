# Phase 7 Research: Community Library

**Date:** 2026-03-17
**Requirements:** LIB-01, LIB-02, LIB-03

---

## What Exists

### Library.tsx (330 lines)
- Entirely mock data — `ALL_DOCS` hardcoded array of 8 objects
- Has: subject filter, module filter, doc type filter, search, pagination (PAGE_SIZE=4)
- `export function Library()` — **no user prop at all**
- Mock fields: `id`, `title`, `size`, `date`, `subject`, `module`, `contributor`, `type`, `typeColor`, `icon`, `iconBgVar`, `contributorColorVar`
- Filter dropdowns built from static `SUBJECTS`, `MODULES`, `DOC_TYPES` arrays

### Dashboard.tsx (line 213)
```tsx
{activePage === 'library' && <Library />}
```
- `user` is in scope (the Dashboard has `user: User` prop) but not passed to Library

### documents table (from migrations 002 + 005)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.users |
| title | text | doc title |
| file_path | text | storage path |
| file_type | text | MIME type (e.g. application/pdf) |
| subject_id | uuid | nullable |
| module_id | uuid | nullable |
| created_at | timestamptz | |
| status | text | processing/ready/failed/no_text |
| chunk_count | integer | |
| file_size | bigint | nullable |
| updated_at | timestamptz | |

**No `document_type` column exists** (Notes/PYQ/etc.). No `contributor_name` column either.

### RLS policies (migration 002)
- SELECT: `auth.uid() = user_id` — **users can only see their own docs!**
- No public-browse policy exists yet

### DocumentRow type (types.ts line 85–98)
All DB columns are typed. No `document_type` field.

### UploadDocs.tsx pattern
- Uses `supabase.auth.getUser()` in `useEffect` to get userId
- Then `supabase.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false })`
- Demonstrates the client-side Supabase query pattern

---

## Key Design Decisions Needed

### Decision 1: Public vs User-Only Library (LIB-01)

**Context:** Current RLS only allows users to see their own docs. Community library means browsing all users' docs.

**Options:**
1. Add a new RLS policy: `SELECT` allowed for `status = 'ready'` (all authenticated users can see all ready docs)
2. Use a Netlify function as proxy to bypass RLS with service-role key

**Decision: Option 1 — add a public-read RLS policy.**
- Simpler: no new function needed
- Correct behavior: library shows all ready docs
- SQL migration needed: migration 007

### Decision 2: Subject/Module Filtering Without subject_id/module_id FKs

**Context:** `subject_id` and `module_id` are UUIDs referencing tables we don't have (no `subjects` table in migrations). In practice they are `null` for most/all uploaded documents.

**Options:**
1. Filter by subject/module inferred from title keywords
2. Drop subject/module filters from Library (only keep doc type + search)
3. Add subject/module as text columns to documents

**Decision: Keep subject/module filters as UI dropdowns but filter client-side by title keywords** (same approach as mock). For demo purposes this is fine — uploaded docs have descriptive titles. The dropdowns remain but filter on title text match. Subject filter = check if `title.toLowerCase()` contains the subject keyword. This is fast, zero DB changes, consistent with demo expectations.

### Decision 3: Document Type (LIB-02)

**Context:** No `document_type` column. The mock used types: Notes, AI Summary, PYQ, Mind Map.

**Options:**
1. Infer from title keywords (e.g. "question paper", "pyq" → PYQ; "notes" → Notes)
2. Add a `document_type` text column + migration
3. Infer from `file_type` MIME (pdf=Notes, etc. — not useful)

**Decision: Add `document_type` text column via migration 007, populated by existing docs as null, editable on upload (future), defaulting to 'notes' for new uploads. For Library display, null → infer from title keywords as fallback. This satisfies LIB-02 cleanly.**

Actually, re-evaluate: for demo simplicity, **infer from title keywords only** (no migration). This avoids changing UploadDocs flow. Can be added to migration 007 later if needed.

**Final decision: Infer document_type from title keywords client-side.** Zero extra migration.

### Decision 4: Contributor Name

**Context:** Mock shows "Sarah J.", "Moduly AI", "Admin". Real docs only have `user_id`. No display_name in documents table.

**Options:**
1. Show "VTU Student" for all contributors (anonymous)
2. Join with auth.users (not possible client-side without service key)
3. Show first 6 chars of user_id as contributor ID
4. Show "Community" for all

**Decision: Show "VTU Student" for all contributors** — appropriate for a student community library demo.

### Decision 5: user prop for Library

**Context:** LIB-03 needs to know who is requesting removal. Dashboard has `user` in scope but doesn't pass it.

**Decision: Add `user: User` prop to Library component.** Update Dashboard.tsx to pass `user={user}`. Same pattern as StudyMode and ExamMode.

### Decision 6: Removal Request (LIB-03)

**Context:** User can request removal of a document they uploaded.

**Options:**
1. New Supabase table `removal_requests` (id, document_id, user_id, reason, created_at) + migration
2. Netlify function that deletes directly if `auth.uid() = doc.user_id` (uses existing DELETE policy)
3. A simple `flag` column on documents + client-side update

**Decision: New `removal_requests` table** (migration 007). Reason: documents shouldn't be auto-deleted — admin reviews removal requests. RLS: authenticated users can insert their own requests, nobody can read others'. A Netlify function `request-removal.mts` handles the insert using service-role key to bypass RLS and validate ownership.

Actually simpler: use client-side Supabase with the RLS insert policy. No Netlify function needed.

**Final decision: Client-side insert into `removal_requests` table with RLS (user can insert their own requests).** Button only visible when `doc.user_id === user.id`. Migration 007 adds both the public-read policy and removal_requests table.

---

## Implementation Plan

### Migration 007 adds:
1. RLS policy: authenticated users can SELECT all `ready` documents (community browse)
2. New `removal_requests` table with RLS

### Library.tsx changes:
1. Add `user: User` prop
2. Remove `ALL_DOCS` mock
3. `useEffect` + `supabase.from('documents').select('*').eq('status', 'ready').order('created_at', { ascending: false })`
4. Client-side filtering: subject by title keyword, module by title keyword, docType by title keyword inference
5. Derive display fields from `DocumentRow`: title, size (formatSize), date (formatDate), contributor ("VTU Student"), type (inferDocType), icon/colors
6. Show "Request Removal" button only when `doc.user_id === user.id`
7. Removal: `supabase.from('removal_requests').insert({ document_id, user_id, created_at })`
8. Loading/empty/error states

### Dashboard.tsx change:
- Line 213: `<Library />` → `<Library user={user} />`

---

## File Change Summary

| File | Change |
|---|---|
| `supabase/migrations/007_community_library.sql` | **NEW** — public-read RLS + removal_requests table |
| `src/pages/Library.tsx` | **REWRITE** — real Supabase data, user prop, removal |
| `src/pages/Dashboard.tsx` | **MODIFY** — pass user prop to Library |

No new Netlify function needed.

---

## Risks / Notes

- `subjects` table does not exist — subject filtering must be title-based, not FK-based
- Pagination stays at PAGE_SIZE=4 (adequate for demo)
- Library CSS stays as-is (no changes needed)
- DOC_TYPES: reduce to 'Any Type', 'Notes', 'PYQ', 'Mind Map' (drop 'AI Summary' — not meaningfully inferred)
- If zero ready docs exist in DB, show empty state (not a bug)
- `import type { User } from '@supabase/supabase-js'` needed in Library.tsx
