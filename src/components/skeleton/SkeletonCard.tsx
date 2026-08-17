/**
 * SkeletonCard.tsx
 * Reusable loading skeleton block for content placeholders.
 */

import React from 'react';

interface SkeletonCardProps {
  /** Height of the skeleton block in px or CSS unit. Default: 100%. */
  height?: string;
  /** Border radius. Default: inherits card radius. */
  borderRadius?: string;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = '100%',
  borderRadius = '8px',
  className = '',
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, borderRadius }}
      aria-hidden="true"
    />
  );
};

interface SkeletonTextProps {
  width?: string;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = '100%',
  className = '',
}) => {
  return (
    <div
      className={`skeleton skeleton--text ${className}`}
      style={{ width }}
      aria-hidden="true"
    />
  );
};
