/**
 * Performance Monitoring Middleware
 *
 * Tracks request timing, memory usage, and performance metrics.
 * Logs slow requests and monitors for performance issues.
 */

import { Request, Response, NextFunction } from 'express';
import productionConfig from '../config/production';

interface PerformanceMetrics {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: string;
}

// Store recent metrics for monitoring
const recentMetrics: PerformanceMetrics[] = [];
const MAX_METRICS_STORED = 100;

/**
 * Request timing middleware
 * Measures and logs request duration
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Get request ID (set by security middleware)
  const requestId = (req as any).requestId || 'unknown';

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture timing
  res.end = function (this: Response, ...args: any[]): Response {
    // Calculate duration
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();

    // Create metrics object
    const metrics: PerformanceMetrics = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      timestamp: new Date().toISOString(),
    };

    // Store metrics
    storeMetrics(metrics);

    // Log slow requests
    if (duration > productionConfig.logging.slowRequestThreshold) {
      logSlowRequest(metrics);
    }

    // Log request (skip health checks)
    if (!productionConfig.logging.ignoreRoutes.includes(req.path)) {
      logRequest(metrics);
    }

    // Set performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Request-ID', requestId);

    // Call original end function
    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Store metrics in memory for monitoring
 */
function storeMetrics(metrics: PerformanceMetrics): void {
  recentMetrics.push(metrics);

  // Keep only last N metrics
  if (recentMetrics.length > MAX_METRICS_STORED) {
    recentMetrics.shift();
  }
}

/**
 * Log request details
 */
function logRequest(metrics: PerformanceMetrics): void {
  const { method, path, statusCode, duration, requestId } = metrics;

  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  const logMessage = {
    type: 'request',
    requestId,
    method,
    path,
    statusCode,
    duration,
    timestamp: metrics.timestamp,
  };

  // Log based on level
  if (logLevel === 'error') {
    console.error(JSON.stringify(logMessage));
  } else if (logLevel === 'warn') {
    console.warn(JSON.stringify(logMessage));
  } else {
    console.log(JSON.stringify(logMessage));
  }
}

/**
 * Log slow requests
 */
function logSlowRequest(metrics: PerformanceMetrics): void {
  console.warn(
    JSON.stringify({
      type: 'slow_request',
      requestId: metrics.requestId,
      method: metrics.method,
      path: metrics.path,
      duration: metrics.duration,
      threshold: productionConfig.logging.slowRequestThreshold,
      memoryDelta: {
        heapUsed: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024), // MB
        rss: Math.round(metrics.memoryUsage.rss / 1024 / 1024), // MB
      },
      timestamp: metrics.timestamp,
    })
  );
}

/**
 * Memory usage monitoring middleware
 * Tracks memory usage and warns if thresholds are exceeded
 */
export function memoryMonitoring(_req: Request, _res: Response, next: NextFunction): void {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  // Warn if memory usage is high
  if (usagePercent > 80) {
    console.warn(
      JSON.stringify({
        type: 'high_memory_usage',
        heapUsed: Math.round(heapUsedMB),
        heapTotal: Math.round(heapTotalMB),
        usagePercent: Math.round(usagePercent),
        timestamp: new Date().toISOString(),
      })
    );
  }

  next();
}

/**
 * CPU usage monitoring
 * Tracks CPU usage patterns
 */
let lastCpuUsage = process.cpuUsage();
let lastCpuCheck = Date.now();

export function cpuMonitoring(_req: Request, _res: Response, next: NextFunction): void {
  const now = Date.now();
  const timeDiff = now - lastCpuCheck;

  // Check every 10 seconds
  if (timeDiff > 10000) {
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);

    const userCpuPercent = (currentCpuUsage.user / 1000000 / timeDiff) * 100;
    const systemCpuPercent = (currentCpuUsage.system / 1000000 / timeDiff) * 100;

    // Warn if CPU usage is high
    if (userCpuPercent > 80 || systemCpuPercent > 80) {
      console.warn(
        JSON.stringify({
          type: 'high_cpu_usage',
          userCpu: Math.round(userCpuPercent),
          systemCpu: Math.round(systemCpuPercent),
          timestamp: new Date().toISOString(),
        })
      );
    }

    lastCpuUsage = process.cpuUsage();
    lastCpuCheck = now;
  }

  next();
}

