import { supabase } from './supabase';
import type { AuthError, User } from '@supabase/supabase-js';

export interface AuthResult {
    user: User | null;
    error: string | null;
}

/**
 * Sign up a new user with email + password.
 * Supabase sends a 6-digit OTP to the email automatically.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return { user: null, error: formatError(error) };
    if (data.user?.identities?.length === 0) {
        // Supabase returns a fake user (no identities) when the email already exists
        return { user: null, error: 'An account with this email already exists. Try logging in.' };
    }

    return { user: data.user, error: null };
}

/**
 * Verify the 6-digit OTP sent to the user's email during sign-up.
 */
export async function verifyOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
    });

    if (error) return { user: null, error: formatError(error) };
    return { user: data.user, error: null };
}

/**
 * Sign in an existing user with email + password.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { user: null, error: formatError(error) };
    return { user: data.user, error: null };
}

/**
 * Resend OTP email to the user.
 */
export async function resendOtp(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { error: formatError(error) };
    return { error: null };
}

/**
 * Sign out current user.
 */
export async function signOut(): Promise<void> {
    await supabase.auth.signOut();
}

/** 
 * Get current session user synchronously from cache.
 */
export async function getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/** Map Supabase error messages to user-friendly strings */
function formatError(error: AuthError): string {
    const msg = error.message?.toLowerCase() ?? '';

    if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
        return 'Incorrect email or password. Please try again.';
    }
    if (msg.includes('email not confirmed')) {
        return 'Please verify your email before logging in.';
    }
    if (msg.includes('user already registered')) {
        return 'An account with this email already exists. Try logging in.';
    }
    if (msg.includes('token has expired') || msg.includes('otp')) {
        return 'Invalid or expired verification code. Request a new one.';
    }
    if (msg.includes('rate limit') || msg.includes('email rate limit')) {
        return 'Too many attempts. Please wait a moment before trying again.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
    }

    return error.message ?? 'Something went wrong. Please try again.';
}
