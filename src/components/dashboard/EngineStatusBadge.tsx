/**
 * EngineStatusBadge.tsx
 * Displays the current engine status with an animated indicator dot.
 */

import React from 'react';
import type { EngineStatus } from '../../types/engine';
import { ENGINE_STATUS_META } from '../../types/engine';

interface EngineStatusBadgeProps {
  status: EngineStatus;
  mode?: 'TUTORIAL' | 'PRACTICE' | 'LIVE' | 'DEMO';
}

export const EngineStatusBadge: React.FC<EngineStatusBadgeProps> = ({ status, mode }) => {
  if (mode === 'DEMO') {
    return (
      <div className="engine-badge engine-badge--amber" role="status" aria-label="Engine status: Demo Mode">
        <span className="engine-badge__dot engine-badge__dot--pulse" style={{ background: '#FFA726' }} />
        <span className="engine-badge__label" style={{ color: '#FFA726', fontWeight: 600 }}>DEMO MODE</span>
      </div>
    );
  }

  const meta = ENGINE_STATUS_META[status];

  return (
    <div className={`engine-badge engine-badge--${meta.color}`} role="status" aria-label={`Engine status: ${meta.label}`}>
      <span className={`engine-badge__dot ${meta.isAnimated ? 'engine-badge__dot--pulse' : ''}`} />
      <span className="engine-badge__label">{meta.label}</span>
    </div>
  );
};
