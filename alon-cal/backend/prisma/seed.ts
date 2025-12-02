/**
 * Prisma Database Seeder
 *
 * This script populates the database with initial test data for development.
 * Run with: npx prisma db seed
 *
 * Configure in package.json:
 * "prisma": {
 *   "seed": "ts-node prisma/seed.ts"
 * }
 */

import { PrismaClient, CalendarProvider, AuditStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clean existing data (development only!)
  if (process.env.NODE_ENV === 'development') {
    console.log('Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.calendarConnection.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create test users
  console.log('Creating test users...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const user1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane.smith@example.com',
      passwordHash,
      firstName: 'Jane',
      lastName: 'Smith',
    },
  });

  console.log(`Created users: ${user1.email}, ${user2.email}`);

  // Create test calendar connections
  console.log('Creating test calendar connections...');

  const googleConnection = await prisma.calendarConnection.create({
    data: {
      userId: user1.id,
      provider: CalendarProvider.GOOGLE,
      calendarId: 'primary',
      calendarName: 'John\'s Calendar',
      accessToken: 'encrypted_test_access_token',
      refreshToken: 'encrypted_test_refresh_token',
      tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      calendarColor: '#4285F4',
      isPrimary: true,
      isConnected: true,
      lastSyncedAt: new Date(),
    },
  });

  const microsoftConnection = await prisma.calendarConnection.create({
    data: {
      userId: user2.id,
      provider: CalendarProvider.MICROSOFT,
      calendarId: 'AAMkAGI2THVSAAA=',
      calendarName: 'Jane\'s Work Calendar',
      accessToken: 'encrypted_test_access_token',
      refreshToken: 'encrypted_test_refresh_token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      calendarColor: '#0078D4',
      isPrimary: true,
      isConnected: true,
      lastSyncedAt: new Date(),
    },
  });

  console.log('Created calendar connections for test users');

  // Create audit log entries
  console.log('Creating audit log entries...');

  await prisma.auditLog.createMany({
    data: [
      {
        userId: user1.id,
        action: 'USER_CREATED',
        resourceType: 'user',
        resourceId: user1.id,
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
      {
        userId: user1.id,
        action: 'OAUTH_CONNECT_GOOGLE',
        resourceType: 'calendar_connection',
        resourceId: googleConnection.id,
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
      {
        userId: user2.id,
        action: 'USER_CREATED',
        resourceType: 'user',
        resourceId: user2.id,
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
      {
        userId: user2.id,
        action: 'OAUTH_CONNECT_MICROSOFT',
        resourceType: 'calendar_connection',
        resourceId: microsoftConnection.id,
        status: AuditStatus.SUCCESS,
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
    ],
  });

  console.log('Audit log entries created');

  // Display summary
  const userCount = await prisma.user.count();
  const connectionCount = await prisma.calendarConnection.count();
  const auditCount = await prisma.auditLog.count();

  console.log('\n=== Seed Summary ===');
  console.log(`Users created: ${userCount}`);
  console.log(`Calendar connections: ${connectionCount}`);
  console.log(`Audit log entries: ${auditCount}`);
  console.log('\nTest credentials:');
  console.log('  Email: john.doe@example.com');
  console.log('  Password: Password123!');
  console.log('  Email: jane.smith@example.com');
  console.log('  Password: Password123!');
  console.log('===================\n');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
