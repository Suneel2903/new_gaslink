import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import FullScreenLoader from '../FullScreenLoader';
import ThemeToggle from './ThemeToggle';
import Sidebar from './Sidebar';
import { DistributorSelector } from '../DistributorSelector';
import './GasLinkBrand.css';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { role, loading, distributor_id, isSuperAdmin } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-red-600 text-lg mb-4">Failed to load user profile or you do not have access.</p>
        <button
          className="btn-primary"
          onClick={() => window.location.href = '/login'}
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Sidebar width: 64 (expanded), 20 (collapsed)
  const sidebarWidth = sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onCollapse={setSidebarCollapsed} />

      {/* Main content */}
      <div className={`flex-1 min-h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300 ${sidebarWidth}`}>
        {/* Main Header with GasLink branding */}
        <div className="gaslink-header border-b border-blue-500/20 shadow-lg">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-center">
                <div className="gaslink-brand text-center">
                  {/* GasLink Text */}
                  <h1 className="gaslink-text text-4xl font-black tracking-wide">
                    GasLink
                  </h1>
                  <div className="mt-2">
                    <span className="gaslink-tagline text-black text-sm font-medium tracking-wider">
                      Simplest LPG Management
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Add distributor selector for super admins */}
              {isSuperAdmin && (
                <div className="flex items-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 shadow-lg hover:bg-white/15 transition-all duration-200">
                    <DistributorSelector />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Subtle animated border */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout; 