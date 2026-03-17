import { getEmbedding } from '../../src/lib/ai/embedding.ts';
import { chatCompletion } from '../../src/lib/ai/llm.ts';
import type { ChatMessage } from '../../src/lib/ai/types.ts';

type HandlerEvent = {
  readonly httpMethod: string;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    await getEmbedding('ping');
    const messages: ReadonlyArray<ChatMessage> = [
      { role: 'user', content: 'Reply with one word: ready' },
    ];
    await chatCompletion({
      model: 'google/gemini-2.0-flash-exp:free',
      messages,
      stream: false,
      temperature: 0,
      max_tokens: 5,
    });
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true }),
    };
  } catch (_err) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false }),
    };
  }
};
