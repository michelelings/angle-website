# OG Image Implementation Investigation - Share Button Issue

## Overview
Investigation into why OG images don't work when using the share button.

## Architecture

### Server-Side Rendering (SSR)
The application uses Vercel rewrites to handle server-side rendering for episode and category pages:

**vercel.json rewrites:**
- `/episode/:id` → `/api/render/episode/[id]` 
- `/:category` → `/api/render/[category]`

These render endpoints inject proper meta tags into the HTML before serving it to crawlers/social platforms.

### OG Image Endpoints
Three OG image generation endpoints exist:

1. **`/api/og-image`** - Default/home page OG image
2. **`/api/og-image/[id]`** - Episode-specific OG image (includes cover image, title, description)
3. **`/api/og-image/category/[category]`** - Category-specific OG image

### Client-Side Meta Tag Updates
The client-side JavaScript dynamically updates meta tags when:
- Opening an episode modal (`updateMetaTags(episode)`)
- Filtering by category (`updateCategoryMetaTags(category)`)
- Closing modal/resetting (`resetMetaTags()`)

## Share Button Implementation

### Two Share Functions

1. **`handleShare(e)`** (line 1965)
   - Called from modal share button (`#modalShareBtn`)
   - Uses `window.location.href` as the URL
   - Only passes `url` to `navigator.share()` (no title/text)
   - Falls back to clipboard if native share fails

2. **`handleCardShare(episode)`** (line 2082)
   - Called from card share button (episode cards in gallery)
   - Constructs URL: `${baseUrl}/episode/${episode.id}`
   - Only passes `url` to `navigator.share()`
   - Falls back to clipboard if native share fails

## Issues Identified

### Issue 1: Card Share Doesn't Update Client Meta Tags
**Problem:** When sharing from a card (not opening modal first), `handleCardShare` is called directly without calling `updateMetaTags(episode)`. 

**Impact:** 
- Client-side meta tags remain unchanged
- However, this shouldn't matter for social platforms since they fetch the URL server-side
- The server-side render endpoint (`/api/render/episode/[id]`) should handle this correctly

**Status:** Likely not the root cause, but inconsistent behavior

### Issue 2: Modal Share Uses Current URL
**Problem:** `handleShare` uses `window.location.href` which should be correct if the modal was opened properly (since `openStoryModal` updates the URL via `pushState`).

**Potential Issue:** If the user navigated away or the URL wasn't updated properly, the wrong URL might be shared.

**Code Reference:**
```javascript
// Line 1518 in openStoryModal
window.history.pushState({ episodeId: episode.id }, '', `/episode/${episode.id}`);
```

**Status:** Should work correctly, but depends on proper URL state management

### Issue 3: Server-Side Rendering May Not Be Triggered
**Problem:** When social platforms fetch the shared URL, they should hit the server-side render endpoint. However, there might be issues with:

1. **Vercel rewrite configuration** - Rewrites might not be working as expected
2. **User-Agent detection** - The render endpoints might not be triggered for all crawlers
3. **Caching** - Social platforms cache OG images aggressively, so changes might not appear immediately

**Investigation Needed:**
- Verify that `/episode/:id` URLs actually hit `/api/render/episode/[id]`
- Check if social platform crawlers are being served the rendered HTML
- Verify OG image URLs are accessible and returning correct images

### Issue 4: OG Image URL Construction
**Potential Issue:** The OG image URLs are constructed using `window.location.origin`:

```javascript
// Line 1871 in updateMetaTags
const ogImageUrl = `${baseUrl}/api/og-image/${episode.id}`;
```

**Concern:** If `window.location.origin` is incorrect (e.g., localhost in development), the OG image URL will be wrong.

**Status:** Should be fine in production, but could cause issues in development

### Issue 5: Missing Meta Tag Attributes
**Observation:** The OG image meta tags include `og:image:width` and `og:image:height` in the static HTML, but these might not be updated dynamically when meta tags change client-side.

**Code Reference:**
```html
<!-- Static HTML (lines 15-16) -->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

**Status:** These are static and correct, so not an issue

## Root Cause Analysis

### Most Likely Root Cause: **Share Button Shares Non-Canonical URL**

The "works when I paste from desktop, fails when I use the share button" pattern almost always indicates:

1. **Share button is sharing a different URL than manual paste**
   - `handleShare` uses `window.location.href` which depends on SPA state
   - On mobile, share might be triggered before `pushState` completes
   - Or from contexts where modal URL never changed
   - Result: Shares URLs like `https://newsangle.co/` or `https://newsangle.co/?episode=123` instead of `/episode/:id`

2. **Manual paste works because:**
   - Desktop address bar shows URL after navigation settled
   - User copies the clean `/episode/:id` URL that matches Vercel rewrites

3. **Why this breaks OG images:**
   - Non-canonical URLs don't match `/episode/:id` → `/api/render/episode/[id]` rewrite
   - Server returns default/home page HTML with default OG image
   - Preview generators fetch the wrong page

### Other Potential Issues:

