import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <FaExclamationTriangle className="mx-auto h-24 w-24 text-yellow-500" />
        </div>

        {/* Error Code */}
        <h1 className="text-9xl font-bold text-gray-300 dark:text-gray-600 mb-4">
          404
        </h1>

        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or you entered the wrong URL.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <FaArrowLeft className="mr-2" />
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/app/dashboard')}
            className="flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
          >
            <FaHome className="mr-2" />
            Go to Dashboard
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            You can also try:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => navigate('/app/orders')}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Orders
            </button>
            <button
              onClick={() => navigate('/app/customers')}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Customers
            </button>
            <button
              onClick={() => navigate('/app/invoices')}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Invoices
            </button>
            <button
              onClick={() => navigate('/app/inventory')}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage; 