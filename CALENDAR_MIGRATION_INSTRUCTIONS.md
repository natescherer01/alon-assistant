# Calendar Backend Migration: Express → FastAPI

## Objective
Port the calendar functionality from `alon-cal/backend` (Express/TypeScript) to the main `backend` (FastAPI/Python) to create a single unified backend.

---

## Current State

### Main Backend (FastAPI) - `/backend/`
- **Port**: 8000
- **Database**: PostgreSQL (Railway) with SQLAlchemy ORM
- **Auth**: JWT with bcrypt, token blacklist via Redis
- **Features**: User auth, task management, Claude AI chat, field-level encryption
- **Key files**:
  - `backend/auth/router.py` - Auth endpoints
  - `backend/auth/utils.py` - JWT utilities
  - `backend/tasks/router.py` - Task CRUD
  - `backend/chat/router.py` - Claude AI chat
  - `backend/models.py` - SQLAlchemy models
  - `backend/main.py` - FastAPI app entry

### Calendar Backend (Express) - `/alon-cal/backend/`
- **Port**: 3001
- **Database**: Same PostgreSQL (Railway) with Prisma ORM
- **Auth**: JWT in httpOnly cookies, accepts main app tokens
- **Features**: Google/Microsoft OAuth, calendar sync, webhooks, ICS support
- **Key files**:
  - `alon-cal/backend/src/routes/oauth.ts` - OAuth flows
  - `alon-cal/backend/src/routes/calendar.ts` - Calendar management
  - `alon-cal/backend/src/routes/events.ts` - Event CRUD
  - `alon-cal/backend/src/integrations/google.ts` - Google Calendar API
  - `alon-cal/backend/src/integrations/microsoft.ts` - Microsoft Graph API
  - `alon-cal/backend/src/services/eventSyncService.ts` - Sync logic
  - `alon-cal/backend/prisma/schema.prisma` - Database schema

### Database Tables (Already Created)
The calendar tables already exist in Railway PostgreSQL:
- `calendar_users` - Calendar user records
- `calendar_connections` - OAuth connections (Google/Microsoft/ICS)
- `calendar_events` - Synced events
- `calendar_sessions` - Session tracking
- `oauth_states` - OAuth CSRF tokens
- `webhook_subscriptions` - Microsoft webhook subscriptions
- `event_attendees` - Event participants
- `event_reminders` - Event reminders
- `calendar_audit_logs` - Audit trail

---

## Migration Tasks

### Phase 1: Setup & Models

#### 1.1 Create Calendar Module Structure
```
backend/
├── calendar/
│   ├── __init__.py
│   ├── router.py              # Main calendar router (imports sub-routers)
│   ├── models.py              # SQLAlchemy models for calendar tables
│   ├── schemas.py             # Pydantic schemas for request/response
│   ├── dependencies.py        # Calendar-specific dependencies
│   ├── oauth/
│   │   ├── __init__.py
│   │   ├── router.py          # OAuth endpoints
│   │   ├── google.py          # Google Calendar integration
│   │   └── microsoft.py       # Microsoft Graph integration
│   ├── services/
│   │   ├── __init__.py
│   │   ├── sync.py            # Event sync service
│   │   ├── ics.py             # ICS calendar parsing
│   │   └── webhook.py         # Webhook management
│   └── utils/
│       ├── __init__.py
│       └── encryption.py      # Token encryption (reuse existing)
```

#### 1.2 Create SQLAlchemy Models
Reference: `alon-cal/backend/prisma/schema.prisma`

Create models in `backend/calendar/models.py`:
- `CalendarUser` - Maps to `calendar_users` table
- `CalendarSession` - Maps to `calendar_sessions` table
- `OAuthState` - Maps to `oauth_states` table
- `CalendarConnection` - Maps to `calendar_connections` table
- `CalendarEvent` - Maps to `calendar_events` table
- `EventAttendee` - Maps to `event_attendees` table
- `EventReminder` - Maps to `event_reminders` table
- `WebhookSubscription` - Maps to `webhook_subscriptions` table
- `CalendarAuditLog` - Maps to `calendar_audit_logs` table

Use existing enums from the database:
- `calendar_provider` (GOOGLE, MICROSOFT, APPLE, ICS)
- `event_status` (CONFIRMED, TENTATIVE, CANCELLED)
- `sync_status` (PENDING, SYNCED, FAILED, DELETED)
- `rsvp_status` (NEEDS_ACTION, ACCEPTED, DECLINED, TENTATIVE)
- `reminder_method` (EMAIL, POPUP, SMS)
- `recurrence_frequency` (DAILY, WEEKLY, MONTHLY, YEARLY)
- etc.

#### 1.3 Create Pydantic Schemas
Reference: `alon-cal/backend/src/types/` and controller request/response types

Create schemas in `backend/calendar/schemas.py` for:
- Calendar connection responses
- Event create/update requests
- OAuth callback responses
- Calendar selection requests

---

### Phase 2: OAuth Integration

#### 2.1 Install Python Dependencies
Add to `requirements.txt`:
```
google-api-python-client==2.108.0
google-auth==2.23.4
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
msal==1.24.1
icalendar==5.0.11
httpx==0.25.1
```

