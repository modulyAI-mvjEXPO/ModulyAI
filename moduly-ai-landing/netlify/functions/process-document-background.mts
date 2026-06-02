import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';

type BackgroundEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
};

type BackgroundBody = {
  readonly documentId: string;
  readonly filePath: string;
  readonly title?: string;
  readonly fileType?: string;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly body: string;
};

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
/**
 * Uploads a raw file buffer directly to Vectara's corpus.
 * Vectara handles all parsing, chunking, and vectorisation automatically.
 *
 * Docs: https://docs.vectara.com/docs/rest-api/upload-file
 */
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

  // Node 18+ (Netlify runtime) has global FormData and Blob
  const form = new FormData();

  const mimeType = fileType || 'application/pdf';
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.set('file', blob, filename);

  // Metadata for filtering in chat queries
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
        // Do NOT set Content-Type manually — fetch sets the multipart boundary automatically
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

// ── Supabase status helpers ───────────────────────────────────────────────────
const updateDocumentStatus = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  status: string,
  extras?: Record<string, unknown>,
): Promise<void> => {
  const { error } = await supabase
    .from('documents')
    .update({
      status,
      ...extras,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document status to ${status}: ${error.message}`);
  }
};

// ── Main processing logic ─────────────────────────────────────────────────────
const processDocument = async (
  documentId: string,
  filePath: string,
  title?: string,
  fileType?: string,
): Promise<void> => {
  const supabase = createServerSupabaseClient();
  const s3Client = createS3Client();

  try {
    // 1. Download raw file from Utho (S3-compatible)
    console.log(`[BG] Downloading "${filePath}" from Utho for document ${documentId}...`);
    const fileBuffer = await downloadFileFromS3(s3Client, filePath);

    // 2. Derive a clean filename for Vectara
    const filename = (title || filePath.split('/').pop() || 'document');

    // 3. Upload the raw file to Vectara — Vectara handles ALL parsing & vectorisation
    console.log(`[BG] Uploading to Vectara corpus for document ${documentId}...`);
    await uploadFileToVectara(
      fileBuffer,
      filename,
      documentId,
      title ?? filename,
      fileType ?? 'application/pdf',
    );

    // 4. Mark as ready in Supabase
    console.log(`[BG] Document ${documentId} successfully indexed in Vectara.`);
    await updateDocumentStatus(supabase, documentId, 'ready', {
      chunk_count: 1, // Vectara manages chunking internally; we use 1 as a sentinel
    });
  } catch (error) {
    console.error(`[BG] Processing failed for document ${documentId}:`, error);
    throw error;
  }
};

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event: BackgroundEvent): Promise<HandlerResponse> => {
  const { documentId, filePath, title, fileType } = JSON.parse(
    event.body ?? '{}',
  ) as BackgroundBody;

  if (!documentId || !filePath) {
    console.error('[BG] Missing documentId or filePath');
    return { statusCode: 200, body: 'missing_params' };
  }

  try {
    await processDocument(documentId, filePath, title, fileType);
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    console.error(`[BG] Fatal error for document ${documentId}:`, err);
    try {
      const supabase = createServerSupabaseClient();
      await updateDocumentStatus(supabase, documentId, 'failed');
    } catch (updateErr: unknown) {
      console.error(`[BG] Could not mark document ${documentId} as failed:`, updateErr);
    }
    return { statusCode: 200, body: 'failed' };
  }
};
