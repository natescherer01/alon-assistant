# Alon-Cal - Calendar Integration Platform

A modern, full-stack calendar integration application built with React, TypeScript, Express, and Prisma. Connect and manage multiple calendar providers (Google Calendar, Microsoft Outlook) in one unified interface.

## Tech Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express 5** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM and database toolkit
- **PostgreSQL** - Relational database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

## Project Structure

```
/alon-cal
├── /frontend                 # React + Vite application
│   ├── /src
│   │   ├── /components      # Reusable UI components
│   │   ├── /pages          # Page components
│   │   ├── /hooks          # Custom React hooks
│   │   ├── /lib            # Utility functions and configs
│   │   ├── /types          # TypeScript type definitions
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── /backend                  # Express + TypeScript API
│   ├── /src
│   │   ├── /routes         # API route definitions
│   │   ├── /controllers    # Route handlers
│   │   ├── /middleware     # Custom middleware
│   │   ├── /services       # Business logic
│   │   ├── /utils          # Helper functions
│   │   └── index.ts        # Server entry point
│   ├── /prisma
│   │   └── schema.prisma   # Database schema
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── docker-compose.yml        # PostgreSQL setup
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** or **yarn** or **pnpm**
- **Docker** (for PostgreSQL)
- **Git**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd alon-cal
```

### 2. Start PostgreSQL Database

Start the PostgreSQL container using Docker Compose:

```bash
docker compose up -d postgres
```

Verify the database is running:

```bash
docker compose ps
```

Optional - Start pgAdmin for database management:

```bash
docker compose --profile tools up -d pgadmin
```

Access pgAdmin at `http://localhost:5050` (admin@aloncal.local / admin)

### 3. Backend Setup

#### Install Dependencies

```bash
cd backend
npm install
```

#### Environment Configuration

Create `.env` file from the example:

```bash
cp .env.example .env
```

Update the following variables in `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/alon_cal_dev
JWT_SECRET=your-super-secret-jwt-key-change-this
ENCRYPTION_KEY=your-32-character-encryption-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-oauth-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-oauth-client-secret
```

#### Initialize Database

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

Seed the database (optional):

```bash
npm run prisma:seed
```

#### Start Backend Server

```bash
npm run dev
```

Backend will start at `http://localhost:3001`

### 4. Frontend Setup

#### Install Dependencies

```bash
cd frontend
npm install
```

#### Environment Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Update if needed:

```env
VITE_API_URL=http://localhost:3001
```

#### Start Frontend Development Server

```bash
npm run dev
```

Frontend will start at `http://localhost:5173`

## Development Commands

### Frontend

```bash
npm run dev        # Start development server (port 5173)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Backend

```bash
npm run dev                # Start development server with hot reload
npm run build              # Compile TypeScript to JavaScript
npm run start              # Start production server
npm run lint               # Type check with TypeScript
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run database migrations (dev)
npm run prisma:studio      # Open Prisma Studio GUI
npm run prisma:seed        # Seed database with sample data
```

### Docker

```bash
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f postgres   # View PostgreSQL logs
docker compose restart postgres   # Restart PostgreSQL
docker compose --profile tools up -d pgadmin  # Start pgAdmin
```

## Environment Variables

### Backend (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | development |
| `PORT` | Backend server port | No | 3001 |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | 7d |
| `ENCRYPTION_KEY` | 32-char key for OAuth token encryption | Yes | - |
| `FRONTEND_URL` | Frontend URL for CORS | No | http://localhost:5173 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes* | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes* | - |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth Client ID | Yes* | - |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth Client Secret | Yes* | - |

*Required for calendar integration features

### Frontend (.env)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API URL | No | http://localhost:3001 |

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models:

- **User** - User accounts with authentication
- **Session** - Active user sessions
- **CalendarConnection** - OAuth connections to calendar providers
- **AuditLog** - Security and compliance logging

See `backend/prisma/schema.prisma` for complete schema definition.

### Database Migrations

Create a new migration:

```bash
cd backend
npm run prisma:migrate
```

View database in Prisma Studio:

```bash
npm run prisma:studio
```

## API Endpoints

### Health Check

```
GET /api/health
```

Returns server health status.

### Authentication (Coming Soon)

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Calendar Integration (Coming Soon)

```
GET  /api/calendars
POST /api/calendars/connect/google
POST /api/calendars/connect/microsoft
GET  /api/calendars/:id/events
POST /api/calendars/:id/sync
```

## OAuth Setup

### Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Microsoft Outlook

1. Go to [Azure Portal](https://portal.azure.com)
2. Register a new application in Azure AD
3. Add Microsoft Graph API permissions (Calendars.Read, Calendars.ReadWrite)
4. Add redirect URI: `http://localhost:3001/api/auth/microsoft/callback`
5. Copy Application (client) ID and Client Secret to `.env`

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Encrypted OAuth tokens in database
- CORS protection
- Helmet.js security headers
- Rate limiting on API endpoints
- SQL injection protection via Prisma
- XSS protection

## Documentation

Comprehensive documentation is available in the [docs](docs/) folder:

- [Quick Start Guide](QUICK_START.md) - Get started in 5 minutes
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Production deployment
- [Testing Guide](docs/testing/TESTING.md) - Testing documentation
- [OAuth Setup](docs/oauth/OAUTH_SETUP_GUIDE.md) - Configure calendar providers
- [Security](docs/security/SECURITY_FIXES_REQUIRED.md) - Security requirements

See [docs/README.md](docs/README.md) for complete documentation index.

## Testing

See [docs/testing/TESTING.md](docs/testing/TESTING.md) for comprehensive testing documentation.

## Deployment

See [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) for complete deployment guide.

### Production Build

#### Frontend

```bash
cd frontend
npm run build
```

Build output will be in `frontend/dist/`

#### Backend

```bash
cd backend
npm run build
```

Compiled JavaScript will be in `backend/dist/`

### Environment Setup

1. Set `NODE_ENV=production`
2. Update database URL to production database
3. Set strong JWT secret and encryption key
4. Configure production OAuth redirect URIs
5. Run migrations: `npm run prisma:migrate:prod`

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `docker compose ps`
- Check DATABASE_URL format in `.env`
- Verify port 5432 is not in use

### Frontend Cannot Connect to Backend

- Check VITE_API_URL in frontend `.env`
- Verify backend is running on port 3001
- Check CORS configuration in `backend/src/index.ts`

### Prisma Migration Errors

- Reset database: `docker compose down -v && docker compose up -d postgres`
- Regenerate client: `npm run prisma:generate`
- Run migrations: `npm run prisma:migrate`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
