import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Read package.json for version info
let packageVersion = 'unknown';
try {
  const packagePath = path.join(__dirname, '../../package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageVersion = packageJson.version;
  }
} catch (error) {
  console.error('Error reading package.json:', error);
}

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    oauth: {
      status: 'healthy' | 'unhealthy' | 'partial';
      configured: {
        google: boolean;
        microsoft: boolean;
      };
    };
    memory: {
      usage: number;
      usagePercent: number;
      total: number;
      free: number;
    };
  };
}

router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  // Database health check
  let dbStatus: 'healthy' | 'unhealthy' = 'unhealthy';
  let dbResponseTime: number | undefined;
  let dbError: string | undefined;

  try {
    const dbCheckStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - dbCheckStart;
    dbStatus = 'healthy';

    // If database is slow, mark as degraded
    if (dbResponseTime > 1000) {
      overallStatus = 'degraded';
    }
  } catch (error) {
    dbStatus = 'unhealthy';
    dbError = error instanceof Error ? error.message : 'Unknown database error';
    overallStatus = 'unhealthy';
    console.error('Database health check failed:', error);
  }

  // OAuth configuration check
  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret'
  );

  const microsoftConfigured = !!(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_CLIENT_ID !== 'your-microsoft-client-id' &&
    process.env.MICROSOFT_CLIENT_SECRET !== 'your-microsoft-client-secret'
  );

  let oauthStatus: 'healthy' | 'unhealthy' | 'partial' = 'healthy';
  if (!googleConfigured && !microsoftConfigured) {
    oauthStatus = 'unhealthy';
    overallStatus = 'degraded';
  } else if (!googleConfigured || !microsoftConfigured) {
    oauthStatus = 'partial';
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const freeMemory = totalMemory - usedMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  // If memory usage is high, mark as degraded
  if (memoryUsagePercent > 90) {
    overallStatus = 'degraded';
  }

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: packageVersion,
    checks: {
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        error: dbError,
      },
      oauth: {
        status: oauthStatus,
        configured: {
          google: googleConfigured,
          microsoft: microsoftConfigured,
        },
      },
      memory: {
        usage: Math.round(usedMemory / 1024 / 1024), // MB
        usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        total: Math.round(totalMemory / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
      },
    },
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(response);
});

// Readiness probe (for Kubernetes/Railway)
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Liveness probe (for Kubernetes/Railway)
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
