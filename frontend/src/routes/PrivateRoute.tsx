import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import FullScreenLoader from '../components/FullScreenLoader';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading, role, distributor_id } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      toast.error('Please log in to access this page', {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [user, loading]);

  if (loading) {
    return <FullScreenLoader />;
  }

  // If not logged in or no role, show friendly message
  if (!user || !role) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-green-600 text-lg mb-4 text-center">
          <strong>You're almost there!</strong><br />
          We're taking you to your dashboard.<br />
          If this takes more than a few seconds, please try logging in again.
        </p>
        <button
          className="btn-primary"
          onClick={() => window.location.href = '/login'}
        >
          Log In Again
        </button>
      </div>
    );
  }

  return <>{children}</>;
}; 