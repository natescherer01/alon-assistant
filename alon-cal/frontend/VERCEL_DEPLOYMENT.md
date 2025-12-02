# Vercel Deployment Guide

Complete guide for deploying the frontend to Vercel.

## Quick Start

1. Create Vercel account
2. Import GitHub repository
3. Configure build settings
4. Set environment variables
5. Deploy automatically

## Prerequisites

- GitHub account with repository
- Vercel account (free tier available)
- Backend deployed to Railway

## Setup Instructions

### 1. Import Project to Vercel

**Via Vercel Dashboard:**

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Select your GitHub repository
5. Configure import settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

**Via Vercel CLI:**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from frontend directory
cd frontend
vercel
```

### 2. Configure Build Settings

Vercel uses `vercel.json` for configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite"
}
```

**Build Process:**

1. Install dependencies
2. Run `npm run build`
3. Build Vite application
4. Deploy `dist` folder to CDN

### 3. Environment Variables

**Required Variables:**

```bash
VITE_API_URL=https://your-backend.railway.app
```

**Add Variables via Dashboard:**

1. Go to your project
2. Navigate to Settings → Environment Variables
3. Add variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://your-backend.railway.app`
   - **Environment**: Production, Preview, Development

**Add Variables via CLI:**

```bash
vercel env add VITE_API_URL production
# Enter value when prompted: https://your-backend.railway.app

vercel env add VITE_API_URL preview
vercel env add VITE_API_URL development
```

**Important Notes:**

- Environment variables prefixed with `VITE_` are embedded in the client bundle
- Never store secrets in frontend environment variables
- Backend URL must be accessible from browsers (CORS enabled)

### 4. Deploy Application

**Automatic Deployment:**

Vercel automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

**Manual Deployment:**

```bash
# Via Vercel CLI
cd frontend
vercel --prod

# Or via Dashboard
# Project → Deployments → Redeploy
```

**Deployment Process:**

1. Vercel clones repository
2. Installs dependencies
3. Builds application
4. Optimizes assets
5. Deploys to global CDN
6. Invalidates cache

### 5. Configure Custom Domain

**Add Custom Domain:**

1. In Vercel project → Settings → Domains
2. Click "Add"
3. Enter your domain (e.g., `app.yourdomain.com` or `yourdomain.com`)
4. Vercel will show DNS instructions

**DNS Configuration:**

**For subdomain (e.g., app.yourdomain.com):**

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600
```

**For apex domain (e.g., yourdomain.com):**

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600

Type: AAAA (optional IPv6)
Name: @
Value: 2606:4700:4700::1111
TTL: 3600
```

Or use ALIAS/ANAME record if your DNS provider supports it:
```
Type: ALIAS or ANAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

**SSL Certificate:**

Vercel automatically provisions SSL certificates via Let's Encrypt. No configuration needed.

**Verify Domain:**

1. Add DNS records
2. Wait for DNS propagation (5-60 minutes)
3. Vercel will verify and issue SSL certificate
4. Domain status changes to "Valid"

**Update Backend CORS:**

After adding custom domain, update Railway environment variables:

```bash
FRONTEND_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

### 6. Verify Deployment

**Check Deployment:**

```bash
# Via CLI
vercel ls

# View deployment URL
vercel inspect <deployment-url>
```

**Test Application:**

1. Visit your Vercel URL
2. Verify application loads
3. Test login functionality
4. Test OAuth flows
5. Check browser console for errors

**Check Build Logs:**

```bash
# Via CLI
vercel logs <deployment-url>

# Via Dashboard
# Project → Deployments → Click deployment → Build Logs
```

## Advanced Configuration

### Performance Optimization

**Enable Compression:**

Vercel automatically compresses responses with Brotli and Gzip.

**Asset Caching:**

In `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Image Optimization:**

Use Vercel Image Optimization:

```tsx
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
/>
```

Note: This requires Next.js. For Vite, use manual optimization.

### Security Headers

Add security headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### Redirects and Rewrites

**Redirect www to non-www:**

```json
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [
        {
          "type": "host",
          "value": "www.yourdomain.com"
        }
      ],
      "destination": "https://yourdomain.com/:path*",
      "permanent": true
    }
  ]
}
```

**API Proxy (optional):**

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.railway.app/api/:path*"
    }
  ]
}
```

### SPA Routing

Handle client-side routing in `vercel.json`:

```json
{
  "routes": [
    {
      "src": "/[^.]+",
      "dest": "/",
      "status": 200
    }
  ]
}
```

## Preview Deployments

### Automatic Preview Deployments

Vercel creates preview deployments for:
- Pull requests
- Non-production branches

**Benefits:**

- Test changes before merging
- Share previews with team
- Automated testing
- Zero configuration

**Preview URL Format:**

```
https://project-name-git-branch-username.vercel.app
```

### Environment Variables for Previews

Set different API URLs for preview deployments:

1. Settings → Environment Variables
2. Add variable
3. Select "Preview" environment
4. Value: `https://staging-backend.railway.app`

### Comment on Pull Requests

Vercel automatically comments on PRs with:
- Preview URL
- Build status
- Deployment logs

## Monitoring and Analytics

### Vercel Analytics

**Enable Analytics:**

1. Project → Analytics
2. Enable Web Analytics
3. Vercel tracks:
   - Page views
   - Unique visitors
   - Top pages
   - Geographic distribution

**Add to Application:**

```bash
npm install @vercel/analytics
```

```tsx
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
```

### Speed Insights

**Enable Speed Insights:**

