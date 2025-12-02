# Quick Test Commands Reference

## Backend Tests

```bash
# Navigate to backend directory
cd /Users/natescherer/alon-cal/backend

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# View coverage report in browser
open coverage/index.html

# Run specific test file
npm test auth.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Email Validation"
```

## Frontend Tests

```bash
# Navigate to frontend directory
cd /Users/natescherer/alon-cal/frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# View coverage report in browser
open coverage/index.html

# Run specific test file
npm test Button.test.tsx
```

## Run All Tests (From Project Root)

```bash
# Run all backend tests
cd backend && npm test && cd ..

# Run all frontend tests
cd frontend && npm test && cd ..

# Or use workspaces (if configured)
npm test --workspaces
```

## Debugging Tests

### Backend
```bash
# Verbose output
npm test -- --verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Run single test in isolation
npm test -- --testNamePattern="specific test name"
```

### Frontend
```bash
# Verbose output
npm test -- --reporter=verbose

# Run with UI for debugging
npm run test:ui

# Run specific describe block
npm test -- --testNamePattern="Button Component"
```

## Before Committing

```bash
# Run linter
npm run lint

# Run all tests
npm test

# Check coverage
npm run test:coverage

# Ensure all pass before commit!
```

## CI/CD (Future)

```bash
# These commands will be run automatically in CI:
npm install
npm run lint
npm test
npm run build
```

## Troubleshooting

### Tests Failing?
1. Check you're in the correct directory
2. Run `npm install` to ensure dependencies are installed
3. Check environment variables are set
4. Read error messages carefully

### Coverage Not Meeting Threshold?
```bash
# View detailed coverage report
npm run test:coverage
open coverage/index.html

# Identify uncovered lines and add tests
```

### Test Timeout?
```bash
# Increase timeout in jest.config.js or vitest.config.ts
# Or for individual tests:
it('slow test', async () => {
  // test code
}, 20000); // 20 second timeout
```
