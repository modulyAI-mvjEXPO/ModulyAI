import 'dotenv/config';
import { getEmbedding } from './src/lib/ai/embedding.ts';
import { createServerSupabaseClient } from './src/lib/ai/supabase-server.ts';

async function run() {
  console.log('Testing getting embeddings...');
  try {
    const res = await getEmbedding('hi');
    console.log('Embeddings success! length:', res.length);
  } catch(e) {
    console.error('Embeddings failed:', e);
  }

  console.log('Testing Supabase client...');
  try {
    const supabase = createServerSupabaseClient();
    const res = await supabase.rpc('match_documents_filtered', { query_embedding: Array(1536).fill(0), match_threshold: 0.1, match_count: 1 });
    console.log('Supabase RAG success:', res);
  } catch (e) {
    console.error('Supabase setup failed:', e);
  }
}

run();
