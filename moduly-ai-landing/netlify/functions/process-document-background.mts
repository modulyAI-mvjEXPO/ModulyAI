import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';
import { extractPdfText } from '../../src/lib/ai/pdf-extract.ts';
import { chunkText } from '../../src/lib/ai/chunker.ts';
import { getEmbedding } from '../../src/lib/ai/embedding.ts';

type BackgroundEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
};

type BackgroundBody = {
  readonly documentId: string;
  readonly filePath: string;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly body: string;
};

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

const downloadPdfFromS3 = async (
  s3Client: S3Client,
  filePath: string,
): Promise<Buffer> => {
  const command = new GetObjectCommand({
    Bucket: process.env['UTHO_BUCKET_NAME'],
    Key: filePath,
  });

  const response = await s3Client.send(command);
  const bodyBytes = await response.Body?.transformToByteArray();

  if (!bodyBytes) {
    throw new Error('Empty response from S3');
  }

  return Buffer.from(bodyBytes);
};

const updateDocumentStatus = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  status: string,
  chunkCount?: number,
): Promise<void> => {
  await supabase
    .from('documents')
    .update({
      status,
      ...(chunkCount !== undefined ? { chunk_count: chunkCount } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);
};

const embedAndStoreChunks = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  chunks: ReturnType<typeof chunkText>,
  pageCount: number,
): Promise<void> => {
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk.content);

    await supabase.from('document_chunks').insert({
      document_id: documentId,
      content: chunk.content,
      metadata: {
        chunk_index: chunk.chunkIndex,
        page_count: pageCount,
      },
      embedding: embedding as unknown as string,
    });
  }
};

const processDocument = async (
  documentId: string,
  filePath: string,
): Promise<void> => {
  const supabase = createServerSupabaseClient();
  
  // MOCK PROCESSING: Wait 3 seconds to simulate AI chunking and embedding
  await new Promise(resolve => setTimeout(resolve, 3000));

  await updateDocumentStatus(
    supabase,
    documentId,
    'ready',
    12, // Mock chunk count
  );
};

export const handler = async (
  event: BackgroundEvent,
): Promise<HandlerResponse> => {
  const { documentId, filePath } = JSON.parse(
    event.body ?? '{}',
  ) as BackgroundBody;

  if (!documentId || !filePath) {
    console.error('Missing documentId or filePath in background function');
    return { statusCode: 200, body: 'missing_params' };
  }

  try {
    await processDocument(documentId, filePath);
    console.log(`Document ${documentId} processed successfully`);
    return { statusCode: 200, body: 'ok' };
  } catch (err: unknown) {
    console.error(`Document processing failed for ${documentId}:`, err);

    try {
      const supabase = createServerSupabaseClient();
      await updateDocumentStatus(supabase, documentId, 'failed');
    } catch (updateErr: unknown) {
      console.error(
        `Failed to update document ${documentId} status to failed:`,
        updateErr,
      );
    }

    return { statusCode: 200, body: 'failed' };
  }
};
