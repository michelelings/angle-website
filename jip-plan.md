# Plan: Shareable Episode Detail Pages

## Overview
Add shareable URLs for individual episodes (e.g., `/episode/[id]`) so users can share direct links to specific episodes.

## Goals
- ✅ Each episode has a unique, shareable URL
- ✅ URLs work when shared (proper meta tags for social sharing)
- ✅ Browser back/forward navigation works correctly
- ✅ Detail page maintains the same visual design as the modal
- ✅ Minimal changes to existing architecture

## Implementation Steps

### 1. Create API Endpoint for Single Episode
**File:** `api/episodes/[id].ts`

- Create a new API endpoint that fetches a single episode by ID
- Follow the same pattern as `api/episodes.ts`
- Query Supabase for episode with matching ID
- Return episode data in the same format
- Handle error cases (episode not found, etc.)

**Example URL:** `/api/episodes/abc123`

### 2. Add Client-Side Routing
**File:** `public/index.html`

- Detect when URL matches `/episode/[id]` pattern
- Extract episode ID from URL path
- Fetch episode data from new API endpoint
- Display detail view instead of gallery view
- Handle browser navigation (back/forward buttons)
- Update URL when navigating to detail page

**Routing Logic:**
- Check `window.location.pathname` on page load
- If matches `/episode/[id]`, show detail view
- Otherwise, show gallery view (current behavior)

### 3. Create Detail Page View
**File:** `public/index.html`

- Reuse existing modal styling and structure
- Create a new detail page view (can be similar to modal but full page)
- Display:
  - Episode cover image
  - Category tag
  - Title
  - Meta information (episode number, duration, host)
  - Full description
  - Tags
  - Audio player
  - Date
- Add "Back to Home" button/link
- Add share button with copy link functionality

**Styling:**
- Can reuse `.modal-content` styles
- Make it full page instead of overlay
- Add navigation header with back button

### 4. Update Episode Cards
**File:** `public/index.html`

- Add `href` attribute to episode cards linking to `/episode/[id]`
- Update click handler to navigate to detail page instead of opening modal
- Option: Keep modal for quick previews, but also allow navigation
- Use `history.pushState()` or `window.location` for navigation

**Card Click Behavior:**
- Navigate to `/episode/[episode-id]`
- Update URL without full page reload
- Fetch and display episode detail

### 5. Add Share Functionality
**File:** `public/index.html`

- Add share button on detail page
- Copy current URL to clipboard
- Show confirmation message when link is copied
- Optionally add native share API for mobile devices

**Share Features:**
- Copy link button
- Social sharing buttons (Twitter, Facebook, etc.) - optional
- Native Web Share API where supported

### 6. Create Dynamic OG Image Endpoint
**File:** `api/og-image/[id].ts`

- Create endpoint that generates dynamic Open Graph images for episodes
- Accept episode ID as URL parameter
- Fetch episode data from Supabase (use `fetchEpisodes` helper or direct query)
- Generate image with:
  - Episode cover image as background (resized/cropped to 1200x630px)
  - Episode title overlaid (with proper font styling)
  - Category tag (optional, if available)
  - Angle branding/logo
- Return image as PNG/JPG with proper content-type headers
- Handle caching headers for performance (Cache-Control: public, max-age=3600)
- Fallback to default OG image if episode not found or image generation fails
- Handle errors gracefully (return default image or 404)

**Example URL:** `/api/og-image/abc123`

**Implementation Approach:**
- Use `@vercel/og` library (recommended for Vercel deployments)
- Or use Canvas API (`node-canvas`) to composite images server-side
- Or use a service like Cloudinary/ImageKit for image transformations

**Image Composition:**
- Background: Episode cover image (ensure 1200x630px aspect ratio)
- Overlay: Semi-transparent dark overlay for text readability
- Title: Episode title in LTT Recoletta font (matching site design)
- Category: Small category tag in top-left corner (if available)
- Logo: Angle logo/branding in bottom-right corner

### 7. Dynamic Meta Tags for SEO & Social Sharing
**File:** `public/index.html`

- Update `<meta>` tags dynamically when viewing detail page
- Set Open Graph tags (og:title, og:description, og:image, og:url)
- Set Twitter Card tags
- Update page `<title>`
- This ensures shared links show proper previews