1. Project → Speed Insights
2. Enable feature
3. Monitor:
   - Core Web Vitals
   - Performance scores
   - Real user metrics

```bash
npm install @vercel/speed-insights
```

```tsx
import { SpeedInsights } from '@vercel/speed-insights/react';

function App() {
  return (
    <>
      <YourApp />
      <SpeedInsights />
    </>
  );
}
```

### Logs and Monitoring

**View Logs:**

```bash
# Via CLI
vercel logs <deployment-url>

# Follow logs
vercel logs <deployment-url> --follow
```

**Via Dashboard:**

1. Project → Deployments
2. Click deployment
3. View "Function Logs" (for serverless functions)
4. View "Build Logs"

## CI/CD Integration

### GitHub Integration

**Automatic Deployments:**

Vercel deploys automatically on:
- Push to `main` → Production
- Push to other branches → Preview
- Pull requests → Preview

**Configure Git Integration:**

1. Project → Settings → Git
2. Configure:
   - Production Branch: `main`
   - Auto-deploy: Enabled
   - Comments on PRs: Enabled

### Custom CI/CD

**GitHub Actions:**

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel Environment
        working-directory: ./frontend
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        working-directory: ./frontend
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        working-directory: ./frontend
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

**Get Vercel Token:**

1. Account Settings → Tokens
2. Create new token
3. Add to GitHub Secrets: `VERCEL_TOKEN`

## Troubleshooting

### Build Failures

**Check Build Logs:**

1. Deployments → Failed deployment → Build Logs

**Common Issues:**

1. **Missing dependencies**
   ```bash
   # Ensure package-lock.json is committed
   git add package-lock.json
   git commit -m "Add package-lock.json"
   ```

2. **TypeScript errors**
   ```bash
   # Check locally first
   npm run build
   ```

3. **Environment variable not set**
   ```bash
   # Verify in Settings → Environment Variables
   vercel env ls
   ```

4. **Node version mismatch**

   Add to `package.json`:
   ```json
   {
     "engines": {
       "node": "18.x"
     }
   }
   ```

### Runtime Errors

**Application Not Loading:**

Check browser console for errors:
- Network errors → Check API URL
- CORS errors → Verify backend CORS_ORIGIN
- 404 errors → Check routing configuration

**API Calls Failing:**

1. Verify `VITE_API_URL` is correct
2. Check backend is accessible
3. Verify CORS headers present:
   ```bash
   curl -I https://your-backend.railway.app/api/health
   ```

**Environment Variables Not Working:**

- Variables must start with `VITE_`
- Redeploy after adding/changing variables
- Check "Preview" environment has correct values

### Performance Issues

**Slow Page Load:**

1. Enable compression (automatic)
2. Optimize images
3. Use code splitting
4. Check Speed Insights

**Large Bundle Size:**

```bash
# Analyze bundle
npm run build -- --analyze

# Use dynamic imports
const Component = lazy(() => import('./Component'));
```

## Cost Management

### Free Tier Limits

Vercel Free (Hobby) includes:
- Unlimited personal projects
- Automatic HTTPS
- 100GB bandwidth/month
- 100 deployments/day
- 1 concurrent build

### Pro Plan ($20/mo per member)

- Commercial projects
- 1TB bandwidth/month
- Unlimited deployments
- 10 concurrent builds
- Advanced analytics
- Priority support

### Tips to Reduce Costs

1. **Optimize images** to reduce bandwidth
2. **Enable caching** for static assets
3. **Remove unused code** to reduce build time
4. **Use Preview deployments** sparingly for large projects

## Best Practices

1. **Environment Variables**: Use different values for preview/production
2. **Branch Protection**: Require reviews before merging to main
3. **Preview Deployments**: Test all changes in preview before production
4. **Custom Domain**: Use for production (better SEO and branding)
5. **Analytics**: Monitor usage and performance
6. **Security Headers**: Implement comprehensive security headers
7. **Error Boundaries**: Handle React errors gracefully
8. **Loading States**: Improve perceived performance
9. **Code Splitting**: Reduce initial bundle size
10. **Asset Optimization**: Compress images and use modern formats

## Next Steps

After successful deployment:

1. Configure custom domain
2. Enable Vercel Analytics
3. Set up Speed Insights
4. Configure security headers
5. Test all features
6. Set up monitoring alerts
7. Configure preview environments
8. Document deployment process

## Support

### Vercel Resources

- Docs: https://vercel.com/docs
- Status: https://www.vercel-status.com
- Discord: https://vercel.com/discord
- GitHub: https://github.com/vercel/vercel

### Useful Commands

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# List deployments
vercel ls

# View logs
vercel logs <url>

# Remove deployment
vercel remove <deployment-id>

# Inspect deployment
vercel inspect <url>

# List environment variables
vercel env ls

# Add environment variable
vercel env add

# Open dashboard
vercel
```

## Additional Features

### Edge Functions

Create API routes with Edge Functions:

```typescript
// api/hello.ts
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  return new Response('Hello from Edge!');
}
```

### Middleware

Add middleware for auth, redirects, etc:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add custom logic
  return NextResponse.next();
}
```

Note: Middleware requires Next.js framework.

### Incremental Static Regeneration (ISR)

For Next.js projects, use ISR for optimal performance:

```typescript
export async function getStaticProps() {
  return {
    props: { data },
    revalidate: 60, // Regenerate every 60 seconds
  };
}
```

## Conclusion

Vercel provides:
- Zero-configuration deployments
- Automatic HTTPS and SSL
- Global CDN
- Preview deployments
- Built-in analytics
- Excellent DX

Follow this guide for successful frontend deployment!
