# Authentication UI - Quick Start Guide

## What Was Built

Complete authentication system with:
- Login page (`/login`)
- Signup page (`/signup`)
- Protected routes
- Reusable UI components
- Form validation
- Error handling
- Loading states
- Responsive design
- Accessibility features

## Files Created (14 new files + 5 updated)

### New Components
1. `src/components/Button.tsx` - Reusable button with loading states
2. `src/components/Input.tsx` - Form input with validation
3. `src/components/ErrorMessage.tsx` - Error display component
4. `src/components/PasswordStrength.tsx` - Password strength indicator
5. `src/components/ProtectedRoute.tsx` - Auth-protected route wrapper

### New Pages
6. `src/pages/LoginPage.tsx` - Login form and logic
7. `src/pages/SignupPage.tsx` - Signup form and logic

### New API & Utils
8. `src/api/auth.ts` - Authentication API functions
9. `src/utils/validation.ts` - Form validation utilities

### Updated Files
10. `src/hooks/useAuth.ts` - Enhanced Zustand auth store
11. `src/lib/api.ts` - Improved error handling
12. `src/types/index.ts` - Updated User interface
13. `src/pages/HomePage.tsx` - Auto-redirect logic
14. `src/App.tsx` - Complete routing setup

## How to Test

### 1. Start the Application

```bash
# Terminal 1 - Backend
cd /Users/natescherer/alon-cal/backend
npm run dev

# Terminal 2 - Frontend
cd /Users/natescherer/alon-cal/frontend
npm run dev
```

### 2. Open Browser
Navigate to: `http://localhost:5173`

### 3. Test Signup Flow

1. Click "Get Started" or navigate to `/signup`
2. Fill in the form:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john.doe@example.com`
   - Password: `Test123!@#`
   - Confirm Password: `Test123!@#`
   - Check "Accept terms"
3. Click "Create account"
4. Should redirect to `/dashboard`
5. Verify user info displays in header

### 4. Test Login Flow

1. Logout from dashboard
2. Navigate to `/login`
3. Enter credentials:
   - Email: `john.doe@example.com`
   - Password: `Test123!@#`
4. Click "Sign in"
5. Should redirect to `/dashboard`

### 5. Test Protected Routes

1. Logout
2. Try accessing `/dashboard` directly
3. Should redirect to `/login`
4. Login again
5. Should redirect back to `/dashboard`

### 6. Test Validation

**On Signup:**
- Empty email → "Email is required"
- Invalid email → "Please enter a valid email address"
- Weak password → Red strength indicator
- Mismatched passwords → "Passwords do not match"
- Unchecked terms → "You must accept the terms"

**On Login:**
- Empty fields → Validation errors
- Wrong credentials → Backend error message

## Key Features

### Password Strength Indicator
Type in password field on signup to see:
- Red (Weak): < 40% requirements met
- Yellow (Medium): 40-80% requirements met
- Green (Strong): > 80% requirements met

Requirements:
- At least 8 characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

### Show/Hide Password
Click checkbox below password fields to toggle visibility

### Auto-redirect
- When authenticated → Redirects to `/dashboard`
- When not authenticated → Redirects to `/login`
- After login → Redirects to intended page or `/dashboard`

### Loading States
- Buttons show spinner during API calls
- Form prevents double submissions
- Protected routes show loading screen

### Error Handling
- Backend errors displayed in red alert box
- Validation errors show below fields
- Network errors handled gracefully

## Component Usage Examples

### Button Component
```typescript
import { Button } from '../components/Button';

<Button variant="primary" isLoading={loading} fullWidth>
  Sign in
</Button>
```

### Input Component
```typescript
import { Input } from '../components/Input';

<Input
  label="Email address"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  required
/>
```

### ErrorMessage Component
```typescript
import { ErrorMessage } from '../components/ErrorMessage';

{error && (
  <ErrorMessage
    message={error}
    onClose={() => clearError()}
  />
)}
```

### PasswordStrength Component
```typescript
import { PasswordStrength } from '../components/PasswordStrength';

<PasswordStrength password={password} showRequirements={true} />
```

### ProtectedRoute Component
```typescript
import { ProtectedRoute } from '../components/ProtectedRoute';

<Route path="/dashboard" element={
  <ProtectedRoute>
    <DashboardPage />
  </ProtectedRoute>
} />
```

## API Integration

