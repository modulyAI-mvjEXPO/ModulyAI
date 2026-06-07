import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';

/**
 * process-document.mts
 * 
 * Synchronous handler for document processing.
 * Triggers Vectara ingestion and updates document status.
 */

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

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

// ── S3 client (Utho) ──────────────────────────────────────────────────────────
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

const downloadFileFromS3 = async (
  s3Client: S3Client,
  filePath: string,
): Promise<Buffer> => {
  const command = new GetObjectCommand({
    Bucket: process.env['UTHO_BUCKET_NAME'],
    Key: filePath,
  });
  const response = await s3Client.send(command);
  const bodyBytes = await response.Body?.transformToByteArray();
  if (!bodyBytes) throw new Error('Empty response from S3');
  return Buffer.from(bodyBytes);
};

// ── Vectara File Upload API ───────────────────────────────────────────────────
const uploadFileToVectara = async (
  fileBuffer: Buffer,
  filename: string,
  documentId: string,
  title: string,
  fileType: string,
): Promise<void> => {
  const apiKey = process.env['VECTARA_API_KEY'];
  const corpusId = process.env['VECTARA_CORPUS_ID'] ?? 'VTU_Study_Materials';

  if (!apiKey) throw new Error('Missing VECTARA_API_KEY');

  const form = new FormData();
  const mimeType = fileType || 'application/pdf';
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.set('file', blob, filename);

  const metadata = JSON.stringify({
    document_id: documentId,
    title: title,
    filename: filename,
    uploaded_at: new Date().toISOString(),
  });
  form.set('metadata', metadata);

  const response = await fetch(
    `https://api.vectara.io/v2/corpora/${encodeURIComponent(corpusId)}/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vectara upload failed (${response.status}): ${errorText}`);
  }

  console.log(`[Vectara] Uploaded "${filename}" (docId: ${documentId}) to corpus "${corpusId}"`);
};

export const handler = async (
  event: HandlerEvent,
): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const supabase = createServerSupabaseClient();

  try {
    const body = JSON.parse(event.body ?? '{}') as ProcessDocumentBody;
    const { title, filePath, fileType, userId, subjectId, moduleId, fileSize } = body;

    // 1. Create document record in Supabase
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
        status: 'pending_approval',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create document record: ${error?.message}`);
    }

    const documentId = data.id as string;

    console.log(`[process-document] Document ${documentId} registered with status 'pending_approval'.`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ documentId, status: 'pending_approval' }),
    };
  } catch (err: unknown) {
    console.error('Unexpected error in process-document:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
