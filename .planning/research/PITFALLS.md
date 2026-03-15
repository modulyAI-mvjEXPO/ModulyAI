# Pitfalls Research

**Domain:** AI-powered VTU study platform — RAG, LLM integration, 2-week expo deadline
**Researched:** 2026-03-15
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Free LLM Provider Unreliability During Live Demo

**What goes wrong:**
Free models on OpenRouter/NVIDIA NIM go down, rate-limit, or return degraded responses during the live expo demo. Judges see errors or painfully slow responses.

**Why it happens:**
Free tiers have no SLA. Rate limits are per-account and can change without notice. Popular free models get overloaded during peak hours. NVIDIA NIM free tier may throttle during high-demand periods.

**How to avoid:**
1. **Multi-provider fallback chain:** OpenRouter → NVIDIA NIM → hardcoded demo responses. Code the fallback into every LLM call.
2. **Pre-demo warm-up:** Make a few API calls 30 min before demo to check availability.
3. **Cached demo responses:** For the exact demo flow you'll show judges, pre-cache the responses. If live API fails, serve cached response with a small artificial delay (looks real).
4. **Multiple API keys:** Create 2-3 accounts per provider. If one key is rate-limited, rotate to the next.

**Warning signs:**
- Response times >5s during testing
- 429 (rate limit) errors appearing in logs
- Model returning generic/low-quality responses

**Phase to address:** LLM integration phase — build fallback chain from day one, not as an afterthought.

---

### Pitfall 2: RAG Returns Irrelevant Chunks (Bad Retrieval Quality)

**What goes wrong:**
Vector similarity search returns chunks that are semantically similar but contextually irrelevant. Student asks about "binary search tree traversal" and gets chunks about "binary number systems" because both contain "binary." AI generates answers using wrong context.

**Why it happens:**
1. Chunk size too large (entire pages) or too small (sentence fragments)
2. No metadata filtering — searching all documents instead of subject-specific ones
3. Similarity threshold too low — accepting marginally relevant matches
4. Embedding model not optimized for academic/technical text

**How to avoid:**
1. **Always filter by metadata first:** Only search within the student's selected subject and chosen documents. Use `filter_metadata` parameter in `match_documents` RPC.
2. **Tune chunk size:** 500 chars with 50 overlap is a good starting point for academic text. Test with actual VTU content and adjust.
3. **Set similarity threshold at 0.7+:** Better to return fewer highly relevant chunks than many marginally relevant ones.
4. **Include chunk context:** Store subject, module, and document type in chunk metadata. Use in filtering.
5. **Test with real VTU content:** Don't just test with lorem ipsum. Use actual syllabus content, notes, and PYQs.

**Warning signs:**
- AI answers seem "off topic" despite having relevant documents selected
- Same chunks appearing for very different questions
- Students getting answers about wrong subjects

**Phase to address:** RAG pipeline phase — test retrieval quality before wiring up LLM.

---

### Pitfall 3: Netlify Function Timeouts on RAG + LLM Chain

**What goes wrong:**
The full chain — embed query (200ms) + vector search (50ms) + LLM prompt construction (10ms) + LLM response (3-8s) — exceeds the 10s Netlify Function timeout. Function dies mid-response.

**Why it happens:**
Default Netlify Functions timeout is 10 seconds. Free LLM models are slower than paid ones (3-8s time-to-first-token). Cold starts add 1-2s. The total chain can easily hit 12-15s.

**How to avoid:**
1. **Use SSE streaming:** Start streaming LLM response immediately. As long as data flows, the connection stays alive. Time-to-first-token matters more than total generation time.
2. **Set extended timeout in netlify.toml:** `[functions] external_node_modules = ["*"]` and configure timeout.
3. **Pre-warm functions:** Make a health-check call before demo to avoid cold starts.
4. **Optimize the pre-LLM chain:** Cache embedding for repeated queries. Keep vector search fast with HNSW index.
5. **Fallback to non-streaming:** If SSE is problematic, use a shorter prompt and non-streaming response that fits within timeout.

**Warning signs:**
- "504 Gateway Timeout" errors in browser
- Responses cut off mid-sentence
- Inconsistent behavior (works sometimes, fails other times — cold start issue)

**Phase to address:** LLM integration phase — test full chain timing early, before building UI around it.

---

### Pitfall 4: Document Processing Pipeline Fails Silently

**What goes wrong:**
Student uploads a PDF, gets "upload successful" message, but the background processing (parse → chunk → embed → store) fails silently. Document shows as "processing" forever. RAG never finds it.

