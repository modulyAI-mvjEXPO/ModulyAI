import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';
import { extractPdfText } from '../../src/lib/ai/pdf-extract.ts';
import { chunkText } from '../../src/lib/ai/chunker.ts';
import { getEmbedding } from '../../src/lib/ai/embedding.ts';
import https from 'https';

type BackgroundEvent = {
  readonly httpMethod: string;
  readonly body: string | null;
};

type BackgroundBody = {
  readonly documentId: string;
  readonly filePath: string;
  readonly title?: string;
};

type HandlerResponse = {
  readonly statusCode: number;
  readonly body: string;
};

type ParsedDocumentJson = {
  readonly documentId: string;
  readonly title: string;
  readonly sourcePath: string;
  readonly parsedAt: string;
  readonly pageCount: number;
  readonly totalChunks: number;
  readonly chunks: ReadonlyArray<{
    readonly index: number;
    readonly content: string;
  }>;
  readonly fullText: string;
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

  if (!bodyBytes) {
    throw new Error('Empty response from S3');
  }

  return Buffer.from(bodyBytes);
};

/**
 * Uploads the parsed JSON to Utho at the `parsed/` mirror path.
 * E.g. source path `source/year-2/22is35a/notes/file.pdf`
 *   → parsed path `parsed/year-2/22is35a/notes/file.json`
 */
const uploadParsedJson = async (
  s3Client: S3Client,
  sourcePath: string,
  parsedDoc: ParsedDocumentJson,
): Promise<string> => {
  // Compute the mirror path: source/... → parsed/..., .ext → .json
  let parsedKey: string;
  if (sourcePath.startsWith('source/')) {
    parsedKey = 'parsed/' + sourcePath.slice('source/'.length);
  } else {
    parsedKey = 'parsed/' + sourcePath;
  }
  // Replace file extension with .json
  parsedKey = parsedKey.replace(/\.[^.]+$/, '.json');

  const jsonBuffer = Buffer.from(JSON.stringify(parsedDoc, null, 2), 'utf-8');

  // Use signed URL + native https to bypass SSL issues (same as upload-to-utho.mjs)
  const command = new PutObjectCommand({
    Bucket: process.env['UTHO_BUCKET_NAME'],
    Key: parsedKey,
    ContentType: 'application/json',
    ACL: 'public-read',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  await new Promise<void>((resolve, reject) => {
    const doUpload = (targetUrl: string): void => {
      const parsedUrl = new URL(targetUrl);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': jsonBuffer.length,
        },
        rejectUnauthorized: false,
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk: string) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else if (res.statusCode === 307 || res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 308) {
            if (res.headers['location']) {
              doUpload(res.headers['location']);
            } else {
              reject(new Error(`Redirect with no Location header: ${res.statusCode}`));
            }
          } else {
            reject(new Error(`Utho parsed upload failed: ${res.statusCode}\n${responseBody}`));
          }
        });
      });

      req.on('error', (e: Error) => reject(e));
      req.write(jsonBuffer);
      req.end();
    };

    doUpload(uploadUrl);
  });

  console.log(`Parsed JSON uploaded to: ${parsedKey}`);
  return parsedKey;
};

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

const embedAndStoreChunks = async (
  supabase: ReturnType<typeof createServerSupabaseClient>,
  documentId: string,
  chunks: ReturnType<typeof chunkText>,
  pageCount: number,
): Promise<void> => {
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const embeddings = await Promise.all(
      batch.map(chunk => getEmbedding(chunk.content))
    );

    const rows = batch.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      metadata: {
        page_count: pageCount,
      },
      embedding: embeddings[index] as unknown as string,
    }));

    const { error } = await supabase.from('document_chunks').insert(rows);

    if (error) {
      throw new Error(`Failed to bulk insert chunks ${i} to ${i + batch.length - 1}: ${error.message}`);
    }
  }
};

const processDocument = async (
  documentId: string,
  filePath: string,
  title?: string,
): Promise<void> => {
  const supabase = createServerSupabaseClient();
  const s3Client = createS3Client();

  try {
    console.log(`Downloading document from S3 for document ${documentId}...`);
    const fileBuffer = await downloadFileFromS3(s3Client, filePath);

    console.log(`Extracting text for document ${documentId}...`);
    const { text, pageCount, isScanned } = await extractPdfText(fileBuffer);

    if (!text.trim() || isScanned) {
      console.warn(`No readable text or scanned PDF detected for document ${documentId}.`);
      await updateDocumentStatus(supabase, documentId, 'no_text', { chunk_count: 0 });
      return;
    }

    console.log(`Chunking extracted text for document ${documentId}...`);
    const chunks = chunkText(text);

    // ── Upload parsed JSON to Utho under parsed/ folder ─────────────────
    const parsedDoc: ParsedDocumentJson = {
      documentId,
      title: title || filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled',
      sourcePath: filePath,
      parsedAt: new Date().toISOString(),
      pageCount,
      totalChunks: chunks.length,
      chunks: chunks.map(c => ({ index: c.chunkIndex, content: c.content })),
      fullText: text,
    };

    let parsedPath: string | undefined;
    try {
      parsedPath = await uploadParsedJson(s3Client, filePath, parsedDoc);
    } catch (uploadErr) {
      console.error(`Failed to upload parsed JSON for ${documentId}:`, uploadErr);
      // Non-fatal — continue with embedding
    }

    // ── Embed and store chunks in Supabase ──────────────────────────────
    console.log(`Embedding and storing ${chunks.length} chunks for document ${documentId}...`);
    await embedAndStoreChunks(supabase, documentId, chunks, pageCount);

    console.log(`Document ${documentId} processed successfully!`);
    await updateDocumentStatus(supabase, documentId, 'ready', {
      chunk_count: chunks.length,
      ...(parsedPath ? { parsed_path: parsedPath } : {}),
    });
  } catch (error) {
    console.error(`Document processing failed internally for ${documentId}:`, error);
    throw error;
  }
};

export const handler = async (
  event: BackgroundEvent,
): Promise<HandlerResponse> => {
  const { documentId, filePath, title } = JSON.parse(
    event.body ?? '{}',
  ) as BackgroundBody;

  if (!documentId || !filePath) {
    console.error('Missing documentId or filePath in background function');
    return { statusCode: 200, body: 'missing_params' };
  }

  try {
    await processDocument(documentId, filePath, title);
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
