import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || 'https://jptusquuyenbwrgasigt.supabase.co';
const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DH3nRkidf1sVejfCN0naVg_z35CsuUU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
