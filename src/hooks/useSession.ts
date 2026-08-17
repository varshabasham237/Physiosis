/**
 * useSession.ts
 * Hook for managing session state in React.
 *
 * Wraps SessionManager and exposes reactive state to components.
 * In Step 2, this will also wire the SessionManager to the engine pipeline.
 */

import { useState, useCallback, useRef } from 'react';
import { SessionManager } from '../engine/session/SessionManager';
import type { SessionState, SessionConfig, SessionMetrics } from '../types/session';

const EMPTY_METRICS: SessionMetrics = {
  completedReps: 0,
  completedSets: 0,
  cleanRepRate: 0,
  analysis: {
    averageFormScore: 0,
    totalDeviations: 0,
    criticalDeviations: 0,
    warningDeviations: 0,
  },
  elapsedMs: 0,
};

export interface UseSessionReturn {
  sessionState: SessionState;
  metrics: SessionMetrics;
  startSession: (config: SessionConfig) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
}

export function useSession(): UseSessionReturn {
  const managerRef = useRef(new SessionManager());

  const [sessionState, setSessionState] = useState<SessionState>(
    managerRef.current.currentState as SessionState
  );
  const [metrics, setMetrics] = useState<SessionMetrics>(EMPTY_METRICS);

  const sync = useCallback(() => {
    setSessionState({ ...managerRef.current.currentState } as SessionState);
    setMetrics(managerRef.current.getMetrics());
  }, []);

  const startSession = useCallback(
    (config: SessionConfig) => {
      managerRef.current.start(config);
      sync();
    },
    [sync]
  );

  const pauseSession = useCallback(() => {
    managerRef.current.pause();
    sync();
  }, [sync]);

  const resumeSession = useCallback(() => {
    managerRef.current.resume();
    sync();
  }, [sync]);

  const stopSession = useCallback(() => {
    managerRef.current.stop();
    sync();
  }, [sync]);

  return { sessionState, metrics, startSession, pauseSession, resumeSession, stopSession };
}
