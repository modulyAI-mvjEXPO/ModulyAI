import { describe, it, expect } from 'vitest';
import { chunkText } from './chunker';

describe('chunkText', () => {
  it('splits text into chunks of approximately chunkSize characters', () => {
    const text = 'A'.repeat(200);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 0 });
    expect(chunks.length).toBe(2);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    });
  });

  it('creates overlapping chunks', () => {
    // Use a string without word boundaries so overlap is exact
    const text = 'A'.repeat(200);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // With uniform characters and no word/sentence boundaries, overlap should be exact
    // Chunk 0: 0..100, Chunk 1 starts at 80 (100 - 20 overlap)
    // So chunk 0 length + chunk 1 length > total text length (due to overlap)
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.content.length, 0);
    expect(totalChunkChars).toBeGreaterThan(200);
  });

  it('prefers splitting at sentence boundaries', () => {
    // Place a sentence boundary near the chunk boundary
    const text = 'Hello world this is a test. Another sentence starts here and keeps going on for a while longer.';
    const chunks = chunkText(text, { chunkSize: 30, overlap: 0 });
    // First chunk should end at the sentence boundary
    expect(chunks[0].content).toMatch(/\.$/);
  });

  it('falls back to word boundaries when no sentence boundary within window', () => {
    // No sentence-ending punctuation at all
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen';
    const chunks = chunkText(text, { chunkSize: 30, overlap: 0 });
    // Each chunk should be trimmed (no leading/trailing spaces)
    chunks.forEach((chunk) => {
      expect(chunk.content.trim()).toBe(chunk.content);
    });
    // Chunks should contain only complete words (no partial words)
    chunks.forEach((chunk) => {
      const words = chunk.content.split(' ');
      words.forEach((word) => {
        expect(['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen']).toContain(word);
      });
    });
  });

  it('normalizes whitespace', () => {
    const text = 'Hello    world\r\n\r\nThis   is\n\n\na    test sentence for chunking purposes here.';
    const chunks = chunkText(text, { chunkSize: 500, overlap: 0 });
    expect(chunks.length).toBe(1);
    // No double spaces or \r\n should remain
    expect(chunks[0].content).not.toMatch(/\s{2,}/);
    expect(chunks[0].content).not.toContain('\r');
  });

  it('skips chunks shorter than 20 chars', () => {
    // 90 chars total, chunkSize 80, overlap 0 => chunk1 ~80 chars, chunk2 ~10 chars (should be filtered)
    const text = 'A'.repeat(90);
    const chunks = chunkText(text, { chunkSize: 80, overlap: 0 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(20);
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
    expect(chunkText('\n\n\r\n')).toEqual([]);
  });

  it('returns single chunk for text shorter than chunkSize', () => {
    const text = 'This is a short text that fits in one chunk.';
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });

  it('assigns sequential chunkIndex starting from 0', () => {
    const text = 'word '.repeat(100); // 500 chars
    const chunks = chunkText(text, { chunkSize: 100, overlap: 10 });
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });

  it('uses default values (500 chars, 50 overlap) when no options provided', () => {
    const text = 'A'.repeat(1000);
    const chunks = chunkText(text);
    // With 500 chunk size and 50 overlap, first chunk is ~500 chars
    expect(chunks[0].content.length).toBeLessThanOrEqual(500);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});
