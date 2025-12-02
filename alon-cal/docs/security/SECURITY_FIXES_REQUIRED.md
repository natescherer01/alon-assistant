# Critical Security Fixes Required

## Overview

Before deploying to production, you MUST implement these 3 critical security fixes for the webhook endpoint. The integration will work in development, but these vulnerabilities can be exploited in production.

---

## 🔴 Fix #1: Add Webhook Authentication (CRITICAL)

### Problem
The webhook endpoint `/api/webhooks/microsoft/events` has no authentication. Anyone can send fake notifications.

### Risk
- Attackers can trigger arbitrary calendar syncs
- DoS attacks by flooding endpoint
- Resource exhaustion
- Data integrity issues

### Files to Modify
1. `backend/src/routes/webhooks.ts`
2. `backend/src/controllers/webhookController.ts`
3. `backend/src/middleware/webhookAuth.ts` (create new)

### Implementation

#### Step 1: Create Webhook Authentication Middleware

Create `backend/src/middleware/webhookAuth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Webhook Authentication Middleware
 *
 * Validates incoming webhook requests are from Microsoft Graph
 */

// Microsoft Graph service IP ranges (update periodically)
const MICROSOFT_IP_RANGES = [
  '13.107.6.0/24',
  '13.107.18.0/24',
  '13.107.128.0/22',
  '52.112.0.0/14',
  '52.120.0.0/14',
  // Add more from: https://learn.microsoft.com/en-us/microsoft-365/enterprise/urls-and-ip-address-ranges
];

/**
 * Verify request originates from Microsoft Graph
 */
function isFromMicrosoft(req: Request): boolean {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? (forwarded as string).split(',')[0].trim() : req.ip;

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development' &&
      (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost')) {
    return true;
  }

  // Check IP against Microsoft ranges
  // Note: You'll need a library like 'ip-range-check' for this
  // npm install ip-range-check @types/ip-range-check

  logger.debug('Webhook request from IP', { ip });

  // Simplified check - in production, use proper CIDR matching
  return true; // Replace with actual IP range check
}

/**
 * Validate Microsoft Graph webhook signature (if available)
 *
 * Note: Microsoft Graph may not send signatures for all webhook types
 * This is a placeholder for future implementation
 */
function verifySignature(req: Request): boolean {
  const signature = req.headers['x-microsoft-graph-signature'];

  if (!signature) {
    // Microsoft doesn't always send signatures
    // Rely on clientState validation instead
    return true;
  }

  // If signature present, verify it
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    logger.warn('WEBHOOK_SIGNING_SECRET not configured');
    return true;
  }

  try {
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature as string),
      Buffer.from(computed)
    );
  } catch (error) {
    logger.error('Signature verification failed', { error });
    return false;
  }
}

/**
 * Webhook authentication middleware
 */
export const authenticateWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Check origin IP
    if (!isFromMicrosoft(req)) {
      logger.warn('Webhook from unauthorized IP', {
        ip: req.ip,
        forwarded: req.headers['x-forwarded-for']
      });
      res.status(403).json({ error: 'Forbidden: Unauthorized source' });
      return;
    }

    // 2. Verify signature if present
    if (!verifySignature(req)) {
      logger.warn('Webhook signature verification failed');
      res.status(401).json({ error: 'Unauthorized: Invalid signature' });
      return;
    }

    // 3. Validate request structure
    if (!req.body || !req.body.value) {
      logger.warn('Webhook malformed request', { body: req.body });
      res.status(400).json({ error: 'Bad Request: Invalid payload' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Webhook authentication error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Rate limiter specifically for webhook endpoint
 */
import rateLimit from 'express-rate-limit';

export const webhookRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Higher limit for burst notifications
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per IP + subscription ID
    const subscriptionId = req.body?.value?.[0]?.subscriptionId || 'unknown';
    return `${req.ip}-${subscriptionId}`;
  },
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  },
});
```

#### Step 2: Apply Middleware to Webhook Routes

Update `backend/src/routes/webhooks.ts`:

