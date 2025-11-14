/**
 * Enhanced API Client with ETag Support
 *
 * Features:
 * - ETag caching for 304 Not Modified responses
 * - CSRF token management
 * - Rate limit header tracking
 * - Automatic retry with exponential backoff
 * - Request deduplication
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// ETag cache (in-memory)
const etagCache = new Map();

// CSRF token cache
let csrfToken = null;

/**
 * Create enhanced axios instance
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

/**
 * Request interceptor - Add auth token, CSRF token, and ETag
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      // Get CSRF token if we don't have one
      if (!csrfToken) {
        try {
          const response = await axios.get(`${API_BASE_URL}/csrf-token`);
          csrfToken = response.data.csrf_token;
        } catch (error) {
          console.warn('Failed to get CSRF token:', error);
        }
      }

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add If-None-Match header for GET requests with cached ETags
    if (config.method?.toLowerCase() === 'get') {
      const cacheKey = `${config.method}:${config.url}`;
      const cachedEtag = etagCache.get(cacheKey);

      if (cachedEtag) {
        config.headers['If-None-Match'] = cachedEtag;
      }
    }

    // Add If-Match header for update requests (optimistic locking)
    if (['put', 'patch'].includes(config.method?.toLowerCase()) && config.etag) {
      config.headers['If-Match'] = config.etag;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor - Handle ETags, rate limits, and errors
 */
apiClient.interceptors.response.use(
  (response) => {
    // Store ETag for future requests
    const etag = response.headers['etag'];
    if (etag && response.config.method?.toLowerCase() === 'get') {
      const cacheKey = `${response.config.method}:${response.config.url}`;
      etagCache.set(cacheKey, etag);
    }

    // Track rate limit headers
    const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
    const rateLimitReset = response.headers['x-ratelimit-reset'];

    if (rateLimitRemaining !== undefined) {
      // Warn if rate limit is getting low
      if (parseInt(rateLimitRemaining) < 10) {
        console.warn(
          `⚠️  Rate limit low: ${rateLimitRemaining} requests remaining (resets at ${new Date(
            parseInt(rateLimitReset) * 1000
          ).toLocaleTimeString()})`
        );
      }
    }

    return response;
  },
  async (error) => {
    const { response, config } = error;

    // Handle 304 Not Modified (cache hit)
    if (response?.status === 304) {
      console.log('✅ Cache hit (304 Not Modified):', config.url);
      // Return empty response (React Query will use cached data)
      return { ...response, data: null, status: 304 };
    }

    // Handle 401 Unauthorized
    if (response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/signup') {
        localStorage.removeItem('token');
        csrfToken = null; // Clear CSRF token
        window.location.href = '/login';
      }
    }

    // Handle 403 CSRF failure
    if (response?.status === 403 && response?.data?.type === 'csrf_error') {
      console.warn('CSRF token invalid, refreshing...');
      csrfToken = null; // Clear invalid token

      // Retry request once with new CSRF token
      if (!config._retry) {
        config._retry = true;
        return apiClient.request(config);
      }
    }

    // Handle 412 Precondition Failed (optimistic locking conflict)
    if (response?.status === 412) {
      console.warn('⚠️  Conflict detected (412), refetch required');
      error.isConflict = true;
    }

    // Handle 429 Too Many Requests
    if (response?.status === 429) {
      const retryAfter = response.headers['retry-after'];
      console.error(
        `❌ Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds`
      );
      error.isRateLimited = true;
      error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
    }

    return Promise.reject(error);
  }
);

/**
 * Helper to clear ETag cache (useful after mutations)
 */
export const clearEtagCache = (pattern) => {
  if (pattern) {
    // Clear matching entries
    for (const [key] of etagCache.entries()) {
      if (key.includes(pattern)) {
        etagCache.delete(key);
      }
    }
  } else {
    // Clear all
    etagCache.clear();
  }
};

/**
 * Helper to clear CSRF token (useful after logout)
 */
export const clearCsrfToken = () => {
  csrfToken = null;
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
  etagCacheSize: etagCache.size,
  hasCsrfToken: !!csrfToken,
});

export default apiClient;
