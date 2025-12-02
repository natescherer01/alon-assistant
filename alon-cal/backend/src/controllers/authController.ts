/**
 * Authentication Controller
 *
 * HTTP request handlers for authentication endpoints.
 *
 * Endpoints:
 * - POST /api/auth/signup - Register new user
 * - POST /api/auth/login - Authenticate user
 * - POST /api/auth/logout - Logout user
 * - POST /api/auth/refresh - Refresh access token
 * - GET /api/auth/me - Get current user
 * - PUT /api/auth/settings - Update user settings
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest, getClientIp, getUserAgent } from '../middleware/auth';
import { hashSHA256 } from '../utils/encryption';
import { validateTimezone, validateTime } from '../utils/validation';

/**
 * Signup request body interface
 */
interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Login request body interface
 */
interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Update settings request body interface
 */
interface UpdateSettingsRequest {
  timezone: string;
  sleepStartTime?: string | null;
  sleepEndTime?: string | null;
}

/**
 * User signup handler
 *
 * POST /api/auth/signup
 *
 * @param req - Express request
 * @param res - Express response
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body as SignupRequest;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
      return;
    }

    // Create user
    const user = await authService.signup(email, password, firstName, lastName);

    // Generate tokens
    const { token } = await authService.login(
      email,
      password,
      getClientIp(req),
      getUserAgent(req)
    );

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return user data (without password hash)
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timezone: user.timezone,
        sleepStartTime: user.sleepStartTime,
        sleepEndTime: user.sleepEndTime,
        createdAt: user.createdAt,
      },
      token,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Signup error:', error);

    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes('already registered')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes('Invalid email') ||
        error.message.includes('Password must')
      ) {
        res.status(400).json({
          error: 'Validation error',
          message: error.message,
        });
        return;
      }
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create account',
    });
  }
}

/**
 * User login handler
 *
 * POST /api/auth/login
 *
 * @param req - Express request
 * @param res - Express response
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
      return;
    }

    // Authenticate user
    const { user, token, refreshToken } = await authService.login(
      email,
      password,
      getClientIp(req),
      getUserAgent(req)
    );

    // Set httpOnly cookie for access token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set httpOnly cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data (without password hash)
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timezone: user.timezone,
        sleepStartTime: user.sleepStartTime,
        sleepEndTime: user.sleepEndTime,
      },
      token,
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof Error) {
      // Handle known errors
      if (
        error.message.includes('Invalid email or password') ||
        error.message.includes('Account has been deleted')
      ) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed',
    });
  }
}

/**
 * User logout handler
 *
 * POST /api/auth/logout
 *
 * @param req - Express request (authenticated)
 * @param res - Express response
 */
export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    // Get token from cookie
    const token = req.cookies.token;

    if (token) {
      // Hash token for session lookup
      const tokenHash = hashSHA256(token);

      // Delete session
      await authService.logout(req.user.userId, tokenHash);
    }

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    res.status(200).json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);

    // Clear cookies even if logout fails
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    res.status(500).json({
      error: 'Internal server error',
      message: 'Logout failed',
    });
  }
}

/**
 * Token refresh handler
 *
 * POST /api/auth/refresh
 *
 * @param req - Express request
 * @param res - Express response
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token not found',
      });
      return;
    }

    // Refresh token
    const { token } = await authService.refreshToken(refreshToken);

    // Set new httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(200).json({
      token,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Token refresh error:', error);

    // Clear invalid tokens
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token',
    });
  }
}

/**
 * Get current user handler
 *
 * GET /api/auth/me
 *
 * @param req - Express request (authenticated)
 * @param res - Express response
 */
export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    // Get user data
    const user = await authService.getMe(req.user.userId);

    // Return user data (without password hash)
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        timezone: user.timezone,
        sleepStartTime: user.sleepStartTime,
        sleepEndTime: user.sleepEndTime,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user data',
    });
  }
}

/**
 * Update user settings handler
 *
 * PUT /api/auth/settings
 *
 * @param req - Express request (authenticated)
 * @param res - Express response
 */
export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    const { timezone, sleepStartTime, sleepEndTime } = req.body as UpdateSettingsRequest;

    // Validate required fields
    if (!timezone) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Timezone is required',
      });
      return;
    }

    // Validate timezone format
    if (!validateTimezone(timezone)) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid timezone. Must be a valid IANA timezone identifier (e.g., America/New_York)',
      });
      return;
    }

    // Validate sleep hours if provided
    if (sleepStartTime !== undefined || sleepEndTime !== undefined) {
      // Both must be provided together or both null
      if ((sleepStartTime === null || sleepStartTime === undefined) !==
          (sleepEndTime === null || sleepEndTime === undefined)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Both sleepStartTime and sleepEndTime must be provided together, or both must be null to clear',
        });
        return;
      }

      // If both are provided (not null/undefined), validate time format
      if (sleepStartTime && sleepEndTime) {
        if (!validateTime(sleepStartTime)) {
          res.status(400).json({
            error: 'Validation error',
            message: 'Invalid sleepStartTime format. Must be in HH:MM format (e.g., "01:00", "23:45")',
          });
          return;
        }

        if (!validateTime(sleepEndTime)) {
          res.status(400).json({
            error: 'Validation error',
            message: 'Invalid sleepEndTime format. Must be in HH:MM format (e.g., "01:00", "23:45")',
          });
          return;
        }
      }
    }

    // Update user settings
    const updatedUser = await authService.updateSettings(
      req.user.userId,
      timezone,
      sleepStartTime,
      sleepEndTime
    );

    // Return updated user data (without password hash)
    res.status(200).json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        timezone: updatedUser.timezone,
        sleepStartTime: updatedUser.sleepStartTime,
        sleepEndTime: updatedUser.sleepEndTime,
        createdAt: updatedUser.createdAt,
      },
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);

    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes('User not found')) {
        res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
        return;
      }
    }

    // Generic error
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update settings',
    });
  }
}
