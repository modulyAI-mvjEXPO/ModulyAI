import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetText = vi.fn();
const mockDestroy = vi.fn().mockResolvedValue(undefined);

vi.mock('pdf-parse', () => {
  const PDFParse = vi.fn(function (this: Record<string, unknown>) {
    this.getText = mockGetText;
    this.destroy = mockDestroy;
  });
  return { PDFParse };
});

import { extractPdfText } from './pdf-extract';

const createTextResult = (text: string, total: number) => ({
  text,
  total,
  pages: [],
  getPageText: () => '',
});

describe('extractPdfText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDestroy.mockResolvedValue(undefined);
  });

  it('returns text content from a valid PDF buffer', async () => {
    mockGetText.mockResolvedValueOnce(
      createTextResult('Hello world this is a sample PDF document with enough text content.', 3),
    );

    const result = await extractPdfText(Buffer.from('fake-pdf'));
    expect(result.text).toBe('Hello world this is a sample PDF document with enough text content.');
  });

  it('constructs PDFParse with data as Uint8Array', async () => {
    mockGetText.mockResolvedValueOnce(createTextResult('Some content that is long enough.'.repeat(3), 1));

    const { PDFParse } = await import('pdf-parse');
    const buf = Buffer.from('fake-pdf');
    await extractPdfText(buf);

    expect(PDFParse).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
  });

  it('returns pageCount from TextResult.total', async () => {
    mockGetText.mockResolvedValueOnce(
      createTextResult('Some text content that is long enough for the test to work correctly.', 5),
    );

    const result = await extractPdfText(Buffer.from('fake-pdf'));
    expect(result.pageCount).toBe(5);
  });

  it('marks isScanned=true when extracted text is < 50 chars', async () => {
    mockGetText.mockResolvedValueOnce(createTextResult('Short', 1));

    const result = await extractPdfText(Buffer.from('fake-pdf'));
    expect(result.isScanned).toBe(true);
  });

  it('marks isScanned=false when extracted text is >= 50 chars', async () => {
    mockGetText.mockResolvedValueOnce(createTextResult('A'.repeat(50), 1));

    const result = await extractPdfText(Buffer.from('fake-pdf'));
    expect(result.isScanned).toBe(false);
  });

  it('throws descriptive error when getText fails', async () => {
    mockGetText.mockRejectedValueOnce(new Error('Invalid PDF structure'));

    await expect(extractPdfText(Buffer.from('corrupt-pdf'))).rejects.toThrow(
      'PDF extraction failed: Invalid PDF structure',
    );
  });

  it('trims the extracted text', async () => {
    mockGetText.mockResolvedValueOnce(
      createTextResult('   Hello world this is content with whitespace around it.   ', 1),
    );

    const result = await extractPdfText(Buffer.from('fake-pdf'));
    expect(result.text).toBe('Hello world this is content with whitespace around it.');
  });

  it('calls destroy after successful extraction', async () => {
    mockGetText.mockResolvedValueOnce(createTextResult('Some long enough text for the test.'.repeat(2), 1));

    await extractPdfText(Buffer.from('fake-pdf'));
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('calls destroy even when getText throws', async () => {
    mockGetText.mockRejectedValueOnce(new Error('Parse error'));

    await expect(extractPdfText(Buffer.from('bad-pdf'))).rejects.toThrow();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });
});
