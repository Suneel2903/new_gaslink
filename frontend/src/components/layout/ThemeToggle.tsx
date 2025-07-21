import React, { useEffect, useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

const THEME_KEY = 'theme';

export const ThemeToggle: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return stored === 'dark';
      // Default to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    // Add transition class to prevent jittery behavior
    document.documentElement.classList.add('theme-transitioning');
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
    
    // Remove transition class after a short delay
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 50);
  }, [darkMode]);

  return (
    <div className="flex items-center gap-3 w-full group relative">
      <span className={`
        text-sm font-medium transition-colors duration-200 flex-shrink-0
        ${darkMode ? 'text-gray-300' : 'text-gray-600'}
      `}>
        Toggle Color
      </span>
      <button
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setDarkMode((d) => !d)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0
          ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
        title={darkMode ? 'Light Mode' : 'Dark Mode'}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
            ${darkMode ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      
      {/* Tooltip for collapsed state */}
      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        Toggle Color
      </div>
    </div>
  );
};

export default ThemeToggle; 