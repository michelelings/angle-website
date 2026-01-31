# Plan: Dynamic Sitemap Implementation

## Overview
Create a dynamic XML sitemap that automatically includes all episodes from Supabase, following the existing API route pattern and Vercel configuration.

## Current Setup Analysis

### Server Architecture
- **Vercel**: Uses API routes in `/api/*` directory
- **Dev Server**: `dev-server.js` handles API routes dynamically by importing `.ts` files
- **Pattern**: API handlers export default async function with `VercelRequest` and `VercelResponse`

### Supabase Integration
- **Episodes**: Fetched via `fetchEpisodes()` from `lib/supabase.ts`
- **Categories**: Fetched via `fetchCategories()` from `lib/supabase.ts`
- **Data**: Episodes have `id`, `title`, `createdAt`, `category`, etc.

### Current Routes
- `/` - Home page (index.html)
- `/api/episodes` - Get all episodes
- `/api/categories` - Get all categories
- `/api/health` - Health check
- `/episode/[id]` - Planned episode detail pages (from jip-plan.md)

### Vercel Configuration
- Current: Simple rewrite rule `"/(.*)" -> "/public/$1"`
- API routes automatically handled by Vercel's serverless functions

## Implementation Plan

### 1. Create Sitemap API Endpoint
**File:** `api/sitemap.ts`

**Purpose:** Generate XML sitemap dynamically from Supabase data

**Implementation:**
- Follow same pattern as `api/episodes.ts` and `api/categories.ts`
- Use `fetchEpisodes()` to get all episodes
- Generate XML sitemap format
- Set proper content-type header: `application/xml` or `text/xml`
- Include CORS headers (matching existing pattern)

**Sitemap Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>https://angle.app/</loc>
    <lastmod>2026-01-31</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Dynamic episode pages -->
  <url>
    <loc>https://angle.app/episode/{episode-id}</loc>
    <lastmod>{episode-createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Repeat for each episode -->
</urlset>
```

**Key Features:**
- Use episode `createdAt` for `<lastmod>` (format: YYYY-MM-DD)
- Set priority: Home = 1.0, Episodes = 0.8
- Set changefreq: Home = weekly, Episodes = monthly
- Use `https://angle.app` as base URL (from robots.txt context)

### 2. Update Vercel Configuration (if needed)
**File:** `vercel.json`

**Current Status:** 
- API routes are automatically handled by Vercel
- No changes needed for `/api/sitemap` route

**Optional Enhancement:**
- If we want `/sitemap.xml` to work (instead of `/api/sitemap`), add rewrite:
```json
{
  "rewrites": [
    { "source": "/sitemap.xml", "destination": "/api/sitemap" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

**Decision:** Recommend using `/sitemap.xml` for SEO best practices (standard location)

### 3. Update robots.txt
**File:** `public/robots.txt`

**Action:** Uncomment and update sitemap reference
```
Sitemap: https://angle.app/sitemap.xml
```

### 4. Error Handling
**Considerations:**
- Handle Supabase connection errors gracefully
- Return valid XML even if episodes fail to load (at minimum, include home page)
- Log errors for debugging
- Set appropriate HTTP status codes

### 5. Performance Considerations
**Caching:**
- Vercel serverless functions have built-in caching
- Consider adding cache headers: `Cache-Control: public, max-age=3600` (1 hour)
- Episodes don't change frequently, so caching is safe

**Size Limits:**
- Sitemap spec: Max 50,000 URLs per sitemap file
- Max file size: 50MB uncompressed
- If episodes exceed 50k, consider sitemap index file (future enhancement)

## Implementation Steps

### Step 1: Create API Endpoint
1. Create `api/sitemap.ts`
2. Import `fetchEpisodes` from `lib/supabase.ts`
3. Generate XML string with all URLs
4. Set proper headers and return XML

### Step 2: Update Vercel Config
1. Add rewrite rule for `/sitemap.xml` → `/api/sitemap`
2. Test that rewrite works correctly

### Step 3: Update robots.txt
1. Uncomment sitemap line
2. Verify URL is correct

### Step 4: Test Locally
1. Run dev server: `npm run dev`
2. Test `/api/sitemap` endpoint
3. Test `/sitemap.xml` endpoint (if rewrite added)
4. Validate XML format

### Step 5: Test on Vercel
1. Deploy to Vercel
2. Test production URLs
3. Submit to Google Search Console (optional)

## Future Enhancements

### Category Pages (if implemented)
If category pages are added (e.g., `/category/[name]`):
- Add category URLs to sitemap
- Priority: 0.7
- Changefreq: weekly

### Sitemap Index (if needed)
If episodes exceed 50k:
- Create `sitemap-index.xml`
- Split episodes into multiple sitemap files
- Reference them in index file

### Lastmod Precision
Currently using date only. Could enhance to include time:
- Format: `YYYY-MM-DDTHH:mm:ss+00:00` (W3C DateTime)

## File Changes Summary

### New Files
- `api/sitemap.ts` - Sitemap generation endpoint

### Modified Files
- `vercel.json` - Add sitemap.xml rewrite (optional but recommended)
- `public/robots.txt` - Uncomment sitemap reference

## Testing Checklist

- [ ] `/api/sitemap` returns valid XML
- [ ] `/sitemap.xml` works (if rewrite added)
- [ ] XML validates against sitemap schema
- [ ] All episodes are included
- [ ] Home page is included
- [ ] Lastmod dates are correct
- [ ] URLs are absolute (https://angle.app/...)
- [ ] robots.txt references sitemap correctly
- [ ] Works in production on Vercel
- [ ] Google Search Console can fetch sitemap (optional)

## SEO Benefits

- **Search Engine Discovery**: Helps search engines find all episodes
- **Indexing**: Improves chances of episodes being indexed
- **Freshness**: Lastmod dates help search engines prioritize updates
- **Standards Compliance**: Follows sitemap.org protocol
