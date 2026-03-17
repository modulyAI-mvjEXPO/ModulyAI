import type { TextChunk } from './types';

type ChunkOptions = {
  readonly chunkSize?: number;
  readonly overlap?: number;
};

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;
const MIN_CHUNK_LENGTH = 20;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSentenceBoundary(text: string, end: number): number {
  const windowStart = Math.floor(end * 0.8);
  for (let i = end; i >= windowStart; i--) {
    const char = text[i - 1];
    if ((char === '.' || char === '!' || char === '?') && i < text.length) {
      const next = text[i];
      if (next === ' ' || next === '\n' || next === undefined) {
        return i;
      }
    }
  }
  return -1;
}

function findWordBoundary(text: string, end: number): number {
  for (let i = end; i > 0; i--) {
    if (text[i] === ' ') {
      return i;
    }
  }
  return -1;
}

export function chunkText(
  text: string,
  options?: ChunkOptions,
): ReadonlyArray<TextChunk> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  const normalized = normalizeWhitespace(text);

  if (normalized.length === 0) {
    return [];
  }

  if (normalized.length <= chunkSize) {
    if (normalized.length < MIN_CHUNK_LENGTH) {
      return [];
    }
    return [{ content: normalized, chunkIndex: 0 }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let prevStart = -1;

  while (start < normalized.length) {
    if (start === prevStart) {
      break;
    }
    prevStart = start;

    let end = start + chunkSize;

    if (end >= normalized.length) {
      const remaining = normalized.slice(start).trim();
      if (remaining.length >= MIN_CHUNK_LENGTH) {
        chunks.push({ content: remaining, chunkIndex: chunks.length });
      }
      break;
    }

    let splitPoint = findSentenceBoundary(normalized, end);

    if (splitPoint === -1) {
      splitPoint = findWordBoundary(normalized, end);
    }

    if (splitPoint === -1 || splitPoint <= start) {
      splitPoint = end;
    }

    const content = normalized.slice(start, splitPoint).trim();

    if (content.length >= MIN_CHUNK_LENGTH) {
      chunks.push({ content, chunkIndex: chunks.length });
    }

    const nextStart = splitPoint - overlap;
    start = nextStart > start ? nextStart : splitPoint;
  }

  return chunks;
}
