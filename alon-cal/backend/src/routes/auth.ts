/**
 * Authentication Routes
 *
 * Defines all authentication-related routes and applies appropriate middleware.
 *
 * Routes:
 * - POST /signup - Register new user (with rate limiting)
 * - POST /login - Authenticate user (with rate limiting)
 * - POST /logout - Logout user (requires auth)
 * - POST /refresh - Refresh access token (with rate limiting)
 * - GET /me - Get current user (requires auth)
 * - PUT /settings - Update user settings (requires auth)
 */

import { Router } from 'express';
import {
  signup,
  login,
  logout,
  refreshToken,
  getMe,
  updateSettings,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { loginRateLimiter, refreshRateLimiter, settingsRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/auth/signup
 *
 * Register a new user account
 *
 * Rate limit: 5 requests per 15 minutes
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123!",
 *   "firstName": "John", // optional
 *   "lastName": "Doe"    // optional
 * }
 *
 * Response (201):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "token": "jwt-token",
 *   "message": "Account created successfully"
 * }
 *
 * Sets httpOnly cookie: token (24h expiration)
 */
router.post('/signup', loginRateLimiter, signup);

/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 *
 * Rate limit: 5 requests per 15 minutes
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePassword123!"
 * }
 *
 * Response (200):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe"
 *   },
 *   "token": "jwt-token",
 *   "message": "Login successful"
 * }
 *
 * Sets httpOnly cookies:
 * - token (24h expiration)
 * - refreshToken (7d expiration)
 */
router.post('/login', loginRateLimiter, login);

/**
 * POST /api/auth/logout
 *
 * Logout current user and invalidate session
 *
 * Requires: Authentication
 *
 * Response (200):
 * {
 *   "message": "Logout successful"
 * }
 *
 * Clears httpOnly cookies: token, refreshToken
 */
router.post('/logout', requireAuth, logout);

/**
 * POST /api/auth/refresh
 *
 * Refresh access token using refresh token
 *
 * Rate limit: 10 requests per 5 minutes
 *
 * Requires: refreshToken cookie
 *
 * Response (200):
 * {
 *   "token": "new-jwt-token",
 *   "message": "Token refreshed successfully"
 * }
 *
 * Sets httpOnly cookie: token (24h expiration)
 */
router.post('/refresh', refreshRateLimiter, refreshToken);

/**
 * GET /api/auth/me
 *
 * Get current authenticated user's profile
 *
 * Requires: Authentication
 *
 * Response (200):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "timezone": "America/New_York",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get('/me', requireAuth, getMe);

/**
 * PUT /api/auth/settings
 *
 * Update current user's settings (timezone, sleep hours)
 *
 * Rate limit: 20 requests per 5 minutes
 *
 * Requires: Authentication
 *
 * Request body:
 * {
 *   "timezone": "America/New_York",
 *   "sleepStartTime": "01:00",  // optional, HH:MM format
 *   "sleepEndTime": "08:00"     // optional, HH:MM format
 * }
 *
 * Note: sleepStartTime and sleepEndTime must be provided together or both null to clear.
 * Sleep duration can cross midnight (e.g., "23:00" start, "06:00" end).
 *
 * Response (200):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "timezone": "America/New_York",
 *     "sleepStartTime": "01:00",
 *     "sleepEndTime": "08:00",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "message": "Settings updated successfully"
 * }
 */
router.put('/settings', settingsRateLimiter, requireAuth, updateSettings);

export default router;