**Meta Tags to Update:**
- `og:title` - Episode title
- `og:description` - Episode description (use fullDescription if available, otherwise description)
- `og:image` - Dynamic OG image URL: `https://angle.app/api/og-image/[episode-id]`
- `og:url` - Current episode URL (full URL including domain)
- `og:type` - Set to "article" for episodes
- `og:image:width` - Set to 1200
- `og:image:height` - Set to 630
- `twitter:card` - Keep as "summary_large_image"
- `twitter:title`, `twitter:description`, `twitter:image` - Match OG tags
- Page `<title>` - Format: "Episode Title | Angle"

**Implementation Details:**
- Update meta tags using JavaScript when episode loads
- Use `document.querySelector('meta[property="og:image"]')` to update existing tags
- Or create new meta tags if they don't exist
- Set `og:image` to point to the dynamic OG image endpoint: `https://angle.app/api/og-image/[episode-id]`
- Ensure meta tags update before page is shared (important for crawlers)
- Consider server-side rendering for better SEO (future enhancement)

### 8. Update Vercel Configuration
**File:** `vercel.json`

- Add rewrite rule to handle `/episode/*` routes
- All `/episode/*` paths should serve `index.html` (for client-side routing)
- This ensures direct links to episodes work correctly

**Current config:**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

**Updated config:**
```json
{
  "rewrites": [
    { "source": "/episode/:id", "destination": "/public/index.html" },
    { "source": "/api/og-image/:id", "destination": "/api/og-image/[id]" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

**Note:** The `/api/og-image/:id` rewrite routes dynamic OG image requests to the API endpoint.

### 9. Add Navigation Controls
**File:** `public/index.html`

- Add "Back to Home" button on detail page
- Handle browser back button (use `popstate` event)
- Ensure smooth transitions between views
- Maintain scroll position when returning to gallery (optional)

**Navigation:**
- Back button in detail page header
- Browser back button support
- Click logo/title to go home

## Technical Considerations

### URL Structure
- Format: `https://angle.app/episode/[episode-id]`
- Example: `https://angle.app/episode/abc-123-def`
- Use episode `id` from database as URL parameter

### State Management
- Track current view state (gallery vs detail)
- Store current episode ID when viewing detail
- Handle page refresh on detail page (re-fetch episode data)

### Performance
- Lazy load episode data when navigating to detail page
- Cache episode data if already loaded
- Preload episode images

### Error Handling
- Handle episode not found (404)
- Handle API errors gracefully
- Show error message if episode fails to load

### Accessibility
- Ensure detail page is keyboard navigable
- Proper ARIA labels for navigation
- Focus management when switching views

## File Changes Summary

### New Files
- `api/episodes/[id].ts` - API endpoint for single episode
- `api/og-image/[id].ts` - Dynamic OG image endpoint (generates episode-specific OG images)

### Modified Files
- `public/index.html` - Add routing, detail view, share functionality, dynamic meta tags
- `vercel.json` - Add route rewrite for `/episode/*` and `/api/og-image/*`

## Testing Checklist

- [ ] Direct link to episode works (`/episode/[id]`)
- [ ] Navigation from gallery to detail page works
- [ ] Browser back button works correctly
- [ ] Share button copies correct URL
- [ ] Meta tags update correctly for social sharing
- [ ] Dynamic OG image endpoint works (`/api/og-image/[id]`)
- [ ] OG image includes episode cover image and title
- [ ] og:image displays correctly when sharing (test with Facebook/Twitter debuggers)
- [ ] og:image URL is absolute (includes domain)
- [ ] og:image meets size requirements (1200x630px minimum)
- [ ] OG image fallback works when episode not found
- [ ] OG image caching headers are set correctly
- [ ] Episode not found shows error message
- [ ] Page refresh on detail page loads episode correctly
- [ ] Mobile responsive design maintained
- [ ] Audio player works on detail page
- [ ] All episode data displays correctly

**Social Sharing Testing:**
- Test og:image with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Test og:image with [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- Test og:image with [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
- Verify image appears correctly in link previews
- Test with different episode cover images

## Future Enhancements (Optional)

- Add episode slug/permalink for better URLs
- Add related episodes section
- Add comments/discussion (if needed)
- Add episode transcript display
- Add download episode option
- Add RSS feed support
- Add sitemap generation
