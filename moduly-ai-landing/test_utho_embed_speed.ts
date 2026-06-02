/**
 * test_utho_embed_speed.ts
 * Run: npx tsx test_utho_embed_speed.ts
 */

import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { extractPdfText } from './src/lib/ai/pdf-extract';
import { chunkText } from './src/lib/ai/chunker';
import { getEmbeddings } from './src/lib/ai/langchain-embeddings';

const UTHO = {
  endpoint: process.env.UTHO_ENDPOINT!,
  region: process.env.UTHO_REGION || 'innoida',
  bucket: process.env.UTHO_BUCKET_NAME!,
  accessKeyId: process.env.UTHO_ACCESS_KEY!,
  secretAccessKey: process.env.UTHO_SECRET_KEY!,
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log('\n🧪 UTHO Document Embedding Speed Test\n');
  console.log('='.repeat(50));

  // Test PDF
  const TEST_FILE = 'source/year-2/22is35a/imp/Database_Management_System_Mod_Mod2-Mod1_DBMS_Module_1___2_Exam_Help.pdf';
  const TEST_DOC_ID = '21676d79-b847-443c-8bd4-132d556ea59d';

  const s3 = new S3Client({
    endpoint: UTHO.endpoint,
    region: UTHO.region,
    credentials: { accessKeyId: UTHO.accessKeyId, secretAccessKey: UTHO.secretAccessKey },
    forcePathStyle: true,
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const timings: Record<string, number> = {};
  const start = Date.now();

  try {
    // 1. Download
    console.log('\n1️⃣ Downloading...');
    const t0 = Date.now();
    const cmd = new GetObjectCommand({ Bucket: UTHO.bucket, Key: TEST_FILE });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    timings.download = Date.now() - t0;
    console.log(`   ✅ ${(buf.length / 1024 / 1024).toFixed(2)} MB in ${timings.download}ms`);

    // 2. Parse
    console.log('\n2️⃣ Parsing PDF...');
    const t1 = Date.now();
    const extracted = await extractPdfText(buf);
    timings.parse = Date.now() - t1;
    console.log(`   ✅ ${extracted.text.length} chars, ${extracted.pageCount} pages in ${timings.parse}ms`);

    // 3. Chunk
    console.log('\n3️⃣ Chunking...');
    const t2 = Date.now();
    const chunks = chunkText(extracted.text, { chunkSize: 500, overlap: 50 });
    timings.chunk = Date.now() - t2;
    console.log(`   ✅ ${chunks.length} chunks in ${timings.chunk}ms`);

    // 4. Embed
    console.log('\n4️⃣ Embedding...');
    const t3 = Date.now();
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const emb = await getEmbeddings(batch.map(c => c.content));
      allEmbeddings.push(...emb);
      process.stdout.write(`\r   📊 ${Math.min(i + 10, chunks.length)}/${chunks.length}`);
    }

    timings.embed = Date.now() - t3;
    console.log(`\n   ✅ ${allEmbeddings.length} × ${allEmbeddings[0]?.length} dims in ${timings.embed}ms`);

    // 5. Store
    console.log('\n5️⃣ Storing to pgvector...');
    const t4 = Date.now();

    const rows = chunks.map((c, i) => ({
      document_id: TEST_DOC_ID,
      content: c.content,
      chunk_index: c.chunkIndex,
      metadata: { title: 'DBMS Important Questions', page_count: extracted.pageCount },
      embedding: allEmbeddings[i],
    }));

    const { error } = await supabase.from('document_chunks').insert(rows);
    timings.store = Date.now() - t4;

    if (error) console.log(`   ⚠️  ${error.message}`);
    else console.log(`   ✅ ${rows.length} chunks stored`);

    // Summary
    timings.total = Date.now() - start;

    console.log('\n' + '='.repeat(50));
    console.log('📊 TIMING SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Download:  ${(timings.download / 1000).toFixed(2)}s`);
    console.log(`   Parse:     ${(timings.parse / 1000).toFixed(2)}s`);
    console.log(`   Chunk:     ${timings.chunk}ms`);
    console.log(`   Embed:     ${(timings.embed / 1000).toFixed(2)}s`);
    console.log(`   Store:     ${timings.store}ms`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   TOTAL:    ${(timings.total / 1000).toFixed(2)}s`);
    console.log('='.repeat(50));

    const chunksPerSec = chunks.length / (timings.embed / 1000);
    console.log(`\n📈 Embed Speed: ${chunksPerSec.toFixed(1)} chunks/sec`);
    console.log(`📈 Pages/sec: ${(extracted.pageCount / (timings.total / 1000)).toFixed(1)}`);
    console.log('\n✅ Ready for vector search!\n');

  } catch (err) {
    console.error('\n❌', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();