import type { AIProviderConfig, ChatCompletionOptions, ChatCompletionResponse, StreamChunk } from './types';

// ─── Provider Definitions ──────────────────────────────────────────────────

/**
 * Z_AI uses BigModel's OpenAI-compatible API.
 * GLM-5 is a high-context reasoning model suited for long engineering docs.
 */
const Z_AI_CONFIG = {
  name: 'z-ai',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKeyEnvVar: 'Z_AI_API_KEY',
  defaultModel: 'glm-5',
} as const satisfies AIProviderConfig;

/**
 * Groq LPU — primary provider for real-time, low-latency responses.
 */
const GROQ_CONFIG = {
  name: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKeyEnvVar: 'GROQ_API_KEY',
  defaultModel: 'llama-3.3-70b-versatile',
} as const satisfies AIProviderConfig;

/**
 * OpenRouter — global safety net. Acts as an aggregator that can route
 * to Fireworks, Together, or other Llama 3.3 hosts if the primary fails.
 * Only activated on 429 (rate limit) or 5xx (server error) responses.
 */
const OPENROUTER_CONFIG = {
  name: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKeyEnvVar: 'OPENROUTER_API_KEY',
  defaultModel: 'meta-llama/llama-3.3-70b-instruct',
} as const satisfies AIProviderConfig;

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000;

/**
 * If total message content exceeds this byte count, the query is treated
 * as a long-context reasoning task and routed to Z_AI (GLM-5).
 */
const LONG_CONTEXT_THRESHOLD_CHARS = 100_000;

/** HTTP status codes that trigger the OpenRouter global fallback. */
const FALLBACK_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ─── Helpers ───────────────────────────────────────────────────────────────

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

// ─── Core Provider Call ────────────────────────────────────────────────────

type ProviderCallResult = {
  readonly result: string | ReadableStream<string>;
  readonly triggeredFallback: false;
} | {
  readonly result: null;
  readonly triggeredFallback: true;
  readonly statusCode: number;
};

/**
 * Calls a single LLM provider. Returns the result on success.
 * If the response status is in FALLBACK_STATUS_CODES, sets `triggeredFallback: true`
 * so the caller can route to OpenRouter. All other errors are thrown normally.
 */
const callLLMProvider = async (
  config: AIProviderConfig,
  options: ChatCompletionOptions,
  modelOverride?: string,
): Promise<ProviderCallResult> => {
  const apiKey = getApiKey(config.apiKeyEnvVar);
  const model = modelOverride ?? config.defaultModel;

  const bodyObj: Record<string, unknown> = {
    model,
    messages: options.messages,
    stream: options.stream ?? false,
  };
  if (options.temperature !== undefined) bodyObj['temperature'] = options.temperature;
  if (options.max_tokens !== undefined) bodyObj['max_tokens'] = options.max_tokens;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config, apiKey),
    body: JSON.stringify(bodyObj),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    if (FALLBACK_STATUS_CODES.has(response.status)) {
      console.warn(`[llm] ${config.name} returned ${response.status} — flagging for OpenRouter fallback`);
      return { result: null, triggeredFallback: true, statusCode: response.status };
    }
    throw new Error(`${config.name} returned status ${response.status}`);
  }

  if (options.stream) {
    if (!response.body) {
      throw new Error(`${config.name} returned no body for streaming response`);
    }
    return { result: parseSSEStream(response.body), triggeredFallback: false };
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message?.content;
  if (content === null || content === undefined) {
    throw new Error(`${config.name} returned null content`);
  }
  return { result: content, triggeredFallback: false };
};

// ─── Smart Router ──────────────────────────────────────────────────────────

/**
 * Determines whether a request should be routed to Z_AI (GLM-5) instead of Groq.
 * Triggers when:
 *  - `options.reasoningMode` is explicitly set to true, OR
 *  - total message content length exceeds LONG_CONTEXT_THRESHOLD_CHARS (100k chars)
 */
const shouldUseReasoning = (options: ChatCompletionOptions): boolean => {
  if (options.reasoningMode === true) return true;
  const totalChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);
  return totalChars > LONG_CONTEXT_THRESHOLD_CHARS;
};

/**
 * Smart LLM router for Moduly AI.
 *
 * Routing logic:
 * 1. **Speed path (default):**  Groq → llama-3.3-70b-versatile
 * 2. **Reasoning path:**        Z_AI → GLM-5  (when reasoningMode or >100k chars)
 * 3. **Global fallback:**       OpenRouter → meta-llama/llama-3.3-70b-instruct
 *                               Activated when Groq or Z_AI return 429 or 5xx.
 *
 * The fallback is also invoked if the primary provider throws any error
 * (e.g., timeout, DNS failure), making the system resilient to full provider outages.
 */
export const chatCompletion = async (
  options: ChatCompletionOptions,
): Promise<string | ReadableStream<string>> => {
  const useReasoning = shouldUseReasoning(options);
  const primaryConfig = useReasoning ? Z_AI_CONFIG : GROQ_CONFIG;
  const primaryLabel = useReasoning ? 'Z_AI (GLM-5)' : 'Groq (llama-3.3-70b-versatile)';

  // ── Step 1: Try primary provider ──────────────────────────────────────────
  try {
    console.info(`[llm] Routing to ${primaryLabel}`);
    const primaryResult = await callLLMProvider(primaryConfig, options);

    if (!primaryResult.triggeredFallback) {
      return primaryResult.result;
    }

    // Primary returned 429/5xx — skip directly to OpenRouter
    console.warn(`[llm] Primary (${primaryLabel}) hit rate limit/server error. Activating OpenRouter fallback.`);
  } catch (primaryErr) {
    console.warn(`[llm] Primary (${primaryLabel}) threw: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}. Activating OpenRouter fallback.`);
  }

  // ── Step 2: Global fallback via OpenRouter ─────────────────────────────────
  console.info('[llm] Routing to OpenRouter (meta-llama/llama-3.3-70b-instruct) as fallback');
  const fallbackResult = await callLLMProvider(OPENROUTER_CONFIG, options);

  if (!fallbackResult.triggeredFallback) {
    return fallbackResult.result;
  }

  // If OpenRouter also returns a fallback-triggering error, throw with full context
  throw new Error(
    `All LLM providers failed. Primary (${primaryLabel}) and OpenRouter fallback both returned errors.`,
  );
};
