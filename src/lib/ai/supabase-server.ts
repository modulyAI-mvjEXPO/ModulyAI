import { createClient } from '@supabase/supabase-js';

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const createServerSupabaseClient = () => {
  const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
  if (!url) {
    throw new Error(
      'Missing required environment variable: SUPABASE_URL or VITE_SUPABASE_URL',
    );
  }
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRoleKey);
};
