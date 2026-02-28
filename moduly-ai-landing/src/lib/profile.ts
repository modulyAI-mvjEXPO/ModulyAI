import { supabase } from './supabase';

export interface UserProfile {
    id: string;
    full_name: string | null;
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
 * Returns null if not found (new user who hasn't completed onboarding).
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('user_profiles')
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
 * Insert or update a user profile.
 */
export async function upsertProfile(
    userId: string,
    update: ProfileUpdate
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, ...update }, { onConflict: 'id' });

    if (error) {
        console.error('upsertProfile error:', error.message);
        return { error: error.message };
    }
    return { error: null };
}
