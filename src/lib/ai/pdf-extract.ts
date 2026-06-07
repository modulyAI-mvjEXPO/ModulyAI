import { PDFParse } from 'pdf-parse';
import type { PdfExtractionResult } from './types';

const SCANNED_PDF_THRESHOLD = 50;

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = result.text.trim();

    return {
      text,
      pageCount: result.total,
      isScanned: text.length < SCANNED_PDF_THRESHOLD,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF extraction failed: ${message}`);
  } finally {
    await parser.destroy();
  }
}
