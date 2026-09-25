# Server rendering and loading performance

Catalog headings, category counts, filters, cards, and search results render on the server. Search uses a native GET form (`?q=`); submit with Enter or Search. Category links preserve the query. Browsing, filtering, and searching work without JavaScript. The browser no longer fetches the full transcript index or builds its search index on startup. Fuzzy transcript search remains available on the server.

Client components remain for gallery movement, audio controls, dialogs, sharing, image error recovery, and artwork themes. The gallery receives its accessible initial cards as server-rendered children. Its enhancement starts without fetching an image manifest.

## Artwork

Initial cards, the interactive gallery, stream cards, and episode artwork use the same versioned `/api/artwork/:id?w=…&v=…` URLs. Four widths (360, 540, 720, 1080) keep the transformation space bounded. WebP quality is 82 and images never upscale. The first catalog image has high priority; other cards lazy-load. Original artwork is used only if optimization fails, followed by the app icon if the original also fails.

The route resolves the original exclusively from the public catalog; it never fetches a URL supplied by the requester. Unsupported sizes, malformed IDs, and missing versions return 400. Outdated versions redirect to the current version without caching the redirect. Successful images receive a one-year immutable cache policy and are explicitly stored in the Workers Cache API. Failures are not cached.

New stories are optimized on first request, without rebuilding the website. `wrangler.jsonc` includes the Cloudflare `IMAGES` binding. Deploy the configuration with the code. Image transformations use Cloudflare Images; local development exercised the configured binding successfully. Existing build-time covers remain for social preview generation.

## Data freshness

Production uses the Workers Cache API, shared across requests within a Cloudflare location. Catalog data expires after 60 seconds; the built search-document index expires after 300 seconds. Index membership can lag publication by up to approximately six minutes when built from a cached catalog. No cross-request promises or authenticated request data are retained. Development and previews bypass this data cache. This is TTL-based refresh, not a publication webhook.

HTML remains dynamically server-rendered with the existing metadata and 404 behavior. It is not globally cached; the public data behind it is cached. Deployment changes that alter cached schemas should bump the cache namespace in `worker/public-cache.ts`.

## Validation

- `npm test`: gallery, search, API, cache expiry, transformation validation, and image failure tests.
- `npm run type-check` and `npm run type-check:cloudflare`.
- `node scripts/verify-next.mjs http://localhost:3107`: server HTML, search results without script execution, API, canonical metadata, and missing routes.
- Browser checks: search submission, gallery, episode dialog, and return to the original search.
- Local sample: the leading production cover (3,045,841-byte original) became a 91,012-byte WebP at 540 pixels, a 97% reduction. This is a payload measurement, not a measured LCP improvement.

The standard Turbopack production build stalled during this run. The Webpack production build and the Cloudflare bundle both completed successfully with:

```sh
NEXT_PRIVATE_STANDALONE=true npm run build -- --webpack
node_modules/.bin/opennextjs-cloudflare build --skipNextBuild
```

The default build configuration has not been changed. No deployment was performed.
