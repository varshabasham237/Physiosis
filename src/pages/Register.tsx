/**
 * Register.tsx
 * Patient Registration Screen for Physiosis Rehabilitation Engine.
 *
 * Automatically generates and displays unique Patient ID (e.g. PHS-100001)
 * upon successful Supabase user creation.
 */

import React, { useState } from 'react';
import {
  Activity,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  MailCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RegisterProps {
  onNavigateToLogin: () => void;
  onRegisteredSuccess?: () => void;
}

export const Register: React.FC<RegisterProps> = ({
  onNavigateToLogin,
  onRegisteredSuccess,
}) => {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredPatientId, setRegisteredPatientId] = useState<string | null>(null);
  const [isEmailConfirmationPending, setIsEmailConfirmationPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const { error, patientId, emailConfirmationRequired } = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      password,
    });
    setIsLoading(false);

    if (error) {
      const msg = error.message || String(error);
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setErrorMessage(
          'Email send rate limit reached on Supabase free SMTP. In your Supabase Dashboard -> Authentication -> Providers -> Email, you can turn off "Confirm email" for local development, or try again in a few minutes.'
        );
      } else if (msg.includes('User already registered') || msg.includes('already exists')) {
        setErrorMessage('An account with this email address already exists. Please log in.');
      } else {
        setErrorMessage(`Registration error: ${msg}`);
      }
      return;
    }

    if (emailConfirmationRequired) {
      setIsEmailConfirmationPending(true);
      return;
    }

    // Successfully registered with immediate session
    setRegisteredPatientId(patientId || 'PHS-100001');
  };

  // Case A: Email confirmation required
  if (isEmailConfirmationPending) {
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

          <div className="auth-card auth-card--success">
            <div className="auth-success-icon">
              <MailCheck size={44} className="text-cyan" />
            </div>

            <h2 className="auth-card__title">Account Created</h2>
            <p className="auth-card__subtitle">
              We've sent a verification link to <strong className="text-primary">{email}</strong>.
            </p>

            <div className="auth-patient-id-card">
              <span className="auth-patient-id-card__label">Confirmation Required</span>
              <p className="auth-patient-id-card__hint text-center">
                Please check your inbox and click the verification link before signing in.
              </p>
            </div>

            <button
              type="button"
              className="btn btn--primary auth-submit-btn"
              onClick={onNavigateToLogin}
            >
              <span>Return to Sign In</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case B: Immediate registration / session restored
  if (registeredPatientId) {
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

          <div className="auth-card auth-card--success">
            <div className="auth-success-icon">
              <CheckCircle2 size={42} className="text-good" />
            </div>

            <h2 className="auth-card__title">Account Created Successfully</h2>
            <p className="auth-card__subtitle">
              Your patient account has been registered with the Physiosis Rehabilitation Engine.
            </p>

            <div className="auth-patient-id-card">
              <span className="auth-patient-id-card__label">Your Assigned Patient ID:</span>
              <span className="auth-patient-id-card__value mono">{registeredPatientId}</span>
              <p className="auth-patient-id-card__hint">
                Please remember your Patient ID. It will appear on all your rehabilitation session reports.
              </p>
            </div>

            <button
              type="button"
              className="btn btn--primary auth-submit-btn"
              onClick={() => {
                if (onRegisteredSuccess) {
                  onRegisteredSuccess();
                } else {
                  onNavigateToLogin();
                }
              }}
            >
              <span>Go to Rehabilitation Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <h2 className="auth-card__title">Create Patient Account</h2>
            <p className="auth-card__subtitle">
              Register for personalized exercise range tracking, repetition analytics, and movement reports.
            </p>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="auth-alert auth-alert--error" role="alert">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reg-fullname" className="form-label">
                Full Name <span className="text-warn">*</span>
              </label>
              <div className="form-input-wrap">
                <User size={16} className="form-input-icon" />
                <input
                  id="reg-fullname"
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-email" className="form-label">
                Email Address <span className="text-warn">*</span>
              </label>
              <div className="form-input-wrap">
                <Mail size={16} className="form-input-icon" />
                <input
                  id="reg-email"
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
              <label htmlFor="reg-phone" className="form-label">
                Phone Number <span className="text-muted text-xs">(Optional)</span>
              </label>
              <div className="form-input-wrap">
                <Phone size={16} className="form-input-icon" />
                <input
                  id="reg-phone"
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-password" className="form-label">
                  Password <span className="text-warn">*</span>
                </label>
                <div className="form-input-wrap">
                  <Lock size={16} className="form-input-icon" />
                  <input
                    id="reg-password"
                    type="password"
                    className="form-input"
                    placeholder="Min. 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-confirm-password" className="form-label">
                  Confirm Password <span className="text-warn">*</span>
                </label>
                <div className="form-input-wrap">
                  <Lock size={16} className="form-input-icon" />
                  <input
                    id="reg-confirm-password"
                    type="password"
                    className="form-input"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn--primary auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Switching Link */}
          <div className="auth-card__footer">
            <span className="text-muted">Already have an account?</span>
            <button
              type="button"
              className="auth-link-btn font-bold text-cyan"
              onClick={onNavigateToLogin}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Security & Disclaimer Footer */}
        <div className="auth-footer-disclaimer">
          <ShieldCheck size={14} className="text-muted" />
          <span>
            Passwords are encrypted and managed securely via Supabase Authentication. No passwords are stored in application tables.
          </span>
        </div>
      </div>
    </div>
  );
};
