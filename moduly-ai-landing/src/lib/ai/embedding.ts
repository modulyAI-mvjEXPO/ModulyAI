import type { AIProviderConfig, EmbeddingResponse } from './types';

const EMBEDDING_PROVIDERS: readonly AIProviderConfig[] = [
  {
    name: 'nvidia-nim',
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
      input_type: inputType,
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
