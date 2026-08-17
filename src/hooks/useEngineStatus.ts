/**
 * useEngineStatus.ts
 * Hook that exposes and manages the current engine status.
 *
 * In Step 2, this will subscribe to PoseDetector events.
 * For now, it provides a manually controllable status state.
 */

import { useState, useCallback } from 'react';
import type { EngineStatus } from '../types/engine';

export interface UseEngineStatusReturn {
  status: EngineStatus;
  setStatus: (status: EngineStatus) => void;
}

export function useEngineStatus(
  initial: EngineStatus = 'idle'
): UseEngineStatusReturn {
  const [status, setStatusState] = useState<EngineStatus>(initial);

  const setStatus = useCallback((next: EngineStatus) => {
    setStatusState(next);
  }, []);

  return { status, setStatus };
}