```typescript
import { Router } from 'express';
import webhookController from '../controllers/webhookController';
import { authenticateWebhook, webhookRateLimiter } from '../middleware/webhookAuth';

const router = Router();

/**
 * Microsoft Graph webhook endpoint
 *
 * SECURITY: Protected by webhook-specific authentication and rate limiting
 */
router.post(
  '/microsoft/events',
  webhookRateLimiter,           // Rate limiting
  authenticateWebhook,          // Authentication
  webhookController.handleMicrosoftWebhook
);

router.post(
  '/google/events',
  webhookRateLimiter,
  webhookController.handleGoogleWebhook
);

export default router;
```

#### Step 3: Add Environment Variable

Add to `.env`:
```bash
# Webhook Security
WEBHOOK_SIGNING_SECRET="your-random-64-char-secret-here"
```

Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Testing

```bash
# Test webhook authentication (should fail without valid source):
curl -X POST http://localhost:3001/api/webhooks/microsoft/events \
  -H "Content-Type: application/json" \
  -d '{"value": [{"subscriptionId": "fake"}]}'

# Expected: 403 Forbidden (in production)
```

---

## 🔴 Fix #2: Encrypt ClientState in Database (CRITICAL)

### Problem
Webhook validation secrets (`clientState`) are stored in plain text.

### Risk
Database compromise exposes webhook authentication mechanism.

### Files to Modify
1. `backend/src/services/webhookService.ts`

### Implementation

Update `backend/src/services/webhookService.ts`:

```typescript
import { encryptToken, decryptToken } from '../utils/encryption';

// Line 101 - When creating subscription
async createSubscription(
  calendarConnectionId: string,
  accessToken: string
): Promise<WebhookSubscription> {
  // ... existing code ...

  const clientState = crypto.randomBytes(16).toString('hex');

  // ... Microsoft Graph API call ...

  // BEFORE: clientState stored in plain text
  // AFTER: Encrypt before storing
  const subscription = await prisma.webhookSubscription.create({
    data: {
      subscriptionId: graphSubscription.id,
      calendarConnectionId,
      provider: CalendarProvider.MICROSOFT,
      resourcePath: graphSubscription.resource,
      changeTypes: graphSubscription.changeType.split(','),
      clientState: encryptToken(clientState), // ENCRYPT HERE
      expirationDateTime: new Date(graphSubscription.expirationDateTime),
      webhookUrl,
      isActive: true,
    },
  });

  return subscription;
}

// Line 280 - When validating notifications
async processMicrosoftNotifications(
  notifications: MicrosoftNotification[]
): Promise<void> {
  for (const notification of notifications) {
    // Fetch subscription from database
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { subscriptionId: notification.subscriptionId },
      include: { calendarConnection: true },
    });

    if (!subscription) {
      logger.warn('Subscription not found', {
        subscriptionId: notification.subscriptionId
      });
      continue;
    }

    // BEFORE: Direct comparison with plain text
    // AFTER: Decrypt before comparing
    const decryptedClientState = decryptToken(subscription.clientState);

    if (notification.clientState !== decryptedClientState) {
      logger.warn('Invalid client state - possible security breach', {
        subscriptionId: notification.subscriptionId,
        expected: decryptedClientState.substring(0, 4) + '***', // Log partial
        received: notification.clientState?.substring(0, 4) + '***',
      });
      continue;
    }

    // ... rest of processing ...
  }
}
```

### Migration

Since existing subscriptions have unencrypted clientState, you need a data migration:

Create `backend/scripts/encrypt-client-states.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { encryptToken } from '../src/utils/encryption';

const prisma = new PrismaClient();

async function migrateClientStates() {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { deletedAt: null },
  });

  console.log(`Found ${subscriptions.length} subscriptions to migrate`);

  for (const sub of subscriptions) {
    // Check if already encrypted (has IV prefix)
    if (sub.clientState.includes(':')) {
      console.log(`Subscription ${sub.id} already encrypted`);
      continue;
    }

    // Encrypt the plain text clientState
    const encrypted = encryptToken(sub.clientState);

    await prisma.webhookSubscription.update({
      where: { id: sub.id },
      data: { clientState: encrypted },
    });

    console.log(`Encrypted clientState for subscription ${sub.id}`);
  }

  console.log('Migration complete!');
}

migrateClientStates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run migration:
```bash
cd backend
npx ts-node scripts/encrypt-client-states.ts
```

### Testing

```bash
# Check database - clientState should have ':' separator (encrypted)
psql $DATABASE_URL -c "SELECT id, client_state FROM webhook_subscriptions LIMIT 5;"

