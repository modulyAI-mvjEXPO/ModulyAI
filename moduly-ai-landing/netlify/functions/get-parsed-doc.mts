import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

type HandlerEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
  readonly queryStringParameters: Record<string, string | undefined> | null;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

const createS3Client = (): S3Client =>
  new S3Client({
    endpoint: process.env['UTHO_ENDPOINT'],
    region: process.env['UTHO_REGION'] ?? 'innoida',
    credentials: {
      accessKeyId: process.env['UTHO_ACCESS_KEY'] ?? '',
      secretAccessKey: process.env['UTHO_SECRET_KEY'] ?? '',
    },
    forcePathStyle: true,
  });

/**
 * Fetches a parsed JSON document from Utho.
 *
 * Usage:
 *   GET /get-parsed-doc?sourcePath=source/year-2/22is35a/notes/file.pdf
 *   POST with body { "sourcePath": "source/year-2/22is35a/notes/file.pdf" }
 *
 * The function computes the parsed/ mirror path automatically.
 */
export const handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  let sourcePath: string | undefined;

  if (event.httpMethod === 'GET') {
    sourcePath = event.queryStringParameters?.['sourcePath'] ?? undefined;
  } else if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      sourcePath = typeof body['sourcePath'] === 'string' ? body['sourcePath'] : undefined;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }
  } else {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!sourcePath) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing sourcePath parameter' }),
    };
  }

  // Compute parsed/ mirror path
  let parsedKey: string;
  if (sourcePath.startsWith('source/')) {
    parsedKey = 'parsed/' + sourcePath.slice('source/'.length);
  } else {
    parsedKey = 'parsed/' + sourcePath;
  }
  parsedKey = parsedKey.replace(/\.[^.]+$/, '.json');

  try {
    const s3Client = createS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env['UTHO_BUCKET_NAME'],
      Key: parsedKey,
    });

    const response = await s3Client.send(command);
    const bodyBytes = await response.Body?.transformToByteArray();

    if (!bodyBytes) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Parsed document not found', parsedKey }),
      };
    }

    const jsonStr = Buffer.from(bodyBytes).toString('utf-8');

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: jsonStr,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // S3 NoSuchKey returns as an error
    if (errMsg.includes('NoSuchKey') || errMsg.includes('404') || errMsg.includes('The specified key does not exist')) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Parsed document not found yet — still processing', parsedKey }),
      };
    }

    console.error('Error fetching parsed doc:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Failed to fetch parsed document' }),
    };
  }
};
