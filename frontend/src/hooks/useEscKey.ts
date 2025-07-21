import { useEffect } from 'react';

interface UseEscKeyOptions {
  onEsc?: () => void;
  isActive?: boolean;
}

export const useEscKey = ({ onEsc, isActive = true }: UseEscKeyOptions) => {
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isActive && onEsc) {
        onEsc();
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onEsc, isActive]);
};

export default useEscKey; 