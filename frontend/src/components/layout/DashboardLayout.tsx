import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Icons (using simple text icons for now)
const Icons = {
  Dashboard: '📊',
  Orders: '📋',
  Inventory: '📦',
  PendingActions: '⏳',
  Customers: '👥',
  Invoices: '🧾',
  Payments: '💰',
  Settings: '⚙️',
  Logout: '🚪',
  Menu: '☰',
  Close: '✕',
  Sun: '☀️',
  Moon: '🌙',
  CylinderPrices: '💸',
  ReturnsConfirmation: '🔄',
  CustomerInventory: '📋',
};

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: Icons.Dashboard },
  { name: 'Orders', href: '/app/orders', icon: Icons.Orders },
  { name: 'Inventory', href: '/app/inventory', icon: Icons.Inventory },
  { name: 'Pending Actions', href: '/app/pending-actions', icon: Icons.PendingActions },
  { name: 'Customers', href: '/app/customers', icon: Icons.Customers },
  { name: 'Invoices', href: '/app/invoices', icon: Icons.Invoices },
  { name: 'Payments', href: '/app/payments', icon: Icons.Payments },
];

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { logout, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const currentPath = location.pathname;

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''} flex`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={
        `fixed inset-y-0 left-0 z-50 ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`
      }>
        <div className="flex flex-col h-full relative">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <h1 className={`text-xl font-bold text-gray-900 dark:text-white transition-all duration-300 ${isSidebarCollapsed ? 'hidden' : ''}`}>GasLink</h1>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hidden lg:block"
                title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                style={{ border: '1px solid #e5e7eb' }}
              >
                {isSidebarCollapsed ? '➡️' : '⬅️'}
              </button>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 lg:hidden"
            >
              {sidebarOpen ? Icons.Close : Icons.Menu}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    if (window.innerWidth < 1024) setSidebarOpen(false); // Close on mobile
                  }}
                  className={
                    `w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                    ${isActive 
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{item.icon}</span>
                  <span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>{item.name}</span>
                </button>
              );
            })}
            {/* Cylinder Prices: Always show */}
            <button
              onClick={() => {
                navigate('/app/admin/cylinder-prices');
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                ${currentPath === '/app/admin/cylinder-prices' 
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.CylinderPrices}</span>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Cylinder Prices</span>
            </button>
            
            {/* Customer Inventory: Show to all users for now */}
            <button
              onClick={() => {
                navigate('/app/admin/customer-inventory');
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                ${currentPath === '/app/admin/customer-inventory' 
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              <span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.CustomerInventory}</span>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Customer Inventory</span>
            </button>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
            >
              <span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{darkMode ? Icons.Sun : Icons.Moon}</span>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* User info */}
            {user && (
              <div className={`px-3 py-2 text-sm text-gray-500 dark:text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                <div className="font-medium">{user.email}</div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors duration-200"
            >
              <span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Logout}</span>
              <span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 min-h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Top header for action buttons */}
        <div className="flex justify-end items-center gap-4 p-6">
          {location.pathname === '/app/orders' && (
            <button
              className="btn-primary px-6 min-w-[120px]"
              onClick={() => {
                // Dispatch a custom event to open the new order modal in OrdersPage
                window.dispatchEvent(new CustomEvent('open-new-order-modal'));
              }}
            >
              + New Order
            </button>
          )}
        </div>
        <Outlet />
      </div>
    </div>
  );
}; 