
import 'dotenv/config';
import { getEmbedding } from './src/lib/ai/embedding.ts';
import { createServerSupabaseClient } from './src/lib/ai/supabase-server.ts';
console.log('Testing getting embeddings...');
getEmbedding('hi').then(res => console.log('Embeddings success! length:', res.length)).catch(console.error);
console.log('Testing Supabase client...');
try {
  const supabase = createServerSupabaseClient();
  supabase.rpc('match_documents_filtered', { query_embedding: Array(1536).fill(0), match_threshold: 0.1, match_count: 1 })
    .then(res => console.log('Supabase RAG success:', res))
    .catch(console.error);
} catch (e) {
  console.error('Supabase setup failed:', e);
}

