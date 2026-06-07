// Force Netlify Dev rebuild of admin-documents function
import { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createServerSupabaseClient } from '../../src/lib/ai/supabase-server.ts';

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

const ADMIN_EMAILS = ['1mj24is016@mvjce.edu.in', '1mj24is038@mvjce.edu.in', 'admin@moduly.ai', 'vtuadmin@moduly.ai'];

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

const deleteFileFromS3 = async (
  s3Client: S3Client,
  filePath: string,
): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: process.env['UTHO_BUCKET_NAME'],
    Key: filePath,
  });
  await s3Client.send(command);
  console.log(`[S3] Deleted file "${filePath}" from bucket`);
};

// ── Vectara File Ingestion ───────────────────────────────────────────────────
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

// ── Admin Authorization Helper ────────────────────────────────────────────────
async function verifyAdmin(event: HandlerEvent, supabase: any) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    throw new Error('No Authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    throw new Error('Malformed Authorization header');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error(`Authentication failed: ${authError?.message || 'Invalid user token'}`);
  }

  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return user;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new Error('Access denied: Administrator permissions required');
  }

  return user;
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const supabase = createServerSupabaseClient();

  try {
    // 1. Verify caller is an administrator
    await verifyAdmin(event, supabase);

    // 2. Handle GET method (fetch all documents with profiles metadata, merged with S3 files)
    if (event.httpMethod === 'GET') {
      // 2a. Fetch files from Utho S3 cloud storage
      let uthoFiles: any[] = [];
      try {
        const s3Client = createS3Client();
        const s3Cmd = new ListObjectsV2Command({
          Bucket: process.env['UTHO_BUCKET_NAME'],
        });
        const s3Data = await s3Client.send(s3Cmd);
        uthoFiles = (s3Data.Contents || [])
          .filter(obj => obj.Key && !obj.Key.startsWith('parsed/'));
      } catch (s3Err) {
        console.warn('[admin-documents] Failed to fetch files from S3:', s3Err);
      }

      // 2b. Fetch registered documents from database
      const { data: docs, error: docErr } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docErr) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: `Failed to fetch documents: ${docErr.message}` }),
        };
      }

      // 2c. Fetch profile metadata
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, email, full_name');

      if (profErr) {
        console.warn('[admin-documents] Profile fetch error:', profErr.message);
      }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const dbMap = new Map((docs || []).map((d: any) => [d.file_path, d]));
      const mergedDocsMap = new Map<string, any>();

      // 2d. Merge: Process S3 files as the source of existence
      for (const file of uthoFiles) {
        if (!file.Key) continue;
        
        const displayKey = file.Key.startsWith('source/')
          ? file.Key.slice('source/'.length)
          : file.Key;

        const dbMatch = dbMap.get(file.Key) || dbMap.get(displayKey);

        if (dbMatch) {
          mergedDocsMap.set(dbMatch.id, {
            ...dbMatch,
            file_size: file.Size,
            profiles: profileMap.get(dbMatch.user_id) || null
          });
        } else {
          // File exists in S3 but has no database record (developer directly uploaded VTU notes)
          const basename = displayKey.split('/').pop() || displayKey;
          const stripped = basename.replace(/^\d+[-_]/, '');
          mergedDocsMap.set(`utho-${file.Key}`, {
            id: `utho-${file.Key}`,
            user_id: 'unknown',
            title: stripped,
            file_path: file.Key,
            file_type: file.Key.split('.').pop()?.toLowerCase() || 'unknown',
            file_size: file.Size,
            status: 'ready',
            chunk_count: 0,
            created_at: file.LastModified ? file.LastModified.toISOString() : new Date().toISOString(),
            profiles: null
          });
        }
      }

      // 2e. Add any remaining DB documents that weren't matched to S3 files (e.g. pending/processing/failed)
      for (const doc of (docs || [])) {
        if (!mergedDocsMap.has(doc.id)) {
          mergedDocsMap.set(doc.id, {
            ...doc,
            profiles: profileMap.get(doc.user_id) || null
          });
        }
      }

      const finalDocs = [...mergedDocsMap.values()];
      // Sort chronologically (latest first)
      finalDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ documents: finalDocs }),
      };
    }

    // 3. Handle POST actions
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body ?? '{}');
      const { action, documentId } = body;

      if (!action || !documentId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Missing action or documentId parameter' }),
        };
      }

      // Action: Approve document and process ingestion
      if (action === 'approve') {
        // Fetch document info
        const { data: doc, error: fetchErr } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (fetchErr || !doc) {
          return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Document not found: ${fetchErr?.message}` }),
          };
        }

        if (doc.status !== 'pending_approval' && doc.status !== 'failed') {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Document has status '${doc.status}' and cannot be approved` }),
          };
        }

        // Set status to 'processing'
        await supabase
          .from('documents')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', documentId);

        try {
          const s3Client = createS3Client();
          console.log(`[Approve] Downloading file "${doc.file_path}" from Utho S3...`);
          const fileBuffer = await downloadFileFromS3(s3Client, doc.file_path);

          const filename = doc.title || doc.file_path.split('/').pop() || 'document';
          console.log(`[Approve] Ingesting to Vectara...`);
          await uploadFileToVectara(fileBuffer, filename, documentId, doc.title, doc.file_type);

          // Update status to 'ready'
          await supabase
            .from('documents')
            .update({ status: 'ready', chunk_count: 1, updated_at: new Date().toISOString() })
            .eq('id', documentId);

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'Document approved and indexed successfully', status: 'ready' }),
          };
        } catch (ingestionErr: any) {
          console.error('[Approve] Ingestion failed:', ingestionErr);
          
          // Set status back to failed
          await supabase
            .from('documents')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', documentId);

          return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ 
              error: `Ingestion failed: ${ingestionErr.message || ingestionErr}`, 
              status: 'failed' 
            }),
          };
        }
      }

      // Action: Reject or Delete document
      if (action === 'delete') {
        let filePath = '';

        if (documentId.startsWith('utho-')) {
          // S3-only document uploaded directly by developer
          filePath = documentId.slice('utho-'.length);
        } else {
          // Fetch document info first
          const { data: doc, error: fetchErr } = await supabase
            .from('documents')
            .select('file_path')
            .eq('id', documentId)
            .single();

          if (fetchErr || !doc) {
            return {
              statusCode: 404,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: `Document not found: ${fetchErr?.message}` }),
            };
          }
          filePath = doc.file_path;
        }

        const s3Client = createS3Client();

        // 1. Delete from Utho S3 storage
        try {
          await deleteFileFromS3(s3Client, filePath);
        } catch (s3Err) {
          console.warn(`[Delete] File delete from Utho storage failed:`, s3Err);
          // We continue to delete the DB record even if Utho deletion fails
        }

        // 2. Delete from Supabase Database (only if it wasn't S3-only)
        if (!documentId.startsWith('utho-')) {
          const { error: deleteErr } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId);

          if (deleteErr) {
            return {
              statusCode: 500,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: `Database deletion failed: ${deleteErr.message}` }),
            };
          }
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ message: 'Document rejected and deleted successfully' }),
        };
      }

      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Unsupported action: ${action}` }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  } catch (err: any) {
    console.error('[admin-documents] Error:', err.message || err);
    return {
      statusCode: err.message?.includes('Access denied') || err.message?.includes('Authentication') ? 403 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
