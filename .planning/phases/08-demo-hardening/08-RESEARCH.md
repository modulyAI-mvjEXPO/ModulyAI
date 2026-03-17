# Phase 8 Research: Demo Hardening

## DEMO Requirements (from REQUIREMENTS.md)

| ID | Requirement | Status |
|----|-------------|--------|
| DEMO-01 | AI responses work even when API quota is exhausted | Pending |
| DEMO-02 | Errors shown as friendly messages, never raw stack traces | Pending |
| DEMO-03 | Loading indicators visible during AI processing | Pending |
| DEMO-04 | Demo flow responses pre-cached for reliability | Pending |
| DEMO-05 | Pre-warm mechanism eliminates cold start delays | Pending |

---

## Findings per Requirement

### DEMO-01 & DEMO-04: Cached Fallback + Pre-cached Demo Responses

**Current state:**
- `llm.ts` has a 2-provider fallback: OpenRouter → NVIDIA NIM.
- If both fail, it throws `"All LLM providers failed. openrouter: <detail>; nvidia-nim: <detail>"`.
- `chat.mts` and `exam-solve.mts` catch this and return a `500` JSON error to the client.
- **No third-tier cached response fallback exists.**

**Gap:**
- When both LLM providers are exhausted during a live demo, the user sees an error instead of an answer.
- DEMO-04 requires specific demo flow responses to be available offline.

**Solution:**
- Add a `DEMO_CACHE` `Map<string, string>` at the top of `chat.mts` and `exam-solve.mts`.
- Key: trimmed lowercase user question.
- Value: pre-written high-quality answer string (HTML-safe, suitable for `dangerouslySetInnerHTML` rendering).
- After both LLM providers fail, check the cache before returning 500. If a cache hit exists, return 200 with the cached response.
- Cache lives in the function files (not `llm.ts`) because it is demo/domain-specific, not a generic LLM concern.
- Cache key matching: `question.trim().toLowerCase()` — exact match only (reliable for scripted demo questions).

**Why not fuzzy matching?**
- Demo questions are scripted and known in advance. Exact match is simpler, faster, and has zero false positives.

---

### DEMO-02: User-Friendly Error Messages

**Current state:**
- Backend `chat.mts` and `exam-solve.mts`: single `try/catch`, return `jsonResponse(500, { error: errorMessage })` where `errorMessage` is the raw exception message, e.g. `"All LLM providers failed. openrouter: status 429; nvidia-nim: status 503"`.
- Frontend `StudyMode.tsx`: catches the error from `chatWithAI()` and renders `"Sorry, I encountered an error: **${err.message}**"` — raw technical string leaks to user.
- Frontend `ExamMode.tsx`: wraps error in `buildAnswerHtml(\`**Error:** ${errorText}\`)` — same raw leak.

**Gap:**
- Raw technical error strings (provider names, HTTP status codes) leak to users.

**Solution:**
- Add a `sanitizeError(msg: string): string` pure function in both `chat.mts` and `exam-solve.mts`.
- Map known error patterns to friendly strings:
  - Contains `"429"` or `"quota"` or `"rate"` → `"AI is temporarily busy. Please try again in a moment."`
  - Contains `"503"` or `"unavailable"` or `"All LLM providers failed"` → `"AI service is temporarily unavailable. Please try again shortly."`
  - Contains `"timeout"` → `"The AI took too long to respond. Please try again."`
  - Default fallback → `"Something went wrong. Please try again."`
- Use `sanitizeError()` when constructing the `error` field in 500 responses.
- The frontend already renders `err.message` — since the error message now comes from the sanitized backend response, no frontend changes are needed.

---

### DEMO-03: Loading Indicators

**Current state:**
- `StudyMode.tsx`: has `isTyping` state + animated `.sm-typing-bubble` dots rendered while waiting for AI response. ✅
- `ExamMode.tsx`: has `isTyping` state + `.em-typing` div with animated dots for both single-question and batch mode. ✅

**Gap:** None. Already fully implemented.

**Action:** No code changes needed for DEMO-03.

---

### DEMO-05: Pre-warm Mechanism

**Current state:**
- No pre-warm mechanism exists.
- Netlify Functions have cold start latency (~1–3s) if not recently invoked.
- During a live demo, the first AI call after an idle period can feel slow.

**Solution:**
- Create `netlify/functions/warm.mts` — a lightweight Netlify Function that:
  - Accepts a `POST` request.
  - Calls `getEmbedding("ping")` to warm the embedding provider connection.
  - Calls `chatCompletion` with a minimal 1-token prompt to warm the LLM provider connection.
  - Returns `{ ok: true }` immediately (fire-and-forget style from frontend).
  - Has no auth requirement (it's a no-op that costs negligible tokens).
- Add a redirect in `netlify.toml`: `from = "/warm"  to = "/.netlify/functions/warm"`.
- Add a `useEffect` in `Dashboard.tsx` that fires `fetch('/warm', { method: 'POST' })` once on mount — fire-and-forget (no `await`, no error handling needed).

**Why Dashboard?**
- Dashboard is the first page users see after login. Warming on Dashboard mount gives ~10–15s head start before the user navigates to Study Mode or Exam Mode.

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| `DEMO_CACHE` in function files, not `llm.ts` | Cache is demo/domain-specific; `llm.ts` is a generic utility |
| Exact-match cache keys | Demo questions are scripted; exact match is reliable with zero false positives |
| `sanitizeError()` in backend | Single source of truth; frontend already renders `err.message` as-is |
| Pre-warm via `Dashboard.tsx` `useEffect` | Earliest opportunity after auth; 10–15s lead time before first AI call |
| `warm.mts` calls real providers | Cold starts are per-provider connection; must actually call them to warm |

---

## Files to Create

| File | Purpose |
|------|---------|
| `netlify/functions/warm.mts` | Pre-warm endpoint |

## Files to Modify

| File | Change |
|------|--------|
| `netlify/functions/chat.mts` | Add `DEMO_CACHE` map + `sanitizeError()` helper + cached fallback tier |
| `netlify/functions/exam-solve.mts` | Add `DEMO_CACHE` map + `sanitizeError()` helper + cached fallback tier |
| `netlify.toml` | Add `/warm` → `/.netlify/functions/warm` redirect |
| `src/pages/Dashboard.tsx` | Add fire-and-forget pre-warm `useEffect` on mount |

## Files NOT Changing

| File | Reason |
|------|--------|
| `src/lib/ai/llm.ts` | Cache is domain-specific; no generic LLM changes needed |
| `src/lib/ai/embedding.ts` | No changes needed for demo hardening |
| `src/pages/StudyMode.tsx` | DEMO-03 already satisfied; error display works via backend sanitization |
| `src/pages/ExamMode.tsx` | DEMO-03 already satisfied; error display works via backend sanitization |
