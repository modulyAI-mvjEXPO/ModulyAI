import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';

type ProcessDocumentBody = {
  readonly title: string;
  readonly filePath: string;
  readonly fileType: string;
  readonly userId: string;
  readonly subjectId?: string;
  readonly moduleId?: string;
  readonly fileSize?: number;
};

type HandlerEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
  readonly headers: Record<string, string | undefined>;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly headers?: Record<string, string>;
  readonly body: string;
};

const REQUIRED_FIELDS = ['title', 'filePath', 'fileType', 'userId'] as const;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
} as const;

const jsonResponse = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const findMissingFields = (
  body: Record<string, unknown>,
): ReadonlyArray<string> =>
  REQUIRED_FIELDS.filter((field) => !body[field]);

const triggerBackgroundProcessing = (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  filePath: string,
  event: HandlerEvent,
): void => {
  const host = event.headers?.host || 'localhost:8888';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const baseUrl =
    process.env['URL'] ??
    process.env['DEPLOY_URL'] ??
    `${protocol}://${host}`;

  fetch(`${baseUrl}/.netlify/functions/process-document-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, filePath }),
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Background function returned ${res.status}`);
      }
    })
    .catch(async (err: unknown) => {
      console.error('Failed to trigger background function:', err);
      await supabase
        .from('documents')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', documentId);
    });
};

export const handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const missingFields = findMissingFields(body);

    if (missingFields.length > 0) {
      return jsonResponse(400, {
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    const {
      title,
      filePath,
      fileType,
      userId,
      subjectId,
      moduleId,
      fileSize,
    } = body as unknown as ProcessDocumentBody;

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        file_path: filePath,
        file_type: fileType,
        user_id: userId,
        subject_id: subjectId ?? null,
        module_id: moduleId ?? null,
        file_size: fileSize ?? null,
        status: 'processing',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Supabase insert error:', error);
      return jsonResponse(500, {
        error: `Failed to create document record: ${error?.message ?? 'Unknown error'}`,
      });
    }

    triggerBackgroundProcessing(supabase, data.id as string, filePath, event);

    return jsonResponse(202, { documentId: data.id });
  } catch (err: unknown) {
    console.error('Unexpected error in process-document:', err);
    return jsonResponse(500, {
      error: 'Internal server error',
    });
  }
};
