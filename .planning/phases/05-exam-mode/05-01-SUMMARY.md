# Phase 5 Plan 05-01 Summary: Exam Mode — PYQ Single Question Solve

**Executed:** 2026-03-16
**Duration:** ~20 minutes
**Status:** Complete — TypeScript clean (both tsconfigs), all tasks done

---

## What Was Done

### Task 1 — New types in `types.ts`

Added two new exported types at the end of `src/lib/ai/types.ts`:

- `ExamRequest`: `{ readonly question: string; readonly mark: string; readonly documentIds?: readonly string[]; readonly subjectId?: string }`
- `ExamResponse`: `{ readonly answer: string; readonly sources: readonly RagChunk[] }`

### Task 2 — `exam-solve.mts` Netlify function (~165 lines)

Created `netlify/functions/exam-solve.mts` — a single-shot (no history) exam answer endpoint:

- `MARK_INSTRUCTIONS` map for 2M / 5M / 10M / 15M (exam-specific; differs from chat.mts which uses 2M/5M/8M/10M)
- `SUBJECT_PROFILES` duplicated inline (same 3 subjects: DSA, CN, DBMS)
- `buildExamSystemPrompt(chunks, mark, subjectId?)` — injects context, mark instructions, and optional curriculum section
  - Persona: "Moduly AI Exam Engine"
  - Instruction style: exam-ready answer generation with VTU formatting and "Marking Scheme:" section hints
- Handler: validates POST, extracts `question` + `mark` + `documentIds?` + `subjectId?`
- Pipeline: `getEmbedding(question)` → `match_documents_filtered` RPC → `chatCompletion` (no stream, `max_tokens: 3000`)
- Returns: `{ answer, sources }`

### Task 3 — `netlify.toml` redirect

Added `/exam-solve` → `/.netlify/functions/exam-solve` redirect. Total redirects now: 6.

### Task 4 — `ExamMode.tsx` real AI integration

Rewrote `src/pages/ExamMode.tsx` to call the real `/exam-solve` endpoint:

- Removed `generateResponse()` mock function
- Added `import type { ExamRequest, ExamResponse }` from `../lib/ai/types`
- Added `renderMarkdown(md: string): string` — inline regex-based markdown → HTML (bold, inline code, headers, lists, line breaks)
- Added `buildAnswerHtml(markdown: string, mark: string): string` — wraps rendered HTML in `.em-ai-output` shell with mark badge
- Added `solveWithAI(question: string, mark: string): Promise<string>` — async fetch to `/exam-solve`, validates response, builds HTML
- `sendMessage` converted to `async useCallback`; uses `void sendMessage()` in JSX event handlers
- Error handling: catch block builds an error HTML string via `buildAnswerHtml` and appends as AI message
- All JSX structure, mock upload panel, mock analysis report panel — preserved unchanged

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/ai/types.ts` | Added `ExamRequest` and `ExamResponse` types |
| `netlify/functions/exam-solve.mts` | **CREATED** (~165 lines, single-shot exam answer function) |
| `netlify.toml` | Added `/exam-solve` redirect (now 6 redirects) |
| `src/pages/ExamMode.tsx` | **REWRITTEN** (~270 lines; mock removed, real AI wired) |

---

## Key Decisions

- **No markdown library**: Simple `renderMarkdown()` regex function inline — avoids dependency for this use case
- **No progressive reveal**: Exam answers appear all at once (vs StudyMode's typing animation) — appropriate for single-shot Q&A
- **`max_tokens: 3000`** for exam answers (vs 2048 in chat.mts) — exam answers are longer and structured
- **ExamMode marks**: `['2M', '5M', '10M', '15M']` (exam paper pattern); StudyMode uses `['2M', '5M', '8M', '10M']`
- **`void sendMessage()`** pattern in event handlers — satisfies TypeScript no-floating-promises for async callbacks
- **Error response**: Catch block builds error HTML via `buildAnswerHtml` — consistent with success response format

---

## Requirements Satisfied

- ✅ EXAM-01: User can enter a PYQ question + select mark value → get AI-generated exam-ready answer

---

## Next Step

Phase 5 Plan 05-02: Full Paper Mode (EXAM-02) — user uploads/selects a full VTU question paper and gets all answers generated in one shot.
