import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClientInstance: SupabaseClient | null = null;

export function getSharedSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'test-key';
    
    supabaseClientInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClientInstance;
}
