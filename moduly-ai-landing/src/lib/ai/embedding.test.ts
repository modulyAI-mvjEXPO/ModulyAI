import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEmbedding } from './embedding';

const createMockEmbeddingResponse = (dimension = 1024) => ({
  data: [{ embedding: Array.from({ length: dimension }, () => 0.1), index: 0 }],
  model: 'nvidia/nv-embedqa-e5-v5',
  usage: { prompt_tokens: 10, total_tokens: 10 },
});

describe('getEmbedding', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('NVIDIA_NIM_API_KEY', 'test-nvidia-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('sends correct payload to NVIDIA NIM endpoint', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify(createMockEmbeddingResponse()), { status: 200 }),
    );
    globalThis.fetch = mockFetch;

    await getEmbedding('test text');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/embeddings');
    expect(options?.method).toBe('POST');

    const body = JSON.parse(options?.body as string) as { model: string; input: string };
    expect(body.model).toBe('nvidia/nv-embedqa-e5-v5');
    expect(body.input).toBe('test text');

    const headers = options?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-nvidia-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns array of exactly 1024 numbers on success', async () => {
    globalThis.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(
      new Response(JSON.stringify(createMockEmbeddingResponse(1024)), { status: 200 }),
    );

    const result = await getEmbedding('test text');

    expect(result).toHaveLength(1024);
    expect(result.every((n) => typeof n === 'number')).toBe(true);
  });

  it('throws descriptive error with provider name when it fails', async () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValue(new Error('Primary failed'));
    globalThis.fetch = mockFetch;

    await expect(getEmbedding('test text')).rejects.toThrow(/nvidia-nim/i);
  });

  it('throws if API key env var is missing', async () => {
    vi.stubEnv('NVIDIA_NIM_API_KEY', '');

    await expect(getEmbedding('test text')).rejects.toThrow(/NVIDIA_NIM_API_KEY/);
  });
});
