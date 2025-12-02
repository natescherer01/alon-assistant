/**
 * Authentication Middleware
 *
 * Provides middleware functions for protecting routes and verifying JWT tokens.
 *
 * Features:
 * - JWT verification from httpOnly cookies
 * - User authentication state management
 * - Request context enrichment with user data
 * - Audit logging for auth failures
 */

import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/auth';
import { prisma } from '../lib/prisma';

/**
 * Extended Request interface with user data
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Authentication middleware - protects routes requiring authentication
 *
 * Verifies JWT token from httpOnly cookie and attaches user to request object.
 * Creates audit log entry for failed authentication attempts.
 *
 * @throws 401 if token is missing or invalid
 * @throws 401 if user not found or deleted
 *
 * @example
 * router.get('/protected', requireAuth, async (req, res) => {
 *   const userId = req.user.userId;
 *   // Access protected resource
 * });
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from httpOnly cookie or Authorization header
    let token = req.cookies.token;

    // If no cookie, check Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      // Log failed auth attempt
      await logAuthFailure(req, 'MISSING_TOKEN', 'No authentication token provided');

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Verify JWT token
    const payload = verifyJWT(token);

    if (!payload) {
      // Log failed auth attempt
      await logAuthFailure(req, 'INVALID_TOKEN', 'Invalid or expired token');

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Verify user exists and is not deleted
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      // Log failed auth attempt
      await logAuthFailure(
        req,
        'USER_NOT_FOUND',
        'User not found or deleted',
        payload.userId
      );

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authentication credentials',
      });
      return;
    }

    // Attach user to request object
    req.user = {
      userId: user.id,
      email: user.email,
    };

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Log failed auth attempt
    await logAuthFailure(req, 'AUTH_ERROR', 'Authentication system error');

    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware
 *
 * Attaches user to request if valid token exists, but doesn't require it.
 * Useful for endpoints that behave differently for authenticated users.
 *
 * @example
 * router.get('/public', optionalAuth, async (req, res) => {
 *   if (req.user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies.token;

    if (!token) {
      next();
      return;
    }

    const payload = verifyJWT(token);

    if (!payload) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        deletedAt: true,
      },
    });

    if (user && !user.deletedAt) {
      req.user = {
        userId: user.id,
        email: user.email,
      };
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Continue even if auth fails
    next();
  }
}

/**
 * Log authentication failure to audit log
 *
 * @param req - Express request object
 * @param action - Failure action type
 * @param errorMessage - Error message
 * @param userId - User ID if available
 */
async function logAuthFailure(
  req: Request,
  action: string,
  errorMessage: string,
  userId?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: `AUTH_FAILURE_${action}`,
        resourceType: 'auth',
        resourceId: null,
        status: 'FAILURE',
        errorMessage,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        metadata: {
          path: req.path,
          method: req.method,
        },
      },
    });
  } catch (error) {
    // Don't throw error if audit logging fails
    console.error('Failed to log auth failure:', error);
  }
}

/**
 * Extract client IP address from request
 *
 * Handles proxies and load balancers by checking headers.
 *
 * @param req - Express request object
 * @returns string - Client IP address
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded && typeof forwarded === 'string') {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];

  if (realIp && typeof realIp === 'string') {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get user agent from request
 *
 * @param req - Express request object
 * @returns string - User agent string
 */
export function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || 'unknown';
}
