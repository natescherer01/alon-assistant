/**
 * Security Middleware
 *
 * Comprehensive security middleware for production deployment.
 * Includes security headers, input sanitization, and protection
 * against common web vulnerabilities.
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import productionConfig from '../config/production';

/**
 * Configure Helmet security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: productionConfig.security.helmet.contentSecurityPolicy,
  hsts: productionConfig.security.helmet.hsts,
  referrerPolicy: productionConfig.security.helmet.referrerPolicy,
  noSniff: productionConfig.security.helmet.noSniff,
  xssFilter: productionConfig.security.helmet.xssFilter,
  hidePoweredBy: productionConfig.security.helmet.hidePoweredBy,

  // Additional security headers
  frameguard: {
    action: 'deny', // Prevent clickjacking
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
  dnsPrefetchControl: {
    allow: false,
  },
  ieNoOpen: true,
});

/**
 * Additional security headers middleware
 */
export function additionalSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // Expect-CT (Certificate Transparency)
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  next();
}

/**
 * Request sanitization middleware
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove potentially dangerous characters for SQL injection
  // Note: Prisma already protects against SQL injection, this is defense in depth
  sanitized = sanitized.replace(/[;<>]/g, '');

  return sanitized;
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  Object.keys(obj).forEach((key) => {
    sanitized[key] = sanitizeObject(obj[key]);
  });

  return sanitized;
}

/**
 * Validate content type middleware
 * Ensure JSON requests have correct Content-Type header
 */
export function validateContentType(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip for GET, DELETE, and health check endpoints
  if (
    req.method === 'GET' ||
    req.method === 'DELETE' ||
    req.path.includes('/health')
  ) {
    return next();
  }

  // Check Content-Type for POST, PUT, PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    if (!contentType) {
      return res.status(400).json({
        error: 'Content-Type header is required',
      });
    }

    if (!contentType.includes('application/json')) {
      return res.status(415).json({
        error: 'Content-Type must be application/json',
      });
    }
  }

  next();
}

/**
 * Request ID middleware
 * Add unique request ID for tracking and debugging
 */
export function requestId(req: Request, _res: Response, next: NextFunction): void {
  // Generate unique request ID
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add to request object
  (req as any).requestId = id;

  next();
}

/**
 * IP address extraction middleware
 * Extract real IP address from proxy headers
 */
export function extractIpAddress(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Check for IP in proxy headers (Railway, Vercel, etc.)
  const forwardedFor = req.get('X-Forwarded-For');
  const realIp = req.get('X-Real-IP');

  let ipAddress = req.ip || req.socket.remoteAddress;

  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    ipAddress = ips[0];
  } else if (realIp) {
    ipAddress = realIp;
  }

  // Add to request object
  (req as any).ipAddress = ipAddress;

  next();
}

/**
 * Timeout middleware
 * Set timeout for all requests to prevent hanging
 */
export function requestTimeout(timeout: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set timeout
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process',
        });
      }
    }, timeout);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
}

/**
 * Prevent parameter pollution
 * Ensure query parameters are not arrays when not expected
 */
export function preventParameterPollution(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      // If parameter is an array and shouldn't be, take first value
      if (Array.isArray(req.query[key])) {
        req.query[key] = (req.query[key] as string[])[0];
      }
    });
  }

  next();
}

/**
 * Security headers for specific routes
 */
export function apiSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Disable caching for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  next();
}

/**
 * Check for suspicious patterns in requests
 */
export function detectSuspiciousPatterns(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection patterns
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i, // XSS patterns
    /(\%3D)|(=)/i, // Potential injection
    /(\.\.\/)/i, // Directory traversal
    /\0/i, // Null bytes
  ];

  const checkString = (str: string): boolean => {
    return suspiciousPatterns.some((pattern) => pattern.test(str));
  };

  // Check URL
  if (checkString(req.url)) {
    console.warn(`Suspicious pattern detected in URL: ${req.url}`);
    return res.status(400).json({
      error: 'Bad request',
      message: 'Suspicious pattern detected',
    });
  }

  // Check query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && checkString(value)) {
        console.warn(`Suspicious pattern detected in query param ${key}: ${value}`);
        return res.status(400).json({
          error: 'Bad request',
          message: 'Suspicious pattern detected',
        });
      }
    }
  }

  next();
}

/**
 * Enforce HTTPS in production
 * Redirects HTTP requests to HTTPS
 */
export function enforceHTTPS(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === 'production') {
    // Check if request is secure
    const isSecure =
      req.secure ||
      req.get('X-Forwarded-Proto') === 'https' ||
      req.get('X-Forwarded-Ssl') === 'on';

    if (!isSecure) {
      // Redirect to HTTPS
      const httpsUrl = `https://${req.get('host')}${req.url}`;
      return res.redirect(301, httpsUrl);
    }
  }

  next();
}

/**
 * Validate OAuth redirect URIs use HTTPS in production
 * Called during application startup
 */
export function validateOAuthConfig(): void {
  const requiredEnvVars = [
    'GOOGLE_OAUTH_REDIRECT_URI',
    'MICROSOFT_OAUTH_REDIRECT_URI',
    'APPLE_OAUTH_REDIRECT_URI',
  ];

  if (process.env.NODE_ENV === 'production') {
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];

      if (!value) {
        throw new Error(`${envVar} is not set in production environment`);
      }

      if (!value.startsWith('https://')) {
        throw new Error(
          `${envVar} must use HTTPS in production. Current value: ${value}`
        );
      }
    }
  }

  console.log('OAuth redirect URIs validated successfully');
}

/**
 * Set secure cookie options based on environment
 */
export function getSecureCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
} {
  return {
    httpOnly: true, // Prevent JavaScript access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}

/**
 * Validate OAuth state parameter to prevent CSRF
 */
export function validateOAuthState(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only validate OAuth callback routes
  if (!req.path.includes('/oauth/') || !req.path.includes('/callback')) {
    return next();
  }

  const { state } = req.query;

  if (!state || typeof state !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing or invalid state parameter',
    });
  }

  // State validation happens in the OAuth service
  // This is just a basic format check
  if (state.length < 16) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid state parameter format',
    });
  }

  next();
}

/**
 * Export all security middleware as a composed function
 */
export function applySecurityMiddleware() {
  return [
    enforceHTTPS,
    securityHeaders,
    additionalSecurityHeaders,
    requestId,
    extractIpAddress,
    validateContentType,
    sanitizeInput,
    preventParameterPollution,
    validateOAuthState,
    apiSecurityHeaders,
    requestTimeout(productionConfig.performance.requestTimeout),
  ];
}
