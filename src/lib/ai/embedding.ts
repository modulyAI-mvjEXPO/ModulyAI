import type { AIProviderConfig, EmbeddingResponse } from './types';

const EMBEDDING_PROVIDERS: readonly AIProviderConfig[] = [
  {
    // Primary: NVIDIA NIM - 1536 dimensions (works with pgvector < 2000 limit)
    name: 'nvidia-nim',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
  },
  {
    // Fallback: Groq (will be converted to 1536 if we upgrade pgvector later)
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    defaultModel: 'nomic-embed-text-v1.5',
  },
];

const TIMEOUT_MS = 15_000;

const getApiKey = (envVar: string): string => {
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Missing API key: ${envVar} environment variable is not set`);
  }
  return key;
};

const callEmbeddingProvider = async (
  config: AIProviderConfig,
  text: string,
  inputType: 'passage' | 'query' = 'passage',
): Promise<ReadonlyArray<number>> => {
  const apiKey = getApiKey(config.apiKeyEnvVar);

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.defaultModel,
      input: [text],
      ...(config.name === 'nvidia-nim' ? { input_type: inputType } : {}),
      // Some NIM models require an explicit encoding format
      encoding_format: 'float'
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${config.name} returned status ${response.status}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data[0].embedding;
};

export const getEmbedding = async (
  text: string,
  inputType: 'passage' | 'query' = 'passage'
): Promise<ReadonlyArray<number>> => {
  const errors: Array<string> = [];

  for (const provider of EMBEDDING_PROVIDERS) {
    try {
      return await callEmbeddingProvider(provider, text, inputType);
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `All embedding providers failed. ${errors.join('; ')}`,
  );
};