/**
 * Error rate monitoring
 * Tracks error rates and warns if threshold exceeded
 */
const errorCounts = {
  total: 0,
  errors: 0,
  lastReset: Date.now(),
};

export function errorRateMonitoring(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Store original end function
  const originalEnd = res.end;

  // Override end function to track errors
  res.end = function (this: Response, ...args: any[]): Response {
    errorCounts.total++;

    if (res.statusCode >= 500) {
      errorCounts.errors++;
    }

    // Calculate error rate every minute
    const timeSinceReset = Date.now() - errorCounts.lastReset;
    if (timeSinceReset > 60000) {
      const errorRate = (errorCounts.errors / errorCounts.total) * 100;

      if (errorRate > 5) {
        // Warn if error rate > 5%
        console.warn(
          JSON.stringify({
            type: 'high_error_rate',
            errorRate: Math.round(errorRate * 100) / 100,
            errors: errorCounts.errors,
            total: errorCounts.total,
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Reset counters
      errorCounts.total = 0;
      errorCounts.errors = 0;
      errorCounts.lastReset = Date.now();
    }

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Get performance metrics
 * Returns recent metrics for monitoring dashboard
 */
export function getPerformanceMetrics() {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Filter recent metrics (last 5 minutes)
  const recent = recentMetrics.filter(
    (m) => new Date(m.timestamp).getTime() > fiveMinutesAgo
  );

  if (recent.length === 0) {
    return {
      averageResponseTime: 0,
      requestCount: 0,
      errorRate: 0,
      slowRequestCount: 0,
    };
  }

  // Calculate averages
  const totalDuration = recent.reduce((sum, m) => sum + m.duration, 0);
  const errorCount = recent.filter((m) => m.statusCode >= 500).length;
  const slowCount = recent.filter(
    (m) => m.duration > productionConfig.logging.slowRequestThreshold
  ).length;

  return {
    averageResponseTime: Math.round(totalDuration / recent.length),
    requestCount: recent.length,
    errorRate: Math.round((errorCount / recent.length) * 100 * 100) / 100,
    slowRequestCount: slowCount,
    metrics: recent.slice(-10), // Last 10 requests
  };
}

/**
 * Memory leak detection
 * Monitors heap usage over time to detect potential leaks
 */
const heapHistory: number[] = [];
const MAX_HEAP_HISTORY = 10;

export function memoryLeakDetection(): void {
  setInterval(() => {
    const heapUsed = process.memoryUsage().heapUsed;
    heapHistory.push(heapUsed);

    // Keep only recent history
    if (heapHistory.length > MAX_HEAP_HISTORY) {
      heapHistory.shift();
    }

    // Detect continuous growth
    if (heapHistory.length === MAX_HEAP_HISTORY) {
      const isGrowing = heapHistory.every((val, idx) => {
        if (idx === 0) return true;
        return val >= heapHistory[idx - 1];
      });

      if (isGrowing) {
        const growth = heapHistory[heapHistory.length - 1] - heapHistory[0];
        const growthMB = growth / 1024 / 1024;

        console.warn(
          JSON.stringify({
            type: 'potential_memory_leak',
            heapGrowth: Math.round(growthMB),
            currentHeap: Math.round(heapUsed / 1024 / 1024),
            timestamp: new Date().toISOString(),
          })
        );
      }
    }
  }, 60000); // Check every minute
}

/**
 * Database query performance tracking
 */
interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: string;
}

const slowQueries: QueryMetrics[] = [];

export function trackDatabaseQuery(query: string, duration: number): void {
  if (duration > productionConfig.database.slowQueryThreshold) {
    slowQueries.push({
      query,
      duration,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 slow queries
    if (slowQueries.length > 50) {
      slowQueries.shift();
    }

    console.warn(
      JSON.stringify({
        type: 'slow_database_query',
        query,
        duration,
        threshold: productionConfig.database.slowQueryThreshold,
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export function getSlowQueries() {
  return slowQueries;
}

/**
 * Export all performance monitoring middleware
 */
export function applyPerformanceMonitoring() {
  // Start memory leak detection
  memoryLeakDetection();

  return [requestTiming, memoryMonitoring, cpuMonitoring, errorRateMonitoring];
}
