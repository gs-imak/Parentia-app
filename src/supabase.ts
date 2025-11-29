import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Initialize Supabase client (lazy - only when needed)
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Upload a file to Supabase Storage
 * @param buffer - File content as Buffer
 * @param filename - Original filename
 * @param contentType - MIME type (e.g., 'application/pdf')
 * @returns Public URL of the uploaded file, or null on failure
 */
export async function uploadAttachment(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  try {
    const supabase = getSupabase();
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `attachments/${timestamp}_${sanitizedFilename}`;
    
    // Upload to 'email-attachements' bucket
    const { data, error } = await supabase.storage
      .from('email-attachements')
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase upload error:', error.message);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('email-attachements')
      .getPublicUrl(storagePath);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Supabase upload failed:', error);
    return null;
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