**Why it happens:**
1. pdf-parse can't handle scanned PDFs (images inside PDF — no text layer)
2. NVIDIA embedding API rate-limits during batch processing
3. Background function crashes but there's no error reporting to the user
4. Supabase insert fails due to schema mismatch or RLS policy

**How to avoid:**
1. **Track processing status in documents table:** `status` column with values: `processing`, `ready`, `failed`, `no_text` (for scanned PDFs).
2. **Wrap every step in try-catch:** Log specific failure reasons. Update document status to `failed` with error message.
3. **Handle scanned PDFs gracefully:** Detect when pdf-parse returns empty/minimal text. Mark document as `no_text` instead of failing. Show user: "This document appears to be a scanned image. Text extraction is not available."
4. **Test with real VTU documents:** Many VTU PYQs are scanned images. Know which ones will work and which won't before demo.
5. **Curate demo documents:** For expo, pre-upload documents you've verified work with pdf-parse.

**Warning signs:**
- Documents stuck in "processing" state
- `document_chunks` table has 0 rows for uploaded documents
- pdf-parse returning empty strings

**Phase to address:** Document processing phase — add status tracking and error handling from the start.

---

### Pitfall 5: Scope Creep Kills the 2-Week Deadline

**What goes wrong:**
You try to make everything perfect — beautiful UI animations, advanced prompt engineering, sophisticated RAG with re-ranking, conversation memory, PYQ frequency analysis — and end up with nothing working by demo day.

**Why it happens:**
2 weeks feels like enough time until you account for: debugging, API issues, Supabase schema iterations, UI polish, testing, and the inevitable "it works locally but not in production" moments. Each feature has hidden complexity.

**How to avoid:**
1. **Build the simplest working version of each feature first:** Study Mode chat that works → then add RAG → then polish prompts. Not: perfect RAG pipeline first.
2. **Vertical slices, not horizontal layers:** Don't build "entire RAG pipeline" then "entire LLM integration" then "entire UI." Build "Study Mode end-to-end (basic)" then "Exam Mode end-to-end (basic)" then "polish both."
3. **Cut features ruthlessly:** If by day 10 Study Mode and Exam Mode don't work, drop Library community features and focus on making core AI features demo-worthy.
4. **Daily demo check:** Can you demo what you have TODAY? If not, you're building in the wrong order.
5. **Pre-decide what gets cut:** If behind schedule: cut PYQ full-paper mode first, then RAG (fall back to general AI), then Exam Mode entirely.

**Warning signs:**
- Day 7 and no feature works end-to-end
- Spending more than 1 day on any single sub-feature
- Adding "nice to have" features before core works

**Phase to address:** Every phase — this is a project management pitfall, not a technical one. Roadmap must enforce strict prioritization.

---

### Pitfall 6: Prompt Engineering Neglected Until the End

**What goes wrong:**
AI responses are generic, unhelpful, or incorrectly formatted. Judges ask a VTU-specific question and the AI gives a generic answer that doesn't reference the syllabus or exam pattern.

**Why it happens:**
Developers focus on the pipeline (embedding, retrieval, streaming) and use basic prompts like "You are a helpful assistant." The system prompt is an afterthought. VTU-specific context (exam patterns, mark allocation, module structure) isn't injected.

**How to avoid:**
1. **Write system prompts early:** Define the Study Mode and Exam Mode personas before building the pipeline. Test prompts directly in OpenRouter/NVIDIA playground.
2. **Include VTU context in system prompt:** Subject name, semester, modules list, exam pattern (theory vs practical), mark allocation scheme. Use data from `vtuData.ts`.
3. **Format instructions:** Tell the AI to structure answers with headings, bullet points, and mark-based length (10-mark answer ≈ 500 words, 5-mark ≈ 250 words).
4. **Test with real VTU questions:** Use actual PYQ questions as test cases. Compare AI answers with known correct answers.
5. **Iterate on prompts:** Budget at least 2-3 hours for prompt iteration per mode.

**Warning signs:**
- AI answers don't mention VTU, subject modules, or exam format
- Answers are too short or too long for the marks allocated
- AI hallucinates module numbers or topic names

**Phase to address:** LLM integration phase — write system prompts as the first task, not the last.

---

### Pitfall 7: Ignoring Image-Based PYQs

**What goes wrong:**
Many VTU previous year question papers are scanned images (photos of printed papers). pdf-parse returns empty text. The entire Exam Mode PYQ solver feature doesn't work with real papers.

