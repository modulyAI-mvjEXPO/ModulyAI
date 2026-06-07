/**
 * langchain-embeddings.ts
 * ─────────────────────────────────────────────────────────
 * LangChain-compatible embeddings using OpenRouter
 * Supports text-embedding-ada-002: 1536 dimensions
 * ─────────────────────────────────────────────────────────
 */

const OR_API_URL = 'https://openrouter.ai/api/v1/embeddings';

/**
 * Get API key from environment
 */
const getApiKey = (): string => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('Missing OPENROUTER_API_KEY environment variable');
  }
  return key;
};

/**
 * Get embedding for a single text
 * @param text - Text to embed  
 * @returns Promise<number[]> - 1536-dimensional embedding vector
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  const apiKey = getApiKey();
  
  const response = await fetch(OR_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://moduly.ai',
      'X-Title': 'Moduly AI',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
  }
  
  const result = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };
  
  return result.data[0]?.embedding ?? [];
};

/**
 * Get embeddings for multiple texts (batch)
 * @param texts - Array of texts to embed
 * @returns Promise<number[][]> - Array of embedding vectors
 */
export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const apiKey = getApiKey();
  
  const response = await fetch(OR_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://moduly.ai',
      'X-Title': 'Moduly AI',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: texts,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
  }
  
  const result = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };
  
  return result.data.map(d => d.embedding);
};

/**
 * Get embedding dimension for this model
 */
export const getEmbeddingDimension = (): number => {
  // text-embedding-ada-002 produces 1536 dimensions
  return 1536;
};

/**
 * Get model info
 */
export const getModelInfo = () => ({
  name: 'text-embedding-ada-002',
  dimensions: 1536,
  description: 'OpenAI ada-002 - 1536 dimensions (pgvector compatible)',
  maxTokens: 8191,
});

export default { getEmbedding, getEmbeddings, getEmbeddingDimension, getModelInfo };