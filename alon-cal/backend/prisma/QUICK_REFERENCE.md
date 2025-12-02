# Database Schema Quick Reference

## Table Relationships

```
User
├── CalendarConnection (1:N)
│   └── CalendarEvent (1:N)
├── Session (1:N)
├── OAuthState (1:N)
└── AuditLog (1:N)

CalendarEvent (Recurring)
└── CalendarEvent (Self-referencing for parent/child instances)
```

## Common Query Patterns

### 1. Get User's Events for Date Range

```typescript
const events = await prisma.calendarEvent.findMany({
  where: {
    calendarConnection: {
      userId: userId,
      isConnected: true,
      deletedAt: null
    },
    startTime: { gte: startDate },
    endTime: { lte: endDate },
    deletedAt: null
  },
  include: {
    calendarConnection: {
      select: {
        calendarName: true,
        calendarColor: true,
        provider: true
      }
    }
  },
  orderBy: { startTime: 'asc' }
});
```

**Index Used**: `calendar_events_connection_date_range_idx`

### 2. Create OAuth State for CSRF Protection

```typescript
const state = crypto.randomBytes(32).toString('hex');

const oauthState = await prisma.oAuthState.create({
  data: {
    userId: userId,
    provider: 'GOOGLE', // or 'MICROSOFT', 'APPLE'
    state: state,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  }
});

// Use state in OAuth redirect URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&...`;
```

### 3. Validate OAuth State in Callback

```typescript
const oauthState = await prisma.oAuthState.findUnique({
  where: { state: callbackState },
  include: { user: true }
});

if (!oauthState) {
  throw new Error('Invalid OAuth state');
}

if (oauthState.expiresAt < new Date()) {
  throw new Error('OAuth state expired');
}

if (oauthState.consumed) {
  throw new Error('OAuth state already used');
}

// Mark as consumed
await prisma.oAuthState.update({
  where: { id: oauthState.id },
  data: { consumed: true }
});
```

**Index Used**: `oauth_states_state_key` (unique index)

### 4. Sync Events from Provider

```typescript
// Incremental sync using sync token
const connection = await prisma.calendarConnection.findUnique({
  where: { id: connectionId }
});

// Get events from provider using syncToken
const providerEvents = await fetchEventsFromProvider(
  connection.accessToken,
  connection.syncToken // null for first sync
);

// Upsert events
for (const providerEvent of providerEvents.items) {
  await prisma.calendarEvent.upsert({
    where: {
      calendarConnectionId_providerEventId: {
        calendarConnectionId: connection.id,
        providerEventId: providerEvent.id
      }
    },
    create: {
      calendarConnectionId: connection.id,
      providerEventId: providerEvent.id,
      title: providerEvent.summary,
      description: providerEvent.description,
      location: providerEvent.location,
      startTime: new Date(providerEvent.start.dateTime),
      endTime: new Date(providerEvent.end.dateTime),
      isAllDay: !!providerEvent.start.date,
      timezone: providerEvent.start.timeZone || 'UTC',
      attendees: providerEvent.attendees || [],
      reminders: providerEvent.reminders?.overrides || [],
      providerMetadata: {
        googleMeetLink: providerEvent.hangoutLink,
        conferenceData: providerEvent.conferenceData
      },
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date()
    },
    update: {
      title: providerEvent.summary,
      description: providerEvent.description,
      location: providerEvent.location,
      startTime: new Date(providerEvent.start.dateTime),
      endTime: new Date(providerEvent.end.dateTime),
      attendees: providerEvent.attendees || [],
      reminders: providerEvent.reminders?.overrides || [],
      syncStatus: 'SYNCED',
      lastSyncedAt: new Date()
    }
  });
}

// Update sync token
await prisma.calendarConnection.update({
  where: { id: connection.id },
  data: {
    syncToken: providerEvents.nextSyncToken,
    lastSyncedAt: new Date()
  }
});
```

**Index Used**: `calendar_events_calendar_connection_id_provider_event_id_key` (unique)

### 5. Get Pending Sync Events

```typescript
const pendingEvents = await prisma.calendarEvent.findMany({
  where: {
    calendarConnectionId: connectionId,
    syncStatus: { in: ['PENDING', 'FAILED'] }
  },
  orderBy: { createdAt: 'asc' }
});
```

**Index Used**: `calendar_events_connection_sync_status_idx`

### 6. Create Recurring Event with Instances

```typescript
// Create parent recurring event
const parentEvent = await prisma.calendarEvent.create({
  data: {
    calendarConnectionId: connectionId,
    providerEventId: 'recurring-123',
    title: 'Weekly Standup',
    startTime: new Date('2025-11-22T10:00:00Z'),
    endTime: new Date('2025-11-22T10:30:00Z'),
    isRecurring: true,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    recurrenceFrequency: 'WEEKLY',
    recurrenceInterval: 1,
    recurrenceEndDate: new Date('2025-12-31T23:59:59Z')
  }
});

