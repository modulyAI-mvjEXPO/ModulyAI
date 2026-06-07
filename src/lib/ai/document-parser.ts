/**
 * document-parser.ts
 * ─────────────────────────────────────────────────────────
 * Universal document parser for ALL educational document types
 * Supports: PDF, DOCX, PPTX, TXT, Images (PNG/JPG), Scanned PDFs
 * 
 * Uses Groq Vision API for OCR on images and scanned PDFs
 * ─────────────────────────────────────────────────────────
 */

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ParseResult {
  readonly text: string;
  readonly pageCount: number;
  readonly type: DocumentType;
  readonly isScanned: boolean;
  readonly error?: string;
}

export type DocumentType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'image' | 'unknown';

// Config - these should come from environment
const getConfig = () => ({
  utho: {
    endpoint: process.env.UTHO_ENDPOINT!,
    region: process.env.UTHO_REGION || 'innoida',
    bucket: process.env.UTHO_BUCKET_NAME!,
    accessKeyId: process.env.UTHO_ACCESS_KEY!,
    secretAccessKey: process.env.UTHO_SECRET_KEY!,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY!,
  },
});

/**
 * Create S3 client for UTHO
 */
const createS3Client = () => {
  const config = getConfig();
  return new S3Client({
    endpoint: config.utho.endpoint,
    region: config.utho.region,
    credentials: {
      accessKeyId: config.utho.accessKeyId,
      secretAccessKey: config.utho.secretAccessKey,
    },
    forcePathStyle: true,
  });
};

/**
 * Download file from UTHO S3
 */
export async function downloadFromUtho(filePath: string): Promise<Buffer> {
  const s3 = createS3Client();
  const config = getConfig();
  
  const command = new GetObjectCommand({
    Bucket: config.utho.bucket,
    Key: filePath,
  });
  
  const response = await s3.send(command);
  
  if (!response.Body) {
    throw new Error('Empty response from S3');
  }
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Download and get presigned URL for viewing
 */
export async function getUthoUrl(filePath: string): Promise<string> {
  const s3 = createS3Client();
  const config = getConfig();
  
  const command = new GetObjectCommand({
    Bucket: config.utho.bucket,
    Key: filePath,
  });
  
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

// ─────────────────────────────────────────────────────────────────────
// OCR with Groq Vision API
// ─────────────────────────────────────────────────────────────────────

/**
 * Extract text from image using Groq Vision API (Llama 3.2 Vision)
 * Works for: PNG, JPG, JPEG, and scanned PDF pages
 */
async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const config = getConfig();
  
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }
  
  // Convert to base64
  const base64 = buffer.toString('base64');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ALL text from this educational document/image. 
Preserve the structure and formatting as much as possible.
For tables, preserve table structure with rows and columns.
For bullet points and numbered lists, keep them as lists.
Include any headers, footers, and page numbers.
This is for study purposes - extract EVERYTHING.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq Vision OCR failed: ${response.status} - ${err}`);
  }
  
  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  
  return data.choices[0]?.message?.content ?? '';
}

// ─────────────────────────────────────────────────────────────────────
// PDF Parsing
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse digital PDF
 */
async function parseDigitalPdf(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    const isScanned = text.length < 100; // Less than 100 chars = likely scanned
    
    return {
      text,
      pageCount: result.total,
      type: 'pdf',
      isScanned,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Convert PDF pages to images and OCR each (for scanned PDFs)
 */
async function parseScannedPdf(buffer: Buffer): Promise<ParseResult> {
  // For scanned PDFs, we need to convert pages to images
  // This is complex - for now, try using Groq Vision directly on the PDF
  // If that fails, we'll need a PDF-to-image converter
  
  const config = getConfig();
  
  // Try Groq Vision directly on PDF (it can handle multi-page PDFs)
  const base64 = buffer.toString('base64');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ALL text from this PDF document. 
This appears to be a scanned/document image.
Preserve all content, structure, tables, and formatting.
Extract every single piece of text for study purposes.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:application/pdf;base64,${base64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OCR failed: ${response.status}`);
  }
  
  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  
  const text = data.choices[0]?.message?.content ?? '';
  
  return {
    text,
    pageCount: 1, // Hard to determine from OCR
    type: 'pdf',
    isScanned: true,
  };
}

