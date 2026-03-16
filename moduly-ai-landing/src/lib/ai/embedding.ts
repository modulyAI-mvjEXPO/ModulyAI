import type { AIProviderConfig, EmbeddingResponse } from './types';

const EMBEDDING_PROVIDERS: readonly [AIProviderConfig, AIProviderConfig] = [
  {
    name: 'nvidia-nim',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'nvidia/nv-embedqa-e5-v5',
  },
  {
    name: 'nvidia-nim-fallback',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'nvidia/nv-embedqa-e5-v5',
  },
];

const TIMEOUT_MS = 10_000;

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
      input: text,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${config.name} returned status ${response.status}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data[0].embedding;
};

export const getEmbedding = async (text: string): Promise<ReadonlyArray<number>> => {
  const [primary, fallback] = EMBEDDING_PROVIDERS;
  const errors: Array<string> = [];

  try {
    return await callEmbeddingProvider(primary, text);
  } catch (err) {
    errors.push(`${primary.name}: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    return await callEmbeddingProvider(fallback, text);
  } catch (err) {
    errors.push(`${fallback.name}-fallback: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(
    `All embedding providers failed. ${errors.join('; ')}`,
  );
};
