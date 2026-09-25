# SEO implementation — 24 September 2026

This implements the engineering work from [the audit](seo-audit-plan-2026-09-24.md). Organic performance and editorial ownership still require account access and owner input.

## Implemented

- Initial HTML contains visible episode cards and links. JavaScript progressively enables the existing gallery; the static cards remain available if enhancement does not finish or the fallback has keyboard focus.
- Home/category titles, introductions and H1s explain the audio content. Display labels normalize verbose category names without changing existing URLs. Episode descriptions use a short discovery description when summaries are long, preserving the full editorial summary on-page instead of clipping qualifications.
- `/new` and `/home-v2` canonicalize to `/` and are excluded from the sitemap. Search requests with `q` or `topic` are noindex without a conflicting base-page canonical.
- `/popular` uses the public API's real listen counts. It is omitted from navigation and the sitemap, and noindexed, when no episodes have recorded listens.
- Episode pages expose sanitized backend source URLs, synthetic-presenter disclosures, chapter headings/speaker labels, publication/reporting dates and actual update dates when supplied. Category breadcrumbs and related-story links support discovery. Related stories require a shared category or named topic.
- `/about` explains the available product information and links to the existing Angle social accounts for feedback. No reviewer names, human-review promises, response commitments, or unsupported editorial credentials were invented.
- Podcast JSON-LD includes the publisher and available citations. Sitemap lastmod values reflect valid supplied content dates, falling back to publication dates.
- Missing routes resolve before response headers: root loading fallback removed, streaming metadata disabled. This trades early shell streaming for reliable status codes and complete initial metadata. Local Worker checks confirm real 404s for ordinary and Googlebot user agents.
- `audio_start`, `audio_progress` (25/50/75), and `audio_complete` events use `episode_id` and the canonical episode `page_location`, including modal playback. Progress measures accumulated played seconds, excluding seek gaps. Completion requires an ended event and at least 90% of duration accumulated. Events deduplicate within a mounted player; reopening an episode begins a new listening session. This is a conservative engagement estimate, not unique-duration coverage or proof of attention.
- Existing `download_click` adds episode attribution from the episode CTA. This event represents a TestFlight outbound click, never an installation.
- Tests cover source URL sanitization, transcript projection, real popularity, timestamps, sitemap membership, query indexing and playback milestones. HTTP checks cover SSR links, canonicals, noindex, 404s and sharing images. Sitemap coverage discrepancies now set a failing exit code.
- TypeScript excludes the pre-existing ` 2.ts` and ` 2.tsx` duplicate copies; the actual application remains fully type checked. Those unrelated files have not been deleted.

## Verification

Final validation passed: 42 tests (13 gallery and 29 application/Worker tests), the OpenNext production build including TypeScript, all HTTP route checks, and sitemap coverage/freshness checks. The local crawl found 9 canonical sitemap URLs, all 3 episodes present, no missing headings/descriptions or canonical mismatches, and no broken links or orphans. Episodes now have direct homepage links. See [the measured report](../.seo/runs/seo-implementation.json). The live catalog had one episode with recorded listens during verification, so `/popular` was included.

Run the complete build and tests:

```sh
npm test
npm run build:cloudflare
npm run preview:cloudflare -- --port 3101
npm run check:next -- http://localhost:3101
node scripts/check-sitemap-coverage.mjs --source http://localhost:3101
npm run seo:measure -- http://localhost:3101 seo-implementation --assert
```

The local preview uses public read-only API requests rather than the production service binding. It is deliberately noindexed and its robots.txt disallows crawling. Local response timings are not comparable to production field performance.

Browser checks cover the homepage, hydrated gallery, 390×844 mobile layout, search filtering, episode dialog opening/closing and focus return, source disclosure, transcript expansion, and console errors. No performance trace tool was available, so no Lighthouse/CrUX/Core Web Vitals result is claimed.

## Account and editorial follow-through