### useAuth Hook
```typescript
import { useAuth } from '../hooks/useAuth';

const {
  user,           // Current user or null
  isAuthenticated, // Boolean
  isLoading,      // Boolean
  error,          // Error message or null
  login,          // (email, password) => Promise<void>
  signup,         // (email, password, firstName?, lastName?) => Promise<void>
  logout,         // () => Promise<void>
  checkAuth,      // () => Promise<void>
  clearError      // () => void
} = useAuth();
```

### Example: Login
```typescript
const handleLogin = async () => {
  try {
    await login(email, password);
    // Automatically redirects to dashboard
  } catch (err) {
    // Error is stored in useAuth state
    console.error('Login failed:', err);
  }
};
```

### Example: Signup
```typescript
const handleSignup = async () => {
  try {
    await signup(email, password, firstName, lastName);
    // Automatically redirects to dashboard
  } catch (err) {
    // Error is stored in useAuth state
    console.error('Signup failed:', err);
  }
};
```

### Example: Logout
```typescript
const handleLogout = async () => {
  await logout();
  navigate('/login');
};
```

## Validation Utilities

```typescript
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePasswordMatch
} from '../utils/validation';

// Email
const isValid = validateEmail('test@example.com'); // true

// Password
const { valid, errors } = validatePassword('Test123!@#');
// { valid: true, errors: [] }

// Name
const isValid = validateName('John'); // true

// Password Match
const match = validatePasswordMatch('Test123!@#', 'Test123!@#'); // true
```

## Troubleshooting

### "Network Error" on login
**Problem**: Backend not running or wrong URL
**Solution**:
1. Check backend is running: `http://localhost:3001/api/health`
2. Verify `VITE_API_URL` in `.env`

### TypeScript errors
**Problem**: Type mismatches
**Solution**: Run `npm run build` to check all types

### Styles not working
**Problem**: Tailwind not configured
**Solution**: Restart dev server: `npm run dev`

### Can't access dashboard
**Problem**: Not authenticated
**Solution**: Login first, then navigate to `/dashboard`

### Infinite redirect loop
**Problem**: Auth state inconsistency
**Solution**:
1. Clear localStorage
2. Clear cookies
3. Refresh page

## Design System

### Colors
- Primary: `bg-blue-600` (#3B82F6)
- Error: `bg-red-600` (#EF4444)
- Success: `bg-green-600` (#10B981)
- Warning: `bg-yellow-500` (#F59E0B)

### Button Variants
- `primary` - Blue background, white text
- `secondary` - Gray background, dark text
- `danger` - Red background, white text

### Spacing
- Form fields: `space-y-6`
- Components: `p-4`, `p-6`, `p-8`
- Margins: `mb-4`, `mb-6`, `mb-8`

### Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Next Steps

After testing authentication:

1. **Customize Styling**: Update colors in components to match brand
2. **Add Features**: Implement forgot password, email verification
3. **Extend Protected Routes**: Add more protected pages
4. **Add Middleware**: Add analytics, error tracking
5. **Configure OAuth**: Add Google/Microsoft login buttons

## Common Use Cases

### Add a new protected page
```typescript
// 1. Create page component
// src/pages/SettingsPage.tsx
export default function SettingsPage() {
  const { user } = useAuth();
  return <div>Settings for {user?.name}</div>;
}

// 2. Add route in App.tsx
<Route path="/settings" element={
  <ProtectedRoute>
    <SettingsPage />
  </ProtectedRoute>
} />
```

### Get current user anywhere
```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user } = useAuth();

  return <div>Hello {user?.name}!</div>;
}
```

### Check if user is logged in
```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome back!</p>
      ) : (
        <Link to="/login">Please login</Link>
      )}
    </div>
  );
}
```

### Display loading state
```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <div>Content</div>;
}
```

## Documentation

For more details, see:
- `AUTHENTICATION.md` - Complete implementation guide
- `AUTH_IMPLEMENTATION_SUMMARY.md` - Technical summary
- Component source files - Inline JSDoc comments

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify backend is running and accessible
3. Check network tab for API calls
4. Review component source code
5. Test with different browsers

## Success!

Your authentication UI is complete and production-ready. All core features are implemented:

- ✅ User signup and login
- ✅ Protected routes
- ✅ Form validation
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design
- ✅ Accessibility
- ✅ TypeScript support

Happy coding!
