/**
 * integration-helpers.ts
 * ─────────────────────────────────────────────────────────
 * Helper to trigger vector embedding from client side
 * ─────────────────────────────────────────────────────────
 */

import { createServerSupabaseClient } from '../lib/ai/supabase-server';
import { getEmbeddings } from '../lib/ai/langchain-embeddings';
import { chunkText } from '../lib/ai/chunker';

/**
 * Trigger vector embedding for already-loaded UTHO document
 * Combines chunks into text and embeds them
 */
export async function triggerVectorEmbedding(
  documentId: string,
  title: string,
  chunks: ReadonlyArray<{ id: string; text: string }>,
  userId: string
): Promise<boolean> {
  if (chunks.length === 0) return false;
  
  try {
    // Combine all chunks into full text
    const fullText = chunks.map(c => c.text).join('\n\n');
    
    // Chunk the combined text
    const textChunks = chunkText(fullText, { chunkSize: 500, overlap: 50 });
    
    if (textChunks.length === 0) return false;
    
    // Get embeddings
    const embeddingResults = await getEmbeddings(textChunks.map(c => c.content));
    
    // Store to Supabase
    const supabase = createServerSupabaseClient();
    
    const rows = textChunks.map((chunk, idx) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      metadata: {
        title,
        user_id: userId,
        source: 'utho',
      },
      embedding: embeddingResults[idx],
    }));
    
    const { error } = await supabase.from('document_chunks').insert(rows);
    
    if (error) {
      console.error('[triggerVectorEmbedding] Insert failed:', error.message);
      return false;
    }
    
    console.log(`[triggerVectorEmbedding] Embedded ${rows.length} chunks for ${documentId}`);
    return true;
    
  } catch (err) {
    console.error('[triggerVectorEmbedding] Error:', err);
    return false;
  }
}

/**
 * Check if document already has vector embeddings
 */
export async function hasVectorEmbeddings(documentId: string): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    const { count } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);
    
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export default {
  triggerVectorEmbedding,
  hasVectorEmbeddings,
};