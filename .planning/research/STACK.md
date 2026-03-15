# Stack Research

**Domain:** AI/LLM Stack Additions for VTU Study Platform (RAG, Embeddings, LLM Integration)
**Researched:** 2026-03-15
**Confidence:** HIGH (verified via official docs: Supabase AI docs, NVIDIA NIM API, OpenRouter API, pdf-parse npm)

> **Scope:** This document covers ONLY the AI/LLM additions needed for Study Mode, Exam Mode, and RAG pipeline. The existing locked stack (React 19, TypeScript 5.9, Vite 7, Supabase, Netlify Functions, Utho S3) is not re-evaluated.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Supabase pgvector** | pgvector 0.7.0+ (Supabase built-in) | Vector storage & similarity search | Already using Supabase for auth/DB — zero new infrastructure. Built-in `extensions.vector` type, HNSW indexing, cosine distance operator (`<=>`). One `match_documents` RPC function handles all retrieval. No external vector DB needed. |
| **NVIDIA NV-EmbedQA E5 v5** | `nvidia/nv-embedqa-e5-v5` | Embedding generation for documents & queries | Free tier available on NVIDIA NIM. 1024 dimensions. Specifically optimized for QA retrieval (not generic text similarity). Commercial license. Finetuned from E5-Large-Unsupervised. Outperforms generic embedding models for study/exam Q&A use case. |
| **OpenRouter** | API v1 (OpenAI-compatible) | LLM chat completions (Study Mode & Exam Mode) | Free models available (rate-limited). OpenAI-compatible API means standard SDK patterns. SSE streaming support. Multiple model fallbacks via single API. If one free model is down, switch to another without code changes. |
| **pdf-parse** | 2.4.5 | PDF text extraction from uploaded documents | Major v2 rewrite — pure TypeScript, works in Node.js AND serverless (Netlify Functions, AWS Lambda). `getText()` for text extraction, `getTable()` for tabular data. Lightweight (no native deps). Handles VTU notes/textbooks that are text-based PDFs. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@openrouter/sdk** | latest | OpenRouter API client with TypeScript types | When calling LLM for chat completions. Provides typed request/response. Alternative: raw `fetch` to `https://openrouter.ai/api/v1/chat/completions` works too since API is OpenAI-compatible. SDK adds convenience, not necessity. |
| **@supabase/supabase-js** | 2.x (already installed) | Supabase client for vector operations via RPC | Already in project for auth. Use `supabase.rpc('match_documents', {...})` for similarity search. No additional package needed for vector operations. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Supabase CLI / Dashboard** | Enable pgvector extension, create vector columns, deploy RPC functions | Run `CREATE EXTENSION IF NOT EXISTS vector;` in Supabase SQL editor. Create migration for `document_chunks` table with `embedding vector(1024)` column. |
| **NVIDIA NIM Playground** | Test embedding model before integration | Free web UI at `build.nvidia.com` to verify embedding quality with sample VTU content before writing integration code. |

## Architecture Decisions

### Embedding Model: NVIDIA NV-EmbedQA E5 v5 (1024 dims) — not Supabase built-in gte-small (384 dims)

Supabase docs recommend `gte-small` (384 dimensions) for use within Edge Functions, but we're using Netlify Functions, not Supabase Edge Functions. The Supabase built-in embedding generation is only available inside their Edge Function runtime.

**Decision:** Use NVIDIA's free API from Netlify Functions because:
1. **QA-optimized:** `nv-embedqa-e5-v5` is specifically finetuned for question-answering retrieval — directly matches our study/exam use case
2. **Higher dimensionality:** 1024 dims captures more semantic nuance than 384 dims, improving retrieval quality for academic content
3. **Free tier:** NVIDIA NIM provides free API access with reasonable rate limits
4. **Simple integration:** Standard REST API (`POST https://integrate.api.nvidia.com/v1/embeddings`) — no special SDK needed

**Trade-off:** External API call adds ~100-200ms latency per embedding request. Acceptable because embeddings are generated at upload time (not real-time user queries — query embedding is a single fast call).

### LLM Provider Strategy: OpenRouter Primary, NVIDIA NIM Fallback

