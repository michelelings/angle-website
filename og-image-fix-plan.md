# OG Image and Category Routing - Implementation Summary

> **Note**: See `og-image-implementation-log.md` for detailed implementation log with all mistakes and fixes.

## Current Issues (RESOLVED ✅)

### 1. Category Pages Return 404 or Wrong OG Tags
- **Problem**: When bots/crawlers visit category pages like `newsangle.co/health` directly, they see the static HTML with homepage OG meta tags instead of category-specific ones
- **Root Cause**: The site is a Single Page Application (SPA) that updates meta tags client-side via JavaScript. Bots don't execute JavaScript, so they only see the static HTML
- **Current Behavior**: 
  - `vercel.json` rewrites all routes to `/index.html` (so pages don't actually 404)
  - But the HTML served has static homepage meta tags
  - Client-side JavaScript updates meta tags, but only after page load

### 2. OG Images Don't Work for Category Pages
- **Problem**: OG image endpoints exist (`/api/og-image/category/[category]`), but meta tags in static HTML point to homepage OG image
- **Root Cause**: Same as above - meta tags are only updated client-side
- **Current Implementation**:
  - ✅ `/api/og-image` - Homepage OG image (works)
  - ✅ `/api/og-image/[id]` - Episode OG images (works for direct links)
  - ✅ `/api/og-image/category/[category]` - Category OG images (endpoint exists but meta tags don't point to it)

### 3. Homepage OG Image
- **Status**: ✅ Works correctly (statically set in HTML)

## Solution: Serverless Function for HTML Rendering (IMPLEMENTED ✅)

Created a serverless function that intercepts category page requests and injects the correct meta tags server-side before serving the HTML.

### Implementation Steps (COMPLETED ✅)

1. **Created `/api/render/[category].ts`** (Serverless Function)
   - Intercepts requests for category pages (e.g., `/health`, `/sports`)
   - Validates category exists by fetching categories from Supabase
   - Reads `index.html` from the file system (with multiple fallback paths)
   - Injects correct meta tags for the category
   - Returns modified HTML

2. **Updated `vercel.json`**
   - Added rewrite rule: `/:category` → `/api/render/[category]`
   - Placed before catch-all rule to ensure proper routing

3. **Fixed OG Image Functions**
   - Changed all OG image functions to Node.js runtime (required for Supabase and JSX)
   - Converted to use Vercel Node.js API (`VercelRequest`/`VercelResponse`)
   - Fixed ImageResponse buffer conversion

4. **Handled Edge Cases**
   - Invalid categories → redirect to home
   - Episode pages (`/episode/[id]`) → handled by existing rewrite
   - API routes → skip render function (handled by Vercel)
   - Static assets → skip render function (handled by Vercel)

### Technical Details (IMPLEMENTED ✅)

**Render Function Logic:**
```typescript
1. Extract category from query params or URL path
2. Validate category exists (case-insensitive matching with slug conversion)
3. If valid:
   - Read index.html (try multiple paths: process.cwd(), __dirname, etc.)
   - Replace meta tags with category-specific ones:
     - og:title → "{Category} Stories | Angle"
     - og:description → "{Category} stories worth listening."
     - og:image → "/api/og-image/category/{category}"
     - og:url → "https://newsangle.co/{category}"
   - Return modified HTML
4. If invalid:
   - Redirect to home (302)
```

**Meta Tag Injection:**
- Uses regex string replacement
- Replaces existing meta tags in the `<head>` section
- Updates all OG and Twitter meta tags

### Files Created/Modified (COMPLETED ✅)

1. **Created**: `api/render/[category].ts` - Serverless function for category page rendering
2. **Updated**: `vercel.json` - Added category rewrite rule
3. **Updated**: `api/og-image.tsx` - Changed to Node.js runtime, Vercel API
4. **Updated**: `api/og-image/[id].tsx` - Changed to Node.js runtime, Vercel API
5. **Updated**: `api/og-image/category/[category].tsx` - Changed to Node.js runtime, Vercel API
6. **Updated**: `tsconfig.json` - Added JSX support
7. **Updated**: `dev-server.js` - Added category routing support

### Testing Checklist (COMPLETED ✅)

- [x] Direct visit to `/health` shows correct OG tags in HTML source
- [x] OG image for `/health` loads correctly (`/api/og-image/category/health`)
- [x] Invalid category redirects to home
- [x] Episode pages still work (`/episode/[id]`)
- [x] API routes still work
- [x] Homepage still works with correct OG tags
- [x] Homepage OG image works (`/api/og-image`)
- [x] Build succeeds without errors

### Key Mistakes and Fixes

See `og-image-implementation-log.md` for complete details. Summary:
1. **File path resolution** - Added multiple fallback paths
2. **Category extraction** - Added URL path parsing fallback
3. **Category matching** - Implemented case-insensitive slug matching
4. **TypeScript JSX** - Added JSX support to tsconfig.json
5. **Duplicate variables** - Fixed duplicate `categorySlug` declaration
6. **Runtime mismatch** - Changed all OG functions to Node.js runtime
7. **API mismatch** - Converted Edge API to Vercel Node.js API
8. **JSX runtime** - Edge Functions don't support react/jsx-runtime

## Final Solution

All OG image functions use:
- **Runtime**: `nodejs` (required for Supabase and JSX support)
- **API**: Vercel Node.js API (`VercelRequest`/`VercelResponse`)
- **ImageResponse**: Converted to buffer before sending

Category pages are rendered server-side with correct meta tags for bots/crawlers.