#### 2.2 Google Calendar OAuth
Reference: `alon-cal/backend/src/integrations/google.ts`

Create `backend/calendar/oauth/google.py`:
- `get_auth_url()` - Generate OAuth URL with state
- `handle_callback(code, state)` - Exchange code for tokens
- `list_calendars(access_token)` - Get user's calendars
- `refresh_token(refresh_token)` - Refresh expired tokens
- `sync_events(connection, start_date, end_date)` - Fetch events

#### 2.3 Microsoft Graph OAuth
Reference: `alon-cal/backend/src/integrations/microsoft.ts`

Create `backend/calendar/oauth/microsoft.py`:
- `get_auth_url()` - Generate OAuth URL with state
- `handle_callback(code, state)` - Exchange code for tokens
- `list_calendars(access_token)` - Get user's calendars
- `refresh_token(refresh_token)` - Refresh expired tokens
- `sync_events(connection, start_date, end_date)` - Fetch events
- `create_webhook_subscription(connection)` - Set up push notifications

#### 2.4 OAuth Router
Reference: `alon-cal/backend/src/routes/oauth.ts`

Create `backend/calendar/oauth/router.py`:
```python
# Endpoints:
GET  /api/v1/calendar/oauth/google/login      # Initiate Google OAuth
GET  /api/v1/calendar/oauth/google/callback   # Handle Google callback
POST /api/v1/calendar/oauth/google/select     # Select calendars to sync
GET  /api/v1/calendar/oauth/microsoft/login   # Initiate Microsoft OAuth
GET  /api/v1/calendar/oauth/microsoft/callback # Handle Microsoft callback
POST /api/v1/calendar/oauth/microsoft/select  # Select calendars to sync
GET  /api/v1/calendar/oauth/session/{session_id} # Get OAuth session data
```

---

### Phase 3: Calendar & Event Management

#### 3.1 Calendar Router
Reference: `alon-cal/backend/src/routes/calendar.ts`

Create `backend/calendar/router.py`:
```python
# Endpoints:
GET    /api/v1/calendar/calendars              # List connected calendars
POST   /api/v1/calendar/calendars/sync-all     # Sync all calendars
GET    /api/v1/calendar/calendars/stats        # Get calendar stats
GET    /api/v1/calendar/calendars/{id}         # Get calendar details
DELETE /api/v1/calendar/calendars/{id}         # Disconnect calendar
POST   /api/v1/calendar/calendars/{id}/sync    # Sync specific calendar
```

#### 3.2 Events Router
Reference: `alon-cal/backend/src/routes/events.ts`

Create endpoints in same router or separate:
```python
# Endpoints:
POST   /api/v1/calendar/events                 # Create event
GET    /api/v1/calendar/events                 # Get events (date range)
GET    /api/v1/calendar/events/upcoming        # Get upcoming events
GET    /api/v1/calendar/events/{id}            # Get event by ID
PUT    /api/v1/calendar/events/{id}            # Update event
DELETE /api/v1/calendar/events/{id}            # Delete event
POST   /api/v1/calendar/events/{id}/retry-sync # Retry failed sync
```

#### 3.3 ICS Calendar Support
Reference: `alon-cal/backend/src/routes/ics.ts` and `alon-cal/backend/src/integrations/ics/`

Create `backend/calendar/services/ics.py`:
- `validate_ics_url(url)` - Validate and fetch ICS calendar
- `parse_ics(content)` - Parse ICS to events
- `sync_ics_calendar(connection)` - Sync ICS calendar

Add ICS endpoints:
```python
POST /api/v1/calendar/ics/validate    # Validate ICS URL
POST /api/v1/calendar/ics/connect     # Connect ICS calendar
PUT  /api/v1/calendar/ics/{id}        # Update ICS calendar
```

---

### Phase 4: Sync Services & Background Jobs

#### 4.1 Event Sync Service
Reference: `alon-cal/backend/src/services/eventSyncService.ts`

Create `backend/calendar/services/sync.py`:
- `sync_google_events(connection)` - Sync Google Calendar events
- `sync_microsoft_events(connection)` - Sync Outlook events
- `sync_ics_events(connection)` - Sync ICS events
- `map_google_event_to_db(event)` - Transform Google event
- `map_microsoft_event_to_db(event)` - Transform Outlook event
- `handle_recurring_events(event)` - Process recurrence rules

#### 4.2 Background Jobs
Reference: `alon-cal/backend/src/services/backgroundJobs.ts`

Options:
1. **FastAPI BackgroundTasks** - For simple async tasks
2. **APScheduler** - For scheduled jobs (recommended)
3. **Celery** - For production-grade job queue

Add to `requirements.txt`:
```
APScheduler==3.10.4
```

Create `backend/calendar/services/jobs.py`:
- `renew_webhook_subscriptions()` - Run every 12 hours
- `cleanup_expired_subscriptions()` - Run every hour
- `sync_ics_calendars()` - Run every 15 minutes

Initialize in `backend/main.py`:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

