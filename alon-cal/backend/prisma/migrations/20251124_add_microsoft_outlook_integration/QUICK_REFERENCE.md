# Quick Reference Guide - Microsoft Integration

## TL;DR

This migration adds Microsoft Outlook/Exchange support including:
- Shared calendars via `delegateEmail`
- Teams meeting fields
- Outlook categories and importance
- Webhook subscriptions for real-time sync

**Breaking Changes:** None. Fully backward compatible.

---

## New Fields Cheat Sheet

### CalendarConnection

```typescript
interface CalendarConnection {
  // ... existing fields ...
  delegateEmail?: string;  // 🆕 Shared calendar owner email
}
```

### CalendarEvent

```typescript
interface CalendarEvent {
  // ... existing fields ...

  // Outlook features
  importance?: 'LOW' | 'NORMAL' | 'HIGH';  // 🆕 Default: NORMAL
  outlookCategories?: string;               // 🆕 Comma-separated
  conversationId?: string;                  // 🆕 Threading
  seriesMasterId?: string;                  // 🆕 Recurring series

  // Teams meeting
  teamsEnabled: boolean;                    // 🆕 Default: false
  teamsMeetingUrl?: string;                 // 🆕 Join URL
  teamsConferenceId?: string;               // 🆕 Conference ID
  teamsDialInUrl?: string;                  // 🆕 Dial-in info
}
```

### WebhookSubscription (New Model)

```typescript
interface WebhookSubscription {
  id: string;
  calendarConnectionId: string;
  provider: 'MICROSOFT' | 'GOOGLE';
  subscriptionId: string;                   // From provider
  resourcePath: string;                     // What to monitor
  expirationDateTime: Date;                 // Renewal deadline
  clientState?: string;                     // Validation secret
  notificationUrl: string;                  // Webhook endpoint
  lastNotificationAt?: Date;                // Last ping
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Common Code Patterns

### 1. Create Teams Meeting Event

```typescript
const event = await prisma.calendarEvent.create({
  data: {
    calendarConnectionId: connectionId,
    providerEventId: graphEventId,
    title: "Team Standup",
    startTime: new Date("2024-01-15T10:00:00Z"),
    endTime: new Date("2024-01-15T10:30:00Z"),
    importance: "NORMAL",
    teamsEnabled: true,
    teamsMeetingUrl: "https://teams.microsoft.com/l/meetup-join/...",
    teamsConferenceId: "123456789",
    teamsDialInUrl: "tel:+1-xxx-xxx-xxxx",
  },
});
```

### 2. Query Today's Teams Meetings

```typescript
const teamsMeetings = await prisma.calendarEvent.findMany({
  where: {
    calendarConnectionId: connectionId,
    teamsEnabled: true,
    startTime: {
      gte: startOfDay(new Date()),
      lt: endOfDay(new Date()),
    },
  },
  orderBy: { startTime: "asc" },
});
```

### 3. Create Webhook Subscription

```typescript
const subscription = await prisma.webhookSubscription.create({
  data: {
    calendarConnectionId: connectionId,
    provider: "MICROSOFT",
    subscriptionId: microsoftSubId,
    resourcePath: `/me/calendars/${calendarId}/events`,
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    clientState: crypto.randomUUID(),
    notificationUrl: `${process.env.BASE_URL}/webhooks/microsoft`,
    isActive: true,
  },
});
```

### 4. Find Expiring Webhooks (Renewal Job)

```typescript
const expiringWebhooks = await prisma.webhookSubscription.findMany({
  where: {
    isActive: true,
    expirationDateTime: {
      lt: new Date(Date.now() + 60 * 60 * 1000), // Within 1 hour
    },
  },
  include: {
    calendarConnection: {
      include: {
        user: true,
      },
    },
  },
  orderBy: { expirationDateTime: "asc" },
});

