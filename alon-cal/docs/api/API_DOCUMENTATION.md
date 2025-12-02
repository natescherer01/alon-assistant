# Calendar Integration API Documentation

Complete API documentation for the Calendar Integration backend.

## Base URL

- Development: `http://localhost:3001`
- Production: `https://api.yourdomain.com`

## Authentication

Most endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}

Response: 201 Created
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "jwt_token_here"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: 200 OK
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token_here"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

---

### OAuth - Google Calendar

#### Initiate Google OAuth
```http
GET /api/oauth/google/login
Authorization: Bearer <token>

Response: 200 OK
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "random_state_token",
  "provider": "GOOGLE"
}
```

#### Google OAuth Callback
```http
GET /api/oauth/google/callback?code=AUTH_CODE&state=STATE_TOKEN

Response: 302 Redirect
Redirects to: {FRONTEND_URL}/calendars/select?provider=google&data=BASE64_DATA
```

#### Select Google Calendars
```http
POST /api/oauth/google/select
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "authorization_code",
  "selectedCalendarIds": ["calendar_id_1", "calendar_id_2"]
}

Response: 201 Created
{
  "message": "Calendars connected successfully",
  "calendars": [
    {
      "id": "connection_uuid",
      "provider": "GOOGLE",
      "calendarId": "calendar_id",
      "calendarName": "Work Calendar",
      "calendarColor": "#1F77B4",
      "isPrimary": true,
      "isConnected": true,
      "lastSyncedAt": null,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### OAuth - Microsoft Calendar

#### Initiate Microsoft OAuth
```http
GET /api/oauth/microsoft/login
Authorization: Bearer <token>

Response: 200 OK
{
  "url": "https://login.microsoftonline.com/...",
  "state": "random_state_token",
  "provider": "MICROSOFT"
}
```

#### Microsoft OAuth Callback
```http
GET /api/oauth/microsoft/callback?code=AUTH_CODE&state=STATE_TOKEN

Response: 302 Redirect
Redirects to: {FRONTEND_URL}/calendars/select?provider=microsoft&data=BASE64_DATA
```

#### Select Microsoft Calendars
```http
POST /api/oauth/microsoft/select
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "authorization_code",
  "selectedCalendarIds": ["calendar_id_1", "calendar_id_2"]
}

Response: 201 Created
{
  "message": "Calendars connected successfully",
  "calendars": [...]
}
```

---

### OAuth - Apple Calendar

#### Initiate Apple OAuth
```http
GET /api/oauth/apple/login
Authorization: Bearer <token>

Response: 200 OK
{
  "url": "https://appleid.apple.com/auth/authorize?...",
  "state": "random_state_token",
  "provider": "APPLE"
}
```

#### Apple OAuth Callback
```http
POST /api/oauth/apple/callback
Content-Type: application/x-www-form-urlencoded

code=AUTH_CODE&state=STATE_TOKEN

Response: 302 Redirect
Redirects to: {FRONTEND_URL}/calendars/select?provider=apple&data=BASE64_DATA
```

#### Select Apple Calendars
```http
POST /api/oauth/apple/select
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "authorization_code",
  "selectedCalendarIds": ["calendar_id_1"]
}

Response: 201 Created
{
  "message": "Calendars connected successfully",
  "calendars": [...]
}
```

---

### Calendar Management

#### Get All Calendars
```http
GET /api/calendars
Authorization: Bearer <token>

