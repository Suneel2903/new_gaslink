import React from 'react';

interface EmptyStateProps {
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-96 text-gray-500">
    <div className="text-xl font-semibold mb-2">{message}</div>
  </div>
);

export default EmptyState; 