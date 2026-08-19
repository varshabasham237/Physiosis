/**
 * Login.tsx
 * Patient Authentication Screen for Physiosis Rehabilitation Engine.
 *
 * Provides:
 *   - Secure Email + Password login via Supabase Auth
 *   - Error messaging for invalid credentials / network issues
 *   - Clean clinical branding
 */

import React, { useState } from 'react';
import { Activity, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onNavigateToRegister,
  onNavigateToForgotPassword,
}) => {
  const { signIn, isBackendConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn({ email, password });
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrorMessage('Invalid email or password. Please check your credentials.');
      } else if (error.message.includes('Email not confirmed')) {
        setErrorMessage('Please verify your email address before signing in.');
      } else {
        setErrorMessage(error.message || 'Failed to sign in. Please try again.');
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-brand__logo">
            <Activity size={24} className="text-cyan" />
            <span className="auth-brand__title">PHYSIOSIS</span>
          </div>
          <span className="auth-brand__tagline">Rehabilitation Movement Engine</span>
        </div>

        {/* Auth Card */}
        <div className="auth-card">
          <div className="auth-card__header">
            <h2 className="auth-card__title">Patient Portal Login</h2>
            <p className="auth-card__subtitle">
              Sign in to access your rehabilitation exercise dashboard and movement reports.
            </p>
          </div>

          {/* Database Status Banner */}
          <div className={`auth-db-status ${isBackendConfigured ? 'auth-db-status--connected' : 'auth-db-status--demo'}`}>
            <Database size={13} />
            <span>
              {isBackendConfigured
                ? 'Connected to Supabase PostgreSQL Database'
                : 'Local Prototype Demo Mode (Supabase URL pending in .env)'}
            </span>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">
                Email Address
              </label>
              <div className="form-input-wrap">
                <Mail size={16} className="form-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <button
                  type="button"
                  className="auth-link-btn"
                  onClick={onNavigateToForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="form-input-wrap">
                <Lock size={16} className="form-input-icon" />
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn--primary auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Switching Link */}
          <div className="auth-card__footer">
            <span className="text-muted">Don't have an account?</span>
            <button
              type="button"
              className="auth-link-btn font-bold text-cyan"
              onClick={onNavigateToRegister}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Security & Disclaimer Footer */}
        <div className="auth-footer-disclaimer">
          <ShieldCheck size={14} className="text-muted" />
          <span>
            Secure medical data protection. Physiosis is advisory and does not replace evaluation by a licensed physiotherapist.
          </span>
        </div>
      </div>
    </div>
  );
};