**Why it happens:**
pdf-parse extracts text from text-layer PDFs. Scanned PDFs contain images, not text. OCR (Tesseract, Google Vision) is needed but adds significant complexity and cost.

**How to avoid:**
1. **Accept this limitation for expo:** OCR is out of scope. Document it clearly.
2. **Curate demo PYQ bank:** Find or create text-based versions of PYQs for demo subjects. Type out a few representative papers manually if needed.
3. **Allow manual text input:** Add a "paste question" option in Exam Mode so students can type/paste questions even if the PDF can't be parsed.
4. **Detect and communicate:** When pdf-parse returns no text, tell the user: "This paper is a scanned image. Please paste the question text manually."
5. **Plan OCR for post-expo:** NVIDIA has OCR models on NIM. Add to roadmap but not for expo.

**Warning signs:**
- PYQ bank PDFs returning empty text from pdf-parse
- Exam Mode showing blank questions
- Demo rehearsal fails because demo PYQs are scanned

**Phase to address:** Document processing phase — test with actual PYQ papers early. Curate demo content before building features.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded demo fallback responses | Demo never fails in front of judges | Must be removed; false confidence in system | Expo only — remove after |
| No conversation memory (stateless chat) | Simpler implementation, no session storage | Users can't ask follow-ups referencing earlier messages | MVP — add conversation history post-expo |
| No embedding caching | Simpler pipeline, fewer moving parts | Same queries re-embedded repeatedly, wastes API calls | Expo scale (<100 queries) — add cache post-expo |
| Processing status polling (not WebSocket) | Simpler than WebSocket for document status | Unnecessary HTTP requests, slight delay in status update | Acceptable long-term — polling every 3s is fine |
| All chunks same size | Simple chunker implementation | Academic content has natural boundaries (theorems, definitions) that get split | MVP — add semantic chunking post-expo |
| No rate limiting on API endpoints | Faster development | Anyone can spam your Netlify Functions and exhaust LLM API credits | Expo only — add rate limiting before public launch |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Supabase pgvector** | Forgetting to enable `vector` extension before creating columns | Run `CREATE EXTENSION IF NOT EXISTS vector;` as the very first migration. Test in Supabase dashboard SQL editor before deploying. |
| **Supabase RPC** | Calling `match_documents` without proper parameter types (vector must be passed as array of floats) | supabase-js sends vectors as float arrays automatically. Test RPC call in Supabase dashboard first. |
| **Supabase RLS** | RLS blocks vector search because `document_chunks` policy is missing | Create explicit SELECT policy on `document_chunks` for authenticated users. Test with `supabase.auth.getUser()` in function. |
| **OpenRouter** | Assuming a specific free model is always available | Query `/api/v1/models` at startup to discover current free models. Store model ID in config, not hardcoded. |
| **OpenRouter SSE** | Not handling `[DONE]` sentinel in SSE stream | OpenRouter sends `data: [DONE]` as the last event. Check for it and close the stream. |
| **NVIDIA NIM** | Sending too many texts in one embedding batch | Check model's max batch size. Start with 10 chunks per request, increase if stable. |
| **Netlify Background Functions** | Using wrong file naming convention | File must end with `-background.ts` (e.g., `process-document-background.ts`). Otherwise Netlify treats it as a regular function with 10s timeout. |
| **pdf-parse v2** | Using v1 API patterns with v2 | v2 is a complete rewrite. Use `getText()` method, not the v1 callback pattern. Check v2 docs specifically. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Embedding all chunks sequentially | Document processing takes 30s+ per document | Batch embed (send all chunks in one API call) | >10 chunks per document |
| No HNSW index on vector column | Vector search takes 500ms+ | Create HNSW index immediately after table creation | >1K chunks in table |
| Retrieving too many chunks | LLM prompt exceeds context window, response quality drops | Limit to top 5 chunks, use similarity threshold 0.7+ | Always — more chunks ≠ better answers |
| Re-embedding identical queries | Wastes API calls, adds 200ms per repeated query | Cache query embeddings (in-memory Map for expo, Redis post-expo) | >50 concurrent users |
| Large PDF processing in regular function | Function times out at 10s/26s | Use background function (`-background.ts` suffix) | PDFs with >20 pages |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| LLM API keys in frontend code | Anyone can steal keys and exhaust your free tier | ALL API calls go through Netlify Functions. Keys only in environment variables. Never in client-side code. |
| No prompt injection protection | User types "ignore previous instructions and..." — AI reveals system prompt or generates harmful content | Sanitize user input. Use clear system prompt boundaries. Don't include sensitive info in system prompts. |
| Unrestricted file uploads | Users upload malicious files (executables, massive files) | Validate file type (PDF/image only) and size limit (10MB) in both frontend and Netlify Function. |
| Supabase service role key in frontend | Full database access from browser | Service role key only in Netlify Functions. Frontend uses anon key with RLS policies. |
| No auth check in Netlify Functions | Unauthenticated users can call AI endpoints and burn API credits | Verify Supabase JWT token in every function. Return 401 if invalid. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while AI responds | User thinks app is broken, clicks again, creates duplicate requests | Show typing indicator immediately. Stream tokens as they arrive. Disable send button during response. |
| AI response with no formatting | Wall of text — hard to read, especially for exam answers | Use markdown in AI response. Render with proper headings, bullet points, code blocks. |
| Document upload with no progress feedback | User uploads large PDF, nothing happens for 30s | Show upload progress bar. Then show "Processing document..." with status polling. |
| Generic error messages | "Something went wrong" — user has no idea what to do | Specific messages: "AI service is temporarily unavailable. Try again in 30 seconds." |
| PYQ solver shows blank when PDF is scanned | Confusing — user uploaded a paper but sees nothing | Detect empty text extraction. Show: "This paper is a scanned image. Paste the question text below." |