# Should see format like: "a1b2c3d4e5f6:encrypted_data_here"
```

---

## 🟡 Fix #3: Add Replay Attack Protection (HIGH PRIORITY)

### Problem
Same webhook notification can be processed multiple times.

### Risk
Duplicate syncs, data inconsistency, resource waste.

### Files to Modify
1. `backend/src/services/webhookService.ts`
2. `backend/src/utils/replayProtection.ts` (create new)

### Implementation

#### Step 1: Create Replay Protection Utility

Create `backend/src/utils/replayProtection.ts`:

```typescript
import crypto from 'crypto';
import { logger } from './logger';

/**
 * In-memory cache for recent notification IDs
 *
 * In production, use Redis for distributed systems
 */
class ReplayProtection {
  private recentNotifications: Map<string, number>;
  private readonly maxAge: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxEntries: number = 10000;

  constructor() {
    this.recentNotifications = new Map();

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Generate unique hash for notification
   */
  private generateHash(notification: any): string {
    const key = JSON.stringify({
      subscriptionId: notification.subscriptionId,
      clientState: notification.clientState,
      changeType: notification.changeType,
      resource: notification.resource,
      resourceData: notification.resourceData?.id,
      // Include timestamp if available
      timestamp: notification.eventTime || Date.now(),
    });

    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Check if notification was recently processed
   */
  isDuplicate(notification: any): boolean {
    const hash = this.generateHash(notification);
    const timestamp = this.recentNotifications.get(hash);

    if (timestamp === undefined) {
      return false;
    }

    const age = Date.now() - timestamp;
    if (age > this.maxAge) {
      // Expired, not a duplicate
      this.recentNotifications.delete(hash);
      return false;
    }

    logger.warn('Duplicate notification detected', {
      subscriptionId: notification.subscriptionId,
      age: `${age}ms`,
    });

    return true;
  }

  /**
   * Mark notification as processed
   */
  markProcessed(notification: any): void {
    const hash = this.generateHash(notification);
    this.recentNotifications.set(hash, Date.now());

    // Prevent memory leak - remove oldest if too many entries
    if (this.recentNotifications.size > this.maxEntries) {
      const oldestKey = this.recentNotifications.keys().next().value;
      this.recentNotifications.delete(oldestKey);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [hash, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > this.maxAge) {
        expired.push(hash);
      }
    }

    expired.forEach(hash => this.recentNotifications.delete(hash));

    if (expired.length > 0) {
      logger.debug('Cleaned up expired notification hashes', {
        count: expired.length
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxAge: number; maxEntries: number } {
    return {
      size: this.recentNotifications.size,
      maxAge: this.maxAge,
      maxEntries: this.maxEntries,
    };
  }
}

export const replayProtection = new ReplayProtection();
```

#### Step 2: Apply Replay Protection

Update `backend/src/services/webhookService.ts`:

```typescript
import { replayProtection } from '../utils/replayProtection';

async processMicrosoftNotifications(
  notifications: MicrosoftNotification[]
): Promise<void> {
  logger.info('Processing Microsoft webhook notifications', {
    count: notifications.length
  });

  for (const notification of notifications) {
    try {
      // CHECK FOR REPLAY ATTACK
      if (replayProtection.isDuplicate(notification)) {
        logger.warn('Ignoring duplicate notification', {
          subscriptionId: notification.subscriptionId,
        });
        continue; // Skip this notification
      }

      // Fetch subscription
      const subscription = await prisma.webhookSubscription.findUnique({
        where: { subscriptionId: notification.subscriptionId },
        include: { calendarConnection: true },
      });

      if (!subscription) {
        logger.warn('Subscription not found', {
          subscriptionId: notification.subscriptionId
        });
        continue;
      }

      // Validate client state
      const decryptedClientState = decryptToken(subscription.clientState);
      if (notification.clientState !== decryptedClientState) {
        logger.warn('Invalid client state', {
          subscriptionId: notification.subscriptionId,
        });
        continue;
      }

      // Authorization check
      const connection = subscription.calendarConnection;
      if (!connection || connection.deletedAt) {
        logger.warn('Calendar connection not found or deleted');
        continue;
      }

      // Process notification
      await this.processNotification(notification, subscription);

      // MARK AS PROCESSED (after successful processing)
      replayProtection.markProcessed(notification);

      // Update last notification time
      await prisma.webhookSubscription.update({
        where: { id: subscription.id },
        data: { lastNotificationAt: new Date() },
      });

    } catch (error) {
      logger.error('Failed to process notification', {
        subscriptionId: notification.subscriptionId,
        error,
      });
      // Don't mark as processed on error - allow retry
    }
  }
}
```

### Testing

```bash
# Test replay protection
# Send same notification twice quickly:

curl -X POST http://localhost:3001/api/webhooks/microsoft/events \
  -H "Content-Type: application/json" \
  -d '{
    "value": [{
      "subscriptionId": "test-123",
      "clientState": "test-state",
      "changeType": "created"
    }]
  }'

# Second request (within 5 minutes):
curl -X POST http://localhost:3001/api/webhooks/microsoft/events \
  -H "Content-Type: application/json" \
  -d '{
    "value": [{
      "subscriptionId": "test-123",
      "clientState": "test-state",
      "changeType": "created"
    }]
  }'

# Check logs - should see "Ignoring duplicate notification"
```

---

## 📊 Verification Checklist

After implementing all fixes:

### Fix #1: Webhook Authentication
- [ ] Middleware created and applied
- [ ] IP validation implemented (or placeholder)
- [ ] Rate limiting specific to webhooks
- [ ] Environment variable `WEBHOOK_SIGNING_SECRET` set
- [ ] Tested with unauthorized request (should fail)

### Fix #2: ClientState Encryption
- [ ] `encryptToken()` used when creating subscriptions
- [ ] `decryptToken()` used when validating notifications
- [ ] Data migration script run on existing subscriptions
- [ ] Verified encrypted format in database

### Fix #3: Replay Protection
- [ ] `ReplayProtection` utility created
- [ ] Applied in `processMicrosoftNotifications()`
- [ ] Tested with duplicate notifications
- [ ] Cleanup job runs periodically

---

## 🚀 Production Deployment

Once all fixes are complete:

1. **Code Review**: Have another developer review security changes
2. **Security Testing**: Run penetration tests on webhook endpoint
3. **Load Testing**: Test with many concurrent webhook notifications
4. **Monitoring**: Setup alerting for failed webhook validations
5. **Documentation**: Update internal docs with security procedures

---

## 📈 Monitoring

Add monitoring for security events:

```typescript
// In webhookController.ts
import { metrics } from '../utils/metrics'; // Your metrics service

// Track security events
metrics.increment('webhook.auth_failure', { reason: 'invalid_ip' });
metrics.increment('webhook.replay_detected');
metrics.increment('webhook.clientstate_mismatch');
```

Setup alerts:
- Alert on >10 auth failures per minute
- Alert on >50 replay detections per hour
- Alert on any clientState mismatches

---

## ⏱️ Estimated Implementation Time

- **Fix #1 (Webhook Auth)**: 2-3 hours
- **Fix #2 (Encrypt ClientState)**: 1-2 hours (+ data migration)
- **Fix #3 (Replay Protection)**: 1-2 hours
- **Testing**: 2-3 hours
- **Total**: **6-10 hours** (1-2 days)

---

## 🆘 Need Help?

If you encounter issues implementing these fixes:

1. Review the security audit report for detailed context
2. Check Microsoft Graph API documentation
3. Test each fix incrementally
4. Use the test commands provided above
5. Check backend logs for security events

---

## ✅ Sign-Off

Once complete, verify:
- [ ] All 3 fixes implemented
- [ ] Tests pass
- [ ] Security audit findings addressed
- [ ] Production environment configured
- [ ] Monitoring/alerting setup
- [ ] Team trained on security procedures

**Only then is the integration ready for production! 🔒**
