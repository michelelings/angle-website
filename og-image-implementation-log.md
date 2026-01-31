# OG Image and Category Routing Implementation Log

## Overview
This document details the complete implementation of server-side OG image generation and category page routing, including all mistakes encountered and how they were resolved.

## Original Problem

### Issues Identified
1. **Category pages (e.g., `/health`) showed wrong OG tags**
   - Static HTML had homepage meta tags
   - Client-side JavaScript updated them, but bots don't execute JS
   - Result: Bots saw homepage OG tags instead of category-specific ones

2. **OG images for category pages didn't work**
   - Endpoint existed: `/api/og-image/category/[category]`
   - Meta tags in static HTML pointed to `/api/og-image` (homepage)
   - Client-side updates weren't seen by bots

3. **Homepage OG image didn't work**
   - Endpoint `/api/og-image` was returning errors

## Initial Solution Design

### Approach: Server-Side HTML Injection
Created a serverless function that:
1. Intercepts category page requests
2. Validates the category exists
3. Reads `index.html` and injects category-specific meta tags server-side
4. Returns modified HTML so bots see correct tags

### Files Created/Modified
1. **`/api/render/[category].ts`** - New serverless function for category page rendering
2. **`vercel.json`** - Added rewrite rule: `/:category` → `/api/render/[category]`
3. **`dev-server.js`** - Updated for local testing support

## Implementation Timeline

### Phase 1: Initial Implementation ✅
**Files Created:**
- `api/render/[category].ts` - Basic implementation with:
  - Category extraction from query params
  - Category validation
  - HTML meta tag replacement
  - File reading from `public/index.html`

**Mistake #1: File Path Resolution**
- **Problem**: Used only `process.cwd()` which might not work in Vercel's serverless environment
- **Error**: Function couldn't find `index.html` file
- **Fix**: Added multiple fallback paths:
  ```typescript
  const possiblePaths = [
    join(process.cwd(), 'public', 'index.html'),
    join(__dirname, '..', '..', 'public', 'index.html'),
    join(process.cwd(), 'index.html'),
  ];
  ```
- **Also Fixed**: Added `__dirname` support for ESM modules using `fileURLToPath` and `dirname`

**Mistake #2: Category Extraction**
- **Problem**: Only checked `req.query.category`, but Vercel rewrites might not pass it correctly
- **Fix**: Added URL path parsing as fallback:
  ```typescript
  if (!category && req.url) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'render') {
      category = pathParts[2];
    } else if (pathParts.length === 1) {
      category = pathParts[0];
    }
  }
  ```

**Mistake #3: Category Name Matching**
- **Problem**: API returns "Health" (capitalized) but URL uses "health" (lowercase)
- **Fix**: Implemented case-insensitive matching with slug conversion:
  ```typescript
  const slugToCategory = (slug: string): string | null => {
    // Try exact match first (case-insensitive)
    const exactMatch = categories.find(c => c.toLowerCase() === slug.toLowerCase());
    if (exactMatch) return exactMatch;
    
    // Try slug match (handles "business-economy" -> "Business & Economy")
    const slugMatch = categories.find(c => categoryToSlug(c) === slug.toLowerCase());
    if (slugMatch) return slugMatch;
    
    // Try partial match
    const normalizedSlug = slug.toLowerCase().replace(/-/g, '');
    const partialMatch = categories.find(c => 
      c.toLowerCase().replace(/\s+/g, '').replace(/[&]/g, '').replace(/[^a-z0-9]/g, '') === normalizedSlug
    );
    if (partialMatch) return partialMatch;
    
    return null;
  };
  ```

### Phase 2: Build Errors ❌ → ✅

**Mistake #4: TypeScript JSX Configuration**
- **Error**: 
  ```
  api/og-image/category/[category].tsx(42,11): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  api/og-image/category/[category].tsx(42,11): error TS17004: Cannot use JSX unless the '--jsx' flag is provided.
  ```
- **Problem**: `tsconfig.json` didn't have JSX support configured
- **Fix**: Updated `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "jsx": "react-jsx",
      ...
    },
    "include": ["api/**/*.ts", "api/**/*.tsx", "lib/**/*.ts"]
  }
  ```

**Mistake #5: Duplicate Variable Declaration**
- **Error**: 
  ```
  api/render/[category].ts(79,11): error TS2451: Cannot redeclare block-scoped variable 'categorySlug'.
  api/render/[category].ts(132,11): error TS2451: Cannot redeclare block-scoped variable 'categorySlug'.
  ```
- **Problem**: `categorySlug` was declared twice in the same scope
- **Fix**: Removed the duplicate declaration, reused the variable from earlier in the function

**Mistake #6: Edge Function Runtime Issues**
- **Error**: 
  ```
  The Edge Function "api/og-image/[id]" is referencing unsupported modules:
  - @vercel/og, ../../lib/supabase.js
  ```
- **Problem**: Edge Functions can't import Node.js modules like Supabase client
- **Initial Fix Attempt**: Changed all OG image functions to `runtime: 'nodejs20.x'`
- **Mistake #6a**: Invalid runtime value
  - **Error**: `unsupported "runtime" value in config: "nodejs20.x" (must be one of: ["edge","experimental-edge","nodejs"])`
  - **Fix**: Changed to `runtime: 'nodejs'`

**Mistake #7: Edge Function JSX Runtime**
- **Error**: 
  ```
  The Edge Function "api/og-image" is referencing unsupported modules:
  - react/jsx-runtime
  ```
