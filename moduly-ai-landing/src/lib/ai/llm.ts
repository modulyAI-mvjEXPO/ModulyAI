import type { AIProviderConfig, ChatCompletionOptions, ChatCompletionResponse, StreamChunk } from './types';

const LLM_PROVIDERS: readonly AIProviderConfig[] = [
  {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
  },
  {
    name: 'nvidia-nim',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyEnvVar: 'NVIDIA_NIM_API_KEY',
    defaultModel: 'meta/llama-3.1-8b-instruct',
  },
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
  },
];

const TIMEOUT_MS = 30_000;

const getApiKey = (envVar: string): string => {
  const key = process.env[envVar];
  if (!key) {
    throw new Error(`Missing API key: ${envVar} environment variable is not set`);
  }
  return key;
};

const buildHeaders = (config: AIProviderConfig, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (config.name === 'openrouter') {
    headers['HTTP-Referer'] = 'https://modulyai.com';
    headers['X-Title'] = 'Moduly AI';
  }

  return headers;
};

const parseSSEStream = (rawStream: ReadableStream<Uint8Array>): ReadableStream<string> => {
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream<string>({
    async start(controller) {
      const reader = rawStream.getReader();

      let done = false;
      while (!done) {
        const read = await reader.read();
        done = read.done;

        if (read.value !== undefined) {
          buffer += decoder.decode(read.value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) {
              continue;
            }

            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              controller.close();
              return;
            }

            const chunk = JSON.parse(data) as StreamChunk;
            const content = chunk.choices[0]?.delta?.content;
            if (content !== undefined) {
              controller.enqueue(content);
            }
          }
        }
      }

      controller.close();
    },
  });
};

const callLLMProvider = async (
  config: AIProviderConfig,
  options: ChatCompletionOptions,
): Promise<string | ReadableStream<string>> => {
  const apiKey = getApiKey(config.apiKeyEnvVar);

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config, apiKey),
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: options.stream ?? false,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.max_tokens !== undefined ? { max_tokens: options.max_tokens } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${config.name} returned status ${response.status}`);
  }

  if (options.stream) {
    if (!response.body) {
      throw new Error(`${config.name} returned no body for streaming response`);
    }
    return parseSSEStream(response.body);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message?.content;
  if (content === null || content === undefined) {
    throw new Error(`${config.name} returned null content`);
  }
  return content;
};

export const chatCompletion = async (
  options: ChatCompletionOptions,
): Promise<string | ReadableStream<string>> => {
  const errors: Array<string> = [];

  for (const provider of LLM_PROVIDERS) {
    try {
      return await callLLMProvider(provider, options);
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    `All LLM providers failed. ${errors.join('; ')}`,
  );
};
