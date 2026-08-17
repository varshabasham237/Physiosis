/**
 * EngineStatusBadge.tsx
 * Displays the current engine status with an animated indicator dot.
 */

import React from 'react';
import type { EngineStatus } from '../../types/engine';
import { ENGINE_STATUS_META } from '../../types/engine';

interface EngineStatusBadgeProps {
  status: EngineStatus;
}

export const EngineStatusBadge: React.FC<EngineStatusBadgeProps> = ({ status }) => {
  const meta = ENGINE_STATUS_META[status];

  return (
    <div className={`engine-badge engine-badge--${meta.color}`} role="status" aria-label={`Engine status: ${meta.label}`}>
      <span className={`engine-badge__dot ${meta.isAnimated ? 'engine-badge__dot--pulse' : ''}`} />
      <span className="engine-badge__label">{meta.label}</span>
    </div>
  );
};