- **Problem**: Edge Functions don't support `react/jsx-runtime` which `@vercel/og` uses
- **Fix**: Changed homepage OG image function to Node.js runtime as well

### Phase 3: Runtime API Mismatch ❌ → ✅

**Mistake #8: Wrong API for Node.js Runtime**
- **Problem**: OG image functions were using Edge API (`Request`/`Response`) but configured for Node.js runtime
- **Error**: Functions returned 500 errors
- **Fix**: Converted all OG image functions to use Vercel's Node.js API:

**Before (Edge API):**
```typescript
export default async function handler(req: Request): Promise<Response> {
  return new ImageResponse(...);
}
```

**After (Node.js API):**
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const imageResponse = new ImageResponse(...);
  const buffer = await imageResponse.arrayBuffer();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).end(Buffer.from(buffer));
}
```

**Key Changes:**
1. Changed function signature to use `VercelRequest` and `VercelResponse`
2. Convert `ImageResponse` to `ArrayBuffer`, then to `Buffer`
3. Use `res.setHeader()` and `res.status().end()` instead of returning `Response`
4. Handle errors with `res.status().json()` instead of returning error `Response`

## Final Working Solution

### File Structure
```
api/
├── og-image.tsx                    # Homepage OG image (Node.js runtime)
├── og-image/
│   ├── [id].tsx                    # Episode OG image (Node.js runtime)
│   └── category/
│       └── [category].tsx          # Category OG image (Node.js runtime)
└── render/
    └── [category].ts               # Category page HTML renderer (Node.js runtime)
```

### Runtime Configuration
- **All OG image functions**: `runtime: 'nodejs'` (required for Supabase imports and JSX)
- **Render function**: `runtime: 'nodejs'` (default, uses Vercel Node.js API)

### Key Implementation Details

#### 1. Category Page Rendering (`api/render/[category].ts`)
- Extracts category from query params or URL path
- Validates category exists (case-insensitive matching)
- Reads `index.html` with multiple fallback paths
- Injects category-specific meta tags:
  - `og:title`: "{Category} Stories | Angle"
  - `og:description`: "{Category} stories worth listening."
  - `og:image`: "/api/og-image/category/{category}"
  - `og:url`: "https://newsangle.co/{category}"
- Returns modified HTML

#### 2. OG Image Generation
All three OG image functions follow the same pattern:
- Use Node.js runtime (required for Supabase and JSX)
- Use Vercel Node.js API (`VercelRequest`/`VercelResponse`)
- Convert `ImageResponse` to buffer before sending
- Set proper headers (Content-Type, Cache-Control)

#### 3. Vercel Configuration (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/sitemap.xml", "destination": "/api/sitemap" },
    { "source": "/api/episodes/(.*)", "destination": "/api/episodes/[id]" },
    { "source": "/episode/:id", "destination": "/index.html" },
    { "source": "/:category", "destination": "/api/render/[category]" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `/:category` rewrite must come before the catch-all `/(.*)` rule.

## Lessons Learned

### 1. Edge vs Node.js Runtime
- **Edge Functions**: Faster, but limited - can't use Node.js modules, no `react/jsx-runtime`
- **Node.js Functions**: Slower, but full Node.js API access, can use Supabase, supports JSX
- **Decision**: Use Node.js runtime for all OG image functions because:
  - They need Supabase client (Node.js module)
  - They use JSX (requires `react/jsx-runtime`)
  - `@vercel/og` works with both, but JSX requires Node.js runtime

### 2. API Compatibility
- Edge Functions use Web API: `Request`/`Response`
- Node.js Functions use Vercel API: `VercelRequest`/`VercelResponse`
- **Critical**: Must match runtime with correct API, can't mix them

### 3. File Path Resolution
- `process.cwd()` might not point to project root in serverless
- Always provide multiple fallback paths
- Use `__dirname` for relative paths (with ESM `fileURLToPath` helper)

### 4. Category Matching
- API returns display names ("Health", "Business & Economy")
- URLs use slugs ("health", "business-economy")
- Need robust matching that handles:
  - Case differences
  - Spaces vs hyphens
  - Special characters (&, etc.)

### 5. TypeScript Configuration
- Must include JSX support for `.tsx` files
- Must include `.tsx` files in `include` array
- Use `"jsx": "react-jsx"` for modern JSX transform

## Testing Checklist

- [x] Homepage OG image works (`/api/og-image`)
- [x] Category pages work (`/health` shows correct meta tags)
- [x] Category OG images work (`/api/og-image/category/health`)
- [x] Episode OG images work (`/api/og-image/[id]`)
- [x] Invalid categories redirect to home
- [x] Build succeeds without errors
- [x] All functions use correct runtime and API

## Current Status

✅ **All issues resolved:**
1. Homepage OG image works
2. Category pages work with correct meta tags
3. Category OG images work
4. Build succeeds
5. All functions use correct runtime and API

## Files Modified

1. `api/og-image.tsx` - Changed to Node.js runtime, Vercel API
2. `api/og-image/[id].tsx` - Changed to Node.js runtime, Vercel API
3. `api/og-image/category/[category].tsx` - Changed to Node.js runtime, Vercel API
4. `api/render/[category].ts` - New file, category page renderer
5. `vercel.json` - Added category rewrite rule
6. `tsconfig.json` - Added JSX support
7. `dev-server.js` - Added category routing support

## Deployment Notes

After deployment, verify:
1. `/api/og-image` returns PNG image (homepage)
2. `/health` shows correct meta tags in HTML source
3. `/api/og-image/category/health` returns PNG image
4. Facebook/Twitter debuggers show correct previews
