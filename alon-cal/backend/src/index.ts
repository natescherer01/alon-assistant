import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Load environment variables with explicit path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import routes
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import oauthRouter from './routes/oauth';
import calendarRouter from './routes/calendar';
import eventsRouter from './routes/events';
import webhooksRouter from './routes/webhooks';
import icsRouter from './routes/ics';

// Import config validation
import { validateOAuthConfig } from './config/oauth';

// Import background jobs
import backgroundJobs from './services/backgroundJobs';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More lenient in dev
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/calendars', calendarRouter);
app.use('/api/calendars/ics', icsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/webhooks', webhooksRouter);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Validate OAuth configuration on startup
validateOAuthConfig();

// Start background jobs
backgroundJobs.startAll();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  backgroundJobs.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  backgroundJobs.stopAll();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
