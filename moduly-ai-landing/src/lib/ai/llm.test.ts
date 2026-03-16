import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCompletion } from './llm';
import type { ChatCompletionOptions } from './types';

const createMockChatResponse = (content = 'Hello from AI') => ({
  id: 'chatcmpl-123',
  choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
  model: 'google/gemini-2.0-flash-exp:free',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const createMockSSEStream = (chunks: ReadonlyArray<string>): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        const sseData = JSON.stringify({
          id: 'chatcmpl-123',
          choices: [{ delta: { content: chunk }, finish_reason: null }],
        });
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
};

const defaultOptions: ChatCompletionOptions = {
  model: 'google/gemini-2.0-flash-exp:free',
  messages: [{ role: 'user', content: 'Hello' }],
};

describe('chatCompletion', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'test-nvidia-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('sends correct payload to OpenRouter with required headers', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify(createMockChatResponse()), { status: 200 }),
    );
    globalThis.fetch = mockFetch;

    await chatCompletion(defaultOptions);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(init?.body as string) as ChatCompletionOptions;
    expect(body.model).toBe('google/gemini-2.0-flash-exp:free');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);

    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-openrouter-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['HTTP-Referer']).toBeDefined();
    expect(headers['X-Title']).toBeDefined();
  });

  it('returns string content in non-streaming mode', async () => {
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify(createMockChatResponse('Test response')), { status: 200 }),
    );

    const result = await chatCompletion(defaultOptions);

    expect(typeof result).toBe('string');
    expect(result).toBe('Test response');
  });

  it('returns ReadableStream in streaming mode', async () => {
    const mockResponse = new Response(createMockSSEStream(['Hello', ' world']), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(mockResponse);

    const result = await chatCompletion({ ...defaultOptions, stream: true });

    expect(result).toBeInstanceOf(ReadableStream);
  });

  it('streaming response correctly parses SSE chunks into content strings', async () => {
    const mockResponse = new Response(createMockSSEStream(['Hello', ' world', '!']), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(mockResponse);

    const result = await chatCompletion({ ...defaultOptions, stream: true });
    const reader = (result as ReadableStream<string>).getReader();
    const chunks: Array<string> = [];

    let done = false;
    while (!done) {
      const read = await reader.read();
      done = read.done;
      if (read.value !== undefined) {
        chunks.push(read.value);
      }
    }

    expect(chunks).toEqual(['Hello', ' world', '!']);
  });

  it('falls back to NVIDIA NIM when OpenRouter returns 500', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createMockChatResponse('Fallback response')), { status: 200 }),
      );
    globalThis.fetch = mockFetch;

    const result = await chatCompletion(defaultOptions);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBe('Fallback response');

    const [fallbackUrl] = mockFetch.mock.calls[1];
    expect(fallbackUrl).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('falls back when OpenRouter fetch throws network error', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createMockChatResponse('Fallback response')), { status: 200 }),
      );
    globalThis.fetch = mockFetch;

    const result = await chatCompletion(defaultOptions);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toBe('Fallback response');
  });

  it('throws descriptive error when both providers fail', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockRejectedValueOnce(new Error('Fallback failed'));
    globalThis.fetch = mockFetch;

    await expect(chatCompletion(defaultOptions)).rejects.toThrow(/openrouter/i);

    mockFetch
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockRejectedValueOnce(new Error('Fallback failed'));

    await expect(chatCompletion(defaultOptions)).rejects.toThrow(/nvidia-nim/i);
  });

  it('throws if API key env var is missing', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');

    await expect(chatCompletion(defaultOptions)).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
