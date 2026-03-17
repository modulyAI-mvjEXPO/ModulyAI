# Summary 06-01: PYQ Intelligence — Topic Frequency Analysis

**Completed**: 2026-03-17  
**Duration**: ~30 min  
**Requirement**: EXAM-04 ✅

---

## What Was Built

A keyword-rule based topic frequency analysis backend that scans uploaded PYQ document chunks and returns structured trend data for ExamMode's left "Analysis Report" panel.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/ai/types.ts` | Added `PyqIntelligenceRequest`, `PyqTopicPattern`, `PyqModuleWeightage`, `PyqIntelligenceResponse` |
| `netlify/functions/pyq-intelligence.mts` | **NEW** — POST endpoint: Supabase query + keyword engine + fallback |
| `netlify.toml` | Added `/pyq-intelligence → /.netlify/functions/pyq-intelligence` redirect |
| `src/pages/ExamMode.tsx` | Added `fetchPyqIntelligence()`, analysis state, `useEffect` on mount, dynamic card/bar rendering |

---

## Key Decisions Made

- **Keyword-rule engine** chosen over AI-based analysis — fast, zero LLM cost, demo-safe
- **Fallback patterns/weightage** returned when no PYQ docs exist (no 500 errors, demo never breaks)
- `maxDocuments` capped at 20 to bound chunk query size (max 2400 rows)
- Top 6 patterns and top 4 module weightage entries returned (matches UI card slots)
- `hits` field computed internally but stripped from API response
- Analysis fetched on ExamMode mount via `useEffect` — not on demand

---

## TypeScript

- `npx tsc --noEmit` — ✅ clean
- `npx tsc -p tsconfig.functions.json --noEmit` — ✅ clean

---

## Requirements Satisfied

- ✅ EXAM-04: Topic frequency analysis derived from uploaded past papers, displayed as visual ranked cards and module weightage bars in ExamMode
