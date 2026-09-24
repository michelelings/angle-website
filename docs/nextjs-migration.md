# Next.js migration

Angle now uses the same application approach as `/Users/michel/Documents/sudokuadaycom`: Next.js App Router, React, TypeScript, Tailwind 4 and OpenNext on Cloudflare Workers. Next.js 16.3.6 includes fixes newer than the reference project's 16.2.11 pin. The deployed backend remains `angle-api`; the website only reads its public v2 API.

## Structure

- `app/`: server-rendered homepage, category and stream pages, direct episode pages, route handlers, metadata and error states.
- `app/@modal/(.)episode/[id]/`: intercepted episode routes. Browsing opens a native modal dialog over the retained gallery; direct requests render a full page. Browser Back/Forward, focus return and audio cleanup are preserved.
- `components/`: header, filters, gallery, cards, episode content, accessible player, dialog and share controls.
- `lib/server/`: request-scoped catalog access, API response handling, sitemap and Next.js sharing-image generation.
- `lib/gallery/`: typed integration with the existing bounded gallery engine. The engine owns its card DOM and animation; React owns the surrounding application. Animation does not update React state each frame.
- `app/globals.css`: Tailwind setup and tokens referencing the approved paper-and-ink component stylesheet in `public/styles/`.
- `legacy/`: preserved HTML and robots source from before migration. These are intentionally outside `public/` because Cloudflare static assets otherwise shadow the React routes.

The older root `api/`, `dev-server.js`, `vercel.json`, `worker/index.ts` and `wrangler.legacy.jsonc` remain reference material during cutover. They are not entrypoints for the current Next/OpenNext build. Existing Worker route tests still use the preserved HTML fixture. The legacy Wrangler file is a configuration snapshot, not a runnable rollback command after moving HTML. Roll back using the prior deployed Worker version.

## Commands

```sh
npm ci
npm run dev
npm test
npm run type-check
npm run type-check:cloudflare
npm run build:cloudflare
npm run preview:cloudflare -- --port 3101
npm run check:next -- http://127.0.0.1:3101
npm run deploy:cloudflare
```

Use Node 22 as declared in `package.json`. Local previews use `ENVIRONMENT:local` and the read-only public API, so they do not require a second local `angle-api` process. Production uses the `ANGLE_BACKEND` service binding. The explicit local upstream also prevents Wrangler's production zone simulation from redirecting localhost to the live domain.

Pages and JSON APIs render dynamically, with request-scoped deduplication and no persistent catalog cache. Publishing or withdrawing a story takes effect without rebuilding the site. Cover generation remains a build step; new covers use originals until the next build. Hashed covers and Next static assets have immutable caching. No new R2 cache or image service is required.

The Edge `middleware.ts` convention is intentional: OpenNext 1.20.2 does not yet support Next's Node `proxy.ts` runtime. It handles the apex-to-www redirect, preview noindex headers, and nosniff. Next prints a deprecation warning but the adapter builds and runs it.

## Verification

- 13 gallery tests, including unmount cleanup, small catalogs, loop recycling, reduced motion, and height-only mobile resize.
- 10 API/Worker tests, including the new route handler contracts, missing IDs, backend failure, canonical sitemap and safe JSON-LD.
- TypeScript for the application and original Worker.
- OpenNext production build and Wrangler dry-run packaging.
- Built Worker HTTP smoke checks: all page types, direct episode HTML, API details, PNG sharing images, 404s, sitemap, robots, redirects, and method handling.
- Browser checks at desktop and 390px mobile widths: design, filtering, audio playback, close cleanup, focus return, Back/Forward and mobile dragging.

“Popular” deliberately retains the existing newest-30-percent placeholder; the backend does not provide a popularity ranking. Automated gallery fixtures cover large catalogs; the live catalog currently has three stories. Physical-device performance is not established by browser viewport simulation.

## Cutover record

Target: `angle-website` in the Angle Cloudflare account, serving `newsangle.co/*` and `www.newsangle.co/*`. The previous production version, verified immediately before this migration, is `b25f1238-abbe-4cc6-99ca-f8d6dbef5ae0`.

Rollback if live validation reveals a regression:

```sh
npx wrangler rollback b25f1238-abbe-4cc6-99ca-f8d6dbef5ae0 --name angle-website --message "Restore pre-Next migration"
```

No backend data, DNS, media, or email configuration changes are involved.

Production deployment completed on 24 September 2026 at approximately 09:50 UTC. Version: `24a16153-4e9e-4984-a0d4-2aa03ca27055`. Live HTTP checks passed for the homepage, new/popular/category handling, stream, direct episode SSR, API, PNG images, missing routes, sitemap, robots, legacy redirects, and methods. Apex redirects to www; workers.dev returns `X-Robots-Tag: noindex, nofollow`. The live homepage was verified in the browser.

The transcript SSR checker now honors its requested test origin instead of following production URLs from the canonical sitemap, and counts rendered article words rather than scripts/HTML. All three current episodes passed, with 1,513–1,739 words of server-rendered article content.