| Provider | Role | Free Models | Rate Limits | Streaming |
|----------|------|-------------|-------------|-----------|
| **OpenRouter** | Primary LLM provider | Multiple free models (varies — check `openrouter.ai/models` for current free options) | Per-model limits, typically generous for free tier | SSE streaming via standard OpenAI-compatible endpoint |
| **NVIDIA NIM** | Fallback LLM provider | `meta/llama-3.1-8b-instruct` and others | Free tier with rate limits | SSE streaming supported |

**Pattern:** Try OpenRouter first. If rate-limited or down, fall back to NVIDIA NIM. Both use OpenAI-compatible APIs, so the calling code is identical — only the base URL and API key change.

### Vector Storage: Supabase pgvector with HNSW Index

**Schema:**
```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1024),  -- NVIDIA nv-embedqa-e5-v5 output
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',  -- subject, module, doc_type, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search (better than IVFFlat)
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_metadata = '{}' OR dc.metadata @> filter_metadata)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Why HNSW over IVFFlat:** HNSW indexes are recommended by Supabase for production use — they don't require training data, handle incremental inserts well (important for community uploads), and provide better recall accuracy. IVFFlat requires periodic re-training as data grows.

**Why cosine distance (`<=>`):** Safe default. Works correctly regardless of whether embeddings are normalized. Supabase docs recommend it as the starting point. Negative inner product (`<#>`) is faster but only works correctly with normalized vectors.

### Text Chunking Strategy: Custom Recursive Character Splitter

**No external library needed.** A simple recursive character splitter is ~50 lines of TypeScript:

```typescript
type ChunkOptions = {
  readonly maxChunkSize: number;    // 500 characters
  readonly chunkOverlap: number;    // 50 characters
  readonly separators: readonly string[];  // ['\n\n', '\n', '. ', ' ']
};

const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxChunkSize: 500,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ' '],
};
```

**Why custom over LangChain's `RecursiveCharacterTextSplitter`:**
1. LangChain.js is a massive dependency (100+ sub-packages) for one utility function
2. Our chunking needs are simple: split VTU study material into overlapping chunks
3. Custom implementation is testable, debuggable, and zero-dependency
4. 500 chars with 50 overlap works well for academic text (paragraphs, definitions, theorems)

**Chunk size rationale:** NVIDIA `nv-embedqa-e5-v5` has a 512 token max context. At ~4 chars/token, 500 characters fits comfortably within the model's context window. Overlap ensures concepts spanning chunk boundaries are captured in at least one chunk.

### Streaming Pattern: SSE through Netlify Functions

```
Client (React) <--SSE--> Netlify Function <--SSE--> OpenRouter/NVIDIA
```

**Implementation:**
- Netlify Function receives user query + retrieves relevant chunks from pgvector
- Constructs system prompt with RAG context + user message
- Streams LLM response back to client via Server-Sent Events
- Client uses `EventSource` or `fetch` with `ReadableStream` to consume

**Timeout consideration:** Netlify Functions default to 10s timeout, with 26s for background functions. LLM streaming responses typically start within 1-2s (time-to-first-token), and the connection stays alive as long as data flows. Streaming keeps the connection active, avoiding timeout issues for long responses.

**Fallback:** If streaming proves problematic with Netlify's timeout, switch to non-streaming (wait for full response). Less UX-friendly but simpler and guaranteed to work within timeout if response is <10s.

### Document Processing Pipeline

```
Upload (existing) → Netlify Function → Utho S3
                         |
                         v
              PDF Text Extraction (pdf-parse)
                         |
                         v
              Text Chunking (custom splitter)
                         |
                         v
              Embedding Generation (NVIDIA API, batch)
                         |
                         v
              Store chunks + vectors in Supabase pgvector
```

**Critical decision: Process at upload time, not query time.**
- Upload is async — user expects to wait a few seconds
- Query must be fast — user expects instant responses
- Pre-computing embeddings at upload means retrieval is just a vector similarity search (fast)
- Netlify Background Functions allow up to 15 minutes for processing, solving timeout concerns for large documents

**Batch embedding:** NVIDIA API supports sending multiple texts in one request. Process all chunks from a document in a single API call rather than one-per-chunk. Reduces latency and stays within rate limits.

## Installation

```bash
# Core AI additions (new packages)
npm install pdf-parse@2.4.5

# Optional: OpenRouter SDK (can use fetch instead)
npm install @openrouter/sdk

# Already installed (no action needed)
# @supabase/supabase-js — already in project
```

