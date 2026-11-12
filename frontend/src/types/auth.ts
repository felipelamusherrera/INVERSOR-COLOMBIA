import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  document_type?: string | null; // 'CC', 'CE', 'PASAPORTE', 'OTRO'
  document_number?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  email_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegisterFormData {
  fullName: string;
  email: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  country: string;
  city: string;
  password: string;
  confirmPassword: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isEmailConfirmed: boolean;
  isPasswordRecoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (data: RegisterFormData) => Promise<{ error: any; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  updateUserPassword: (password: string) => Promise<{ error: any }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
  setIsPasswordRecoveryMode: (mode: boolean) => void;
}
