declare module 'pdf-parse' {
  interface PdfData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    version: string;
  }

  interface PdfParseOptions {
    pagerender?: (pageData: unknown) => string;
    max?: number;
    version?: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfData>;
  export = pdfParse;
}

// Internal lib path to bypass test file loading bug
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfData {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfData>;
  export = pdfParse;
}
