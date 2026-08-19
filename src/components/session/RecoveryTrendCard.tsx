/**
 * RecoveryTrendCard.tsx
 * Multi-session recovery progress chart based on persistent PhysiosisSession records.
 *
 * Includes an exercise filter to prevent mixing incompatible angle scales
 * (e.g. Shoulder 165° vs Knee 170° vs Leg Raise 45°).
 */

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { PhysiosisSession } from '../../engine/session/SessionTypes';
import { getAllExercises } from '../../engine/exercise/ExerciseRegistry';

interface RecoveryTrendCardProps {
  sessions: PhysiosisSession[];
  activeExerciseId?: string;
}

type TrendMetric = 'ROM' | 'QUALITY';

export const RecoveryTrendCard: React.FC<RecoveryTrendCardProps> = ({
  sessions,
  activeExerciseId,
}) => {
  const exercises = getAllExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    activeExerciseId ?? 'shoulder-flexion'
  );
  const [metric, setMetric] = useState<TrendMetric>('ROM');

  const selectedExercise =
    exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0];

  // Filter sessions strictly matching selected exercise
  const filteredSessions = sessions.filter(
    (s) =>
      s.exercise === selectedExercise.name ||
      (selectedExercise.id === 'shoulder-flexion' && (!s.exercise || s.exercise === 'Shoulder Flexion'))
  );

  // Newest first in storage, reverse for chronological chart left-to-right
  const chronologicalSessions = [...filteredSessions].reverse();
  const hasData = chronologicalSessions.length > 0;

  const width = 320;
  const height = 130;
  const padLeft = 34;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 26;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const isRom = metric === 'ROM';
  const targetAngle = selectedExercise.targetAngle;
  const maxY = isRom ? Math.max(180, targetAngle + 15) : 100;

  const getX = (idx: number) => {
    if (chronologicalSessions.length === 1) return padLeft + chartW / 2;
    return padLeft + (idx / (chronologicalSessions.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return padTop + chartH - (clamped / maxY) * chartH;
  };

  const points = chronologicalSessions.map((s, i) => ({
    x: getX(i),
    y: getY(isRom ? s.bestROM : s.averageScore),
    val: isRom ? s.bestROM : s.averageScore,
    sessionLabel: `S${i + 1}`,
    reps: s.totalReps,
    hasLimitation: s.limitationsDetected > 0,
  }));

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const targetY = getY(targetAngle);

  return (
    <div className="card recovery-trend-card">
      <div className="card__header">
        <div className="card__header-left">
          <TrendingUp size={16} />
          <div>
            <span className="card__title">Recovery Trend</span>
            <span className="recovery-trend-card__sub">Session movement-range trend</span>
          </div>
        </div>

        <div className="rep-trend-chart__toggle">
          <button
            type="button"
            className={`chart-tab ${isRom ? 'chart-tab--active' : ''}`}
            onClick={() => setMetric('ROM')}
          >
            Best ROM
          </button>
          <button
            type="button"
            className={`chart-tab ${!isRom ? 'chart-tab--active' : ''}`}
            onClick={() => setMetric('QUALITY')}
          >
            Quality
          </button>
        </div>
      </div>

      {/* ── Exercise Filter Selector ────────────────────────────────────── */}
      <div className="recovery-trend-card__filter-row">
        <span className="recovery-trend-card__filter-label">Exercise:</span>
        <select
          className="recovery-trend-card__select"
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          aria-label="Filter recovery trend by exercise"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} ({ex.targetAngle}°)
            </option>
          ))}
        </select>
      </div>

      {!hasData ? (
        <div className="recovery-trend-card__empty">
          <p>No completed sessions for {selectedExercise.name} yet.</p>
          <span>Complete and end an exercise session to track recovery progress over time.</span>
        </div>
      ) : (
        <div className="recovery-trend-card__chart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} className="recovery-trend-card__svg">
            {/* Grid */}
            <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="var(--border-subtle)" strokeWidth="0.8" />
            <line x1={padLeft} y1={padTop + chartH / 2} x2={width - padRight} y2={padTop + chartH / 2} stroke="var(--border-subtle)" strokeWidth="0.8" />
            <line x1={padLeft} y1={padTop + chartH} x2={width - padRight} y2={padTop + chartH} stroke="var(--border-default)" strokeWidth="1" />

            {/* Target reference line */}
            {isRom && (
              <g>
                <line
                  x1={padLeft}
                  y1={targetY}
                  x2={width - padRight}
                  y2={targetY}
                  stroke="rgba(0, 230, 118, 0.65)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 4}
                  y={targetY + 3}
                  textAnchor="end"
                  fill="rgba(0, 230, 118, 0.85)"
                  fontSize="7.5"
                  fontFamily="var(--font-mono)"
                >
                  {targetAngle}°
                </text>
              </g>
            )}

            {/* Y Axis Labels */}
            <text x={padLeft - 4} y={padTop + 3} textAnchor="end" fill="var(--text-disabled)" fontSize="7" fontFamily="var(--font-mono)">
              {isRom ? `${maxY}°` : '100'}
            </text>
            <text x={padLeft - 4} y={padTop + chartH + 3} textAnchor="end" fill="var(--text-disabled)" fontSize="7" fontFamily="var(--font-mono)">
              0
            </text>

            {/* Trend line */}
            <path
              d={pathD}
              fill="none"
              stroke={isRom ? 'var(--accent-cyan)' : 'var(--color-good)'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Nodes */}
            {points.map((pt) => (
              <g key={pt.sessionLabel}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={4}
                  fill={isRom ? (pt.hasLimitation ? '#FFA726' : '#00E676') : 'var(--accent-blue)'}
                  stroke="#0A0E14"
                  strokeWidth="1.5"
                />
                <text
                  x={pt.x}
                  y={pt.y - 6}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {isRom ? `${pt.val}°` : `${pt.val}`}
                </text>
                <text
                  x={pt.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {pt.sessionLabel}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};
