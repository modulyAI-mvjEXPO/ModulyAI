# Phase 4 Plan 04-02 Summary: VTU Curriculum Awareness

**Executed:** 2026-03-16
**Duration:** ~15 minutes
**Status:** Complete — TypeScript clean, all tasks done

---

## What Was Done

### Task 1 — SUBJECT_PROFILES + extended buildSystemPrompt (`chat.mts`)

Added `SubjectProfile` type and `SUBJECT_PROFILES` constant with entries for 3 demo subjects:

| Key | Subject |
|-----|---------|
| `data-structures` | Data Structures and Algorithms |
| `computer-networks` | Computer Networks |
| `dbms` | Database Management Systems |

Each profile has: `name`, `modules[]` (5 VTU modules), `examPattern`, `highFrequencyTopics[]`.

Extended `buildSystemPrompt` with a 4th parameter `subjectId?: string`. When `subjectId` matches a known profile, a `curriculumSection` block is injected into the system prompt containing the subject name, numbered module list, exam pattern, and high-frequency topics.

Updated the `buildSystemPrompt` call at the bottom of the handler to pass `request.subjectId`.

### Task 2 — Dynamic topics + subjectId state (`StudyMode.tsx`)

- Removed static `INITIAL_TOPICS` constant
- Added `SUBJECT_TOPIC_MAP`-style logic via `getTopicsForSubject(subjectId: string): TopicItem[]` — returns 5 subject-specific topics (first 2 active) for each of the 3 known subjects, and a 4-item generic fallback for empty/unknown subjects
- Added `subjectId` state: `useState('')`
- Changed topics init: `useState<TopicItem[]>(() => getTopicsForSubject(''))`
- Added `useEffect` to reset topics when `subjectId` changes

### Task 3 — Subject selector UI (`StudyMode.tsx` + `StudyMode.css`)

Added a `<section className="sm-section">` containing a `<select className="sm-subject-select">` to the Study Kit sidebar, placed between the Source Docs section and the Active Topics section. Options: General (default), Data Structures & Algorithms, Computer Networks, Database Management Systems.

Added `sm-subject-select` CSS class: full-width styled select with custom SVG chevron, dark/light mode variants, hover border, and focus ring.

### Task 4 — Wire subjectId end-to-end (`StudyMode.tsx`)

- Added `subjectId: string | undefined` param to `chatWithAI` (inserted before `history`)
- Added `subjectId: subjectId || undefined` to POST `/chat` body
- Updated `sendMessage` call: passes `subjectId || undefined` before `history`
- Added `subjectId` to `useCallback` dependency array

---

## Files Modified

| File | Change |
|------|--------|
| `netlify/functions/chat.mts` | Added `SubjectProfile` type, `SUBJECT_PROFILES` constant, extended `buildSystemPrompt` with `subjectId` param and curriculum injection |
| `src/pages/StudyMode.tsx` | Replaced `INITIAL_TOPICS` with `getTopicsForSubject`, added `subjectId` state, subject selector UI, wired `subjectId` through `chatWithAI` |
| `src/pages/StudyMode.css` | Added `sm-subject-select` class (dark/light variants) |

---

## Requirements Satisfied

- ✅ STUDY-05: AI responses for demo subjects include VTU module structure, exam pattern, and high-frequency topic hints via system prompt curriculum injection

---

## Phase 4 Completion

Both Phase 4 plans are now complete. All Phase 4 success criteria satisfied:
- ✅ Study Kit document selection and RAG filtering (04-01)
- ✅ Mark-calibrated answer depth 2M/5M/8M/10M (04-01)
- ✅ VTU curriculum awareness for DSA, CN, DBMS (04-02)

---

## Next Step

Phase 4 complete. Choose next phase from: 5 (Exam Mode), 6 (PYQ Intelligence), 7 (Community Library) — all independent of each other.
