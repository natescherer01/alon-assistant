/**
 * Prisma Client Mock
 *
 * Mock implementation of Prisma client for testing
 * Uses jest-mock-extended for type-safe mocking
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create deep mock of Prisma client
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Export for use in tests
export default prismaMock;
