/**
 * Header.tsx
 * Top navigation bar for Physiosis:
 *   - Brand logo & tagline
 *   - Integrated exercise selection switcher
 *   - Authenticated Patient ID & profile trigger
 *   - Session controls & history trigger
 *   - Engine status
 */

import React from 'react';
import { Activity, History, Square, User, LogOut } from 'lucide-react';
import { EngineStatusBadge } from './EngineStatusBadge';
import type { EngineStatus } from '../../types/engine';
import { getAllExercises } from '../../engine/exercise/ExerciseRegistry';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
  engineStatus: EngineStatus;
  isStreaming: boolean;
  isInitializing: boolean;
  onToggleCamera: () => void;
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onEndSession?: (reason?: 'manual' | 'automatic') => void;
  hasActiveSession?: boolean;
  savedSessionsCount: number;
  onOpenHistory: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  engineStatus,
  selectedExerciseId,
  onSelectExercise,
  onEndSession,
  hasActiveSession = false,
  savedSessionsCount,
  onOpenHistory,
  onOpenProfile,
}) => {
  const { profile, user, signOut } = useAuth();
  const exercises = getAllExercises();

  const patientName = profile?.full_name || user?.user_metadata?.full_name || 'Patient';
  const patientId = profile?.patient_login_id || 'DEMO-001';

  return (
    <header className="header" role="banner">
      {/* ── Brand Logo & App Identity ─────────────────────────────────── */}
      <div className="header__brand">
        <div className="header__logo-icon">
          <Activity size={18} />
        </div>
        <div className="header__logo-text">
          <span className="header__logo-name">PHYSIOSIS</span>
          <span className="header__logo-tagline">BioKinematic AI</span>
        </div>
      </div>

      {/* ── Center: Target Exercise Selector Switcher ─────────────────── */}
      <div className="header__exercise-tabs" role="group" aria-label="Select Rehabilitation Exercise">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className={`header__exercise-tab ${selectedExerciseId === ex.id ? 'header__exercise-tab--active' : ''}`}
            onClick={() => onSelectExercise(ex.id)}
          >
            <span className="header__exercise-name">{ex.name}</span>
            <span className="header__exercise-target mono">{ex.targetAngle}°</span>
          </button>
        ))}
      </div>

      {/* ── Right Actions: Session Status, Patient ID, History, Logout ── */}
      <div className="header__actions">
        {/* Engine Status Badge */}
        <EngineStatusBadge status={engineStatus} mode={mode} />

        {/* Patient Profile Quick Pill */}
        <button
          type="button"
          className="header__patient-pill"
          onClick={onOpenProfile}
          title="View Patient Account Details"
        >
          <div className="patient-pill__icon">
            <User size={13} />
          </div>
          <div className="patient-pill__details">
            <span className="patient-pill__name">{patientName}</span>
            <span className="patient-pill__id mono">{patientId}</span>
          </div>
        </button>

        {/* End Active Session Quick Button */}
        {hasActiveSession && onEndSession && (
          <button
            type="button"
            className="btn-header-end"
            onClick={() => onEndSession('manual')}
            title="End current active session and generate report"
          >
            <Square size={11} fill="currentColor" />
            <span>End Session</span>
          </button>
        )}

        {/* Previous Sessions History Button */}
        <button
          type="button"
          className="btn-header-history"
          onClick={onOpenHistory}
          title="View previous rehabilitation sessions"
        >
          <History size={14} />
          <span>History</span>
          {savedSessionsCount > 0 && (
            <span className="btn-header-history__badge">{savedSessionsCount}</span>
          )}
        </button>

        {/* Logout Quick Button */}
        <button
          type="button"
          className="btn-header-logout"
          onClick={signOut}
          title="Sign Out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
};
