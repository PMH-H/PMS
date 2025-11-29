import React, { useState } from 'react';
import { signIn, signUp } from '../services/supabase';
import { supabase } from '../services/supabase';

interface LoginProps {
    onLoginSuccess: () => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (mode === 'signin') {
                const { error } = await signIn(email, password);
                if (error) {
                    setError(error.message || 'Invalid login credentials');
                } else {
                    onLoginSuccess();
                }
            } else if (mode === 'signup') {
                // Validation
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    setLoading(false);
                    return;
                }

                const { error } = await signUp(email, password, { full_name: fullName });
                if (error) {
                    setError(error.message || 'Failed to create account');
                } else {
                    setSuccess('Account created! Please check your email to verify your account.');
                    // Clear form
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setFullName('');
                    // Switch to sign in after 3 seconds
                    setTimeout(() => {
                        setMode('signin');
                        setSuccess('');
                    }, 3000);
                }
            } else if (mode === 'reset') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password',
                });
                if (error) {
                    setError(error.message || 'Failed to send reset email');
                } else {
                    setSuccess('Password reset email sent! Please check your inbox.');
                    setTimeout(() => {
                        setMode('signin');
                        setSuccess('');
                    }, 3000);
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Background Image */}
            <div className="login-background"></div>

            {/* Login Form */}
            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-title">PharmAI</h1>
                    <p className="login-subtitle">Smart Pharmacy Management</p>
                </div>

                {/* Tab Navigation */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('signin');
                            setError('');
                            setSuccess('');
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                        onClick={() => {
                            setMode('signup');
                            setError('');
                            setSuccess('');
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {/* Success Message */}
                    {success && (
                        <div className="alert alert-success">
                            <svg className="alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {success}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="alert alert-error">
                            <svg className="alert-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Full Name (Sign Up Only) */}
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                                required
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Email */}
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            disabled={loading}
                        />
                    </div>

                    {/* Password (Sign In & Sign Up) */}
                    {mode !== 'reset' && (
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Confirm Password (Sign Up Only) */}
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                required
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Forgot Password Link (Sign In Only) */}
                    {mode === 'signin' && (
                        <div className="forgot-password-link">
                            <button
                                type="button"
                                onClick={() => setMode('reset')}
                                className="link-button"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner">
                                <svg className="spinner" viewBox="0 0 24 24">
                                    <circle className="spinner-circle" cx="12" cy="12" r="10" />
                                </svg>
                                Processing...
                            </span>
                        ) : mode === 'signin' ? (
                            'Sign In'
                        ) : mode === 'signup' ? (
                            'Create Account'
                        ) : (
                            'Send Reset Link'
                        )}
                    </button>

                    {/* Back to Sign In (Reset Mode) */}
                    {mode === 'reset' && (
                        <div className="back-to-signin">
                            <button
                                type="button"
                                onClick={() => setMode('signin')}
                                className="link-button"
                            >
                                ← Back to Sign In
                            </button>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="login-footer">
                    <p className="footer-text">
                        {mode === 'signin' ? (
                            <>
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="link-button"
                                >
                                    Sign up
                                </button>
                            </>
                        ) : mode === 'signup' ? (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => setMode('signin')}
                                    className="link-button"
                                >
                                    Sign in
                                </button>
                            </>
                        ) : null}
                    </p>
                </div>
            </div>

            <style>{`
                .login-container {
                    position: relative;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    overflow: hidden;
                }

                .login-background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: url('/pharmacy_bg.png');
                    background-size: cover;
                    background-position: center;
                    z-index: 0;
                }

                .login-background::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.85) 0%, rgba(118, 75, 162, 0.85) 100%);
                    z-index: 1;
                }

                .login-card {
                    position: relative;
                    z-index: 1;
                    background: rgba(255, 255, 255, 0.85); /* More translucent */
                    backdrop-filter: blur(12px); /* Increased blur for better readability */
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                    padding: 30px; /* Reduced padding */
                    width: 100%;
                    max-width: 380px; /* Reduced width */
                    animation: slideUp 0.5s ease-out;
                    border: 1px solid rgba(255, 255, 255, 0.3); /* Subtle border */
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .login-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .login-title {
                    font-size: 32px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin: 0 0 8px 0;
                }

                .login-subtitle {
                    color: #6b7280;
                    font-size: 14px;
                    margin: 0;
                }

                .auth-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 30px;
                    background: #f3f4f6;
                    padding: 4px;
                    border-radius: 12px;
                }

                .auth-tab {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    color: #6b7280;
                }

                .auth-tab.active {
                    background: white;
                    color: #667eea;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-group label {
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                }

                .form-group input {
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 10px;
                    font-size: 15px;
                    transition: all 0.3s ease;
                    background: white;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .form-group input:disabled {
                    background: #f9fafb;
                    cursor: not-allowed;
                }

                .alert {
                    padding: 12px 16px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    animation: slideDown 0.3s ease-out;
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .alert-success {
                    background: #d1fae5;
                    color: #065f46;
                    border: 1px solid #6ee7b7;
                }

                .alert-error {
                    background: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #fca5a5;
                }

                .alert-icon {
                    width: 20px;
                    height: 20px;
                    flex-shrink: 0;
                }

                .submit-button {
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-top: 10px;
                }

                .submit-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
                }

                .submit-button:active:not(:disabled) {
                    transform: translateY(0);
                }

                .submit-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .loading-spinner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                }

                .spinner-circle {
                    fill: none;
                    stroke: white;
                    stroke-width: 3;
                    stroke-dasharray: 50;
                    stroke-dashoffset: 25;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }

                .forgot-password-link,
                .back-to-signin {
                    text-align: right;
                    margin-top: -10px;
                }

                .link-button {
                    background: none;
                    border: none;
                    color: #667eea;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 0;
                    text-decoration: none;
                    transition: color 0.2s ease;
                }

                .link-button:hover {
                    color: #764ba2;
                    text-decoration: underline;
                }

                .login-footer {
                    margin-top: 30px;
                    text-align: center;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }

                .footer-text {
                    color: #6b7280;
                    font-size: 14px;
                    margin: 0;
                }

                @media (max-width: 480px) {
                    .login-card {
                        padding: 30px 20px;
                    }

                    .login-title {
                        font-size: 28px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;
