/**
 * Production Configuration
 *
 * Centralized configuration for production environment settings.
 * This includes database connection pooling, security settings,
 * rate limiting, and performance optimization.
 */

export const productionConfig = {
  // Database Configuration
  database: {
    // Connection pool settings
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
    // Enable statement timeout (30 seconds)
    statementTimeout: 30000,
    // Enable query logging for slow queries (>1s)
    slowQueryThreshold: 1000,
  },

  // Security Settings
  security: {
    // Helmet configuration
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", process.env.FRONTEND_URL || ''],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
    },

    // CORS configuration
    cors: {
      origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
      maxAge: 86400, // 24 hours
    },
  },

  // Rate Limiting Configuration
  rateLimit: {
    // General API rate limit
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Authentication endpoints (stricter)
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: true,
    },

    // OAuth endpoints
    oauth: {
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many OAuth requests, please try again later.',
    },
  },

  // Performance Settings
  performance: {
    // Request timeout (30 seconds)
    requestTimeout: 30000,

    // Body parser limits
    bodyParser: {
      json: { limit: '1mb' },
      urlencoded: { extended: true, limit: '1mb' },
    },

    // Compression settings
    compression: {
      level: 6, // Balance between speed and compression ratio
      threshold: 1024, // Only compress responses > 1KB
      filter: (req: any, res: any) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return true;
      },
    },
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    // Log levels: error, warn, info, debug

    // Disable logging for health checks to reduce noise
    ignoreRoutes: ['/api/health', '/api/health/ready', '/api/health/live'],

    // Format
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',

    // Enable request logging
    requestLogging: true,

    // Slow request threshold (log requests slower than this)
    slowRequestThreshold: 1000, // 1 second
  },

  // Application Settings
  application: {
    // Environment
    nodeEnv: process.env.NODE_ENV || 'production',

    // Server
    port: parseInt(process.env.PORT || '3001'),

    // URLs
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // JWT
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256' as const,
      issuer: 'calendar-integration-app',
      audience: 'calendar-integration-users',
    },

    // Encryption
    encryption: {
      key: process.env.ENCRYPTION_KEY!,
      algorithm: 'aes-256-cbc' as const,
    },
  },

  // OAuth Configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.API_URL}/api/oauth/google/callback`,
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },

    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      redirectUri: `${process.env.API_URL}/api/oauth/microsoft/callback`,
      scope: ['Calendars.ReadWrite', 'offline_access', 'User.Read'],
    },
  },

  // Graceful Shutdown Configuration
  shutdown: {
    // Timeout before forcing shutdown (30 seconds)
    timeout: 30000,

    // Signals to handle
    signals: ['SIGTERM', 'SIGINT'],
  },
};

/**
 * Validate production configuration
 * Throws error if required environment variables are missing
 */
export function validateProductionConfig(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'API_URL',
    'FRONTEND_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Validate ENCRYPTION_KEY length
  if (process.env.ENCRYPTION_KEY!.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET!.length < 32) {
    console.warn('WARNING: JWT_SECRET should be at least 32 characters for security');
  }

  // Validate URLs
  try {
    new URL(process.env.API_URL!);
    new URL(process.env.FRONTEND_URL!);
  } catch (error) {
    throw new Error('API_URL and FRONTEND_URL must be valid URLs');
  }

  console.log('Production configuration validated successfully');
}

/**
 * Get database connection URL with connection pooling
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL!;

  // Add connection pooling parameters if not present
  if (!url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=${productionConfig.database.pool.max}`;
  }

  return url;
}

export default productionConfig;