@app.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(renew_webhooks, 'interval', hours=12)
    scheduler.add_job(cleanup_subscriptions, 'interval', hours=1)
    scheduler.add_job(sync_ics, 'interval', minutes=15)
    scheduler.start()
```

---

### Phase 5: Webhook Support

#### 5.1 Webhook Endpoints
Reference: `alon-cal/backend/src/routes/webhooks.ts`

Create webhook handling:
```python
# Endpoints:
POST /api/v1/calendar/webhooks/microsoft   # Microsoft Graph webhook receiver
POST /api/v1/calendar/webhooks/google      # Google Calendar webhook receiver
```

#### 5.2 Webhook Service
Reference: `alon-cal/backend/src/services/webhookService.ts`

Create `backend/calendar/services/webhook.py`:
- `create_microsoft_subscription(connection)` - Create webhook subscription
- `renew_microsoft_subscription(subscription)` - Renew before expiry
- `handle_microsoft_notification(payload)` - Process notification
- `cleanup_expired_subscriptions()` - Remove expired subscriptions

---

### Phase 6: Integration & Cleanup

#### 6.1 Register Routers in Main App
Update `backend/main.py`:
```python
from calendar.router import router as calendar_router

app.include_router(calendar_router, prefix="/api/v1/calendar", tags=["calendar"])
```

#### 6.2 Update CORS Origins
Ensure frontend origin is allowed for new endpoints.

#### 6.3 Update Frontend API Client
Update `frontend/src/api/calendarApi.ts`:
- Change base URL from `VITE_CALENDAR_API_URL` to `VITE_API_BASE_URL`
- Update endpoint paths (add `/calendar` prefix if needed)

#### 6.4 Test All Endpoints
- OAuth flows (Google, Microsoft)
- Calendar listing and sync
- Event CRUD operations
- ICS calendar support
- Webhook notifications
- Background job execution

#### 6.5 Remove alon-cal Backend
Once migration is complete and tested:
1. Remove `alon-cal/backend/` directory
2. Remove calendar-specific frontend API client if consolidated
3. Update deployment configurations

---

## Environment Variables (Unified)

The merged backend needs these environment variables:

```env
# Existing Main App Variables
SECRET_KEY=<your-secret-key>
DATABASE_URL=<railway-postgres-url>
ANTHROPIC_API_KEY=<claude-api-key>
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend.vercel.app

# New Calendar Variables
ENCRYPTION_KEY=<32-char-encryption-key>

# Google OAuth
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URI=https://your-backend.up.railway.app/api/v1/calendar/oauth/google/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<microsoft-client-id>
MICROSOFT_CLIENT_SECRET=<microsoft-client-secret>
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://your-backend.up.railway.app/api/v1/calendar/oauth/microsoft/callback

# Webhook URL (for Microsoft push notifications)
API_URL=https://your-backend.up.railway.app
```

---

## Key Implementation Notes

### 1. Token Encryption
Reuse the existing `backend/app/core/encryption.py` for encrypting OAuth tokens before storing in database.

### 2. User Linking
The calendar uses `calendar_users` table. When a main app user accesses calendar features:
1. Look up by email in `calendar_users`
2. If not found, create a new record with email from JWT
3. Link all calendar data to this `calendar_users.id`

### 3. Error Handling
Follow the existing pattern in `backend/auth/router.py`:
- Use HTTPException with appropriate status codes
- Log errors with proper context
- Return consistent error response format

### 4. Rate Limiting
Apply rate limits similar to auth endpoints:
- OAuth initiation: 10/minute
- Sync operations: 5/minute
- Event operations: 30/minute

### 5. Audit Logging
Port the audit logging from `alon-cal/backend/src/services/auditService.ts`:
- Log OAuth successes/failures
- Log calendar connections/disconnections
- Log sync operations

---

## Reference Files to Study

Before starting, read these files in order:

1. **Database Schema**: `alon-cal/backend/prisma/schema.prisma`
2. **OAuth Flow**: `alon-cal/backend/src/routes/oauth.ts` → `src/controllers/oauthController.ts` → `src/services/oauthService.ts`
3. **Google Integration**: `alon-cal/backend/src/integrations/google.ts`
4. **Microsoft Integration**: `alon-cal/backend/src/integrations/microsoft.ts`
5. **Event Sync**: `alon-cal/backend/src/services/eventSyncService.ts`
6. **Calendar Routes**: `alon-cal/backend/src/routes/calendar.ts`
7. **Event Routes**: `alon-cal/backend/src/routes/events.ts`
8. **Background Jobs**: `alon-cal/backend/src/services/backgroundJobs.ts`

---

## Success Criteria

Migration is complete when:
1. ✅ All calendar tables have SQLAlchemy models
2. ✅ Google OAuth flow works end-to-end
3. ✅ Microsoft OAuth flow works end-to-end
4. ✅ Calendar listing works for all providers
5. ✅ Event sync works (both directions)
6. ✅ ICS calendar support works
7. ✅ Background jobs run on schedule
8. ✅ Microsoft webhooks receive notifications
9. ✅ Frontend works with new API endpoints
10. ✅ All existing main app functionality still works