// Create instances (can be done lazily on-demand)
const instances = generateRecurringInstances(parentEvent);

for (const instance of instances) {
  await prisma.calendarEvent.create({
    data: {
      calendarConnectionId: connectionId,
      providerEventId: `${parentEvent.providerEventId}_${instance.date}`,
      parentEventId: parentEvent.id,
      title: parentEvent.title,
      startTime: instance.startTime,
      endTime: instance.endTime,
      isRecurring: false
    }
  });
}
```

### 7. Soft Delete Event (Sync with Provider)

```typescript
// Soft delete (preserves sync history)
await prisma.calendarEvent.update({
  where: { id: eventId },
  data: {
    deletedAt: new Date(),
    syncStatus: 'DELETED'
  }
});

// Hard delete after 30 days (cleanup job)
await prisma.calendarEvent.deleteMany({
  where: {
    deletedAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
  }
});
```

### 8. Get All Calendars for User

```typescript
const calendars = await prisma.calendarConnection.findMany({
  where: {
    userId: userId,
    deletedAt: null
  },
  include: {
    _count: {
      select: { events: true }
    }
  },
  orderBy: [
    { isPrimary: 'desc' },
    { createdAt: 'asc' }
  ]
});
```

### 9. Refresh OAuth Token

```typescript
const connection = await prisma.calendarConnection.findUnique({
  where: { id: connectionId }
});

// Decrypt refresh token
const refreshToken = decrypt(connection.refreshToken);

// Get new tokens from provider
const { accessToken, refreshToken: newRefreshToken, expiresIn } =
  await refreshProviderToken(refreshToken);

// Update connection
await prisma.calendarConnection.update({
  where: { id: connectionId },
  data: {
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(newRefreshToken || refreshToken),
    tokenExpiresAt: new Date(Date.now() + expiresIn * 1000)
  }
});
```

## JSONB Field Examples

### Attendees

```typescript
const attendees = [
  {
    email: 'john@example.com',
    name: 'John Doe',
    responseStatus: 'accepted',
    organizer: true
  },
  {
    email: 'jane@example.com',
    name: 'Jane Smith',
    responseStatus: 'tentative',
    organizer: false
  }
];

await prisma.calendarEvent.create({
  data: {
    // ... other fields
    attendees: attendees
  }
});
```

### Reminders

```typescript
const reminders = [
  { method: 'popup', minutes: 15 },
  { method: 'email', minutes: 60 }
];

await prisma.calendarEvent.create({
  data: {
    // ... other fields
    reminders: reminders
  }
});
```

### Provider Metadata

```typescript
// Google Calendar
const googleMetadata = {
  googleMeetLink: 'https://meet.google.com/abc-defg-hij',
  conferenceData: {
    conferenceId: 'abc-defg-hij',
    conferenceSolution: {
      name: 'Google Meet',
      iconUri: 'https://...'
    }
  }
};

// Microsoft Outlook
const microsoftMetadata = {
  teamsLink: 'https://teams.microsoft.com/...',
  onlineMeetingUrl: 'https://teams.microsoft.com/...',
  onlineMeetingProvider: 'teamsForBusiness'
};

await prisma.calendarEvent.create({
  data: {
    // ... other fields
    providerMetadata: googleMetadata // or microsoftMetadata
  }
});
```

## Querying JSONB Fields

```typescript
// Find events with specific attendee
const events = await prisma.$queryRaw`
  SELECT *
  FROM calendar_events
  WHERE attendees @> '[{"email": "john@example.com"}]'::jsonb
`;

