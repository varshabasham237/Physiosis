/**
 * FinalSessionReport.tsx
 * Comprehensive Patient Rehabilitation Session Report component.
 *
 * Built strictly from actual live session kinematics without synthetic values.
 * Features:
 *   - Clean clinical report formatting with deterministic session ID
 *   - Session Overview & Data-Backed Summary
 *   - Core Movement Metrics Grid
 *   - Estimated Movement Progress indicator & horizontal progress visualization
 *   - Rep-by-Rep Performance table
 *   - Inline SVG Movement-Range Trend chart
 *   - Limitation Summary (if below reference target)
 *   - Non-Prescriptive Advisory Guidance
 *   - Responsible Use Safety Footer
 *   - Native browser print integration with clean printable layout
 */

import React from 'react';
import {
  Printer,
  X,
  Award,
  Activity,
  Repeat,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  FileText,
  Target,
} from 'lucide-react';
import type { PhysiosisSession } from '../../engine/session/SessionTypes';
import { formatElapsedTime } from '../../utils/format';
import { generateAdvisoryGuidance } from '../../engine/session/SessionAnalytics';
import {
  calculateSessionProgress,
  generateDeterministicSessionId,
  generateSessionOverviewText,
  formatReportDateTime,
} from '../../engine/session/SessionProgress';
import { getExercise } from '../../engine/exercise/ExerciseRegistry';
import { getExerciseSuggestion, SUGGESTION_DISCLAIMER } from '../../engine/feedback/SuggestionLibrary';

interface FinalSessionReportProps {
  session: PhysiosisSession;
  onClose: () => void;
  onStartNewSession?: () => void;
}

