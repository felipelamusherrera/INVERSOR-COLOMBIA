import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jptusquuyenbwrgasigt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DH3nRkidf1sVejfCN0naVg_z35CsuUU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
