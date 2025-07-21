import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaChartBar, 
  FaClipboardList, 
  FaUsers, 
  FaFileInvoiceDollar, 
  FaMoneyBillWave, 
  FaBoxes, 
  FaClock, 
  FaCog, 
  FaSignOutAlt, 
  FaBars, 
  FaTimes, 
  FaChevronLeft, 
  FaChevronRight,
  FaBuilding,
  FaUserCog,
  FaRupeeSign,
  FaSun,
  FaMoon
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCollapse?: (collapsed: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  adminOnly?: boolean;
  iconColor: string;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/app/dashboard',
    icon: FaChartBar,
    roles: ['super_admin', 'admin', 'distributor_admin', 'finance', 'inventory', 'driver', 'customer'],
    iconColor: 'text-blue-600'
  },
  {
    id: 'orders',
    label: 'Orders',
    path: '/app/orders',
    icon: FaClipboardList,
    roles: ['super_admin', 'admin', 'distributor_admin', 'inventory', 'driver'],
    iconColor: 'text-purple-600'
  },
  {
    id: 'customers',
    label: 'Customers',
    path: '/app/customers',
    icon: FaUsers,
    roles: ['super_admin', 'admin', 'distributor_admin'],
    iconColor: 'text-indigo-600'
  },
  {
    id: 'invoices',
    label: 'Invoices',
    path: '/app/invoices',
    icon: FaFileInvoiceDollar,
    roles: ['super_admin', 'admin', 'distributor_admin', 'finance'],
    iconColor: 'text-orange-600'
  },
  {
    id: 'payments',
    label: 'Payments',
    path: '/app/payments',
    icon: FaMoneyBillWave,
    roles: ['super_admin', 'admin', 'distributor_admin', 'finance'],
    iconColor: 'text-green-600'
  },
  {
    id: 'inventory',
    label: 'Inventory',
    path: '/app/inventory',
    icon: FaBoxes,
    roles: ['super_admin', 'admin', 'distributor_admin', 'inventory'],
    iconColor: 'text-teal-600'
  },
  {
    id: 'pending-actions',
    label: 'Pending Actions',
    path: '/app/pending-actions',
    icon: FaClock,
    roles: ['super_admin', 'admin', 'distributor_admin'],
    iconColor: 'text-yellow-600'
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/app/settings',
    icon: FaCog,
    roles: ['super_admin', 'admin', 'distributor_admin'],
    iconColor: 'text-gray-600'
  },
  {
    id: 'cylinder-prices',
    label: 'Cylinder Prices',
    path: '/app/admin/cylinder-prices',
    icon: FaRupeeSign,
    roles: ['super_admin', 'admin', 'distributor_admin', 'finance'],
    adminOnly: true,
    iconColor: 'text-blue-500'
  },
  {
    id: 'customer-inventory',
    label: 'Customer Inventory',
    path: '/app/admin/customer-inventory',
    icon: FaUserCog,
    roles: ['super_admin', 'admin', 'distributor_admin'],
    adminOnly: true,
    iconColor: 'text-pink-600'
  },
  {
    id: 'corporation-invoices',
    label: 'AC4/ERV',
    path: '/app/corporation-invoices',
    icon: FaBuilding,
    roles: ['super_admin', 'admin', 'distributor_admin', 'finance', 'inventory'],
    iconColor: 'text-red-600'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onCollapse }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const { logout, user, role, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  const handleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (onCollapse) onCollapse(next);
      return next;
    });
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const hasAccess = (item: NavItem) => {
    if (item.adminOnly && !isSuperAdmin && role !== 'admin' && role !== 'distributor_admin') {
      return false;
    }
    return item.roles.includes(role || '') || item.roles.includes('super_admin');
  };

  const filteredNavItems = navItems.filter(hasAccess);

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 
        ${isCollapsed ? 'w-16' : 'w-64'} 
        bg-white dark:bg-gray-800 shadow-lg 
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full relative">
          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCollapse}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hidden lg:block"
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isCollapsed ? <FaChevronRight size={16} /> : <FaChevronLeft size={16} />}
              </button>
              <h1 className={`
                text-lg font-medium text-gray-900 dark:text-white 
                transition-all duration-300 
                ${isCollapsed ? 'hidden' : 'block'}
              `}>
                Menu
              </h1>
            </div>
            <button
              onClick={onToggle}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 lg:hidden"
            >
              {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 px-2 py-4 space-y-1 ${isCollapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.path);
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm font-medium rounded-md 
                    transition-colors duration-200 group relative
                    ${isActive 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`
                    text-lg flex-shrink-0 transition-all duration-300
                    ${isCollapsed ? 'mx-auto' : 'mr-3'}
                    ${isActive ? 'text-blue-600 dark:text-blue-400' : item.iconColor}
                  `} />
                  <span className={`
                    transition-all duration-300
                    ${isCollapsed ? 'hidden' : 'block'}
                  `}>
                    {item.label}
                  </span>
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Theme Toggle */}
            <div className={`
              flex items-center px-3 py-2
              ${isCollapsed ? 'justify-center' : 'justify-start'}
            `}>
              {isCollapsed ? (
                <button
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={() => setDarkMode((d) => !d)}
                  className={`
                    p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                    transition-colors duration-200 group relative
                  `}
                  title="Toggle Color"
                >
                  {darkMode ? <FaSun size={16} /> : <FaMoon size={16} />}
                  {/* Tooltip for collapsed state */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Toggle Color
                  </div>
                </button>
              ) : (
                <ThemeToggle />
              )}
            </div>
            
            {/* User info */}
            {user && (
              <div className={`
                px-3 py-2 text-sm text-gray-500 dark:text-gray-400 
                ${isCollapsed ? 'hidden' : 'block'}
              `}>
                <div className="font-medium truncate">{user.email}</div>
                {role && (
                  <div className="text-xs mt-1">
                    Logged in as: <span className="font-semibold">{role}</span>
                  </div>
                )}
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center px-3 py-2 text-sm font-medium 
                text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 
                rounded-md transition-colors duration-200 group relative
              `}
              title={isCollapsed ? 'Logout' : undefined}
            >
              <FaSignOutAlt className={`
                text-lg flex-shrink-0 transition-all duration-300
                ${isCollapsed ? 'mx-auto' : 'mr-3'}
              `} />
              <span className={`
                transition-all duration-300
                ${isCollapsed ? 'hidden' : 'block'}
              `}>
                Logout
              </span>
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Logout
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 