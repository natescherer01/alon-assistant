/**
 * React Query Client Configuration
 *
 * Optimized configuration for data loading with:
 * - Proper cache timing (gcTime > staleTime to prevent memory leaks)
 * - Encrypted localStorage persistence
 * - Stale-while-revalidate pattern
 * - Retry strategies
 * - Network-aware caching
 */

import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import secureStorage from './secureStorage';

/**
 * Custom persister using encrypted localStorage
 */
const createSecurePersister = () => ({
  persistClient: async (client) => {
    try {
      await secureStorage.setItem('REACT_QUERY_OFFLINE_CACHE', client);
    } catch (error) {
      console.error('Failed to persist query client:', error);
    }
  },
  restoreClient: async () => {
    try {
      return await secureStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
    } catch (error) {
      console.error('Failed to restore query client:', error);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      secureStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    } catch (error) {
      console.error('Failed to remove persisted client:', error);
    }
  },
});

/**
 * Create and configure React Query client
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate timing
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - MUST be > staleTime to prevent premature eviction

      // Refetch strategies
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnReconnect: true, // Refetch when internet reconnects
      refetchOnMount: true, // Refetch when component mounts

      // Retry configuration
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

      // Network mode
      networkMode: 'online', // Only fetch when online

      // Error handling
      throwOnError: false, // Don't throw errors (handle in components)

      // Structural sharing (default: true, but explicit for clarity)
      structuralSharing: true, // Prevents unnecessary re-renders
    },

    mutations: {
      // Retry mutations once (idempotent operations only)
      retry: 1,
      retryDelay: 1000,

      // Network mode
      networkMode: 'online',

      // Error handling
      throwOnError: false,

      // Mutation lifecycle
      onError: (error, variables, context) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

/**
 * Set up persistence with encrypted localStorage
 */
export const setupPersistence = async () => {
  try {
    // Check if encryption is available
    const encryptionAvailable = await secureStorage.isEncryptionAvailable();

    if (!encryptionAvailable) {
      console.warn('Encryption not available, cache persistence disabled');
      return;
    }

    // Set up persistence
    await persistQueryClient({
      queryClient,
      persister: createSecurePersister(),
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      buster: '1.0', // Increment to invalidate all cached data
    });

    console.log('✅ Query cache persistence enabled with encryption');
  } catch (error) {
    console.error('Failed to set up query persistence:', error);
  }
};

/**
 * Online/Offline event handlers
 */
export const setupNetworkHandlers = () => {
  // Refetch active queries when coming back online
  window.addEventListener('online', () => {
    console.log('🌐 Network online - refetching active queries');
    queryClient.refetchQueries({ type: 'active' });
  });

  // Pause ongoing queries when going offline
  window.addEventListener('offline', () => {
    console.log('📡 Network offline - pausing queries');
    queryClient.cancelQueries();
  });
};

/**
 * Cache size monitoring (development only)
 */
export const getCacheStats = () => {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  const stats = {
    totalQueries: queries.length,
    activeQueries: queries.filter(q => q.observers.length > 0).length,
    staleQueries: queries.filter(q => q.isStale()).length,
    fetchingQueries: queries.filter(q => q.isFetching()).length,
    cachedDataSize: JSON.stringify(cache).length,
  };

  return stats;
};

/**
 * Clear all cache (useful for logout)
 */
export const clearCache = async () => {
  queryClient.clear();
  await secureStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
  console.log('🗑️  Query cache cleared');
};

export default queryClient;
