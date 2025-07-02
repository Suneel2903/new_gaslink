import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FullScreenLoader } from '../contexts/AuthContext';

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    // Redirect authenticated users to dashboard or intended destination
    const from = location.state?.from?.pathname || '/app/dashboard';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}; 