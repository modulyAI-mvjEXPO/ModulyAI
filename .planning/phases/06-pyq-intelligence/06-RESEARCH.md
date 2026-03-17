# Phase 6 Research: PYQ Intelligence

## Requirement: EXAM-04

> System parses multiple past papers for a subject and displays topic frequency analysis showing which topics appear most often, presented in a visual format (chart or ranked list).

---

## Existing Data Available

### Database Tables

- `documents` — each row has `id`, `title`, `status`, `subject_id`, `created_at`
- `document_chunks` — each row has `document_id`, `content` (chunked text)
- Documents with `status = 'ready'` have fully-processed vector chunks in `document_chunks`

### Identifying PYQ Documents

No dedicated `document_type` column exists. PYQ identification relies on the document `title`:
- Titles containing: `pyq`, `question`, `exam`, `qp`
- Filter: `status = 'ready'` AND `title ilike '%pyq%'` OR similar

### Existing Precedents

- `chat.mts` — reads chunks via Supabase JS client, processes text
- `exam-solve.mts` — similar single-call pattern
- `supabase-server.ts` — server-side Supabase client already exists
- `ExamMode.tsx` left panel already had static mock analysis cards + module weightage bars

---

## Approach Decision

### Option A: AI-Based Analysis (Rejected)
Send PYQ text to LLM and ask it to extract topics.
- **Con**: Expensive on free-tier LLMs, slow, unreliable for structured output
- **Con**: Rate-limit risk for demo

### Option B: Keyword-Rule Engine (Chosen)
Define a `TOPIC_RULES` array of `{ topic, module, avgMarks, keywords[] }`.
For each PYQ document, scan all its chunk text for keyword hits.
Compute frequency = `(docs_with_hit / total_docs) * 100`.

- **Pro**: Fast, deterministic, zero LLM calls, no cost
- **Pro**: Graceful fallback when no PYQ docs exist (hardcoded fallback)
- **Con**: Coverage limited to pre-defined topics — acceptable for demo scope

### Option C: Embedding Similarity Clustering (Rejected)
Cluster chunk embeddings into topic groups.
- **Con**: Complex, needs stored embeddings + k-means or similar — overkill for demo

---

## Architecture

```
POST /pyq-intelligence
  → pyq-intelligence.mts
  → supabase: SELECT documents WHERE status='ready' AND title ilike PYQ patterns
  → if no docs → return FALLBACK_PATTERNS / FALLBACK_WEIGHTAGE (demo-safe)
  → supabase: SELECT document_chunks WHERE document_id IN [...]
  → aggregate chunk text per document
  → apply TOPIC_RULES keyword matching
  → compute frequency %, priority (High/Medium/Low), avgMarks
  → compute moduleWeightage from mark scores
  → return PyqIntelligenceResponse { papersAnalyzed, patterns[], moduleWeightage[] }

ExamMode.tsx (left panel)
  → useEffect on mount: fetchPyqIntelligence()
  → render patterns as .em-analysis-card elements
  → render moduleWeightage as .em-module-bar progress bars
  → fallback: show FALLBACK_ANALYSIS if fetch fails
```

---

## Types Added to types.ts

```typescript
PyqIntelligenceRequest  { subjectId?, maxDocuments? }
PyqTopicPattern         { topic, module, frequency, priority, avgMarks }
PyqModuleWeightage      { module, marks, percentage }
PyqIntelligenceResponse { papersAnalyzed, patterns[], moduleWeightage[] }
```

---

## Routing

- Added to `netlify.toml`: `/pyq-intelligence` → `/.netlify/functions/pyq-intelligence`

---

## Key Decisions

- `maxDocuments` defaults to 20 (caps chunk queries at 20×120 = 2400 rows)
- Topics capped at top 6 by frequency (UI displays 4–6 cards)
- Module weightage capped at top 4
- `hits` field stripped before returning (internal only)
- Analysis loaded on component mount (not on-demand)
- `analysisLoading` state drives badge text ("Loading analysis..." vs "8 papers analyzed")
