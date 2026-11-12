import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || 'https://jptusquuyenbwrgasigt.supabase.co';
const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdHVzcXV1eWVuYndyZ2FzaWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MzIzMTAsImV4cCI6MjEwODAwODMxMH0.X4qPYl2_Edv83MCBtOEhwl-5FG1zWPEPNPwZwKiBV7I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