## "Looks Done But Isn't" Checklist

- [ ] **Study Mode chat:** Does it work with RAG context? Or only with general LLM knowledge? Test with a document selected vs. no document.
- [ ] **Exam Mode solver:** Does question-by-question mode handle multi-part questions (a, b, c)? Test with real VTU PYQ format.
- [ ] **Library browse:** Does it show document processing status? Or just documents marked "ready"? Users need to know their upload is being processed.
- [ ] **Document upload:** Does it handle duplicate uploads? What if the same PDF is uploaded twice?
- [ ] **Auth in functions:** Are ALL Netlify Functions checking the Supabase JWT? Test by calling without auth header.
- [ ] **Error states:** What happens when OpenRouter is down? When NVIDIA NIM is rate-limited? When Supabase is unreachable? Test each failure mode.
- [ ] **Mobile responsiveness:** Expo judges may test on phones. Does the chat interface work on small screens?
- [ ] **Empty states:** What does Library show when no documents are uploaded? What does Study Mode show when no subject is selected?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Free LLM goes down during demo | LOW | Switch to cached demo responses. Have backup API keys. Pre-rehearse the failover. |
| Bad RAG retrieval quality | MEDIUM | Tune similarity threshold. Add metadata filtering. Improve chunking. May need to re-process documents. |
| Function timeout | LOW | Switch to non-streaming response. Reduce prompt size. Pre-warm function. |
| Document processing failures | MEDIUM | Fix error handling. Re-process failed documents. May need to curate demo documents manually. |
| Scope creep — running out of time | HIGH | Cut features to core: Study Mode chat (even without RAG) + basic Library browse. Polish what works. |
| Prompt quality issues | LOW | Iterate on system prompts. Test in LLM playground. Can be fixed without code changes (prompts are strings). |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Free LLM unreliability | LLM integration | Fallback chain works end-to-end. Cached responses serve correctly. |
| Bad RAG retrieval | RAG pipeline | Retrieval test with 10 real VTU questions returns relevant chunks. |
| Function timeouts | LLM integration | Full chain (embed + retrieve + stream) completes within timeout. SSE stream stays alive. |
| Silent processing failures | Document processing | Failed documents show error status. Scanned PDFs detected and communicated. |
| Scope creep | All phases (roadmap enforcement) | Daily demo check — can demo current state to judges? |
| Prompt neglect | LLM integration | System prompts include VTU context. Test with 5 real questions per mode. |
| Image-based PYQs | Document processing | Demo PYQ bank curated with text-based papers. Manual input option available. |
| Security (API keys exposed) | LLM integration | All keys in env vars. Frontend makes zero direct API calls to LLM/embedding services. |

## Sources

- OpenRouter API documentation — rate limits, free model availability, SSE streaming patterns
- NVIDIA NIM documentation — embedding rate limits, batch processing limits
- Netlify Functions documentation — timeout behavior, background function naming, SSE support
- Supabase pgvector documentation — RLS with vectors, HNSW index behavior, RPC patterns
- pdf-parse v2 documentation — scanned PDF limitations, serverless compatibility
- Community reports on RAG quality issues — chunking strategies, retrieval tuning
- VTU exam paper analysis — format patterns, scanned vs text-based papers

---
*Pitfalls research for: AI-powered VTU study platform (Moduly AI)*
*Researched: 2026-03-15*
