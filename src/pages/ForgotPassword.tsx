/**
 * ForgotPassword.tsx
 * Password Reset request screen for Physiosis Rehabilitation Engine.
 */

import React, { useState } from 'react';
import { Activity, Mail, ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(email.trim());
    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Failed to send reset email. Please try again.');
      return;
    }

    setIsSent(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand__logo">
            <Activity size={24} className="text-cyan" />
            <span className="auth-brand__title">PHYSIOSIS</span>
          </div>
          <span className="auth-brand__tagline">Rehabilitation Movement Engine</span>
        </div>

        <div className="auth-card">
          {isSent ? (
            <div className="auth-card--success">
              <div className="auth-success-icon">
                <CheckCircle2 size={42} className="text-good" />
              </div>
              <h2 className="auth-card__title">Reset Link Sent</h2>
              <p className="auth-card__subtitle">
                If an account exists for <strong className="text-primary">{email}</strong>, you will receive a password reset link shortly.
              </p>
              <button
                type="button"
                className="btn btn--primary auth-submit-btn"
                onClick={onNavigateToLogin}
              >
                <ArrowLeft size={16} />
                <span>Return to Sign In</span>
              </button>
            </div>
          ) : (
            <>
              <div className="auth-card__header">
                <h2 className="auth-card__title">Reset Password</h2>
                <p className="auth-card__subtitle">
                  Enter your registered email address and we'll send you instructions to reset your password.
                </p>
              </div>

              {errorMessage && (
                <div className="auth-alert auth-alert--error" role="alert">
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="reset-email" className="form-label">
                    Email Address
                  </label>
                  <div className="form-input-wrap">
                    <Mail size={16} className="form-input-icon" />
                    <input
                      id="reset-email"
                      type="email"
                      className="form-input"
                      placeholder="patient@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    <span>Sending...</span>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <Send size={15} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-card__footer">
                <button
                  type="button"
                  className="auth-link-btn font-bold text-muted flex items-center gap-1"
                  onClick={onNavigateToLogin}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
