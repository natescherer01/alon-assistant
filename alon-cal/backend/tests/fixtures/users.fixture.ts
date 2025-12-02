/**
 * User Test Fixtures
 *
 * Sample user data for testing
 */

import { User } from '@prisma/client';

export const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  deletedAt: null,
};

export const mockUsers = {
  user1: mockUser,
  user2: {
    ...mockUser,
    id: '223e4567-e89b-12d3-a456-426614174000',
    email: 'test2@example.com',
    firstName: 'Test2',
    lastName: 'User2',
  },
  deletedUser: {
    ...mockUser,
    id: '323e4567-e89b-12d3-a456-426614174000',
    email: 'deleted@example.com',
    deletedAt: new Date('2024-01-15T00:00:00Z'),
  },
};
