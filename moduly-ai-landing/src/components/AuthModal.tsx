import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn, signUp, verifyOtp, resendOtp } from '../lib/auth';
import { upsertProfile } from '../lib/profile';
import './AuthModal.css';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'otp';

const BLOCKED_DOMAINS = [
    'gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com',
    'live.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com',
    'zoho.com', 'yandex.com', 'gmx.com', 'rediffmail.com',
];

function validateCollegeEmail(email: string): string | null {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Enter a valid email address';
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return 'Enter a valid email address';
    if (BLOCKED_DOMAINS.includes(domain)) {
        return 'Personal email addresses are not allowed. Use your college email.';
    }
    return null;
}

function validateUsername(username: string): string | null {
    if (!username) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 30) return 'Username can be at most 30 characters';
    if (!/^[a-zA-Z0-9_\-.@]+$/.test(username)) {
        return 'Only letters, numbers and _ - . @ are allowed';
    }
    return null;
}

function validatePassword(password: string): string | null {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return null;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [view, setView] = useState<AuthView>('login');
    // Signup fields
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // Login field — accepts email OR username
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        setErrors({});
        setShowPassword(false);
        setShowConfirmPassword(false);
        setShowLoginPassword(false);
        setSuccessMessage('');
    }, [view]);

    // Countdown timer for resend cooldown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(id);
    }, [resendCooldown]);

    useEffect(() => {
        if (!isOpen) {
            setView('login');
            setUsername('');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setLoginIdentifier('');
            setLoginPassword('');
            setOtp(['', '', '', '', '', '']);
            setErrors({});
            setIsSubmitting(false);
            setResendCooldown(0);
            setResendLoading(false);
            setSuccessMessage('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // ── Login ──────────────────────────────────────────────
    const handleLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};
        if (!loginIdentifier.trim()) newErrors.loginIdentifier = 'Email or username is required';
        const passwordError = validatePassword(loginPassword);
        if (passwordError) newErrors.loginPassword = passwordError;
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

        setIsSubmitting(true);
        setErrors({});
        try {
            const { error } = await signIn(loginIdentifier, loginPassword);
            if (error) {
                setErrors({ form: error });
                return;
            }
            setSuccessMessage('Logged in successfully. Welcome back!');
            setTimeout(onClose, 1200);
        } catch {
            setErrors({ form: 'Login failed. Please try again later.' });
        } finally {
            setIsSubmitting(false);
        }
    }, [loginIdentifier, loginPassword, onClose]);

    // ── Sign Up ────────────────────────────────────────────
    const handleSignup = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};
        const usernameError = validateUsername(username);
        if (usernameError) newErrors.username = usernameError;
        const emailError = validateCollegeEmail(email);
        if (emailError) newErrors.email = emailError;
        const passwordError = validatePassword(password);
        if (passwordError) newErrors.password = passwordError;
        if (!confirmPassword) newErrors.confirmPassword = 'Confirm your password';
        else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

        setIsSubmitting(true);
        setErrors({});
        try {
            const { error } = await signUp(email, password);
            if (error) {
                setErrors({ form: error });
                return;
            }
            setView('otp');
        } catch {
            setErrors({ form: 'Signup failed. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    }, [username, email, password, confirmPassword]);

    // ── OTP ────────────────────────────────────────────────
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted.length) return;
        const newOtp = Array(6).fill('').map((_, i) => pasted[i] ?? '');
        setOtp(newOtp);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) { setErrors({ otp: 'Enter the complete 6-digit code' }); return; }

        setErrors({});
        setIsSubmitting(true);
        try {
            const { error, user } = await verifyOtp(email, code);
            if (error) {
                setErrors({ otp: error });
                return;
            }

            // Save username + email to profile right after OTP verification
            if (user) {
                try {
                    await upsertProfile(user.id, {
                        display_name: username,
                        email: email,
                    });
                } catch (profileErr) {
                    console.error('Initial profile creation failed:', profileErr);
                }
            }

            setSuccessMessage('Account verified! Welcome to MODULY AI.');
            setTimeout(onClose, 1400);
        } catch {
            setErrors({ otp: 'Verification failed. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendLoading(true);
        setErrors(prev => { const n = { ...prev }; delete n.otp; return n; });

        const { error } = await resendOtp(email);
        setResendLoading(false);

        if (error) {
            setErrors({ otp: error });
            return;
        }

        setOtp(Array(6).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
        setResendCooldown(60);
    };

    const openOutlook = () => {
        window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
    };

    if (!isOpen) return null;

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-glow modal-glow-1"></div>
                <div className="modal-glow modal-glow-2"></div>

                <button className="modal-close" onClick={onClose} aria-label="Close modal">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="modal-brand">
                    <div className="modal-logo">M</div>
                    <span className="modal-logo-text">MODULY AI</span>
                </div>

                {/* Success banner */}
                {successMessage && (
                    <div className="auth-success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        {successMessage}
                    </div>
                )}

                {/* Form-level error */}
                {errors.form && (
                    <div className="auth-error">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {errors.form}
                    </div>
                )}

                {view !== 'otp' ? (
                    <>
                        {/* ── Tabs ── */}
                        <div className="auth-tabs">
                            <button className={`auth-tab ${view === 'login' ? 'active' : ''}`} onClick={() => setView('login')}>
                                Login
                            </button>
                            <button className={`auth-tab ${view === 'signup' ? 'active' : ''}`} onClick={() => setView('signup')}>
                                Sign Up
                            </button>
                            <div className={`tab-indicator ${view === 'signup' ? 'right' : ''}`}></div>
                        </div>

                        {/* ── Login Form ── */}
                        {view === 'login' && (
                            <form className="auth-form" onSubmit={handleLogin} noValidate>
                                <div className="form-group">
                                    <label htmlFor="login-identifier">Email or Username</label>
                                    <div className={`input-wrapper ${errors.loginIdentifier ? 'error' : ''}`}>
                                        <AtIcon />
                                        <input
                                            id="login-identifier"
                                            type="text"
                                            placeholder="you@college.edu.in or your_username"
                                            value={loginIdentifier}
                                            autoComplete="username"
                                            onChange={(e) => { setLoginIdentifier(e.target.value); clearError('loginIdentifier'); }}
                                        />
                                    </div>
                                    {errors.loginIdentifier
                                        ? <span className="field-error">{errors.loginIdentifier}</span>
                                        : <span className="field-hint">Enter your college email or your username</span>
                                    }
                                </div>

                                <div className="form-group">
                                    <label htmlFor="login-password">Password</label>
                                    <div className={`input-wrapper ${errors.loginPassword ? 'error' : ''}`}>
                                        <LockIcon />
                                        <input
                                            id="login-password" type={showLoginPassword ? 'text' : 'password'}
                                            placeholder="Enter your password" value={loginPassword} autoComplete="current-password"
                                            onChange={(e) => { setLoginPassword(e.target.value); clearError('loginPassword'); }}
                                        />
                                        <EyeToggle show={showLoginPassword} onToggle={() => setShowLoginPassword(v => !v)} />
                                    </div>
                                    {errors.loginPassword && <span className="field-error">{errors.loginPassword}</span>}
                                </div>

                                <button type="submit" className="auth-submit" disabled={isSubmitting}>
                                    {isSubmitting ? <span className="spinner" /> : 'Login'}
                                </button>
                            </form>
                        )}

                        {/* ── Sign Up Form ── */}
                        {view === 'signup' && (
                            <form className="auth-form" onSubmit={handleSignup} noValidate>
                                {/* Username — above email */}
                                <div className="form-group">
                                    <label htmlFor="signup-username">Username</label>
                                    <div className={`input-wrapper ${errors.username ? 'error' : ''}`}>
                                        <UsernameIcon />
                                        <input
                                            id="signup-username"
                                            type="text"
                                            placeholder="your_username"
                                            value={username}
                                            autoComplete="username"
                                            onChange={(e) => { setUsername(e.target.value); clearError('username'); }}
                                        />
                                    </div>
                                    {errors.username
                                        ? <span className="field-error">{errors.username}</span>
                                        : <span className="field-hint">Letters, numbers, and _ - . @ allowed (3–30 chars)</span>
                                    }
                                </div>

                                <div className="form-group">
                                    <label htmlFor="signup-email">College Email</label>
                                    <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                                        <EmailIcon />
                                        <input
                                            id="signup-email" type="email" placeholder="you@college.edu.in"
                                            value={email} autoComplete="email"
                                            onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                                        />
                                    </div>
                                    {errors.email
                                        ? <span className="field-error">{errors.email}</span>
                                        : <span className="field-hint">Personal emails (Gmail, Yahoo, etc.) are not accepted</span>
                                    }
                                </div>

                                <div className="form-group">
                                    <label htmlFor="signup-password">Password</label>
                                    <div className={`input-wrapper ${errors.password ? 'error' : ''}`}>
                                        <LockIcon />
                                        <input
                                            id="signup-password" type={showPassword ? 'text' : 'password'}
                                            placeholder="Create a password (min 8 chars)" value={password} autoComplete="new-password"
                                            onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                                        />
                                        <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                                    </div>
                                    {errors.password && <span className="field-error">{errors.password}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="signup-confirm">Confirm Password</label>
                                    <div className={`input-wrapper ${errors.confirmPassword ? 'error' : ''}`}>
                                        <ShieldIcon />
                                        <input
                                            id="signup-confirm" type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Re-enter your password" value={confirmPassword} autoComplete="new-password"
                                            onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }}
                                        />
                                        <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(v => !v)} />
                                    </div>
                                    {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                                </div>

                                <button type="submit" className="auth-submit" disabled={isSubmitting}>
                                    {isSubmitting ? <span className="spinner" /> : 'Create Account'}
                                </button>
                            </form>
                        )}
                    </>
                ) : (
                    /* ── OTP View ── */
                    <div className="otp-view">
                        <div className="otp-header">
                            <div className="otp-icon-wrapper">
                                <EmailIcon size={32} />
                            </div>
                            <h3>Verify Your Email</h3>
                            <p>
                                We sent a 6-digit verification code to
                                <strong> {email}</strong>
                            </p>
                        </div>

                        <form className="otp-form" onSubmit={handleVerifyOtp}>
                            <div className="otp-inputs" onPaste={handleOtpPaste}>
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => { otpRefs.current[index] = el; }}
                                        type="text" inputMode="numeric" maxLength={1}
                                        aria-label={`OTP digit ${index + 1}`}
                                        title={`OTP digit ${index + 1}`}
                                        placeholder="·"
                                        value={digit} className={`otp-digit ${digit ? 'filled' : ''}`}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>
                            {errors.otp && <span className="field-error otp-error">{errors.otp}</span>}

                            <button type="submit" className="auth-submit" disabled={isSubmitting}>
                                {isSubmitting ? <span className="spinner" /> : 'Verify Account'}
                            </button>
                        </form>

                        <div className="otp-actions">
                            <button className="outlook-btn" onClick={openOutlook}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Open Outlook
                            </button>

                            <button
                                className="resend-btn"
                                onClick={handleResendOtp}
                                disabled={resendCooldown > 0 || resendLoading}
                            >
                                {resendLoading ? (
                                    <><span className="spinner-sm" /> Sending…</>
                                ) : resendCooldown > 0 ? (
                                    `Resend in ${resendCooldown}s`
                                ) : (
                                    'Resend code'
                                )}
                            </button>
                        </div>

                        <button className="back-link" onClick={() => { setView('signup'); setOtp(Array(6).fill('')); setErrors({}); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                            </svg>
                            Back to Sign Up
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    function clearError(key: string) {
        setErrors(prev => { const n = { ...prev }; delete n[key]; delete n.form; return n; });
    }
}

/* ── Reusable icon components ── */
function AtIcon() {
    return (
        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
        </svg>
    );
}

function UsernameIcon() {
    return (
        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function EmailIcon({ size = 18 }: { size?: number }) {
    return (
        <svg className="input-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function ShieldIcon() {
    return (
        <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
        </svg>
    );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    const label = show ? 'Hide password' : 'Show password';
    return (
        <button type="button" className="toggle-password" onClick={onToggle} aria-label={label} title={label}>
            {show ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
            )}
        </button>
    );
}
