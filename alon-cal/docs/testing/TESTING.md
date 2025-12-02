# Testing Guide

Comprehensive testing documentation for the Calendar Integration Application.

## Overview

This project includes comprehensive test coverage for both backend and frontend components:

- **Backend**: Jest with TypeScript
- **Frontend**: Vitest with React Testing Library
- **Coverage Target**: 80% minimum

## Directory Structure

```
backend/
  src/
    __tests__/
      setup.ts                    # Test configuration
      auth.test.ts                # Authentication tests
      validation.test.ts          # Input validation tests
      oauth.test.ts               # OAuth service tests
      helpers/
        mockPrisma.ts             # Prisma mock utilities
        testData.ts               # Test fixtures
      integration/                # API integration tests

frontend/
  src/
    __tests__/
      setup.ts                    # Test configuration
      components/                 # Component tests
        Button.test.tsx
      utils/                      # Utility tests
        validation.test.ts
      hooks/                      # Hook tests
      pages/                      # Page tests
      helpers/                    # Test utilities
```

## Running Tests

### Backend Tests

```bash
# Run all backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test auth.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Email Validation"
```

### Frontend Tests

```bash
# Run all frontend tests
cd frontend
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm test -- --ui

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test Button.test.tsx
```

## Test Configuration

### Backend (Jest)

Configuration: `backend/jest.config.js`

Key features:
- TypeScript support via ts-jest
- Node environment
- Coverage thresholds: 80% minimum
- Automatic mock clearing
- Custom setup file for environment variables

### Frontend (Vitest)

Configuration: `frontend/vitest.config.ts`

Key features:
- jsdom environment for DOM testing
- React Testing Library integration
- Coverage thresholds: 80% minimum
- Path aliases support
- Mock setup for browser APIs

## Writing Tests

### Backend Test Structure

```typescript
import { describe, it, expect } from '@jest/globals';
import { validateEmail } from '../utils/validation';

describe('Email Validation', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Frontend Component Test Structure

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/Button';

describe('Button Component', () => {
  it('should render with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Test Categories

### 1. Unit Tests

Test individual functions and utilities in isolation:

- **Validation**: Email, password, input sanitization
- **Encryption**: Token encryption/decryption
- **Authentication**: Password hashing, JWT generation
- **Utilities**: Helper functions, formatters

### 2. Component Tests

Test React components with React Testing Library:

- **Rendering**: Component renders correctly
- **User Interaction**: Clicks, form inputs
- **Props**: Different prop combinations
- **States**: Loading, error, success states
- **Events**: Event handlers fire correctly

### 3. Integration Tests

Test API endpoints and service interactions:

- **Auth API**: Signup, login, logout flows
- **Calendar API**: Fetch, connect, disconnect
- **OAuth Flow**: Complete authorization flow
- **Error Handling**: API error responses

### 4. Hook Tests

Test custom React hooks:

- **useAuth**: Authentication state management
- **useCalendars**: Calendar data fetching
- **useToast**: Toast notifications

## Test Utilities

### Backend Helpers

**Mock Prisma (`helpers/mockPrisma.ts`)**:
```typescript
import { prismaMock, createMockUser } from './__tests__/helpers/mockPrisma';

const mockUser = createMockUser({ email: 'test@example.com' });
prismaMock.user.findUnique.mockResolvedValue(mockUser);
```

**Test Data (`helpers/testData.ts`)**:
```typescript
import { validEmails, testUsers } from './__tests__/helpers/testData';

// Use pre-defined test data
validEmails.forEach(email => {
  expect(validateEmail(email)).toBe(true);
});
```

### Frontend Helpers

**Render with Providers**:
```typescript
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithProviders = (component) => {
  const queryClient = new QueryClient();
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>
  );
};
```

## Coverage Reports

Coverage reports are generated in:
- Backend: `backend/coverage/`
- Frontend: `frontend/coverage/`

### Viewing Coverage

```bash
# Backend HTML report
open backend/coverage/index.html