```sql
-- Run in Supabase SQL Editor (one-time setup)
CREATE EXTENSION IF NOT EXISTS vector;

-- Then apply migration for document_chunks table (see schema above)
```

**Environment variables to add:**
```env
NVIDIA_NIM_API_KEY=nvapi-...        # Free tier key from build.nvidia.com
OPENROUTER_API_KEY=sk-or-v1-...     # Free tier key from openrouter.ai
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Supabase pgvector** | Pinecone / Weaviate / Qdrant | If you need managed vector DB with built-in filtering, auto-scaling, or >1M vectors. Overkill for our scale (<10K chunks for expo). Adds external dependency + cost. |
| **NVIDIA nv-embedqa-e5-v5** (1024d) | Supabase built-in `gte-small` (384d) | If using Supabase Edge Functions (not Netlify Functions). Lower dimensionality = faster search but less semantic precision. Good for prototyping within Supabase ecosystem. |
| **NVIDIA nv-embedqa-e5-v5** (1024d) | OpenAI `text-embedding-3-small` (1536d) | If budget allows. Higher quality embeddings. $0.02/1M tokens. Not free. |
| **OpenRouter (free models)** | OpenAI GPT-4o / Anthropic Claude | If budget allows. Dramatically better response quality. Not free. OpenRouter can proxy to these models too (paid). |
| **OpenRouter (free models)** | Groq (free tier) | If Groq's free tier is available and sufficient. Extremely fast inference (LPU). But model selection is limited and free tier may be discontinued. |
| **pdf-parse 2.4.5** | Mozilla pdf.js / Unstructured.io | pdf.js is lower-level (more control, more code). Unstructured.io is cloud-hosted (adds latency + dependency). pdf-parse wraps pdf.js with a clean API. |
| **Custom text chunker** | LangChain.js `RecursiveCharacterTextSplitter` | If already using LangChain for other features. Our project doesn't use LangChain — adding it for one utility is not worth the dependency weight. |
| **SSE streaming** | WebSockets | If bidirectional communication needed (e.g., real-time collaboration). SSE is simpler, HTTP-based, works with Netlify Functions. WebSockets require persistent connections that serverless doesn't support well. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **LangChain.js** | Massive dependency (~100 packages). Abstractions add complexity without value for our simple RAG pipeline. Debugging is harder through LangChain's layers. We need: chunking (50 lines custom), embedding (1 API call), retrieval (1 RPC call). LangChain solves problems we don't have. | Custom integration code. Direct API calls to NVIDIA/OpenRouter. Custom chunker. Supabase RPC for retrieval. |
| **Pinecone / Weaviate / Qdrant** | External vector database adds: another service to manage, another API key, another point of failure, another billing concern. We already have Supabase with pgvector built-in. For <10K document chunks (expo scale), pgvector is more than sufficient. | Supabase pgvector (already in our stack). |
| **OpenAI Embeddings/Chat** | Not free. Even `text-embedding-3-small` costs $0.02/1M tokens. GPT-4o-mini is ~$0.15/1M input tokens. Budget is near-zero. | NVIDIA NIM (free tier embeddings) + OpenRouter (free tier chat models). |
| **Hugging Face Inference API** | Free tier exists but is slow (cold starts 30s+), rate-limited aggressively, and model availability is inconsistent. Not reliable for live demo. | NVIDIA NIM (faster, more reliable free tier for embeddings). OpenRouter (more free model options for chat). |
| **Ollama / Local LLMs** | Requires GPU hardware. We're deploying on Netlify (serverless). No local machine to run inference. Even if available, 7B+ models need substantial RAM/VRAM. | Cloud API providers (OpenRouter, NVIDIA NIM). |
| **Supabase Edge Functions (for embedding)** | Would lock us into `gte-small` (384d) and Supabase's Deno runtime. We're using Netlify Functions (Node.js). Mixing two serverless runtimes adds deployment complexity. | Netlify Functions calling NVIDIA embedding API directly. |
| **ChromaDB / FAISS (in-memory)** | In-memory vector stores don't persist across serverless function invocations. Each Netlify Function invocation is stateless. Data would be lost. | Supabase pgvector (persistent, queryable via RPC). |
| **Vercel AI SDK** | Designed for Vercel/Next.js deployment. While it works elsewhere, it adds unnecessary abstraction for our simple streaming needs. We're on Netlify, not Vercel. | Direct `fetch` with SSE parsing. Standard `ReadableStream` API. |

## Stack Patterns by Variant

**If NVIDIA NIM free tier is rate-limited during demo:**
- Switch to OpenRouter for embeddings (some models support embeddings)
- Or pre-compute all demo document embeddings before the expo (offline batch processing)
- Rate limits are per-API-key; having a backup key helps

**If OpenRouter free models quality is poor for VTU content:**
- Use NVIDIA NIM LLMs (e.g., `meta/llama-3.1-8b-instruct`) as primary
- Invest more time in system prompt engineering to compensate for model quality
- Pre-load excellent VTU syllabus context in system prompt to guide the model

**If Netlify Functions timeout during document processing:**
- Use Netlify Background Functions (up to 15 min timeout) for document ingestion
- Process documents asynchronously: upload triggers background function, UI polls for completion
- Chunk and embed in batches to stay within timeout

**If pgvector search is slow with HNSW index:**
- Won't happen at expo scale (<10K chunks)
- If it does: reduce `ef_search` parameter, or pre-filter by metadata before vector search
- Consider switching to IVFFlat with periodic re-indexing (only if >100K chunks)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pdf-parse@2.4.5 | Node.js 20+ | v2 rewrite requires Node 20+. Netlify Functions support Node 20. Verify `AWS_LAMBDA_JS_RUNTIME` or `NODE_VERSION` in `netlify.toml`. |
| @openrouter/sdk@latest | TypeScript 5.x, Node.js 18+ | OpenAI-compatible types. Works with existing TS 5.9 setup. |
| Supabase pgvector | @supabase/supabase-js 2.x | Vector operations via RPC functions. No special client version needed. Already using supabase-js 2.x. |
| NVIDIA NIM API | Any HTTP client (fetch) | REST API — no SDK dependency. Uses standard `Authorization: Bearer` header. Compatible with any runtime. |

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Supabase pgvector | **HIGH** | Verified via official Supabase AI/Vector documentation. Well-documented patterns for `match_documents` RPC, HNSW indexes, vector column creation. Battle-tested approach. |
| NVIDIA NIM Embeddings | **HIGH** | Verified via NVIDIA NIM API documentation and model cards. `nv-embedqa-e5-v5` is a published model with clear specs (1024 dims, 512 token context). Free tier confirmed. |
| OpenRouter LLM | **MEDIUM** | API is well-documented and OpenAI-compatible. However, free model availability changes frequently. Specific free models available at demo time cannot be guaranteed. Mitigation: have NVIDIA NIM as fallback. |
| pdf-parse v2 | **HIGH** | Verified via npm package page. v2.4.5 is the current major release. Pure TypeScript, serverless-compatible. API surface is simple and well-documented. |
| Streaming via Netlify | **MEDIUM** | SSE streaming through Netlify Functions works in principle (HTTP streaming is supported), but edge cases around timeout behavior and buffering need testing. Fallback to non-streaming is straightforward. |
| Custom text chunker | **HIGH** | This is standard practice. Recursive character splitting is a well-understood algorithm. No external dependency risk. Testable in isolation. |

## Sources

- **Supabase AI & Vector docs** — pgvector setup, vector columns, HNSW indexes, `match_documents` RPC pattern, embedding dimension recommendations. Official documentation at `supabase.com/docs/guides/ai`. HIGH confidence.
- **NVIDIA NIM API docs** — `nv-embedqa-e5-v5` model card, embedding API endpoint (`integrate.api.nvidia.com/v1/embeddings`), 1024 dimension output, 512 token context limit. Official at `build.nvidia.com`. HIGH confidence.
- **OpenRouter API docs** — SDK (`@openrouter/sdk`), OpenAI-compatible endpoints, SSE streaming, free model discovery. Official at `openrouter.ai/docs`. HIGH confidence.
- **pdf-parse npm** — v2.4.5 features (pure TS, `getText()`, serverless support, Node 20+ requirement). Verified via npm package page. HIGH confidence.
- **Supabase embedding guide** — `gte-small` (384d) recommendation for Edge Functions, dimension performance analysis. Official docs. HIGH confidence (but not applicable to our Netlify setup).

---
*Stack research for: AI/LLM additions to Moduly AI (VTU Study Platform)*
*Researched: 2026-03-15*
