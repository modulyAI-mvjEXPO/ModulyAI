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
  const { error } = await supabase
    .from('documents')
    .update({
      status,
      ...(chunkCount !== undefined ? { chunk_count: chunkCount } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  if (error) {
    throw new Error(`Failed to update document status to ${status}: ${error.message}`);
  }
};

const embedAndStoreChunks = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  chunks: ReturnType<typeof chunkText>,
  pageCount: number,
): Promise<void> => {
  const BATCH_SIZE = 5;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (chunk) => {
        const embedding = await getEmbedding(chunk.content);

        const { error } = await supabase.from('document_chunks').insert({
          document_id: documentId,
          content: chunk.content,
          chunk_index: chunk.chunkIndex,
          metadata: {
            page_count: pageCount,
          },
          embedding: embedding as unknown as string,
        });

        if (error) {
          throw new Error(
            `Failed to insert chunk ${chunk.chunkIndex}: ${error.message}`,
          );
        }
      }),
    );
  }
};

const processDocument = async (
  documentId: string,
  filePath: string,
): Promise<void> => {
  const supabase = createServerSupabaseClient();
  const s3Client = createS3Client();

  try {
    console.log(`Downloading PDF from S3 for document ${documentId}...`);
    const pdfBuffer = await downloadPdfFromS3(s3Client, filePath);

    console.log(`Extracting text from PDF for document ${documentId}...`);
    const { text, pageCount, isScanned } = await extractPdfText(pdfBuffer);

    if (!text.trim() || isScanned) {
      console.warn(`No readable text or scanned PDF detected for document ${documentId}.`);
      await updateDocumentStatus(supabase, documentId, 'no_text', 0);
      return;
    }

    console.log(`Chunking extracted text for document ${documentId}...`);
    const chunks = chunkText(text);

    console.log(`Embedding and storing ${chunks.length} chunks for document ${documentId}...`);
    await embedAndStoreChunks(supabase, documentId, chunks, pageCount);

    console.log(`Document ${documentId} processed successfully!`);
    await updateDocumentStatus(supabase, documentId, 'ready', chunks.length);
  } catch (error) {
    console.error(`Document processing failed internally for ${documentId}:`, error);
    throw error;
  }
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
