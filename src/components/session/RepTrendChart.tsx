/**
 * RepTrendChart.tsx
 * Clean, lightweight SVG line chart displaying repetition-level ROM and Severity trends.
 */

import React, { useState } from 'react';
import type { RepResult } from '../../engine/session/SessionTypes';

interface RepTrendChartProps {
  reps: RepResult[];
  targetAngle?: number;
}

type ChartMetric = 'ROM' | 'SEVERITY';

export const RepTrendChart: React.FC<RepTrendChartProps> = ({
  reps,
  targetAngle = 165,
}) => {
  const [metric, setMetric] = useState<ChartMetric>('ROM');

  if (!reps || reps.length === 0) {
    return (
      <div className="rep-trend-chart rep-trend-chart--empty">
        <span>Complete a repetition to view trend graph.</span>
      </div>
    );
  }

  const width = 280;
  const height = 110;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 22;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const isRom = metric === 'ROM';
  const minY = 0;
  const maxY = isRom ? 180 : 100;

  const getX = (idx: number) => {
    if (reps.length === 1) return padLeft + chartW / 2;
    return padLeft + (idx / (reps.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    return padTop + chartH - (clamped / maxY) * chartH;
  };

  const points = reps.map((r, i) => ({
    x: getX(i),
    y: getY(isRom ? r.peakAngle : r.severity),
    val: isRom ? r.peakAngle : r.severity,
    repNum: r.repNumber,
    isLimited: r.limitationDetected,
  }));

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const targetY = getY(targetAngle);

  return (
    <div className="rep-trend-chart">
      {/* Metric Toggle Header */}
      <div className="rep-trend-chart__header">
        <span className="rep-trend-chart__title">
          {isRom ? 'Repetition ROM Trend' : 'Movement Severity Trend'}
        </span>
        <div className="rep-trend-chart__toggle">
          <button
            type="button"
            className={`chart-tab ${isRom ? 'chart-tab--active' : ''}`}
            onClick={() => setMetric('ROM')}
          >
            ROM
          </button>
          <button
            type="button"
            className={`chart-tab ${!isRom ? 'chart-tab--active' : ''}`}
            onClick={() => setMetric('SEVERITY')}
          >
            Severity
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="rep-trend-chart__svg"
        aria-label="Repetition trend line chart"
      >
        {/* Horizontal grid lines */}
        <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="var(--border-subtle)" strokeWidth="0.8" />
        <line x1={padLeft} y1={padTop + chartH / 2} x2={width - padRight} y2={padTop + chartH / 2} stroke="var(--border-subtle)" strokeWidth="0.8" />
        <line x1={padLeft} y1={padTop + chartH} x2={width - padRight} y2={padTop + chartH} stroke="var(--border-default)" strokeWidth="1" />

        {/* Target reference line (in ROM mode) */}
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
          {isRom ? '180°' : '100'}
        </text>
        <text x={padLeft - 4} y={padTop + chartH + 3} textAnchor="end" fill="var(--text-disabled)" fontSize="7" fontFamily="var(--font-mono)">
          0
        </text>

        {/* Trend line */}
        <path
          d={pathD}
          fill="none"
          stroke={isRom ? 'var(--accent-cyan)' : 'var(--color-warn)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((pt) => (
          <g key={pt.repNum}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={3.5}
              fill={isRom ? (pt.isLimited ? '#FFA726' : '#00E676') : 'var(--color-warn)'}
              stroke="#0D1117"
              strokeWidth="1.5"
            />
            {/* Value label */}
            <text
              x={pt.x}
              y={pt.y - 5}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize="8"
              fontFamily="var(--font-mono)"
              fontWeight="600"
            >
              {isRom ? `${pt.val}°` : `${pt.val}`}
            </text>
            {/* X-axis Rep label */}
            <text
              x={pt.x}
              y={height - 5}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="7.5"
              fontFamily="var(--font-mono)"
            >
              R{pt.repNum}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
