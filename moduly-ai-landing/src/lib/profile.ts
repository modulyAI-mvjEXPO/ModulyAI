import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  bio?: string | null;
  dob: string | null;
  phone: string | null;
  region: string | null;
  college: string | null;
  course: string | null;
  semester: number | null;
  subjects: string[] | null;
  onboarding_complete: boolean;
  created_at?: string;
}

export type ProfileUpdate = Partial<Omit<UserProfile, 'id' | 'created_at'>>;

/**
 * Fetch a user's profile from Supabase.
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getProfile error:', error.message);
    return null;
  }
  return data as UserProfile | null;
}

/**
 * Insert or update a user profile robustly:
 * 1. Attempt UPDATE and check if any row was actually changed.
 * 2. If UPDATE matched 0 rows → row doesn't exist → INSERT it.
 */
export async function upsertProfile(
  userId: string,
  update: ProfileUpdate
): Promise<{ error: string | null }> {
  // Step 1: Try UPDATE — fetch updated row to confirm it existed
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('id');

  if (updateError) {
    console.error('upsertProfile UPDATE error:', updateError.message);
    return { error: updateError.message };
  }

  // Row existed and was updated — done
  if (updated && updated.length > 0) return { error: null };

  // Step 2: Row doesn't exist — INSERT a new one
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, ...update });

  if (insertError) {
    console.error('upsertProfile INSERT error:', insertError.message);
    return { error: insertError.message };
  }

  return { error: null };
}

/**
 * Look up a user's email by their display_name (username).
 * Uses a SECURITY DEFINER RPC so RLS doesn't block unauthenticated lookups.
 * Returns null if no match found.
 */
export async function getEmailByUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase
    .rpc('get_email_by_username', { p_username: username.trim() });

  if (error) {
    console.error('getEmailByUsername RPC error:', error.message);
    return null;
  }
  if (!data) return null;
  return data as string;
}