# Frontend HTML report
open frontend/coverage/index.html
```

### Coverage Thresholds

Both backend and frontend must maintain:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// Good
it('should reject passwords shorter than 8 characters', () => {});

// Bad
it('test password', () => {});
```

### 2. Arrange-Act-Assert (AAA) Pattern

```typescript
it('should create user successfully', async () => {
  // Arrange
  const userData = { email: 'test@example.com', password: 'Test123!' };
  
  // Act
  const result = await authService.signup(userData);
  
  // Assert
  expect(result.user.email).toBe(userData.email);
});
```

### 3. Test One Thing

Each test should verify one specific behavior:

```typescript
// Good - Tests one behavior
it('should validate email format', () => {
  expect(validateEmail('user@example.com')).toBe(true);
});

it('should reject empty email', () => {
  expect(validateEmail('')).toBe(false);
});

// Bad - Tests multiple behaviors
it('should validate email', () => {
  expect(validateEmail('user@example.com')).toBe(true);
  expect(validateEmail('')).toBe(false);
  expect(validateEmail('invalid')).toBe(false);
});
```

### 4. Mock External Dependencies

Always mock:
- Database calls (Prisma)
- External APIs (Google, Microsoft)
- File system operations
- Network requests

```typescript
import { prismaMock } from './__tests__/helpers/mockPrisma';

prismaMock.user.create.mockResolvedValue(mockUser);
```

### 5. Clean Up

Clean up after each test:

```typescript
import { afterEach } from '@jest/globals';

afterEach(() => {
  jest.clearAllMocks();
});
```

## Common Testing Patterns

### Testing Async Functions

```typescript
it('should hash password asynchronously', async () => {
  const password = 'TestPass123!';
  const hash = await hashPassword(password);
  expect(hash).not.toBe(password);
});
```

### Testing Error Handling

```typescript
it('should throw error for invalid input', () => {
  expect(() => decryptToken('invalid')).toThrow();
});

it('should handle async errors', async () => {
  await expect(authService.login('invalid', 'wrong')).rejects.toThrow();
});
```

### Testing React Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';

it('should login user', async () => {
  const { result } = renderHook(() => useAuth());
  
  await act(async () => {
    await result.current.login('user@example.com', 'Pass123!');
  });
  
  expect(result.current.isAuthenticated).toBe(true);
});
```

### Testing Forms

```typescript
import userEvent from '@testing-library/user-event';

it('should submit login form', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  
  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.type(screen.getByLabelText(/password/i), 'Pass123!');
  await user.click(screen.getByRole('button', { name: /login/i }));
  
  expect(screen.getByText(/welcome/i)).toBeInTheDocument();
});
```

## Continuous Integration

Tests run automatically on:
- Every push to repository
- Pull requests
- Before deployment

### CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: cd backend && npm install
      - name: Run tests
        run: cd backend && npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: cd frontend && npm install
      - name: Run tests
        run: cd frontend && npm test -- --coverage
```

## Debugging Tests

### Backend

```bash
# Run tests with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Run single test with verbose output
npm test -- --verbose auth.test.ts
```

### Frontend

```bash
# Run tests with Vitest UI
npm test -- --ui

# Debug specific test
npm test -- --reporter=verbose Button.test.tsx
```

## Troubleshooting

### Common Issues

**1. Module not found errors**
- Check import paths
- Verify tsconfig.json paths
- Ensure test files are in correct location

**2. Timeout errors**
- Increase test timeout in config
- Check for unresolved promises
- Verify async/await usage

**3. Mock not working**
- Ensure mocks are set up before imports
- Clear mocks between tests
- Check mock implementation

**4. Coverage not meeting threshold**
- Run coverage report to identify gaps
- Add tests for uncovered code
- Consider if some code should be excluded

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For questions or issues with tests:
1. Check this documentation
2. Review existing test examples
3. Check error messages carefully
4. Consult team members
5. Update documentation if you find gaps
