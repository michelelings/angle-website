# Plan: Direct Links to Episode Detail Pages

## Overview
Enable shareable direct links to individual episode detail pages (e.g., `https://newsangle.co/episode/[id]`) so users can bookmark, share, and access specific episodes directly.

## Current State
- Episodes are displayed in a horizontal scrolling gallery
- Clicking an episode opens a modal with episode details
- No direct URL routing - all navigation is client-side modal-based
- Episodes have unique IDs from Supabase database
- `fetchEpisodeById()` function already exists in `lib/supabase.ts`

## Goals
1. ✅ Each episode has a unique, shareable URL (`/episode/[id]`)
2. ✅ URLs work when shared (proper meta tags for social sharing)
3. ✅ Browser back/forward navigation works correctly
4. ✅ Detail page maintains the same visual design as the modal
5. ✅ Minimal changes to existing architecture

## Implementation Steps

### Phase 1: API & Routing Foundation

#### Step 1: Create Single Episode API Endpoint
**File:** `api/episodes/[id].ts` (NEW)

- Create API endpoint that fetches a single episode by ID
- Use existing `fetchEpisodeById()` from `lib/supabase.ts`
- Follow same pattern as `api/episodes.ts`
- Return episode data in same format
- Handle 404 for episode not found

**Example:**
```typescript
// GET /api/episodes/[id]
// Returns: { success: true, data: Episode } or { success: false, error: "..." }
```

#### Step 2: Update Vercel Configuration
**File:** `vercel.json` (MODIFY)

Add rewrite rules for:
- `/episode/:id` → `/public/index.html` (for client-side routing)
- `/api/episodes/:id` → `/api/episodes/[id]` (API endpoint)

**Updated config:**
```json
{
  "version": 2,
  "framework": null,
  "rewrites": [
    { "source": "/sitemap.xml", "destination": "/api/sitemap" },
    { "source": "/episode/:id", "destination": "/public/index.html" },
    { "source": "/api/episodes/:id", "destination": "/api/episodes/[id]" },
    { "source": "/api/og-image/:id", "destination": "/api/og-image/[id]" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

### Phase 2: Client-Side Routing

#### Step 3: Add URL Routing Logic
**File:** `public/index.html` (MODIFY)

- Add function to parse URL and extract episode ID
- Check `window.location.pathname` on page load
- If matches `/episode/[id]`, show detail view
- Otherwise, show gallery view (current behavior)
- Handle browser navigation with `popstate` event

**Routing Functions:**
```javascript
// Extract episode ID from URL
function getEpisodeIdFromUrl() {
  const match = window.location.pathname.match(/^\/episode\/([^\/]+)$/);
  return match ? match[1] : null;
}

// Navigate to episode detail page
function navigateToEpisode(episodeId) {
  window.history.pushState({ episodeId }, '', `/episode/${episodeId}`);
  showEpisodeDetail(episodeId);
}

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  const episodeId = e.state?.episodeId || getEpisodeIdFromUrl();
  if (episodeId) {
    showEpisodeDetail(episodeId);
  } else {
    showGallery();
  }
});
```

#### Step 4: Create Detail Page View
**File:** `public/index.html` (MODIFY)

- Reuse existing modal HTML structure and styles
- Create new detail page view (full page, not overlay)
- Add "Back to Home" button
- Hide gallery when showing detail view
- Show detail view when URL matches `/episode/[id]`

**View States:**
- Gallery view (default)
- Detail view (when on `/episode/[id]`)

**Detail Page Structure:**
- Reuse `.modal-content` styles but make it full page
- Add navigation header with back button
- Display all episode information (same as modal)
- Include audio player

#### Step 5: Update Episode Card Click Handlers
**File:** `public/index.html` (MODIFY)

- Update `createEpisodeCard()` function
- Change click handler to navigate to `/episode/[id]` instead of opening modal
- Use `navigateToEpisode(episode.id)` instead of `openStoryModal(episode)`

**Change:**
```javascript
// OLD:
card.addEventListener('click', () => {
  openStoryModal(episode);
});