// Renew each subscription
for (const webhook of expiringWebhooks) {
  try {
    const renewed = await renewMicrosoftSubscription(webhook);
    await prisma.webhookSubscription.update({
      where: { id: webhook.id },
      data: {
        expirationDateTime: renewed.expirationDateTime,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Deactivate failed renewal
    await prisma.webhookSubscription.update({
      where: { id: webhook.id },
      data: { isActive: false },
    });
  }
}
```

### 5. Handle Webhook Notification

```typescript
app.post("/webhooks/microsoft", async (req, res) => {
  // 1. Validate notification
  const notification = req.body;
  const subscriptionId = notification.subscriptionId;
  const clientState = notification.clientState;

  const subscription = await prisma.webhookSubscription.findUnique({
    where: {
      subscriptionId_provider: {
        subscriptionId,
        provider: "MICROSOFT",
      },
    },
  });

  if (!subscription || subscription.clientState !== clientState) {
    return res.status(401).send("Unauthorized");
  }

  // 2. Update last notification time
  await prisma.webhookSubscription.update({
    where: { id: subscription.id },
    data: { lastNotificationAt: new Date() },
  });

  // 3. Trigger sync
  await syncCalendar(subscription.calendarConnectionId);

  res.status(200).send("OK");
});
```

### 6. Query Delegated Calendars

```typescript
const delegatedCalendars = await prisma.calendarConnection.findMany({
  where: {
    userId: currentUserId,
    provider: "MICROSOFT",
    delegateEmail: { not: null },
    isConnected: true,
  },
  select: {
    id: true,
    calendarName: true,
    delegateEmail: true,
    lastSyncedAt: true,
  },
});
```

### 7. Query High-Priority Events

```typescript
const urgentEvents = await prisma.calendarEvent.findMany({
  where: {
    calendarConnectionId: connectionId,
    importance: "HIGH",
    startTime: {
      gte: new Date(),
    },
  },
  orderBy: { startTime: "asc" },
  take: 10,
});
```

### 8. Find Events by Conversation Thread

```typescript
const eventThread = await prisma.calendarEvent.findMany({
  where: {
    conversationId: "AAQkAGI1M...",
  },
  orderBy: { createdAt: "asc" },
  include: {
    eventAttendees: true,
  },
});
```

### 9. Parse and Store Outlook Categories

```typescript
// From Microsoft Graph API
const graphEvent = {
  categories: ["Red category", "Work", "Important"],
};

// Store in database
const event = await prisma.calendarEvent.create({
  data: {
    // ... other fields ...
    outlookCategories: graphEvent.categories?.join(",") || null,
  },
});

// Retrieve and parse
const storedEvent = await prisma.calendarEvent.findUnique({
  where: { id: eventId },
});
const categories = storedEvent.outlookCategories?.split(",") || [];
```

### 10. Sync Microsoft Event with All Fields

```typescript
async function syncMicrosoftEvent(graphEvent: any, connectionId: string) {
  const eventData = {
    calendarConnectionId: connectionId,
    providerEventId: graphEvent.id,
    title: graphEvent.subject,
    description: graphEvent.bodyPreview,
    location: graphEvent.location?.displayName,
    startTime: new Date(graphEvent.start.dateTime),
    endTime: new Date(graphEvent.end.dateTime),
    isAllDay: graphEvent.isAllDay,
    timezone: graphEvent.start.timeZone,

    // Microsoft-specific fields
    importance: graphEvent.importance?.toUpperCase() as any,
    outlookCategories: graphEvent.categories?.join(","),
    conversationId: graphEvent.conversationId,
    seriesMasterId: graphEvent.seriesMasterId,

    // Teams meeting
    teamsEnabled: graphEvent.isOnlineMeeting || false,
    teamsMeetingUrl: graphEvent.onlineMeeting?.joinUrl,
    teamsConferenceId: graphEvent.onlineMeeting?.conferenceId,
    teamsDialInUrl: graphEvent.onlineMeeting?.tollNumber,

    // Metadata
    htmlLink: graphEvent.webLink,
    lastSyncedAt: new Date(),
  };

  return await prisma.calendarEvent.upsert({
    where: {
      calendarConnectionId_providerEventId: {
        calendarConnectionId: connectionId,
        providerEventId: graphEvent.id,
      },
    },
    create: eventData,
    update: eventData,
  });
}
```

---

## SQL Quick Queries

### Today's Teams Meetings

```sql
SELECT
  ce.title,
  ce.start_time,
  ce.teams_meeting_url
FROM calendar_events ce
WHERE ce.teams_enabled = true
  AND ce.start_time >= CURRENT_DATE
  AND ce.start_time < CURRENT_DATE + INTERVAL '1 day'
ORDER BY ce.start_time;
```

### Webhook Health Check

```sql
SELECT
  provider,
  COUNT(*) as total,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN expiration_datetime < NOW() THEN 1 ELSE 0 END) as expired,
  SUM(CASE WHEN expiration_datetime < NOW() + INTERVAL '1 hour' THEN 1 ELSE 0 END) as expiring_soon
FROM webhook_subscriptions
GROUP BY provider;
```

### High-Priority Upcoming Events

```sql
SELECT
  ce.title,
  ce.start_time,
  ce.importance,
  ce.teams_enabled
FROM calendar_events ce
WHERE ce.importance = 'HIGH'
  AND ce.start_time >= NOW()
  AND ce.start_time <= NOW() + INTERVAL '7 days'
ORDER BY ce.start_time;
```

### Delegated Calendars by User

```sql
SELECT
  cc.calendar_name,
  cc.delegate_email,
  cc.last_synced_at,
  COUNT(ce.id) as event_count
FROM calendar_connections cc
LEFT JOIN calendar_events ce ON ce.calendar_connection_id = cc.id
WHERE cc.user_id = '<user_uuid>'
  AND cc.delegate_email IS NOT NULL
  AND cc.is_connected = true
GROUP BY cc.id, cc.calendar_name, cc.delegate_email, cc.last_synced_at;
```

---

## Field Mapping Reference

### Microsoft Graph → Database

| Graph API Field | Database Field | Notes |
|----------------|----------------|-------|
| `id` | `providerEventId` | Event ID |
| `subject` | `title` | Event title |
| `importance` | `importance` | LOW/NORMAL/HIGH |
| `categories[]` | `outlookCategories` | Comma-separated |
| `conversationId` | `conversationId` | Thread ID |
| `seriesMasterId` | `seriesMasterId` | Recurring series |
| `isOnlineMeeting` | `teamsEnabled` | Boolean flag |
| `onlineMeeting.joinUrl` | `teamsMeetingUrl` | Join URL |
| `onlineMeeting.conferenceId` | `teamsConferenceId` | Conference ID |
| `onlineMeeting.tollNumber` | `teamsDialInUrl` | Dial-in info |

---

## Environment Variables

Add to `.env`:

```bash
# Webhook Configuration
WEBHOOK_BASE_URL=https://yourdomain.com
WEBHOOK_CLIENT_STATE_SECRET=your-random-secret-here

# Microsoft Graph API
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_REDIRECT_URI=${WEBHOOK_BASE_URL}/auth/microsoft/callback

# Webhook Renewal Job
WEBHOOK_RENEWAL_INTERVAL_MINUTES=30
WEBHOOK_EXPIRATION_BUFFER_HOURS=1
```

---

## Migration Commands

```bash
# Run migration
cd backend
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Verify migration
npx prisma migrate status

# Studio (GUI)
npx prisma studio
```

---

## Troubleshooting

### Issue: Prisma client types not updated

```bash
rm -rf node_modules/.prisma
npm run prisma:generate
```

### Issue: Migration already applied

```bash
# Check migration status
npx prisma migrate status

# Mark as applied (if already run manually)
npx prisma migrate resolve --applied 20251124_add_microsoft_outlook_integration
```

### Issue: Webhook expiration monitoring not working

Check indexes:
```sql
EXPLAIN ANALYZE
SELECT * FROM webhook_subscriptions
WHERE is_active = true
  AND expiration_datetime < NOW() + INTERVAL '1 hour';
```

Should use: `webhook_subscriptions_expiration_active_idx`

---

## Testing Checklist

- [ ] Create event with Teams meeting data
- [ ] Query Teams meetings by date range
- [ ] Create webhook subscription
- [ ] Update webhook last_notification_at
- [ ] Query expiring webhooks
- [ ] Renew webhook subscription
- [ ] Deactivate expired webhook
- [ ] Create delegated calendar connection
- [ ] Query delegated calendars
- [ ] Store and retrieve Outlook categories
- [ ] Query by importance level
- [ ] Query event conversation thread

---

## Performance Tips

1. **Use composite indexes for common queries:**
   - Teams meetings: `(calendar_connection_id, teams_enabled, start_time)`
   - Webhook renewal: `(expiration_datetime, is_active)`

2. **Batch webhook renewals:**
   ```typescript
   // Renew in parallel
   await Promise.all(
     expiringWebhooks.map(webhook => renewWebhook(webhook))
   );
   ```

3. **Cache webhook subscriptions:**
   - Store active webhooks in Redis
   - Invalidate on creation/deletion
   - Reduces DB queries on notification handling

4. **Optimize Teams meeting queries:**
   ```typescript
   // Use partial index
   where: {
     teamsEnabled: true, // Must be first condition
     startTime: { gte: date },
   }
   ```

---

## Security Considerations

1. **Encrypt clientState:** Store webhook secrets encrypted
2. **Validate notifications:** Always check clientState matches
3. **Rate limit webhook endpoint:** Prevent abuse
4. **Monitor expired subscriptions:** Alert on renewal failures
5. **Sanitize Outlook categories:** User input, potential XSS

---

## Next Steps

1. Implement Microsoft Graph API client
2. Build webhook notification handler
3. Create webhook renewal background job
4. Add Teams meeting UI components
5. Implement Outlook categories UI
6. Add importance level filtering
7. Build event threading view

---

## Resources

- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [Microsoft Graph Webhooks](https://learn.microsoft.com/en-us/graph/webhooks)
- [Teams Meeting API](https://learn.microsoft.com/en-us/graph/api/resources/onlinemeeting)
- [Prisma Documentation](https://www.prisma.io/docs)
