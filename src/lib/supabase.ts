import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured =
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey.length > 10;

// Only create a real client if credentials are valid
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient);

export const isSupabaseConfigured = () => isConfigured;
