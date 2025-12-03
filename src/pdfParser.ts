// pdf-parse is CommonJS, use dynamic import workaround for ESM
// Types are defined in src/types/pdf-parse.d.ts
// IMPORTANT: pdf-parse has a bug where it tries to load a test PDF file on init.
// We use the internal lib path to bypass this issue.

type PdfParseResult = { text: string; numpages: number; info: unknown };
type PdfParseFunction = (buffer: Buffer) => Promise<PdfParseResult>;

const pdfParse = async (buffer: Buffer): Promise<PdfParseResult> => {
  // Import the internal lib directly to avoid test file loading issue
  // See: https://gitlab.com/nicholiern/pdf-parse/-/issues/24
  const pdfParseFn = await import('pdf-parse/lib/pdf-parse.js');
  const parser: PdfParseFunction = (pdfParseFn as unknown as { default: PdfParseFunction }).default 
    ?? (pdfParseFn as unknown as PdfParseFunction);
  
  return parser(buffer);
};

// Maximum PDF size: 10MB
const MAX_PDF_SIZE = 10 * 1024 * 1024;

// Minimum text length to consider PDF as text-based (not scanned)
// Lowered to 10 to catch PDFs with minimal text (e.g., amounts/dates only)
const MIN_TEXT_LENGTH = 10;

// Maximum text length to return (avoid token limits)
const MAX_TEXT_LENGTH = 10000;

/**
 * Extract text content from a PDF buffer
 * Only works with text-based PDFs (not scanned images)
 * 
 * @param buffer - PDF file content as Buffer
 * @returns Extracted text, or null if extraction fails or PDF is image-based
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  // Size check
  if (buffer.length > MAX_PDF_SIZE) {
    console.warn(`PDF too large (${Math.round(buffer.length / 1024 / 1024)}MB), skipping extraction`);
    return null;
  }
  
  try {
    const result = await pdfParse(buffer);
    const text = result.text?.trim();
    
    // Check if text extraction yielded meaningful content
    if (!text || text.length < MIN_TEXT_LENGTH) {
      console.warn('PDF appears to be image-based or empty (insufficient text extracted)');
      return null;
    }
    
    // Truncate to avoid token limits
    if (text.length > MAX_TEXT_LENGTH) {
      console.log(`PDF text truncated from ${text.length} to ${MAX_TEXT_LENGTH} chars`);
      return text.slice(0, MAX_TEXT_LENGTH);
    }
    
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PDF parsing failed:', message);
    return null;
  }
}

/**
 * Check if a file is a PDF based on content type or filename
 */
export function isPdf(contentType: string, filename: string): boolean {
  return (
    contentType === 'application/pdf' ||
    filename.toLowerCase().endsWith('.pdf')
  );
}