export const FinalSessionReport: React.FC<FinalSessionReportProps> = ({
  session,
  onClose,
  onStartNewSession,
}) => {
  const exerciseDef = getExercise(session.exercise.toLowerCase().replace(/ /g, '-'));
  const targetAngle = exerciseDef?.targetAngle ?? session.reps[0]?.targetAngle ?? 165;
  // Derive exercise ID for suggestion lookup (stable, deterministic from session data)
  const exerciseIdForLookup = session.exercise.toLowerCase().replace(/ /g, '-');
  const limitationSuggestion = session.limitationsDetected > 0
    ? getExerciseSuggestion(exerciseIdForLookup)
    : null;

  const sessionId = generateDeterministicSessionId(session.startedAt, session.id);
  const { dateStr, timeStr } = formatReportDateTime(session.startedAt);
  const overviewStatement = generateSessionOverviewText(session);
  const guidanceText = generateAdvisoryGuidance(session);
  const progressResult = calculateSessionProgress(session);

  const hasLimitations = session.limitationsDetected > 0;
  const remainingToTarget = Math.max(0, targetAngle - session.bestROM);

  const handlePrint = () => {
    window.print();
  };

  // SVG Trend Chart Dimensions
  const chartWidth = 520;
  const chartHeight = 130;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 26;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;
  const maxY = Math.max(targetAngle + 10, ...session.reps.map((r) => r.peakAngle), 50);

  const getChartX = (idx: number, count: number) => {
    if (count <= 1) return padLeft + innerW / 2;
    return padLeft + (idx / (count - 1)) * innerW;
  };

  const getChartY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return padTop + innerH - (clamped / maxY) * innerH;
  };

  const chartPoints = session.reps.map((r, i) => ({
    x: getChartX(i, session.reps.length),
    y: getChartY(r.peakAngle),
    val: r.peakAngle,
    label: `Rep ${r.repNumber}`,
    isLimited: r.limitationDetected,
  }));

  const chartPathD = chartPoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const targetLineY = getChartY(targetAngle);

  // Status badge label helper
  const getRepStatusLabel = (r: typeof session.reps[0]) => {
    if (r.peakAngle >= targetAngle) return 'Target reached';
    if (r.peakAngle >= targetAngle * 0.85) return 'Near target';
    if (session.reps.indexOf(r) > 0 && r.peakAngle > session.reps[session.reps.indexOf(r) - 1].peakAngle) {
      return 'Improving';
    }
    return 'Below reference';
  };

  return (
    <div
      className="session-summary-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-header-title"
    >
      <div className="session-summary-modal final-session-report">
        {/* ── 1. REPORT HEADER ────────────────────────────────────────── */}
        <div className="report-header">
          <div className="report-header__brand">
            <div className="report-header__logo-row">
              <FileText size={18} className="text-cyan" />
              <span className="report-header__app-name">PHYSIOSIS</span>
              <span className="report-header__pill">
                {session.endedReason === 'automatic'
                  ? 'Session report — automatically ended after 2 minutes'
                  : 'Session report — manually ended'}
              </span>
              {session.isUnsaved && (
                <span className="report-header__pill" style={{ background: 'var(--color-warn-dim)', color: 'var(--color-warn)' }}>
                  Not yet saved
                </span>
              )}
            </div>
            <h1 id="report-header-title" className="report-header__title">
              Rehabilitation Movement Report
            </h1>
          </div>

          <div className="report-header__meta-box">
            <div className="report-header__meta-item">
              <span className="meta-item__key">Session ID:</span>
              <span className="meta-item__val text-mono">{sessionId}</span>
            </div>
            {session.patientId && (
              <div className="report-header__meta-item">
                <span className="meta-item__key">Patient ID:</span>
                <span className="meta-item__val text-mono">{session.patientId}</span>
              </div>
            )}
            <div className="report-header__meta-item">
              <span className="meta-item__key">Date & Time:</span>
              <span className="meta-item__val">{dateStr}, {timeStr}</span>
            </div>
            <div className="report-header__meta-item">
              <span className="meta-item__key">Exercise:</span>
              <span className="meta-item__val text-cyan font-bold">{session.exercise}</span>
            </div>
            <div className="report-header__meta-item">
              <span className="meta-item__key">Ended:</span>
              <span className="meta-item__val">
                {session.endedReason === 'automatic' ? 'Automatic (2 min)' : 'Manual'}
              </span>
            </div>
          </div>

          <div className="report-header__actions no-print">
            <button
              type="button"
              className="btn btn--secondary btn-print"
              onClick={handlePrint}
              title="Print or export report as PDF"
            >
              <Printer size={14} />
              <span>Print Report</span>
            </button>
            <button
              type="button"
              className="btn-icon report-close-btn"
              onClick={onClose}
              aria-label="Close report"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE REPORT BODY ──────────────────────────────────── */}
        <div className="report-body">
          {/* ── 2. SESSION OVERVIEW ────────────────────────────────────── */}
          <section className="report-section" aria-labelledby="heading-overview">
            <div className="report-section__header">
              <h2 id="heading-overview" className="report-section__title">
                Session Overview
              </h2>
            </div>
            <div className="overview-summary-box">
              <div className="overview-meta-pills">
                <span className="overview-pill">
                  <Activity size={12} />
                  <strong>Exercise:</strong> {session.exercise}
                </span>
                <span className="overview-pill">
                  <Clock size={12} />
                  <strong>Duration:</strong> {formatElapsedTime(session.durationSeconds * 1000)}
                </span>
                <span className="overview-pill">
                  <Repeat size={12} />
                  <strong>Completed:</strong> {session.totalReps} Repetitions
                </span>
                <span className="overview-pill">
                  <Clock size={12} />
                  <strong>Ended:</strong> {session.endedReason === 'automatic' ? 'Automatic (2-min limit)' : 'Manual'}
                </span>
              </div>
              <p className="overview-statement-text">{overviewStatement}</p>
            </div>
          </section>

          {/* ── 3. MOVEMENT METRICS ────────────────────────────────────── */}
          <section className="report-section" aria-labelledby="heading-metrics">
            <div className="report-section__header">
              <h2 id="heading-metrics" className="report-section__title">
                Movement Metrics
              </h2>
            </div>
            <div className="report-metrics-grid">
              <div className="report-metric-card report-metric-card--highlight">
                <div className="report-metric-card__icon"><Award size={15} /></div>
                <div className="report-metric-card__content">
                  <span className="report-metric-card__val">{session.bestROM}°</span>
                  <span className="report-metric-card__label">Best ROM</span>
                </div>
              </div>

              <div className="report-metric-card">
                <div className="report-metric-card__icon"><Activity size={15} /></div>
                <div className="report-metric-card__content">
                  <span className="report-metric-card__val">{session.averageROM}°</span>
                  <span className="report-metric-card__label">Average ROM</span>
                </div>
              </div>

              <div className="report-metric-card">
                <div className="report-metric-card__icon"><Target size={15} /></div>
                <div className="report-metric-card__content">
                  <span className="report-metric-card__val">{targetAngle}°</span>
                  <span className="report-metric-card__label">Reference Target</span>
                </div>
              </div>

              <div className="report-metric-card">
                <div className="report-metric-card__icon"><CheckCircle size={15} /></div>
                <div className="report-metric-card__content">
                  <span className="report-metric-card__val">{session.averageScore} / 100</span>
                  <span className="report-metric-card__label">Average Quality</span>
                </div>
              </div>

              <div className="report-metric-card">
                <div className="report-metric-card__icon"><AlertTriangle size={15} /></div>
                <div className="report-metric-card__content">
                  <span className={`report-metric-card__val ${hasLimitations ? 'text-warn' : 'text-good'}`}>
                    {session.limitationsDetected}
                  </span>
                  <span className="report-metric-card__label">Detected Limitations</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. ESTIMATED MOVEMENT PROGRESS ─────────────────────────── */}
          <section className="report-section" aria-labelledby="heading-progress">
            <div className="report-section__header">
              <h2 id="heading-progress" className="report-section__title">
                Estimated Movement Progress
              </h2>
              <span className={`trend-badge trend-badge--${progressResult.trend.toLowerCase()}`}>
                Trend: {progressResult.trend.charAt(0) + progressResult.trend.slice(1).toLowerCase()}
              </span>
            </div>

            <div className="progress-indicator-card">
              <div className="progress-indicator-header">
                <div className="progress-indicator-value-wrap">
                  <span className="progress-indicator-pct">{progressResult.progressPercentage}%</span>
                  <span className="progress-indicator-delta">
                    {progressResult.deltaDegrees >= 0 ? `+${progressResult.deltaDegrees}°` : `${progressResult.deltaDegrees}°`} from baseline
                  </span>
                </div>
                <p className="progress-indicator-statement">{progressResult.explanation}</p>
              </div>

              {/* Horizontal Progress Bar: Baseline -> Latest -> Target */}
              <div className="progress-bar-visual" role="progressbar" aria-valuenow={progressResult.progressPercentage} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar-visual__track">
                  <div
                    className="progress-bar-visual__fill"
                    style={{ width: `${progressResult.progressPercentage}%` }}
                  />
                  <div
                    className="progress-bar-visual__thumb"
                    style={{ left: `${progressResult.progressPercentage}%` }}
                  >
                    <span className="progress-thumb-label">{progressResult.latestROM}°</span>
                  </div>
                </div>

                <div className="progress-bar-visual__labels">
                  <div className="progress-point">
                    <span className="progress-point__title">Baseline</span>
                    <span className="progress-point__value mono">{progressResult.baselineROM}°</span>
                  </div>
                  <div className="progress-point progress-point--center">
                    <span className="progress-point__title">Latest Observed</span>
                    <span className="progress-point__value mono text-cyan">{progressResult.latestROM}°</span>
                  </div>
                  <div className="progress-point progress-point--right">
                    <span className="progress-point__title">Prototype Target</span>
                    <span className="progress-point__value mono text-good">{progressResult.targetROM}°</span>
                  </div>
                </div>
              </div>

              <p className="progress-disclaimer-note">
                Prototype movement-range trend indicator. Not a clinical recovery prediction.
              </p>
            </div>
          </section>

          {/* ── 5. REP PERFORMANCE TABLE ───────────────────────────────── */}
          <section className="report-section" aria-labelledby="heading-reps">
            <div className="report-section__header">
              <h2 id="heading-reps" className="report-section__title">
                Rep Performance
              </h2>
              <span className="report-section__sub">{session.totalReps} recorded repetition cycles</span>
            </div>

            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Peak ROM</th>
                    <th>Reference Target</th>
                    <th>Remaining Gap</th>
                    <th>Quality Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {session.reps.map((r) => {
                    const status = getRepStatusLabel(r);
                    return (
                      <tr key={r.repNumber}>
                        <td className="mono font-semibold">Rep {r.repNumber}</td>
                        <td className="mono font-bold text-primary">{r.peakAngle}°</td>
                        <td className="mono text-muted">{targetAngle}°</td>
                        <td className="mono">{r.deviation > 0 ? `${r.deviation}°` : '0° ✓'}</td>
                        <td className="mono">{r.qualityScore} / 100</td>
                        <td>
                          <span
                            className={`report-status-pill report-status-pill--${
                              status === 'Target reached'
                                ? 'success'
                                : status === 'Improving'
                                ? 'improving'
                                : status === 'Near target'
                                ? 'good'
                                : 'limited'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 6. MOVEMENT-RANGE TREND CHART ──────────────────────────── */}
          {session.reps.length > 1 && (
            <section className="report-section" aria-labelledby="heading-trend">
              <div className="report-section__header">
                <h2 id="heading-trend" className="report-section__title">
                  Movement-Range Trend
                </h2>
                <span className="report-section__sub">Repetition peak angle progression</span>
              </div>

              <div className="report-chart-card">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="report-svg-chart">
                  {/* Grid Lines */}
                  <line x1={padLeft} y1={padTop} x2={chartWidth - padRight} y2={padTop} stroke="var(--border-subtle)" strokeWidth="0.8" />
                  <line x1={padLeft} y1={padTop + innerH / 2} x2={chartWidth - padRight} y2={padTop + innerH / 2} stroke="var(--border-subtle)" strokeWidth="0.8" />
                  <line x1={padLeft} y1={padTop + innerH} x2={chartWidth - padRight} y2={padTop + innerH} stroke="var(--border-default)" strokeWidth="1" />

                  {/* Target Reference Line */}
                  <line
                    x1={padLeft}
                    y1={targetLineY}
                    x2={chartWidth - padRight}
                    y2={targetLineY}
                    stroke="rgba(0, 230, 118, 0.70)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={chartWidth - padRight + 4}
                    y={targetLineY + 3}
                    textAnchor="start"
                    fill="rgba(0, 230, 118, 0.85)"
                    fontSize="8"
                    fontFamily="var(--font-mono)"
                  >
                    Target {targetAngle}°
                  </text>

                  {/* Y Axis Labels */}
                  <text x={padLeft - 6} y={padTop + 3} textAnchor="end" fill="var(--text-disabled)" fontSize="7.5" fontFamily="var(--font-mono)">
                    {maxY}°
                  </text>
                  <text x={padLeft - 6} y={padTop + innerH + 3} textAnchor="end" fill="var(--text-disabled)" fontSize="7.5" fontFamily="var(--font-mono)">
                    0°
                  </text>

                  {/* Trend Path */}
                  <path
                    d={chartPathD}
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Nodes */}
                  {chartPoints.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={4}
                        fill={pt.isLimited ? '#FFA726' : '#00E676'}
                        stroke="#0A0E14"
                        strokeWidth="1.5"
                      />
                      <text
                        x={pt.x}
                        y={pt.y - 7}
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                        fontWeight="600"
                      >
                        {pt.val}°
                      </text>
                      <text
                        x={pt.x}
                        y={chartHeight - 6}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize="8"
                        fontFamily="var(--font-mono)"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </section>
          )}

          {/* ── 7. DETECTED MOVEMENT LIMITATIONS ───────────────────────── */}
          {hasLimitations ? (
            <section className="report-section" aria-labelledby="heading-limitations">
              <div className="report-section__header">
                <h2 id="heading-limitations" className="report-section__title text-warn">
                  Detected Movement Limitation
                </h2>
              </div>
              <div className="report-limitation-card">
                <div className="limitation-stats-row">
                  <div className="limitation-stat">
                    <span className="limitation-stat__key">Observed Peak:</span>
                    <span className="limitation-stat__val mono">{session.bestROM}°</span>
                  </div>
                  <div className="limitation-stat">
                    <span className="limitation-stat__key">Reference Target:</span>
                    <span className="limitation-stat__val mono text-good">{targetAngle}°</span>
                  </div>
                  <div className="limitation-stat">
                    <span className="limitation-stat__key">Remaining Range:</span>
                    <span className="limitation-stat__val mono text-warn">{remainingToTarget}°</span>
                  </div>
                </div>
                <p className="limitation-message">
                  Observed movement range remained below the current prototype reference target during {session.limitationsDetected} of {session.totalReps} completed repetition cycles.
                </p>
              </div>

              {/* Advisory suggestion — derived from the same SuggestionLibrary used in the live UI */}
              {limitationSuggestion && (
                <div className="report-suggestion-card" aria-label="Advisory suggestion">
                  <div className="report-suggestion__header">
                    <AlertTriangle size={12} className="report-suggestion__icon" />
                    <span className="report-suggestion__label">Advisory Suggestion</span>
                  </div>
                  <p className="report-suggestion__name">{limitationSuggestion.name}</p>
                  <p className="report-suggestion__guidance">{limitationSuggestion.shortGuidance}</p>
                  <p className="report-suggestion__disclaimer">{SUGGESTION_DISCLAIMER}</p>
                </div>
              )}
            </section>
          ) : (
            <section className="report-section">
              <div className="report-success-card">
                <CheckCircle size={16} className="text-good" />
                <span>Reference target range was consistently achieved across all completed repetitions with proper movement control.</span>
              </div>
            </section>
          )}

          {/* ── 8. ADVISORY GUIDANCE ───────────────────────────────────── */}
          <section className="report-section" aria-labelledby="heading-guidance">
            <div className="report-section__header">
              <h2 id="heading-guidance" className="report-section__title">
                Advisory Guidance
              </h2>
            </div>
            <div className="report-guidance-box">
              <p>{guidanceText}</p>
            </div>
          </section>

          {/* ── 9. RESPONSIBLE USE & DISCLAIMER ────────────────────────── */}
          <section className="report-section report-disclaimer-section">
            <div className="report-disclaimer-card">
              <ShieldAlert size={14} className="text-muted flex-shrink-0" />
              <p>
                <strong>Responsible Use Notice:</strong> Physiosis provides advisory movement analysis for rehabilitation exercise monitoring. It is not a diagnostic system and does not replace evaluation, diagnosis, or clinical treatment plans by a licensed physiotherapist.
              </p>
            </div>
          </section>
        </div>

        {/* ── 10. REPORT FOOTER ACTIONS ───────────────────────────────── */}
        <div className="report-footer no-print">
          <div className="report-footer__left">
            <button
              type="button"
              className="btn btn--secondary btn-print"
              onClick={handlePrint}
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
          </div>

          <div className="report-footer__right">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
            >
              Close
            </button>
            {onStartNewSession && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  onClose();
                  onStartNewSession();
                }}
              >
                Start New Session
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
