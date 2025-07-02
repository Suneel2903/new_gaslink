import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/app/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error: any) {
      setError(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoType: 'admin' | 'finance' | 'inventory') => {
    setLoading(true);
    setError('');

    const demoAccounts = {
      admin: { email: 'admin@gaslink.com', password: 'admin123' },
      finance: { email: 'finance@gaslink.com', password: 'finance123' },
      inventory: { email: 'inventory@gaslink.com', password: 'inventory123' },
    };

    try {
      const { email, password } = demoAccounts[demoType];
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error: any) {
      setError('Demo login failed. Please use manual login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 shadow-lg mb-2">
            <span className="text-4xl text-primary-500">🔥</span>
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to <span className="text-primary-600">GasLink</span>
          </h2>
          <p className="mt-2 text-center text-base text-gray-600 dark:text-gray-400">
            LPG Distribution Management System
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex justify-center py-3"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

        {/* Demo Accounts */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background-light dark:bg-background-dark text-gray-500 dark:text-gray-400">
                Demo Accounts
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              onClick={() => handleDemoLogin('admin')}
              disabled={loading}
              className="btn-secondary"
            >
              Admin Demo
            </button>
            <button
              onClick={() => handleDemoLogin('finance')}
              disabled={loading}
              className="btn-secondary"
            >
              Finance Demo
            </button>
            <button
              onClick={() => handleDemoLogin('inventory')}
              disabled={loading}
              className="btn-secondary"
            >
              Inventory Demo
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            GasLink v1.0.0 - LPG Distribution Management
          </p>
        </div>
      </div>
    </div>
  );
}; 