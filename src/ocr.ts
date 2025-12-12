const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;

type OcrSpaceResponse = {
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[] | null;
  ParsedResults?: Array<{
    ParsedText?: string;
    ErrorMessage?: string | null;
  }>;
};

const OCR_TIMEOUT_MS = 12_000;

// Simple in-memory cache to avoid repeated OCR calls for the same URL during a process lifetime.
const ocrCache = new Map<string, { text: string | null; at: number }>();
const OCR_CACHE_TTL_MS = 30 * 60 * 1_000; // 30 minutes

function getCached(url: string): string | null | undefined {
  const hit = ocrCache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > OCR_CACHE_TTL_MS) {
    ocrCache.delete(url);
    return undefined;
  }
  return hit.text;
}

function setCached(url: string, text: string | null) {
  ocrCache.set(url, { text, at: Date.now() });
}

/**
 * Best-effort OCR for a PDF/image URL using OCR.Space.
 *
 * Notes:
 * - Only runs when OCR_SPACE_API_KEY is set.
 * - This is used as a fallback for scanned PDFs that have no text layer.
 * - Does NOT throw: returns null on failure.
 */
export async function ocrTextFromUrl(url: string): Promise<string | null> {
  if (!OCR_SPACE_API_KEY) return null;
  if (!url) return null;

  const cached = getCached(url);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    // OCR.Space supports x-www-form-urlencoded. We use the URL endpoint to avoid uploading blobs.
    const body = new URLSearchParams();
    body.set('apikey', OCR_SPACE_API_KEY);
    body.set('url', url);
    body.set('language', 'fre');
    body.set('OCREngine', '2');
    body.set('isOverlayRequired', 'false');
    // Do not request searchable PDF output; we only need text.
    body.set('isCreateSearchablePdf', 'false');

    const res = await fetch('https://api.ocr.space/parse/imageurl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn('[OCR] OCR.Space HTTP error', res.status);
      setCached(url, null);
      return null;
    }

    const json = (await res.json()) as OcrSpaceResponse;
    if (json.IsErroredOnProcessing) {
      console.warn('[OCR] OCR.Space processing error', json.ErrorMessage);
      setCached(url, null);
      return null;
    }

    const text = json.ParsedResults?.[0]?.ParsedText?.trim() || null;
    setCached(url, text);
    return text;
  } catch (err) {
    console.warn('[OCR] OCR.Space request failed', err);
    setCached(url, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}


