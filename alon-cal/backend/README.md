# Calendar Integration Backend

Express + TypeScript backend for the Calendar Integration Application.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Server runs at `http://localhost:3001`

## Project Structure

```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   ├── integrations/    # Calendar provider clients
│   ├── utils/           # Helper functions
│   └── index.ts         # Server entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── tests/               # Test files
```

## Available Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run tests
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
```

## Documentation

- **API Reference**: [docs/api/API_DOCUMENTATION.md](../docs/api/API_DOCUMENTATION.md)
- **Microsoft Integration**: [docs/backend/MICROSOFT_INTEGRATION.md](../docs/backend/MICROSOFT_INTEGRATION.md)
- **OAuth Setup**: [docs/oauth/OAUTH_SETUP_GUIDE.md](../docs/oauth/OAUTH_SETUP_GUIDE.md)
- **Deployment**: [docs/deployment/DEPLOYMENT.md](../docs/deployment/DEPLOYMENT.md)
- **Testing**: [docs/testing/TESTING.md](../docs/testing/TESTING.md)

## Environment Variables

See [.env.example](.env.example) for required configuration.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `ENCRYPTION_KEY` - 32-character key for OAuth token encryption
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` - Microsoft OAuth credentials

## Tech Stack

- **Express 5** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **MSAL** - Microsoft authentication
- **Google APIs** - Google Calendar integration

## Support

See the [main project README](../README.md) for more information.
