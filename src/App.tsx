/**
 * App.tsx
 * Root application component with Supabase Authentication Provider
 * and protected patient routing.
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './components/dashboard/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Activity } from 'lucide-react';

type AuthView = 'login' | 'register' | 'forgot-password';

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-box">
          <Activity size={32} className="text-cyan animate-pulse" />
          <span className="auth-loading-text">Initializing Physiosis Engine...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return (
        <Register
          onNavigateToLogin={() => setAuthView('login')}
          onRegisteredSuccess={() => setAuthView('login')}
        />
      );
    }

    if (authView === 'forgot-password') {
      return <ForgotPassword onNavigateToLogin={() => setAuthView('login')} />;
    }

    return (
      <Login
        onNavigateToRegister={() => setAuthView('register')}
        onNavigateToForgotPassword={() => setAuthView('forgot-password')}
      />
    );
  }

  return <Dashboard />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
