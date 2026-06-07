import { supabase } from './supabase';
import { getEmailByUsername } from './profile';
import type { AuthError, User } from '@supabase/supabase-js';

export interface AuthResult {
    user: User | null;
    error: string | null;
}

/** Returns true if the string looks like a valid email (has @domain.tld). */
function looksLikeEmail(input: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input);
}

/**
 * Helper to wrap promises with a timeout.
 * Prevents UI hangs if Supabase/Network calls never resolve.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 20000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => 
            setTimeout(() => {
                console.warn(`[TIMEOUT] Operation exceeded ${timeoutMs}ms`);
                reject(new Error('TIMEOUT'));
            }, timeoutMs)
        )
    ]);
}

/**
 * Sign up a new user with email + password.
 * Supabase sends a 6-digit OTP to the email automatically.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
    try {
        const { data, error } = await withTimeout(supabase.auth.signUp({ email, password }));
        if (error) return { user: null, error: formatError(error) };
        if (data.user?.identities?.length === 0) {
            return { user: null, error: 'An account with this email already exists. Try logging in.' };
        }
        return { user: data.user, error: null };
    } catch (e) {
        if ((e as Error).message === 'TIMEOUT') {
            return { user: null, error: 'Connection timed out. Please try again.' };
        }
        return { user: null, error: 'Sign up failed. Please check your connection.' };
    }
}

/**
 * Verify the 6-digit OTP sent to the user's email during sign-up.
 */
export async function verifyOtp(email: string, token: string): Promise<AuthResult> {
    try {
        const { data, error } = await withTimeout(supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup',
        }));
        if (error) return { user: null, error: formatError(error) };
        return { user: data.user, error: null };
    } catch (e) {
        if ((e as Error).message === 'TIMEOUT') {
            return { user: null, error: 'Verification timed out. Please try again.' };
        }
        return { user: null, error: 'Verification failed. Please try again.' };
    }
}

/**
 * Sign in with either an email address OR a username.
 */
export async function signIn(emailOrUsername: string, password: string): Promise<AuthResult> {
    let email = emailOrUsername.trim();

    try {
        if (!looksLikeEmail(email)) {
            const found = await withTimeout(getEmailByUsername(email), 10000);
            if (!found) return { user: null, error: 'No account found with that username.' };
            email = found;
        }

        const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 15000);
        if (error) return { user: null, error: formatError(error) };
        return { user: data.user, error: null };
    } catch (e) {
        if ((e as Error).message === 'TIMEOUT') {
            return { user: null, error: 'Login timed out. Please check your connection.' };
        }
        return { user: null, error: 'Login failed. Please try again.' };
    }
}

/**
 * Resend OTP email to the user.
 */
export async function resendOtp(email: string): Promise<{ error: string | null }> {
    try {
        const { error } = await withTimeout(supabase.auth.resend({ type: 'signup', email }));
        if (error) return { error: formatError(error) };
        return { error: null };
    } catch {
        return { error: 'Failed to resend code. Please try again.' };
    }
}

export async function signOut(): Promise<{ error: string | null }> {
    try {
        const { error } = await withTimeout(supabase.auth.signOut({ scope: 'global' }), 5000);
        if (error) {
            console.error('Supabase signOut error:', error);
            return { error: formatError(error) };
        }
        return { error: null };
    } catch (e) {
        console.error('Sign out error or timeout:', e);
        // Fallback: clear local session without server call
        try {
            await supabase.auth.signOut({ scope: 'local' });
            return { error: null };
        } catch (localErr) {
            console.error('Local sign-out also failed:', localErr);
            return { error: 'Sign out failed. Please try again.' };
        }
    }
}

/** 
 * Get current session user synchronously from cache.
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const { data: { user } } = await withTimeout(supabase.auth.getUser(), 3000);
        return user;
    } catch {
        return null;
    }
}

/** Map Supabase error messages to user-friendly strings */
function formatError(error: AuthError): string {
    const msg = error.message?.toLowerCase() ?? '';

    if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
        return 'Incorrect email/username or password. Please try again.';
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
