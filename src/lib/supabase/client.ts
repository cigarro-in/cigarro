import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced environment variable validation
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch {
  throw new Error('Invalid Supabase URL format in environment variables.');
}

// Validate that we're using HTTPS in production
if (import.meta.env.PROD && !supabaseUrl.startsWith('https://')) {
  throw new Error('Supabase URL must use HTTPS in production.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);