// ─────────────────────────────────────────────────────────────────────
// DOCX Parsing
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse DOCX file
 */
async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  
  return {
    text,
    pageCount: Math.ceil(text.length / 3000), // Rough estimate
    type: 'docx',
    isScanned: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// PPTX Parsing  
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse PPTX file - extracts text from all slides
 */
async function parsePptx(buffer: Buffer): Promise<ParseResult> {
  // Use mammoth's PPTX support
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  
  return {
    text,
    pageCount: (text.match(/Slide \d+/g) || []).length || 1,
    type: 'pptx',
    isScanned: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// TXT Parsing
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse plain text file
 */
function parseTxt(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8').trim();
  
  return {
    text,
    pageCount: Math.ceil(text.length / 3000),
    type: 'txt',
    isScanned: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Image Parsing (PNG, JPG, JPEG)
// ─────────────────────────────────────────────────────────────────────

/**
 * Parse image file - uses OCR
 */
async function parseImage(buffer: Buffer, extension: string): Promise<ParseResult> {
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
  
  const text = await extractTextFromImage(buffer, mimeType);
  
  return {
    text,
    pageCount: 1,
    type: 'image',
    isScanned: true, // All images are essentially "scanned"
  };
}

// ─────────────────────────────────────────────────────────────────────
// Main Parser
// ─────────────────────────────────────────────────────────────────────

/**
 * Detect document type from file extension
 */
export function detectType(filename: string): DocumentType {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'pptx':
    case 'ppt':
      return 'pptx';
    case 'txt':
      return 'txt';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'webp':
      return 'image';
    default:
      return 'unknown';
  }
}

/**
 * Main parse function - handles all document types
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  useOcrFallback = true,
): Promise<ParseResult> {
  const type = detectType(filename);
  
  try {
    switch (type) {
      case 'pdf': {
        // First try digital parse
        const digitalResult = await parseDigitalPdf(buffer);
        
        // If scanned (very little text), try OCR
        if (digitalResult.isScanned && useOcrFallback) {
          console.log('[parser] PDF appears scanned, using OCR...');
          return parseScannedPdf(buffer);
        }
        
        return digitalResult;
      }
      
      case 'docx':
        return parseDocx(buffer);
      
      case 'pptx':
        return parsePptx(buffer);
      
      case 'txt':
        return parseTxt(buffer);
      
      case 'image': {
        const ext = filename.toLowerCase().split('.').pop() || 'png';
        return parseImage(buffer, ext);
      }
      
      default:
        return {
          text: '',
          pageCount: 0,
          type: 'unknown',
          isScanned: false,
          error: `Unsupported file type: ${filename}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // If parse failed and OCR fallback enabled, try OCR
    if (useOcrFallback && type === 'pdf') {
      console.log('[parser] Digital parse failed, trying OCR...');
      try {
        return parseScannedPdf(buffer);
      } catch {
        // OCR also failed
        return {
          text: '',
          pageCount: 0,
          type,
          isScanned: true,
          error: message,
        };
      }
    }
    
    return {
      text: '',
      pageCount: 0,
      type,
      isScanned: type === 'image',
      error: message,
    };
  }
}

/**
 * Parse document from UTHO by file path
 */
export async function parseUthoDocument(filePath: string): Promise<ParseResult> {
  console.log(`[parser] Downloading from UTHO: ${filePath}`);
  const buffer = await downloadFromUtho(filePath);
  console.log(`[parser] Downloaded ${buffer.length} bytes`);
  
  return parseDocument(buffer, filePath);
}

export default {
  parseDocument,
  parseUthoDocument,
  detectType,
  downloadFromUtho,
  getUthoUrl,
};