Response: 200 OK
{
  "calendars": [
    {
      "id": "connection_uuid",
      "provider": "GOOGLE",
      "calendarId": "calendar_id",
      "calendarName": "Work Calendar",
      "calendarColor": "#1F77B4",
      "isPrimary": true,
      "isConnected": true,
      "lastSyncedAt": "2024-01-01T12:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Calendar by ID
```http
GET /api/calendars/:connectionId
Authorization: Bearer <token>

Response: 200 OK
{
  "calendar": {
    "id": "connection_uuid",
    "provider": "GOOGLE",
    "calendarId": "calendar_id",
    "calendarName": "Work Calendar",
    "calendarColor": "#1F77B4",
    "isPrimary": true,
    "isConnected": true,
    "lastSyncedAt": "2024-01-01T12:00:00Z",
    "tokenExpiresAt": "2024-01-02T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Disconnect Calendar
```http
DELETE /api/calendars/:connectionId
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Calendar disconnected successfully"
}
```

#### Sync Calendar
```http
POST /api/calendars/:connectionId/sync
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Calendar synced successfully",
  "lastSyncedAt": "2024-01-01T12:00:00Z",
  "stats": {
    "totalEvents": 45,
    "newEvents": 5,
    "updatedEvents": 3,
    "deletedEvents": 1
  }
}
```

#### Get Calendar Stats
```http
GET /api/calendars/stats
Authorization: Bearer <token>

Response: 200 OK
{
  "stats": {
    "total": 3,
    "connected": 3,
    "disconnected": 0,
    "byProvider": {
      "google": 2,
      "microsoft": 1
    }
  }
}
```

---

### Events

#### Get Events in Date Range
```http
GET /api/events?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z
Authorization: Bearer <token>

Response: 200 OK
{
  "events": [
    {
      "id": "event_uuid",
      "title": "Team Meeting",
      "description": "Weekly sync",
      "location": "Conference Room A",
      "startTime": "2024-01-15T14:00:00Z",
      "endTime": "2024-01-15T15:00:00Z",
      "isAllDay": false,
      "timezone": "America/New_York",
      "status": "CONFIRMED",
      "isRecurring": false,
      "attendees": [
        {
          "email": "attendee@example.com",
          "name": "Jane Doe",
          "responseStatus": "accepted",
          "organizer": false
        }
      ],
      "reminders": [
        {
          "method": "popup",
          "minutes": 10
        }
      ],
      "htmlLink": "https://calendar.google.com/event?...",
      "calendar": {
        "provider": "GOOGLE",
        "name": "Work Calendar",
        "color": "#1F77B4"
      }
    }
  ],
  "meta": {
    "total": 45,
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  }
}
```

#### Get Event by ID
```http
GET /api/events/:eventId
Authorization: Bearer <token>

Response: 200 OK
{
  "event": {
    "id": "event_uuid",
    "title": "Team Meeting",
    "description": "Weekly sync",
    "location": "Conference Room A",
    "startTime": "2024-01-15T14:00:00Z",
    "endTime": "2024-01-15T15:00:00Z",
    "isAllDay": false,
    "timezone": "America/New_York",
    "status": "CONFIRMED",
    "isRecurring": false,
    "recurrenceRule": null,
    "attendees": [...],
    "reminders": [...],
    "htmlLink": "https://calendar.google.com/event?...",
    "calendar": {
      "provider": "GOOGLE",
      "name": "Work Calendar",
      "color": "#1F77B4"
    },
    "providerMetadata": {...},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Get Upcoming Events
```http
GET /api/events/upcoming?limit=10
Authorization: Bearer <token>

Response: 200 OK
{
  "events": [
    {
      "id": "event_uuid",
      "title": "Team Meeting",
      "startTime": "2024-01-15T14:00:00Z",
      "endTime": "2024-01-15T15:00:00Z",
      "isAllDay": false,
      "location": "Conference Room A",
      "calendar": {
        "provider": "GOOGLE",
        "name": "Work Calendar",
        "color": "#1F77B4"
      }
    }
  ],
  "meta": {
    "total": 10,
    "limit": 10
  }
}
```

#### Sync All Calendars
```http
POST /api/events/sync
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Calendar sync completed",
  "stats": {
    "totalEvents": 150,
    "newEvents": 20,
    "updatedEvents": 10,
    "deletedEvents": 5,
    "errors": []
  },
  "calendarCount": 3
}
```

---

### Health Check

#### Health Status
```http
GET /api/health

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Detailed error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "User not authenticated"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

---

## Event Syncing

### Sync Behavior

- **Incremental Sync**: Uses sync tokens (Google) or delta links (Microsoft) to fetch only changed events
- **Full Sync**: Fetches all events within the specified date range
- **Automatic Token Refresh**: Tokens are automatically refreshed when they expire
- **Error Handling**: Failed syncs are logged and can be retried

### Sync Frequency

- Manual sync: User-initiated via `/api/calendars/:id/sync` or `/api/events/sync`
- Background sync: Can be scheduled using cron jobs or task schedulers

### Event Data

Events are stored with the following information:
- Title, description, location
- Start/end time, timezone, all-day flag
- Status (confirmed, tentative, cancelled)
- Recurrence information
- Attendees and their response status
- Reminders
- Provider-specific metadata (JSONB)

---

## Security

### Authentication
- JWT tokens with configurable expiration
- Secure password hashing with bcrypt
- Session management with IP and user agent tracking

### OAuth
- CSRF protection via state tokens (single-use, 15-minute expiry)
- Encrypted token storage (AES-256-GCM)
- Automatic token refresh before expiration

### Data Protection
- OAuth tokens encrypted in database
- Audit logs for all OAuth and sync operations
- Rate limiting on API endpoints

---

## Environment Variables

Required environment variables (see `.env.example` for full list):

```bash
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-key

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Microsoft OAuth
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common

# Apple OAuth (Optional)
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...

# URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

---

## Development

### Running the Server

```bash
# Install dependencies
npm install

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Start production server
npm run build
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## Providers Supported

1. **Google Calendar**
   - OAuth 2.0 with offline access
   - Calendar listing and event sync
   - Incremental sync with sync tokens
   - Recurring events support

2. **Microsoft Outlook**
   - OAuth 2.0 with MSAL
   - Calendar listing via Microsoft Graph
   - Delta query for incremental sync
   - Recurring events support

3. **Apple Calendar**
   - Sign in with Apple OAuth
   - Basic calendar listing (CalDAV stub)
   - Note: Full CalDAV implementation required for event sync

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Configurable via `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`

---

## Logging

Structured logging using custom logger utility:
- Info: General application flow
- Debug: Detailed debugging information
- Warn: Warning messages
- Error: Error messages with stack traces

---

## Support

For issues or questions, please refer to the project repository.
