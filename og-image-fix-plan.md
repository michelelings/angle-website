# Plan: Fix OG Images and Category Page Links

## Current Issues

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

## Solution: Vercel Edge Middleware

Create a Vercel Edge Middleware that intercepts requests and injects the correct meta tags server-side before serving the HTML.

### Implementation Steps

1. **Create `middleware.ts`** (Edge Middleware)
   - Intercept requests for category pages (e.g., `/health`, `/sports`)
   - Validate category exists by fetching categories from Supabase
   - Read `index.html` from the file system
   - Inject correct meta tags for the category
   - Return modified HTML

2. **Update `vercel.json`**
   - Ensure middleware runs before rewrites
   - Keep existing rewrites for API routes and episode pages

3. **Handle Edge Cases**
   - Invalid categories → serve default homepage HTML
   - Episode pages (`/episode/[id]`) → let existing client-side logic handle (or extend middleware)
   - API routes → skip middleware
   - Static assets → skip middleware

### Technical Details

**Middleware Logic:**
```typescript
1. Check if request is for a category page (single segment path, not /api/*, not /episode/*, not static assets)
2. Extract category from URL (e.g., `/health` → `health`)
3. Validate category exists (fetch from Supabase or use cached list)
4. If valid:
   - Read index.html
   - Replace meta tags with category-specific ones:
     - og:title → "{Category} Stories | Angle"
     - og:description → "{Category} stories worth listening."
     - og:image → "/api/og-image/category/{category}"
     - og:url → "https://newsangle.co/{category}"
   - Return modified HTML
5. If invalid:
   - Return default index.html (or redirect to /)
```

**Meta Tag Injection:**
- Use string replacement or HTML parsing
- Replace existing meta tags in the `<head>` section
- Ensure all OG and Twitter meta tags are updated

### Files to Create/Modify

1. **Create**: `middleware.ts` - Edge middleware for server-side meta tag injection
2. **Update**: `vercel.json` - Ensure middleware configuration (may not need changes, Vercel auto-detects middleware.ts)

### Testing Checklist

- [ ] Direct visit to `/health` shows correct OG tags in HTML source
- [ ] OG image for `/health` loads correctly (`/api/og-image/category/health`)
- [ ] Invalid category redirects or shows homepage
- [ ] Episode pages still work (`/episode/[id]`)
- [ ] API routes still work
- [ ] Homepage still works with correct OG tags
- [ ] Facebook/Twitter debuggers show correct previews for category pages

### Alternative Approach (If Middleware Doesn't Work)

If Edge Middleware has limitations, we can:
1. Create a serverless function that generates HTML dynamically
2. Update `vercel.json` rewrites to route category pages to this function
3. Function reads index.html, injects meta tags, returns HTML

However, Edge Middleware is preferred as it's more efficient and runs at the edge.