// NEW:
card.addEventListener('click', () => {
  navigateToEpisode(episode.id);
});
```

### Phase 3: Dynamic Meta Tags & Social Sharing

#### Step 6: Add Dynamic Meta Tags
**File:** `public/index.html` (MODIFY)

- Update meta tags when viewing detail page
- Set Open Graph tags (og:title, og:description, og:image, og:url)
- Update page `<title>`
- Reset meta tags when returning to gallery

**Meta Tags to Update:**
- `og:title` - Episode title
- `og:description` - Episode description
- `og:image` - Episode cover image (or default)
- `og:url` - Current episode URL
- `og:type` - "article"
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Page `<title>` - "Episode Title | Angle"

**Function:**
```javascript
function updateMetaTags(episode) {
  // Update og:title
  updateMetaTag('property', 'og:title', episode.title);
  updateMetaTag('property', 'og:description', episode.description || '');
  updateMetaTag('property', 'og:image', episode.coverImage || '/images/icon.webp');
  updateMetaTag('property', 'og:url', window.location.href);
  updateMetaTag('property', 'og:type', 'article');
  
  // Update Twitter tags
  updateMetaTag('name', 'twitter:title', episode.title);
  updateMetaTag('name', 'twitter:description', episode.description || '');
  updateMetaTag('name', 'twitter:image', episode.coverImage || '/images/icon.webp');
  
  // Update page title
  document.title = `${episode.title} | Angle`;
}

function updateMetaTag(attr, value, content) {
  let tag = document.querySelector(`meta[${attr}="${value}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}
```

#### Step 7: Add Share Functionality
**File:** `public/index.html` (MODIFY)

- Add share button on detail page
- Copy current URL to clipboard
- Show confirmation toast/notification
- Optionally use native Web Share API

**Share Button:**
```javascript
function addShareButton(episode) {
  // Add share button to detail page
  // Copy URL to clipboard
  // Show "Link copied!" message
}
```

### Phase 4: Error Handling & Edge Cases

#### Step 8: Handle Episode Not Found
**File:** `public/index.html` (MODIFY)

- Check if episode ID exists when loading detail page
- Show 404 error message if episode not found
- Provide link back to home
- Handle API errors gracefully

#### Step 9: Handle Page Refresh
**File:** `public/index.html` (MODIFY)

- On page load, check if we're on a detail page URL
- If yes, fetch episode data from API
- Show loading state while fetching
- Display episode detail once loaded

## File Changes Summary

### New Files
- `api/episodes/[id].ts` - API endpoint for single episode

### Modified Files
- `public/index.html` - Add routing, detail view, share functionality, dynamic meta tags
- `vercel.json` - Add route rewrites for `/episode/*` and `/api/episodes/*`

## Implementation Order

1. ✅ **Step 1**: Create API endpoint (`api/episodes/[id].ts`)
2. ✅ **Step 2**: Update Vercel config (`vercel.json`)
3. ✅ **Step 3**: Add URL routing logic (`public/index.html`)
4. ✅ **Step 4**: Create detail page view (`public/index.html`)
5. ✅ **Step 5**: Update episode card handlers (`public/index.html`)
6. ✅ **Step 6**: Add dynamic meta tags (`public/index.html`)
7. ✅ **Step 7**: Add share functionality (`public/index.html`)
8. ✅ **Step 8**: Handle errors (`public/index.html`)
9. ✅ **Step 9**: Handle page refresh (`public/index.html`)

## Testing Checklist

- [ ] Direct link to episode works (`/episode/[id]`)
- [ ] Navigation from gallery to detail page works
- [ ] Browser back button works correctly
- [ ] Browser forward button works correctly
- [ ] Page refresh on detail page loads episode correctly
- [ ] Share button copies correct URL
- [ ] Meta tags update correctly for social sharing
- [ ] Episode not found shows error message
- [ ] Mobile responsive design maintained
- [ ] Audio player works on detail page
- [ ] All episode data displays correctly
- [ ] Back button navigates to gallery
- [ ] URL updates when navigating to episode

## Technical Notes

### URL Structure
- Format: `https://newsangle.co/episode/[episode-id]`
- Use episode `id` from Supabase database
- Example: `https://newsangle.co/episode/abc-123-def`

### State Management
- Track current view (gallery vs detail) based on URL
- Store episode ID in URL (not in state)
- Handle page refresh by reading URL

### Performance
- Fetch episode data only when needed
- Cache episode data if already loaded in gallery
- Lazy load images

### Accessibility
- Ensure detail page is keyboard navigable
- Proper ARIA labels for navigation
- Focus management when switching views

## Future Enhancements (Optional)

- Add episode slugs for better URLs (e.g., `/episode/episode-title-slug`)
- Add dynamic OG image generation (`/api/og-image/[id]`)
- Add related episodes section
- Add episode transcript display
- Add sitemap generation with episode URLs
