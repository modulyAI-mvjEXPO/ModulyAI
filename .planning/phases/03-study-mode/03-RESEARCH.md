# Phase 3: Study Mode Core — Research

**Date**: 2026-03-16
**Phase Goal**: Users can chat with AI about any VTU subject and receive real, RAG-grounded answers streamed in real-time (replacing hardcoded mock responses)
**Requirements**: STUDY-01, STUDY-02

## Current State Analysis

### StudyMode.tsx (473 lines) — What Exists

**Mock Architecture to Replace:**
- `generateResponse()` (lines 64-120): Hardcoded keyword-matching responses — returns canned text based on whether query contains "avl", "bfs", "dfs", "practice"
- `sendMessage()` (line 173): Uses `setTimeout(900-1500ms)` to simulate AI latency — needs to become real SSE streaming
- `INITIAL_DOCS` (line 35): 2 hardcoded DocItem objects — should come from Supabase `documents` table
- `INITIAL_TOPICS` (line 40): 4 hardcoded topics — keep for now (Phase 4 enhancement)
- `WELCOME` message (line 54): Hardcoded welcome — keep or make dynamic

**Interfaces to Preserve/Adapt:**
- `DocItem`: `{ id, name, type, meta, selected }` — will map from `DocumentRow`
- `Message`: `{ id, role: 'ai' | 'user', content, time, isRich? }` — note `role: 'ai'` vs API's `'assistant'`
- `TopicItem`: `{ id, name, active }` — keep as-is for now

**UI Elements to Keep:**
- Study Kit sidebar with doc selection, topic tags, strict toggle
- Mark selector: `['2M', '8M', '10M']`
- Chat message list with AI/user bubbles
- Typing indicator (bouncing dots)
- Quick-action buttons on first message
- Context chips in footer (selected docs, strict badge, mark badge)
- Textarea with Enter to send, Shift+Enter for newline
- `renderMd()` for basic markdown rendering

**Props/State:**
- `user: User` prop from Supabase auth
- `selectedMark` state — passed to AI prompt
- `strict` state — controls whether AI uses only selected docs
- `docs` state — list of documents with selection state
- `isTyping` state — already exists for typing indicator

### Available Backend Utilities

**LLM Client (src/lib/ai/llm.ts):**
- `chatCompletion(options)` → `string | ReadableStream<string>`
- When `stream: true`, returns `ReadableStream<string>` that emits parsed SSE content tokens
- `parseSSEStream()` handles `data: [DONE]` termination
- Default model: `google/gemini-2.0-flash-exp:free` (OpenRouter)
- Fallback: NVIDIA NIM `meta/llama-3.1-8b-instruct`
- 30-second timeout

**Embedding Client (src/lib/ai/embedding.ts):**
- `getEmbedding(text)` → `ReadonlyArray<number>` (1024-dim)
- NVIDIA NIM provider with fallback
- 10-second timeout

**Supabase Server Client (src/lib/ai/supabase-server.ts):**
- `createServerSupabaseClient()` → service role client
- Uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

**RAG Retrieval RPC (migration 006):**
- `match_documents_filtered(query_embedding, filter_document_ids?, filter_subject_id?, match_threshold?, match_count?)`
- JOINs with documents table, only returns chunks where `status = 'ready'`
- Returns: `id, document_id, content, metadata, similarity`
- Default: threshold 0.5, count 5

**Types (src/lib/ai/types.ts):**
- `ChatMessage`: `{ role: 'system' | 'user' | 'assistant', content }`
- `ChatCompletionOptions`: `{ model, messages, stream?, temperature?, max_tokens? }`
- `DocumentRow`: full document table row type (12 fields)
- `DocumentStatus`: `'processing' | 'ready' | 'failed' | 'no_text'`

### Existing Netlify Function Pattern

**process-document.mts** (reference):
- TypeScript `.mts` extension (ES module)
- Manual `HandlerEvent` / `HandlerResponse` types (no Netlify SDK types)
- `CORS_HEADERS` with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`
- `jsonResponse()` helper for consistent responses
- POST-only validation
- try-catch wrapping entire handler
- Imports from `../../src/lib/ai/` using relative paths with `.ts` extension

**netlify.toml** redirects pattern:
```toml
[[redirects]]
  from = "/endpoint-name"
  to = "/.netlify/functions/endpoint-name"
  status = 200
