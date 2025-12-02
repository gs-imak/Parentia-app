// pdf-parse is CommonJS, use dynamic import workaround for ESM
// Types are defined in src/types/pdf-parse.d.ts
type PdfParseFunction = (buffer: Buffer, options?: { max: number }) => Promise<{ text: string; numpages: number }>;

const pdfParse = async (buffer: Buffer): Promise<{ text: string; numpages: number }> => {
  const pdf = await import('pdf-parse');
  // Handle both ESM default export and CommonJS module.exports
  const parser: PdfParseFunction = (pdf as unknown as { default: PdfParseFunction }).default 
    ?? (pdf as unknown as PdfParseFunction);
  
  // Call with options to prevent test file lookup issue
  return parser(buffer, { max: 0 }); // max: 0 means parse all pages
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
