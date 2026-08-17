/**
 * LiveFeedCard.tsx
 * The primary dashboard card hosting the live webcam feed and real-time skeleton overlay.
 */

import React from 'react';
import { Camera, CameraOff, Loader2, AlertCircle } from 'lucide-react';
import type { EngineStatus } from '../../types/engine';
import type { PoseTrackingStats } from '../../types/pose';

interface LiveFeedCardProps {
  engineStatus: EngineStatus;
  isStreaming: boolean;
  isInitializing: boolean;
  errorMessage: string | null;
  stats: PoseTrackingStats;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onToggleCamera: () => void;
}

export const LiveFeedCard: React.FC<LiveFeedCardProps> = ({
  engineStatus,
  isStreaming,
  isInitializing,
  errorMessage,
  stats,
  videoRef,
  canvasRef,
  onToggleCamera,
}) => {
  const isLive = engineStatus === 'running' && isStreaming;

  return (
    <div className="card live-feed-card">
      {/* Card header */}
      <div className="card__header">
        <div className="card__header-left">
          <Camera size={16} />
          <span className="card__title">Live Engine Feed</span>
        </div>

        <div className="card__header-right">
          {isLive && (
            <span className="live-indicator">
              <span className="live-indicator__dot" />
              LIVE
            </span>
          )}
          {!isLive && !isInitializing && (
            <span className="card__status-text">Engine Offline</span>
          )}
          {isInitializing && (
            <span className="card__status-text card__status-text--init">
              Initializing MediaPipe...
            </span>
          )}

          <button
            className={`btn-camera-toggle ${isStreaming ? 'btn-camera-toggle--active' : ''}`}
            onClick={onToggleCamera}
            disabled={isInitializing}
            type="button"
            aria-label={isStreaming ? 'Stop Camera' : 'Start Camera'}
          >
            {isInitializing ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Loading Engine</span>
              </>
            ) : isStreaming ? (
              <>
                <CameraOff size={14} />
                <span>Stop Camera</span>
              </>
            ) : (
              <>
                <Camera size={14} />
                <span>Start Camera</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feed viewport */}
      <div className="live-feed-card__viewport">
        {/* Error message banner */}
        {errorMessage && (
          <div className="feed-error-banner" role="alert">
            <AlertCircle size={16} className="feed-error-banner__icon" />
            <div className="feed-error-banner__text">
              <strong>Camera Error: </strong> {errorMessage}
            </div>
          </div>
        )}

        {/* Video feed element */}
        <video
          ref={videoRef}
          className={`live-feed-card__video ${isStreaming ? 'live-feed-card__video--visible' : ''}`}
          playsInline
          muted
          autoPlay
        />

        {/* Skeleton canvas overlay */}
        <canvas
          ref={canvasRef}
          className={`live-feed-card__canvas ${isStreaming ? 'live-feed-card__canvas--visible' : ''}`}
        />

        {/* Placeholder when offline */}
        {!isStreaming && !isInitializing && (
          <div className="live-feed-card__placeholder">
            <div className="live-feed-card__placeholder-icon">
              <Camera size={44} strokeWidth={1.2} />
            </div>
            <p className="live-feed-card__placeholder-title">Webcam Feed Inactive</p>
            <p className="live-feed-card__placeholder-subtitle">
              Press <strong>Start Camera</strong> to initialize MediaPipe Pose Landmarker
            </p>
            <button
              className="btn-primary-start"
              onClick={onToggleCamera}
              type="button"
            >
              <Camera size={16} />
              <span>Start Camera</span>
            </button>
          </div>
        )}

        {/* Initializing state */}
        {isInitializing && (
          <div className="live-feed-card__placeholder">
            <Loader2 size={40} className="spin-icon init-spinner" />
            <p className="live-feed-card__placeholder-title">Loading MediaPipe Models</p>
            <p className="live-feed-card__placeholder-subtitle">
              Acquiring camera stream and warming up GPU delegate...
            </p>
          </div>
        )}

        {/* Pose tracking helper overlay when streaming */}
        {isStreaming && !stats.poseDetected && (
          <div className="pose-searching-badge">
            <span className="pose-searching-dot" />
            <span>Position body in camera view</span>
          </div>
        )}

        {/* Corner frame markers */}
        <span className="corner corner--tl" aria-hidden="true" />
        <span className="corner corner--tr" aria-hidden="true" />
        <span className="corner corner--bl" aria-hidden="true" />
        <span className="corner corner--br" aria-hidden="true" />
      </div>

      {/* Footer metrics row */}
      <div className="live-feed-card__footer">
        <div className="metric-chip">
          <span className="metric-chip__label">FPS</span>
          <span className="metric-chip__value">
            {isStreaming ? (stats.fps > 0 ? stats.fps : '—') : '—'}
          </span>
        </div>
        <div className="metric-chip">
          <span className="metric-chip__label">Confidence</span>
          <span className="metric-chip__value">
            {isStreaming && stats.poseDetected ? `${stats.confidence}%` : '—'}
          </span>
        </div>
        <div className="metric-chip">
          <span className="metric-chip__label">Landmarks</span>
          <span className="metric-chip__value">
            {isStreaming && stats.poseDetected
              ? `${stats.landmarkCount} / 13`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};
