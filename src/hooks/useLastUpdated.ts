import { useCallback, useState } from 'react';

export const useLastUpdated = () => {
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const markSuccess = useCallback((timestamp?: Date) => {
    const next = timestamp ?? new Date();
    setLastUpdatedAt(next);
    return next;
  }, []);

  const resetLastUpdated = useCallback(() => {
    setLastUpdatedAt(null);
  }, []);

  return {
    lastUpdatedAt,
    markSuccess,
    resetLastUpdated,
  };
};
