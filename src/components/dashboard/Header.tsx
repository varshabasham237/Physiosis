/**
 * Header.tsx
 * Top navigation bar: Physiosis logo + tagline + engine status + nav links.
 */

import React from 'react';
import { Activity } from 'lucide-react';
import { EngineStatusBadge } from './EngineStatusBadge';
import type { EngineStatus } from '../../types/engine';

interface HeaderProps {
  engineStatus: EngineStatus;
}

export const Header: React.FC<HeaderProps> = ({ engineStatus }) => {
  return (
    <header className="header" role="banner">
      {/* Logo area */}
      <div className="header__brand">
        <div className="header__logo-icon" aria-hidden="true">
          <Activity size={20} strokeWidth={2.5} />
        </div>
        <div className="header__logo-text">
          <span className="header__logo-name">Physiosis</span>
          <span className="header__logo-tagline">Rehabilitation Engine</span>
        </div>
      </div>

      {/* Center nav links — placeholder for future routing */}
      <nav className="header__nav" aria-label="Main navigation">
        <a href="#" className="header__nav-link header__nav-link--active" aria-current="page">
          Dashboard
        </a>
        <a href="#" className="header__nav-link">
          Exercises
        </a>
        <a href="#" className="header__nav-link">
          Reports
        </a>
      </nav>

      {/* Engine status */}
      <div className="header__actions">
        <EngineStatusBadge status={engineStatus} />
      </div>
    </header>
  );
};
