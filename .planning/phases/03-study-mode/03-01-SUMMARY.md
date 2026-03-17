# Plan 03-01 Summary: Chat Netlify Function with RAG Retrieval

**Status**: Complete
**Duration**: ~10 minutes

## What Was Done

### Task 1: ChatRequest, ChatResponse, RagChunk types (`src/lib/ai/types.ts`)
- Added `ChatRequest` type with `message`, `documentIds`, `subjectId`, `mark`, `strict`, `history` fields
- Added `ChatResponse` type with `response` and `sources` array (documentId, content, similarity)
- Added `RagChunk` type matching `match_documents_filtered` RPC return shape (id, document_id, content, metadata, similarity)
- All fields use `readonly` modifiers
- Existing types unchanged

### Task 2: Chat Netlify Function (`netlify/functions/chat.mts`)
- Created full RAG-grounded chat completion function following existing `process-document.mts` structure
- **Validation**: POST-only (405 for others), validates `message` is non-empty string (400 if missing)
- **RAG pipeline**: Embeds user query via `getEmbedding()` → retrieves context via `match_documents_filtered` RPC → builds system prompt → calls `chatCompletion()` with `stream: false`
- **System prompt builder** (`buildSystemPrompt`): Pure function that assembles VTU-specific instructions with:
  - Mark-based depth calibration (2M = shorter, 10M = detailed with examples)
  - Strict mode toggle (context-only vs. general knowledge supplementation)
  - Context section with retrieved chunks or "no docs found" fallback message
- **Message array builder** (`buildMessagesArray`): Pure function that assembles system + history (capped at 10) + user message
- **Request parsing**: Safely extracts optional fields (`documentIds`, `subjectId`, `mark`, `strict`, `history`) with type checking
- **Response**: Returns `{ response, sources }` where sources are truncated to 200 chars
- **Error handling**: RAG errors gracefully degraded (continues without context); LLM errors return 500 with message
- Constants: `DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free'`, `temperature: 0.7`, `max_tokens: 2048`

### Task 3: Netlify redirect (`netlify.toml`)
- Added `/chat` → `/.netlify/functions/chat` redirect (status 200)
- Existing 4 redirects preserved, new redirect appended at end

## Architecture

```
User sends question (from StudyMode.tsx, implemented in 03-02)
    ↓
POST /chat  →  /.netlify/functions/chat
    ↓
chat.mts handler
    ↓ Step 1: Validate request (POST, non-empty message)
    ↓ Step 2: getEmbedding(message) → 1024-dim vector
    ↓ Step 3: supabase.rpc('match_documents_filtered', { embedding, filters })
    ↓ Step 4: buildSystemPrompt(chunks, mark, strict)
    ↓ Step 5: buildMessagesArray(systemPrompt, history, message)
    ↓ Step 6: chatCompletion({ model, messages, stream: false })
    ↓ Step 7: Map chunks → sources (truncated to 200 chars)
    ↓
Response: { response: string, sources: [{ documentId, content, similarity }] }
```

## Verification
- TypeScript compiles clean across all 3 tsconfigs (`npx tsc -b --noEmit`)
- All 34 existing tests pass (`npx vitest run`)
- `chat.mts` exists with handler export
- `netlify.toml` contains all 5 redirects including `/chat`
- `types.ts` contains `ChatRequest`, `ChatResponse`, `RagChunk` with readonly fields
- No `any` types (one `as unknown as string` for pgvector embedding parameter)
- All type imports use `import type` syntax
- System prompt includes: VTU context, mark-based depth, strict mode, retrieved chunks
- Graceful degradation: RAG error → continue without context; no docs → general knowledge note
- History capped at 10 messages

## Deviations
None. Implementation follows the plan exactly.

## Files Modified
- `src/lib/ai/types.ts` — **MODIFIED** (added ChatRequest, ChatResponse, RagChunk types)
- `netlify/functions/chat.mts` — **CREATED** (141 lines, RAG chat function)
- `netlify.toml` — **MODIFIED** (added /chat redirect)

## Success Criteria Met
- ✅ User's question is embedded and used for vector similarity search (STUDY-01)
- ✅ Retrieved document chunks are included in the LLM prompt as context (STUDY-01)
- ✅ LLM generates an answer grounded in the retrieved context (STUDY-01)
- ✅ If no relevant documents found, AI responds with general knowledge and a note (success criterion 3)
- ✅ Chat endpoint accepts optional document/subject filters for targeted retrieval
- ✅ Chat endpoint accepts mark parameter for answer depth calibration
- ✅ Chat endpoint accepts strict flag for context-only vs general knowledge mode
- ✅ Chat history is included for conversational context
- ✅ TypeScript strict compilation passes

## Next Step
Execute Plan 03-02: Frontend useChat hook and StudyMode integration (plan not yet created — needs to be written first).
