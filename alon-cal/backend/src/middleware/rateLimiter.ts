/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for different endpoint types.
 *
 * Features:
 * - Login rate limiting (5 attempts per 15 minutes)
 * - API rate limiting (100 requests per minute)
 * - IP-based and user-based limiting
 * - Custom error messages
 * - Request tracking
 */

import rateLimit from 'express-rate-limit';

/**
 * Login rate limiter
 *
 * Prevents brute force attacks on authentication endpoints
 * - 5 requests per 15 minutes per IP
 * - Applies to: /signup, /login
 *
 * @example
 * router.post('/login', loginRateLimiter, loginHandler);
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false, // Count all requests
  handler: (req, res) => {
    console.warn(`Login rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * API rate limiter
 *
 * General API rate limiting for authenticated endpoints
 * - 100 requests per minute per IP
 * - Applies to: All /api routes
 *
 * @example
 * app.use('/api/', apiRateLimiter);
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many requests. Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    console.warn(`API rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests. Please slow down and try again later.',
    });
  },
});

/**
 * Strict rate limiter for sensitive operations
 *
 * Extra strict rate limiting for critical operations
 * - 3 requests per hour per IP
 * - Applies to: Password reset, email change, etc.
 *
 * @example
 * router.post('/reset-password', strictRateLimiter, resetPasswordHandler);
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    console.warn(`Strict rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many attempts. Please try again in 1 hour.',
    });
  },
});

/**
 * OAuth callback rate limiter
 *
 * Rate limiting for OAuth callback endpoints
 * - 20 requests per 5 minutes per IP
 * - Applies to: /auth/google/callback, /auth/microsoft/callback
 *
 * @example
 * router.get('/auth/google/callback', oauthRateLimiter, callbackHandler);
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many OAuth attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`OAuth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many authentication attempts. Please try again later.',
    });
  },
});

/**
 * Token refresh rate limiter
 *
 * Rate limiting for token refresh endpoint
 * - 10 requests per 5 minutes per IP
 * - Applies to: /auth/refresh
 *
 * @example
 * router.post('/auth/refresh', refreshRateLimiter, refreshHandler);
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many token refresh attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Refresh rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many token refresh attempts. Please try again later.',
    });
  },
});

/**
 * Settings rate limiter
 *
 * Rate limiting for user settings updates
 * - 20 requests per 5 minutes per IP
 * - Applies to: /auth/settings
 *
 * @example
 * router.put('/settings', settingsRateLimiter, requireAuth, updateSettings);
 */
export const settingsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many settings updates. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Settings rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many settings updates. Please try again later.',
    });
  },
});
