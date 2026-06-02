/**
 * test_utho_embed_speed.ts
 * ─────────────────────────────────────────────────────────
 * Test: Pull UTHO document → Parse → Chunk → Embed
 * ─────────────────────────────────────────────────────────
 * 
 * Run: cd moduly-ai-landing && npx tsx ../testing_scripts_by_OP/test_utho_embed_speed.ts
 */

import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { extractPdfText } from '../moduly-ai-landing/src/lib/ai/pdf-extract';
import { chunkText } from '../moduly-ai-landing/src/lib/ai/chunker';
import { getEmbedding, getEmbeddings } from '../moduly-ai-landing/src/lib/ai/langchain-embeddings';

// Config
const UTHO_CONFIG = {
  endpoint: process.env.UTHO_ENDPOINT!,
  region: process.env.UTHO_REGION || 'innoida',
  bucket: process.env.UTHO_BUCKET_NAME!,
  accessKeyId: process.env.UTHO_ACCESS_KEY!,
  secretAccessKey: process.env.UTHO_SECRET_KEY!,
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log('🧪 UTHO Document Embedding Speed Test\n');
  console.log('='.repeat(50));
  
  // Test with this PDF
  const TEST_FILE_PATH = 'source/year-2/22is35a/imp/Database_Management_System_Mod_Mod2-Mod1_DBMS_Module_1___2_Exam_Help.pdf';
  const TEST_DOC_ID = '21676d79-b847-443c-8bd4-132d556ea59d';
  const TEST_USER_ID = '961b3102-b2f7-4064-8c8b-e21e954e2f7b';
  
  // Initialize clients
  const s3 = new S3Client({
    endpoint: UTHO_CONFIG.endpoint,
    region: UTHO_CONFIG.region,
    credentials: {
      accessKeyId: UTHO_CONFIG.accessKeyId,
      secretAccessKey: UTHO_CONFIG.secretAccessKey,
    },
    forcePathStyle: true,
  });
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const timings = {
    download: 0,
    parse: 0,
    chunk: 0,
    embed: 0,
    store: 0,
    total: 0,
  };
  
  const startTotal = Date.now();
  
  try {
    // 1. Download
    console.log('\n1️⃣ Downloading from UTHO S3...');
    const downloadStart = Date.now();
    
    const command = new GetObjectCommand({
      Bucket: UTHO_CONFIG.bucket,
      Key: TEST_FILE_PATH,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    timings.download = Date.now() - downloadStart;
    console.log(`   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB in ${timings.download}ms`);
    
    // 2. Parse
    console.log('\n2️⃣ Parsing PDF...');
    const parseStart = Date.now();
    
    const extracted = await extractPdfText(buffer);
    
    timings.parse = Date.now() - parseStart;
    console.log(`   ✅ Extracted ${extracted.text.length} chars from ${extracted.pageCount} pages in ${timings.parse}ms`);
    
    if (extracted.text.length < 100) {
      console.log('   ⚠️  Warning: Very little text - may be scanned/image PDF');
    }
    
    // 3. Chunk
    console.log('\n3️⃣ Chunking text...');
    const chunkStart = Date.now();
    
    const chunks = chunkText(extracted.text, { chunkSize: 500, overlap: 50 });
    
    timings.chunk = Date.now() - chunkStart;
    console.log(`   ✅ Created ${chunks.length} chunks in ${timings.chunk}ms`);
    
    if (chunks.length === 0) {
      throw new Error('No chunks generated!');
    }
    
    // 4. Embed
    console.log('\n4️⃣ Embedding chunks...');
    const embedStart = Date.now();
    
    const BATCH_SIZE = 10;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.content);
      const embeddings = await getEmbeddings(texts);
      allEmbeddings.push(...embeddings);
      
      const progress = Math.min(i + BATCH_SIZE, chunks.length);
      process.stdout.write(`\r   📊 ${progress}/${chunks.length} chunks embedded...`);
    }
    
    timings.embed = Date.now() - embedStart;
    console.log(`\n   ✅ Embedded ${allEmbeddings.length} chunks (${allEmbeddings[0]?.length} dims) in ${timings.embed}ms`);
    
    // 5. Store
    console.log('\n5️⃣ Storing to Supabase pgvector...');
    const storeStart = Date.now();
    
    const rows = chunks.map((chunk, idx) => ({
      document_id: TEST_DOC_ID,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      metadata: {
        title: 'DBMS Module 1-2 Important Questions',
        page_count: extracted.pageCount,
        source: 'utho_test',
      },
      embedding: allEmbeddings[idx],
    }));
    
    const { error } = await supabase.from('document_chunks').insert(rows);
    
    if (error) {
      console.log(`   ⚠️  Insert error: ${error.message}`);
    } else {
      console.log(`   ✅ Stored ${rows.length} chunks to pgvector`);
    }
    
    timings.store = Date.now() - storeStart;
    
    // Summary
    timings.total = Date.now() - startTotal;
    
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
    console.log(`\n📈 Embed Speed: ${chunksPerSec.toFixed(1)} chunks/second`);
    console.log(`📈 Throughput: ${(extracted.pageCount / (timings.total / 1000)).toFixed(1)} pages/second`);
    
    console.log('\n✅ Document ready for vector search!\n');
    
  } catch (err) {
    console.error('\n❌ Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();