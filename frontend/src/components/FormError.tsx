import React from 'react';
import type { FieldError } from 'react-hook-form';

interface FormErrorProps {
  error?: FieldError | string | undefined;
}

const FormError: React.FC<FormErrorProps> = ({ error }) => {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
};

export default FormError; 