// Find events with Google Meet links
const meetEvents = await prisma.$queryRaw`
  SELECT *
  FROM calendar_events
  WHERE provider_metadata->>'googleMeetLink' IS NOT NULL
`;
```

## Background Jobs (Cron)

### Cleanup Expired OAuth States

```typescript
// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  await prisma.oAuthState.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumed: true }
      ]
    }
  });
});
```

### Refresh Expiring Tokens

```typescript
// Run every hour
cron.schedule('0 * * * *', async () => {
  const expiringConnections = await prisma.calendarConnection.findMany({
    where: {
      tokenExpiresAt: {
        lt: new Date(Date.now() + 60 * 60 * 1000) // Next hour
      },
      isConnected: true,
      deletedAt: null
    }
  });

  for (const connection of expiringConnections) {
    try {
      await refreshOAuthToken(connection);
    } catch (error) {
      console.error(`Failed to refresh token for ${connection.id}:`, error);

      // Mark as disconnected after 3 failures
      if (connection.failedRefreshCount >= 2) {
        await prisma.calendarConnection.update({
          where: { id: connection.id },
          data: { isConnected: false }
        });
      }
    }
  }
});
```

### Sync Calendar Events

```typescript
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const connectionsToSync = await prisma.calendarConnection.findMany({
    where: {
      isConnected: true,
      deletedAt: null,
      OR: [
        { lastSyncedAt: null },
        {
          lastSyncedAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
          }
        }
      ]
    }
  });

  for (const connection of connectionsToSync) {
    try {
      await syncCalendarEvents(connection);
    } catch (error) {
      console.error(`Failed to sync ${connection.id}:`, error);

      await prisma.auditLog.create({
        data: {
          userId: connection.userId,
          action: 'EVENT_SYNC_FAILED',
          resourceType: 'calendar_connection',
          resourceId: connection.id,
          status: 'FAILURE',
          errorMessage: error.message,
          metadata: { provider: connection.provider }
        }
      });
    }
  }
});
```

## Useful SQL Queries

### Get Event Count by Calendar

```sql
SELECT
  cc.calendar_name,
  cc.provider,
  COUNT(ce.id) as event_count
FROM calendar_connections cc
LEFT JOIN calendar_events ce ON ce.calendar_connection_id = cc.id
WHERE cc.user_id = 'user-uuid'
  AND cc.deleted_at IS NULL
  AND ce.deleted_at IS NULL
GROUP BY cc.id, cc.calendar_name, cc.provider
ORDER BY event_count DESC;
```

### Find Events in Date Range

```sql
SELECT
  ce.title,
  ce.start_time,
  ce.end_time,
  cc.calendar_name,
  cc.provider
FROM calendar_events ce
JOIN calendar_connections cc ON ce.calendar_connection_id = cc.id
WHERE cc.user_id = 'user-uuid'
  AND ce.start_time >= '2025-11-22 00:00:00+00'
  AND ce.end_time <= '2025-11-29 23:59:59+00'
  AND ce.deleted_at IS NULL
ORDER BY ce.start_time ASC;
```

### Find Conflicting Events

```sql
SELECT
  ce1.title as event1,
  ce2.title as event2,
  ce1.start_time,
  ce1.end_time
FROM calendar_events ce1
JOIN calendar_events ce2 ON
  ce1.calendar_connection_id = ce2.calendar_connection_id
  AND ce1.id < ce2.id
  AND ce1.start_time < ce2.end_time
  AND ce1.end_time > ce2.start_time
WHERE ce1.calendar_connection_id IN (
  SELECT id FROM calendar_connections WHERE user_id = 'user-uuid'
)
AND ce1.deleted_at IS NULL
AND ce2.deleted_at IS NULL
ORDER BY ce1.start_time;
```

## Testing

### Sample Test Data

```typescript
// Create test user
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    passwordHash: await bcrypt.hash('password', 10),
    firstName: 'Test',
    lastName: 'User'
  }
});

// Create test calendar connection
const connection = await prisma.calendarConnection.create({
  data: {
    userId: user.id,
    provider: 'GOOGLE',
    calendarId: 'primary',
    calendarName: 'Test Calendar',
    accessToken: encrypt('test-access-token'),
    refreshToken: encrypt('test-refresh-token'),
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    calendarColor: '#4285F4',
    isPrimary: true
  }
});

// Create test event
const event = await prisma.calendarEvent.create({
  data: {
    calendarConnectionId: connection.id,
    providerEventId: 'test-event-123',
    title: 'Test Meeting',
    description: 'This is a test meeting',
    location: 'Conference Room A',
    startTime: new Date('2025-11-22T10:00:00Z'),
    endTime: new Date('2025-11-22T11:00:00Z'),
    timezone: 'America/New_York',
    attendees: [
      {
        email: 'attendee@example.com',
        name: 'Attendee Name',
        responseStatus: 'accepted',
        organizer: false
      }
    ],
    reminders: [
      { method: 'popup', minutes: 15 }
    ]
  }
});
```

## Migration Commands

```bash
# Create new migration
npx prisma migrate dev --name add_calendar_events

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Reset database (DEV ONLY - destroys data)
npx prisma migrate reset

# View current migration status
npx prisma migrate status

# Open Prisma Studio for visual data browsing
npx prisma studio
```
