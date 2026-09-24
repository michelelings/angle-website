# Continuous gallery implementation

The existing visual design and 15px/second continuous motion are retained. The frontend uses a viewport-sized window in `public/js/gallery.js`, rather than four full catalog copies. All stories remain available at mobile widths. No new browser framework or carousel library is shipped.

## Changes

- For looping catalogs: nine cards at the tested 1280px desktop viewport; seven at 390px mobile. Two cards on each side provide image lookahead. Overscan cards are inert so keyboard users do not tab into clipped content. Concurrent small-catalog changes were preserved: lists need at least eight unique stories and two viewport widths of content to loop; shorter lists show each story once, centered when they fit, or manually scrollable with clamped ends.
- Looping card boundaries include the 10px gap, including the last-to-first seam. Forward and backward drags can wrap indefinitely in loop mode. Large input deltas jump straight to the correct window.
- Only incoming cards are constructed at boundaries. Ordinary frames update one transform. Pointer/wheel input is combined into one frame, and clicks after dragging are suppressed.
- Automatic movement stops for a modal, hidden document, offscreen gallery, keyboard focus, or reduced-motion preference. Manual browsing remains available. Resume resets elapsed time rather than jumping forward.
- Share SVG is embedded once in the script; no icon fetch per card. Delegated clicks resolve the current story. Modal close reuses the same cards and position. Resize adjusts geometry once. Audio listeners are installed once.
- Categories come from the catalog already loaded by the page, eliminating a second API dependency. Browser history restoration no longer pushes a new episode history entry.
- Visible and buffer covers load eagerly with asynchronous decoding. Responsive renditions are selected by the portrait card's height (500px desktop / 450px mobile), preserving sufficient resolution when a square image covers a portrait card. Larger original artwork is retained for the modal. Missing renditions fall back to the original, then the site icon.
- Worker and Vercel routes now serve `/js/` as static files.

## Cover generation and deployment

`sharp` is a development dependency, not browser JavaScript. It creates 500/1000/1500px square WebP renditions and an atomic manifest. File names include a content hash. Four concurrent jobs bound build work; unchanged artwork is reused using its catalog update timestamp. Generated files are ignored by Git and must be present in the deployment assets directory.

```sh
# Defaults to the deployed website Worker catalog.
npm run build:covers

# Override the source for a particular deployment or supply multiple catalogs.
npm run build:covers -- https://www.newsangle.co/api/episodes

# Both commands generate covers before packaging/uploading assets.
npm run build:cloudflare       # dry-run only
npm run deploy:cloudflare      # publishes; not run during this implementation
```

Set `COVER_CATALOG_URL` to choose the source used by the build/deploy scripts. For a Vercel build, run `npm run build:covers -- https://www.newsangle.co/api/episodes` before deploying the public directory. If using `wrangler deploy` directly, first run the cover step; prefer the npm deploy script to avoid omission. No upstream storage or catalog records are changed by this process.

Newly published stories without a generated rendition remain functional using the original image. Re-run generation and deploy assets when publishing artwork. If an image is replaced at the same URL, update its catalog `updatedAt`; alternatively remove its manifest entry before regeneration. Encoding failure makes the build exit nonzero while retaining previous manifest entries where available. Thumbnail generation currently assumes square artwork, matching the audited covers; review cropping if the publishing pipeline starts producing another aspect ratio.

## Verified locally

| Measurement | Before | After |
| --- | --- | --- |
| Mounted cards, 227-story fixture, 1280px viewport | 908 | 9 |
| Total DOM elements, same fixture | 9,799 | 193 |
| Moving track width | 354,110px | 3,500px |
| Five audited covers | 3,297,190 bytes | 335,040 bytes at 1000px (~90% less) |
| Mounted cards, 1,000-story fixture | Not measured | 9 |

The 1,000-story stress fixture uses distinct IDs and cycles the 227 existing artwork URLs; it verifies DOM scaling, not 1,000 unique-image decode pressure. The browser selected the generated 1000px source at DPR 2. Original image dimensions should be compared with selected source file dimensions, not density-corrected `naturalWidth` when using `srcset`.

Browser checks covered desktop and mobile layout, keyboard browsing, dragging without accidental modal activation, small catalogs, category selection, modal opening/closing, browser Back to the same category, and bounded DOM size. Automated tests cover negative and large jumps, tiny/empty lists, seam continuity, node reuse, pause/resume, reduced-motion behavior, delegated events, responsive geometry, and pointer focus. Worker route tests, the Worker TypeScript check, and the Wrangler dry-run validate packaging and routes. After integration with the latest main branch, both TypeScript checks pass. The existing React runtime dependency and SEO validation scripts are retained, and `@types/react` supplies the missing JSX declarations for the Vercel handlers.

These are structural and byte-size improvements, not a claim of measured GPU FPS. A before/after frame trace on target phones remains the appropriate final smoothness check.

## Local QA commands

```sh
npm run test:gallery
npm run test:cloudflare
npm run type-check
npm run type-check:cloudflare

# Save a public catalog, then preview without database credentials.
curl -o /tmp/angle-catalog.json https://www.newsangle.co/api/episodes
node scripts/preview-gallery.mjs /tmp/angle-catalog.json
# http://127.0.0.1:4173/?count=1000
# http://127.0.0.1:4173/?count=3
# http://127.0.0.1:4173/?count=0
```
