import type { RagChunk, RerankResponse } from './types';

// NVIDIA NIM Reranker configuration
const RERANKER_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const RERANKER_MODEL = 'nvidia/llama-3.2-nv-rerankqa-1b-v2';
const RERANKER_TIMEOUT_MS = 10_000;
const MAX_RERANK_PASSAGES = 20; // NIM reranker max

const getApiKey = (): string => {
  const key = process.env['NVIDIA_NIM_API_KEY'];
  if (!key) {
    throw new Error('Missing API key: NVIDIA_NIM_API_KEY environment variable is not set');
  }
  return key;
};

/**
 * Reranks RAG chunks using NVIDIA NIM's cross-encoder reranker.
 *
 * The embedding-based retrieval (ANN search) finds *approximately* relevant
 * chunks. The cross-encoder reranker reads the query AND each chunk together,
 * producing a precise relevance score. This "two-stage" approach is the
 * standard recipe for high-accuracy RAG pipelines.
 *
 * @param query     The user's question.
 * @param chunks    Retrieved chunks from Supabase pgvector search.
 * @param topN      How many top chunks to return after reranking (default 5).
 * @returns         Chunks sorted by reranker score, capped to topN.
 */
export const rerankChunks = async (
  query: string,
  chunks: ReadonlyArray<RagChunk>,
  topN = 5,
): Promise<ReadonlyArray<RagChunk>> => {
  if (chunks.length === 0) return chunks;

  // If we have fewer chunks than topN, no reranking needed
  if (chunks.length <= topN) return chunks;

  try {
    const apiKey = getApiKey();

    // Truncate to NIM's max passage count
    const passages = chunks.slice(0, MAX_RERANK_PASSAGES).map(c => ({
      text: c.content,
    }));

    const response = await fetch(`${RERANKER_BASE_URL}/ranking`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RERANKER_MODEL,
        query: { text: query },
        passages,
      }),
      signal: AbortSignal.timeout(RERANKER_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Soft fail — return original order rather than crashing the whole request
      console.warn(`NVIDIA NIM reranker returned ${response.status}. Using original retrieval order.`);
      return chunks.slice(0, topN);
    }

    const data = (await response.json()) as RerankResponse;

    // Sort by logit score descending and return top-N original chunks
    const sorted = [...data.rankings]
      .sort((a, b) => b.logit - a.logit)
      .slice(0, topN)
      .map(r => chunks[r.index])
      .filter((c): c is RagChunk => c !== undefined);

    return sorted;
  } catch (err) {
    // Graceful degradation: if reranker times out or throws, use original order
    console.warn('Reranker failed, using original retrieval order:', err instanceof Error ? err.message : String(err));
    return chunks.slice(0, topN);
  }
};
