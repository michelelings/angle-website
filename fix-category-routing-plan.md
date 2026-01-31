# Plan: Fix Category Page Routing Issues

## Current Status
- ❌ `/health` returns 404
- ❌ `/api/og-image/category/health` returns 404
- ✅ Homepage works
- ✅ `/api/categories` should work (need to verify)

## Potential Issues

### Issue 1: File Path Resolution in Vercel
**Problem**: `process.cwd()` might not point to the project root in Vercel's serverless environment.

**Current Code**:
```typescript
const indexPath = join(process.cwd(), 'public', 'index.html');
```

**Solution**: Use `__dirname` or check multiple possible paths.

### Issue 2: Rewrite Pattern Not Matching
**Problem**: The rewrite pattern `/:category` might be too broad or not matching correctly.

**Current Config**:
```json
{ "source": "/:category", "destination": "/api/render/[category]" }
```

**Solution**: Make the pattern more specific or verify Vercel's rewrite behavior.

### Issue 3: Function Not Deployed
**Problem**: The serverless function might not be deployed or there's a build error.

**Solution**: Check Vercel deployment logs and ensure the function builds correctly.

### Issue 4: Query Parameter Extraction
**Problem**: Vercel might not be passing the category parameter correctly.

**Current Code**:
```typescript
const category = req.query.category as string;
```

**Solution**: Also check `req.url` or path parameters.

## Debugging Steps

### Step 1: Add Logging
Add comprehensive logging to understand what's happening:
- Log the incoming request URL
- Log extracted category
- Log file path being read
- Log errors with full stack traces

### Step 2: Test File Path Resolution
Try multiple path resolution strategies:
- `process.cwd() + '/public/index.html'`
- `__dirname + '/../../public/index.html'` (if using ESM)
- Check if file exists before reading

### Step 3: Verify Rewrite Works
Test if the rewrite is actually being triggered:
- Add a simple test endpoint that returns the request details
- Check if `/api/render/health` works directly (bypassing rewrite)

### Step 4: Check Vercel Function Logs
- Check Vercel dashboard for function logs
- Look for build errors
- Check runtime errors

## Implementation Plan - COMPLETED

### Fix 1: Improve File Path Resolution ✅
```typescript
// Try multiple possible paths
const possiblePaths = [
  join(process.cwd(), 'public', 'index.html'),
  join(__dirname, '..', '..', 'public', 'index.html'),
  join(process.cwd(), 'index.html'), // Fallback
];

let html = null;
for (const path of possiblePaths) {
  try {
    html = await readFile(path, 'utf-8');
    break;
  } catch (e) {
    console.log(`Failed to read ${path}:`, e.message);
  }
}

if (!html) {
  throw new Error('Could not find index.html');
}
```

### Fix 2: Extract Category from URL Directly ✅
```typescript
// Try multiple ways to get category
let category = req.query.category as string;

// If not in query, try extracting from URL
if (!category) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // If path is /api/render/health, category is the last part
  if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'render') {
    category = pathParts[2];
  }
}
```

### Fix 3: Add Better Error Handling ✅
```typescript
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Log request details
    console.log('Request URL:', req.url);
    console.log('Request query:', req.query);
    console.log('Request headers:', req.headers);
    
    // ... rest of code
    
  } catch (error) {
    console.error('Error rendering category page:', error);
    console.error('Stack:', error.stack);
    
    // Return error details in development
    if (process.env.NODE_ENV === 'development') {
      res.status(500).json({
        error: error.message,
        stack: error.stack,
        query: req.query,
        url: req.url,
      });
    } else {
      res.redirect(302, '/');
    }
  }
}
```

### Fix 4: Test Direct API Access
Create a test to verify the function works when accessed directly:
- `/api/render/health` (should work if function is deployed)
- If this works but `/health` doesn't, the issue is with the rewrite

### Fix 5: Alternative Approach - Use Edge Middleware
If serverless functions have issues, consider using Vercel Edge Middleware:
- Runs at the edge (faster)
- Can modify responses before they're sent
- Better for simple HTML manipulation

## Testing Checklist

- [ ] Test `/api/render/health` directly (bypass rewrite)
- [ ] Check Vercel function logs for errors
- [ ] Verify file paths work in Vercel environment
- [ ] Test with a known valid category
- [ ] Test with invalid category (should redirect)
- [ ] Verify OG image endpoint works
- [ ] Check if categories API returns valid data

## Fixes Applied ✅

1. ✅ **Fixed file path resolution** - Added multiple fallback paths and `__dirname` support for ESM
2. ✅ **Added better error logging** - Comprehensive logging for debugging
3. ✅ **Improved category extraction** - Extract from URL path if not in query params
4. ✅ **Fixed category matching** - Handle case-insensitive matching and URL slug conversion
5. ✅ **Better error handling** - Return error details in development, redirect in production

## Next Steps

1. **Deploy the fixes** - Push the updated `api/render/[category].ts` file
2. **Test the deployment** - Check if `/health` works after deployment
3. **Verify OG images** - Test `/api/og-image/category/health` endpoint
4. **Check Vercel logs** - If still not working, check function logs for specific errors

## Known Issues to Address

- **Category name mapping**: API returns "Health" but URL uses "health" - need to verify how categories are stored/used
- **URL slug format**: Categories like "Business & Economy" need proper slug conversion (e.g., "business-economy")