1. **Search Console:** verify the `newsangle.co` domain property using the verification record supplied by Google. Submit `https://www.newsangle.co/sitemap.xml`. Inspect `/`, a category, `/about`, and all three episode URLs; check Google's chosen canonical and rendered content. This implementation does not submit a sitemap or claim verification.
2. **Baseline:** export available query/page/device/country performance data (prefer 90 days); separate brand and nonbrand queries. Record impressions, clicks, CTR, position, intended canonical indexing, organic listening starts, and outbound app clicks. Compare consistent page cohorts after 30 and 60 days rather than promising an arbitrary traffic gain.
3. **GA reporting:** confirm the existing property receives the events in DebugView or Realtime. Register `episode_id` and `link_location` as event-scoped custom dimensions if needed. Assess organic landing-page engagement; designate `download_click` as a key event only if outbound interest is the agreed goal. Verify end-to-end delivery separately from the unit-tested dispatch logic. Do not call it app installation attribution.
4. **Backend date contract:** the inspected public V2 responses currently omit `updatedAt`. The mapper now accepts a valid supplied value instead of manufacturing it from `createdAt`; the backend must expose a content revision timestamp before the website can reflect future revisions accurately. Do not substitute `asOf` (reporting cutoff), request time, or deployment time.
5. **Editorial responsibility:** supply a verified owner/editor identity, review process, and corrections handling commitments before expanding the About page. The current source links/disclosures are taken from the published backend payload; this change does not certify the accuracy of each news claim. A per-claim evidence UI and correction-history schema need a separately verified contract.
6. **Demand and performance:** choose focused query targets from actual data and review corresponding search results. Obtain field performance from Search Console/CrUX if enough traffic exists; otherwise collect mobile lab measurements. Avoid publishing thin topic pages or extra stories solely to increase URL count.

## Production deployment

Deployed on 24 September 2026 as Worker version `6754f8d4-2679-456f-a4f9-f5f16d44b8ad` to `newsangle.co/*` and `www.newsangle.co/*`. The previously validated OpenNext bundle was published using `npx opennextjs-cloudflare deploy`.

Production route checks, source/transcript checks, actual 404s, search noindex, alternate-view canonicals, sharing images, sitemap coverage/dates, and health/readiness all passed. The final [production crawl](../.seo/runs/seo-release-verified-2026-09-24.json) confirms 9 canonical pages and no broken links, orphan pages, metadata omissions, or canonical mismatches. An immediate earlier crawl (`seo-production-2026-09-24.json`) still observed the prior 10-page release during rollout; use the final report for this release. Follow-up ordinary and crawler requests both confirmed the new homepage and 9-page sitemap.

Wrangler uses the shared `projects` OAuth profile, bound locally to `/Users/michel` so repositories and Codex worktrees inherit it. The previous Angle and Bloom directory overrides were removed. The user approved access to all current and future Cloudflare accounts. `whoami` from the Angle, Sudoku, and Bloom repositories confirms access to both current accounts (Angle and Sudoku); Bloom currently deploys into the Angle account. Read-only deployment queries for Angle and Bloom and a D1 database listing against the Sudoku account succeeded. Credentials and directory bindings are machine-local, not committed. On another machine, authorize a shared profile for the required accounts and activate it at the common parent directory. Keep each project's explicit `account_id` so deployment targeting remains deterministic. Environment API tokens or a closer directory binding can override this shared profile.

## Integration with the artwork redesign — 25 September 2026

Reconciled the SEO work with the artwork redesign through `baa4a95`. Category URLs remain directly accessible and preserve the new client-side filtering/history behavior; the earlier category-to-home redirect approach is superseded. The portrait cards, artwork-derived backgrounds, fullscreen episode layout, and versioned social images are retained. Transcripts, sources, related stories, and listening analytics are integrated into that layout, with one player and one set of actions per episode.

Validation: 58 tests, Next.js and Cloudflare builds, TypeScript, browser checks, and the full route/API/social-image checks against the local Cloudflare preview passed. Numbered duplicate backup files remain local and are excluded from the commit.