```

### Netlify SSE Streaming Constraints

**Key discovery**: Netlify Functions (AWS Lambda) do NOT support true SSE streaming from the function response. The response is buffered and sent all at once. Options:
1. **Netlify Edge Functions** — run on Deno, DO support streaming responses
2. **Client-side streaming** — function returns full response, client simulates streaming (defeats purpose)
3. **Proxy pattern** — function calls LLM API, gets streamed response, but client gets it buffered

**Decision**: Use Netlify Edge Functions for the chat endpoint. Edge Functions:
- Run on Deno (not Node.js)
- Support `ReadableStream` in `Response` body
- Have `TransformStream` for SSE
- File goes in `netlify/edge-functions/` directory
- Configured in `netlify.toml` under `[[edge_functions]]`
- Can import from `src/lib/ai/` but need Deno-compatible imports

**ALTERNATIVE**: Keep as regular Netlify Function, return complete response (no streaming), add streaming in Phase 8 as enhancement. This is simpler and avoids Deno compatibility issues.

**CHOSEN APPROACH**: Regular Netlify Function that calls LLM with `stream: false`, returns complete response. The frontend will simulate progressive display using a typing animation. This gives the visual appearance of streaming while keeping the architecture simple. True SSE streaming can be added in Phase 8 (Demo Hardening) if needed.

**Rationale**:
- Avoids Deno/Edge Function complexity and import compatibility issues
- Keeps consistent architecture with existing `.mts` functions
- The visual experience (progressive text reveal) can be achieved client-side
- Real streaming is a Phase 8 optimization, not core functionality
- STUDY-02 says "user sees text appearing progressively" — achievable with client-side animation

## Architecture Decisions

### Plan 03-01: Chat Netlify Function

**Endpoint**: POST `/chat`
**File**: `netlify/functions/chat.mts`

**Request body**:
```typescript
{
  message: string;           // User's question
  documentIds?: string[];    // Optional: filter RAG to specific docs
  subjectId?: string;        // Optional: filter by subject
  mark?: string;             // e.g. "8M" — for prompt engineering
  strict?: boolean;          // Whether to restrict to docs only
  history?: Array<{ role: 'user' | 'assistant'; content: string }>; // Chat history for context
}
```

**Flow**:
1. Validate request (POST only, message required)
2. Embed user query via `getEmbedding(message)`
3. Call `match_documents_filtered` RPC with optional filters
4. Build system prompt with retrieved context chunks
5. Build messages array: system prompt + history + user message
6. Call `chatCompletion()` with `stream: false`
7. Return JSON: `{ response: string, sources: Array<{ documentId, content, similarity }> }`

**System prompt template**:
```
You are Moduly AI, a study assistant for VTU (Visvesvaraya Technological University) students.
Answer the student's question using the provided context from their study materials.
{mark_instruction}
{strict_instruction}

Context from study materials:
{chunks}

If no relevant context is found, provide a helpful answer using general knowledge and note that no matching study materials were found.
```

### Plan 03-02: Frontend Integration

**Changes to StudyMode.tsx**:
1. Replace `INITIAL_DOCS` with Supabase query for user's `ready` documents
2. Replace `generateResponse()` + `setTimeout()` with real `/chat` API call
3. Add progressive text reveal animation (client-side, to satisfy STUDY-02)
4. Map `DocumentRow` → `DocItem` for sidebar display
5. Pass selected document IDs to `/chat` endpoint
6. Handle errors gracefully (show error message in chat)
7. Return sources from API response (optional display)

**New hook or utility**: `useChat` or inline fetch logic
- Sends POST to `/chat` with message, documentIds, mark, strict, history
- On response, progressively reveals text character by character
- Manages loading state (isTyping)

## File Impact

### New Files
- `netlify/functions/chat.mts` — Chat endpoint with RAG

### Modified Files
- `netlify.toml` — Add `/chat` redirect
- `src/pages/StudyMode.tsx` — Replace mock with real AI integration

### Unchanged Files
- `src/lib/ai/llm.ts` — Used as-is
- `src/lib/ai/embedding.ts` — Used as-is
- `src/lib/ai/supabase-server.ts` — Used as-is
- `src/lib/ai/types.ts` — May add ChatRequest/ChatResponse types

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM API slow (>10s) | Medium | 30s timeout already set; show typing indicator |
| No documents uploaded | High (new users) | Fallback to general knowledge with note |
| Embedding API failure | Low | Fallback chain exists; return error message in chat |
| Large chat history exceeds token limit | Low (demo) | Limit history to last 10 messages |
| CORS issues with function | Low | Existing pattern uses `Access-Control-Allow-Origin: *` |

---
*Research completed: 2026-03-16*
