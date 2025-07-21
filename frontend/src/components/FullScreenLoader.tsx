import React from 'react';
import { FaSpinner } from 'react-icons/fa';

interface FullScreenLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({ 
  message = 'Loading...', 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center space-y-4">
        <FaSpinner 
          className={`${sizeClasses[size]} text-blue-600 dark:text-blue-400 animate-spin`} 
        />
        <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
          {message}
        </p>
      </div>
    </div>
  );
};

export default FullScreenLoader; 