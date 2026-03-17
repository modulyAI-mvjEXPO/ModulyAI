# Phase 4 Plan 04-01 Summary: Mark Calibration + Study Kit Polish

**Executed:** 2026-03-16
**Duration:** ~15 minutes
**Status:** Complete — TypeScript clean, all tasks done

---

## What Was Done

### Task 1 — Mark Calibration (`chat.mts`)

Added `MARK_INSTRUCTIONS` constant (a `Readonly<Record<string, string>>` map) with per-mark prompts:

| Mark | Instruction |
|------|-------------|
| 2M   | 2–3 concise sentences, core definition only |
| 5M   | 1–2 paragraphs + one concrete example |
| 8M   | Structured: intro + sub-points + 1-2 examples + conclusion |
| 10M  | Comprehensive: essay-style, headings, multiple examples, comparison table, conclusion |

Replaced the generic mark instruction in `buildSystemPrompt` with lookup from this map.

Also added `5M` to `MARKS` array in `StudyMode.tsx` — was `['2M', '8M', '10M']`, now `['2M', '5M', '8M', '10M']`.

### Task 2 — Study Kit UX (`StudyMode.tsx`)

- `+ Add` button now calls `navigate('/upload-docs')` via `useNavigate` (added import)
- Added **All** and **None** text buttons beside `+ Add` in the Source Docs header (only shown when docs exist)
- New helpers: `selectAllDocs()` and `selectNoneDocs()` toggle all doc `selected` flags immutably

### Task 3 — Zero-Docs Warning (`StudyMode.tsx` + `StudyMode.css`)

- When `docs.length > 0` and `selectedDocs.length === 0`, a warning chip appears in the footer:
  `⚠ No docs selected — using general knowledge`
- CSS class `sm-chip--warn`: red/rose colour, light/dark variants, `max-width: none` to show full text
- CSS classes `sm-section-actions` + `sm-text-btn` for the All/None button row

---

## Files Modified

| File | Change |
|------|--------|
| `netlify/functions/chat.mts` | Added `MARK_INSTRUCTIONS` map, updated `buildSystemPrompt` |
| `src/pages/StudyMode.tsx` | `useNavigate` import, `5M` in MARKS, `navigate('/upload-docs')`, All/None toggles, warn chip |
| `src/pages/StudyMode.css` | `sm-chip--warn`, `sm-section-actions`, `sm-text-btn` |

---

## Requirements Satisfied

- ✅ STUDY-04: AI answers calibrated to 2M / 5M / 8M / 10M mark allocation
- ✅ STUDY-03 (partial): `+ Add` navigates to upload page; All/None toggles improve doc selection UX
- ✅ Zero-docs warning: user informed when no docs are context-filtering the AI

---

## Next Step

Execute **04-02** — VTU Curriculum Awareness (STUDY-05):
- Add `SUBJECT_PROFILES` map to `chat.mts` for 3 demo subjects (DSA, CN, DBMS)
- Extend `buildSystemPrompt` to inject curriculum section when `subjectId` matches
- Add subject selector `<select>` in `StudyMode.tsx` sidebar
- Replace `INITIAL_TOPICS` with `getTopicsForSubject(subjectId)` dynamic function
- Pass `subjectId` through `chatWithAI` → `/chat`
