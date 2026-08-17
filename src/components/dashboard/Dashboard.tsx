/**
 * Dashboard.tsx
 * Root dashboard layout — connects usePoseTracking hook with all UI panels.
 */

import React from 'react';
import { Header } from './Header';
import { LiveFeedCard } from './LiveFeedCard';
import { AnalysisCard } from './AnalysisCard';
import { ReferenceExerciseCard } from './ReferenceExerciseCard';
import { SessionHealthCard } from './SessionHealthCard';
import { usePoseTracking } from '../../hooks/usePoseTracking';
import { useSession } from '../../hooks/useSession';

export const Dashboard: React.FC = () => {
  const {
    videoRef,
    canvasRef,
    engineStatus,
    isStreaming,
    isInitializing,
    errorMessage,
    stats,
    toggleCamera,
  } = usePoseTracking();

  const { sessionState, metrics } = useSession();

  return (
    <div className="app">
      <Header engineStatus={engineStatus} />

      <main className="dashboard" id="main-content" role="main">
        {/* Primary column: live webcam feed with pose skeleton */}
        <section className="dashboard__primary" aria-label="Live feed">
          <LiveFeedCard
            engineStatus={engineStatus}
            isStreaming={isStreaming}
            isInitializing={isInitializing}
            errorMessage={errorMessage}
            stats={stats}
            videoRef={videoRef}
            canvasRef={canvasRef}
            onToggleCamera={toggleCamera}
          />
        </section>

        {/* Secondary column: analysis + reference + session */}
        <aside className="dashboard__secondary" aria-label="Analysis and session panels">
          <AnalysisCard
            engineStatus={engineStatus}
            isStreaming={isStreaming}
            stats={stats}
          />

          <div className="dashboard__secondary-row">
            <ReferenceExerciseCard exerciseId="shoulder-abduction" />
            <SessionHealthCard sessionState={sessionState} metrics={metrics} />
          </div>
        </aside>
      </main>
    </div>
  );
};