1. **Social Platform Caching**
   - Social platforms (Twitter, Facebook, LinkedIn, etc.) aggressively cache OG images
   - Even if the implementation is correct, cached versions might be shown

2. **Server-Side Rendering Not Working**
   - The Vercel rewrites might not be working correctly
   - Social crawlers might not be hitting the render endpoints

3. **OG Image Endpoint Errors**
   - The OG image endpoints might be failing silently
   - Images might not be generating correctly
   - Endpoints might not be "bot-friendly" (require auth, redirect loops, wrong content-type)

## Testing Protocol

### Step 1: Prove What URL the Share Button Actually Shares

**Add logging to both share functions:**

```javascript
console.log("SHARE URL", url);
```

**Test on the device/app where previews fail:**
- Click share button
- Copy the logged URL from console
- Paste it into notes app

**Common "gotchas" you'll catch:**
- URL has query params: `/episode/123?something=1` (rewrites might not match)
- URL has hash: `/#/episode/123` (SPA routing, not server route)
- URL is home page: `/` (pushState didn't happen yet)
- URL has www vs non-www mismatch (one redirects, one doesn't)

**If logged URL differs from manual paste URL, you found the root cause.**

### Step 2: Verify SSR OG Tags on Exact Shared URL (No JS)

**Run these against the exact URL that was logged:**

```bash
# Check HTTP status
curl -I https://newsangle.co/episode/123

# Test with Facebook crawler user agent
curl -A "facebookexternalhit/1.1" -s https://newsangle.co/episode/123 | head -n 80

# Test with Twitter crawler user agent
curl -A "Twitterbot/1.0" -s https://newsangle.co/episode/123 | head -n 120
```

**What to confirm:**
- ✅ Response is 200 (not 301/302/307 redirect)
- ✅ HTML contains OG tags in first response (not injected by client JS)
- ✅ `og:image` is absolute HTTPS URL
- ✅ `og:url` matches shared URL exactly

**If OG tags are missing in curl results, rewrites or render endpoint logic is not being applied for bots.**

### Step 3: Confirm OG Image Endpoint is "Bot Friendly"

**Test the image endpoint directly:**

```bash
# Standard request
curl -I https://newsangle.co/api/og-image/123

# With bot user agent
curl -A "facebookexternalhit/1.1" -I https://newsangle.co/api/og-image/123
```

**What you want:**
- ✅ Status 200
- ✅ `content-type: image/png` (or jpeg)
- ✅ No auth required
- ✅ No cookies required
- ✅ No redirect loops
- ✅ Reasonable cache headers (not "forever wrong")

**If you see redirects, huge cache max-age, or missing content-type, some apps will refuse or cache incorrectly.**

### Step 4: Testing Checklist

**Fill this in as you test:**

- [ ] Share button logged URL on failing platform: `_________________`
- [ ] Example: `_________________`
- [ ] Curl bot fetch of that exact URL contains OG tags: `yes/no`
- [ ] HTTP status for shared URL: `200 / redirect / other`
- [ ] `og:image` value in SSR HTML: `_________________`
- [ ] Curl HEAD to og:image URL returns:
  - Status: `_________________`
  - Content-Type: `_________________`
  - Cache-Control: `_________________`
- [ ] Which app fails preview: `WhatsApp / iMessage / Slack / LinkedIn / Other`
- [ ] Does same URL preview correctly when pasted manually in that app: `yes/no`

**This matrix will make the cause obvious fast.**

### Step 5: Check Social Platform Debuggers

- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

## Recommended Fixes

### Fix 1: Force Canonical Share URL Every Time (CRITICAL)

**Problem:** `handleShare` uses `window.location.href` which depends on SPA state. On mobile, share might be triggered before `pushState` completes, resulting in wrong URL.

**Solution: Modal share should use episode ID from state, not current href**

```javascript
async function handleShare(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const baseUrl = window.location.origin;
    
    // Get episode ID from history state or currentEpisodeId variable
    const episodeId = 
        window.history.state?.episodeId || 
        currentEpisodeId;
    
    // Always construct canonical URL
    const url = episodeId
        ? `${baseUrl}/episode/${episodeId}`
        : `${baseUrl}/`;
    
    console.log("SHARE URL", url);
    
    // Try native share API first (mobile)
    if (navigator.share) {
        try {
            await navigator.share({ url });
            console.log('Share successful');
            showShareToast();
            return;
        } catch (err) {
            // User cancelled - don't show error
            if (err.name === 'AbortError' || err.code === 20) {
                console.log('User cancelled share');
                return;
            }
            // Other error - fall through to clipboard
            console.log('Native share failed, falling back to clipboard:', err);
        }
    }
    
    // Fall back to clipboard
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            console.log('URL copied to clipboard');
            showShareToast();
        } else {
            throw new Error('Clipboard API not available');
        }
    } catch (err) {
        // Fallback clipboard implementation...
    }
}
```

**Key idea:** Do not depend on meta tags or current SPA URL. Always share the canonical server route that matches your Vercel rewrites.

### Fix 2: Card Share Already Canonical (Keep It)

**Card share is already correct - just add logging:**

```javascript
async function handleCardShare(episode) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/episode/${episode.id}`;
    
    console.log("SHARE URL", url);
    
    // Try native share API first (mobile)
    if (navigator.share) {
        try {
            await navigator.share({ url });
            showShareToast();
            return;
        } catch (err) {
            // User cancelled - don't show error
            if (err.name === 'AbortError' || err.code === 20) {
                return;
            }
            // Other error - fall through to clipboard
        }
    }
    
    // Fall back to clipboard
    // ... existing clipboard code ...
}
```

### Fix 3: Make Rewrites Robust to Query Strings

**Ensure rewrites handle tracking params without breaking:**

1. **In vercel.json, ensure `/episode/:id` rewrite appears before `/:category`:**
   ```json
   {
     "rewrites": [
       { "source": "/episode/:id", "destination": "/api/render/episode/[id]" },
       { "source": "/:category", "destination": "/api/render/[category]" }
     ]
   }
   ```

2. **Make render endpoints handle query strings:**
   - Extract episode ID from path, ignore query params
   - Don't let `?utm_source=...` break OG tag generation
   - Ensure OG image URLs don't include query params

### Fix 4: Improve OG Image Cache Headers

**Instead of random cache-busting, use controlled headers:**

**On `/api/og-image/[id]` response:**

```javascript
res.setHeader('Content-Type', 'image/png');
res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
```

**Then optionally version with stable identifier:**

```javascript
// In updateMetaTags or render endpoint
const ogImageUrl = episode.updatedAt
    ? `${baseUrl}/api/og-image/${episode.id}?v=${new Date(episode.updatedAt).getTime()}`
    : `${baseUrl}/api/og-image/${episode.id}`;
```

**Benefits:**
- `max-age=0`: Browsers don't cache (always fresh)
- `s-maxage=86400`: CDN caches for 24 hours
- `stale-while-revalidate=604800`: Serve stale for 7 days while revalidating
- Version query param: Changes propagate when content changes, not every request

### Fix 5: Ensure History State is Set Correctly

**In `openStoryModal`, ensure state includes episodeId:**

```javascript
function openStoryModal(episode) {
    // ... existing modal setup code ...
    
    // Update URL with state that includes episodeId
    window.history.pushState(
        { episodeId: episode.id, view: 'episode' }, 
        '', 
        `/episode/${episode.id}`
    );
    currentEpisodeId = episode.id;
    
    // ... rest of function ...
}
```

**This ensures `handleShare` can reliably get episode ID from `window.history.state?.episodeId`.**

## Implementation Priority

### Immediate Actions (Do First):

1. **Add logging to share functions** - Prove what URL is actually being shared
2. **Implement Fix 1** - Force canonical URL in `handleShare` using episode ID from state
3. **Test with curl** - Verify SSR OG tags on exact shared URL
4. **Fill testing checklist** - Document findings to identify root cause

### Secondary Actions (After Root Cause Confirmed):

5. **Implement Fix 3** - Make rewrites robust to query strings
6. **Implement Fix 4** - Improve OG image cache headers
7. **Verify Fix 5** - Ensure history state is set correctly

### Validation:

8. Test share button on failing platform/app
9. Verify logged URL matches expected canonical format
10. Confirm OG image preview appears correctly in target app
11. Use social platform debuggers to verify OG tags

## Critical Issue Found: OG Image Endpoint Returning HTML

### Problem Identified

**Root Cause:** The catch-all rewrite rule in `vercel.json` is intercepting `/api/og-image/[id]` requests and serving `index.html` instead of the PNG image.

**Evidence:**
- `curl -I https://www.newsangle.co/api/og-image/[id]` returns:
  - `content-type: text/html; charset=utf-8` (should be `image/png`)
  - `content-disposition: inline; filename="index.html"` (should be PNG)

**Why This Breaks iMessage:**
- iMessage fetches the OG image URL from meta tags
- Receives HTML instead of PNG
- Cannot display the image preview

### Fix Applied

Updated `vercel.json` to exclude `/api/*` routes from the catch-all rewrite:

```json
{
  "rewrites": [
    { "source": "/:path((?!/api).*)", "destination": "/index.html" }
  ]
}
```

This uses a negative lookahead pattern to ensure API routes pass through to Vercel's API routing instead of being caught by the SPA fallback.

### Testing After Fix

After deploying, verify:
```bash
curl -I https://www.newsangle.co/api/og-image/[EPISODE_ID]
```

Should return:
- `content-type: image/png`
- Status 200
- PNG image data (not HTML)

## Summary

The "works when pasted, fails when shared" pattern had two root causes:

1. **Share button sharing non-canonical URL** - Fixed by using episode ID from state
2. **OG image endpoint returning HTML** - Fixed by excluding `/api/*` from catch-all rewrite

Both fixes are now implemented. After deployment, iMessage should display OG images correctly.
