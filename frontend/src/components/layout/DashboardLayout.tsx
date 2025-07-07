import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, FullScreenLoader } from '../../contexts/AuthContext';

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
  CorporationInvoices: '🏢',
};

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { logout, user, role, isSuperAdmin, distributor_id } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Log role, isSuperAdmin, distributor_id for debugging
  console.log('Sidebar Debug:', { role, isSuperAdmin, distributor_id });

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

  // Sidebar module logic
  const sidebarModules = () => {
    if (isSuperAdmin) {
      return [
        'Dashboard', 'Orders', 'Customers', 'Invoices', 'Payments', 'Inventory', 'Credit Notes', 'Pending Actions', 'Settings',
      ];
    }
    if (role === 'distributor_admin') {
      return [
        'Dashboard', 'Orders', 'Customers', 'Invoices', 'Payments', 'Inventory', 'Credit Notes', 'Pending Actions', 'Settings',
      ];
    }
    if (role === 'finance') {
      return ['Invoices', 'Payments'];
    }
    if (role === 'inventory') {
      return ['Orders', 'Inventory'];
    }
    if (role === 'driver') {
      return ['Assigned Deliveries'];
    }
    if (role === 'customer') {
      return ['My Orders', 'Account'];
    }
    return [];
  };
  const modules = sidebarModules();

  const showCorporationInvoices = isSuperAdmin || role === 'distributor_admin' || role === 'finance' || role === 'inventory';

  if (!role) return <FullScreenLoader />;

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
            {modules.includes('Dashboard') && (
              <button onClick={() => { navigate('/app/dashboard'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/dashboard' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Dashboard}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Dashboard</span></button>
            )}
            {modules.includes('Orders') && (
              <button onClick={() => { navigate('/app/orders'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/orders' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Orders}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Orders</span></button>
            )}
            {modules.includes('Customers') && (
              <button onClick={() => { navigate('/app/customers'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/customers' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Customers}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Customers</span></button>
            )}
            {modules.includes('Invoices') && (
              <button onClick={() => { navigate('/app/invoices'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/invoices' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Invoices}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Invoices</span></button>
            )}
            {showCorporationInvoices && (
              <button onClick={() => { navigate('/app/corporation-invoices'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/corporation-invoices' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.CorporationInvoices}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Corporation Invoices</span></button>
            )}
            {modules.includes('Payments') && (
              <button onClick={() => { navigate('/app/payments'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/payments' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Payments}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Payments</span></button>
            )}
            {modules.includes('Inventory') && (
              <button onClick={() => { navigate('/app/inventory'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/inventory' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Inventory}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Inventory</span></button>
            )}
            {modules.includes('Credit Notes') && (
              <button onClick={() => { navigate('/app/credit-notes'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/credit-notes' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">🧾</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Credit Notes</span></button>
            )}
            {modules.includes('Pending Actions') && (
              <button onClick={() => { navigate('/app/pending-actions'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/pending-actions' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.PendingActions}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Pending Actions</span></button>
            )}
            {modules.includes('Settings') && (
              <button onClick={() => { navigate('/app/settings'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200${currentPath === '/app/settings' ? ' bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : ' text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><span className="text-lg mr-0 lg:mr-3 flex-shrink-0">{Icons.Settings}</span><span className={`${isSidebarCollapsed ? 'hidden' : 'inline'} transition-all duration-300`}>Settings</span></button>
            )}
            {/* Always show Cylinder Prices and Customer Inventory */}
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
                {role && <div className="text-xs mt-1">Logged in as: <span className="font-semibold">{role}</span></div>}
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

            {/* Show badge for Global Access or distributor_id */}
            {isSuperAdmin ? (
              <div className="text-xs text-green-600 font-semibold mt-2">🌐 Global Access</div>
            ) : distributor_id ? (
              <div className="text-xs text-blue-600 font-semibold mt-2">Distributor: {distributor_id}</div>
            ) : null}
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