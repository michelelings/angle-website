# SEO rollout and verification

The October 2026 changes keep `https://www.newsangle.co` as the canonical origin and retain existing episode and subject URLs. Domain migration is explicitly deferred.

## Editorial headlines

The public episode contract accepts an optional `searchTitle`. It takes precedence over the creative `title` in page metadata, headings, cards, related links, and dialogue navigation. The creative title remains on the episode page, and both titles remain searchable.

`lib/episode-headlines.ts` contains ten initial editorial headlines reviewed against the public detail payloads on 2026-10-03. Each is pinned to its publication revision, so rewritten episodes do not inherit a stale headline. Add future headlines in the upstream `searchTitle` field when supported, or add a reviewed revision-pinned entry here. These headlines describe content; no keyword-volume claims are implied.

## Complete readable stories

Prefer the published solo prose. When absent, render the selected rendition's dialogue transcript with its supplied speaker names. A plain-text transcript is the final fallback. Never generate missing factual content from a title or summary. Solo scripts without a spoken sign-off retain their final substantive paragraph.

Run the following against a v2 detail payload (or JSON array of detail payloads) **before promoting an episode**:

```sh
npm run check:publication -- /path/to/episode-detail.json
```

The command exits nonzero for invalid media/records, missing titles, missing summaries, or missing readable text. List payloads omit transcripts and are not a substitute for detail payloads. The publishing service is outside this repository: its release workflow still needs to invoke this check or an equivalent rule. Existing episodes are not silently removed from the site when validation fails.

## Subject and category eligibility

`lib/subject-editorial.ts` contains three original reading guides: Bitcoin, Moore’s law, and universal basic income. Their questions link to existing published episodes. A subject qualifies for indexing only when it has an editorial guide, all of that guide's selected episodes are present, and its identity is not ambiguous. Other subject pages remain accessible with `noindex, follow` until they receive original editorial treatment. Wikipedia excerpts remain attributed supplementary background.

Both `/sitemap.xml` and `/api/sitemap` use the same eligibility function. They include the home and About pages, canonical categories, published episodes, and qualifying subject guides. Alternate catalog orders (`/new`, `/popular`) and search results are not indexing targets. Subject dates reflect guide edits and the underlying episode dates; category pages do not invent modification dates.

## Release checks

```sh
npm run type-check
npm run type-check:cloudflare
npm test
npm run build
npm run check:next -- http://localhost:3101
npm run seo:measure -- http://localhost:3101 after --assert --sitemap-only
```

Omit `--sitemap-only` for the deeper audit of every discovered internal link, including subjects excluded from indexing.

The HTML audit writes `.seo/runs/after.json`. It checks readable episode text, indexing directives, headings, canonical URLs, links, and descriptions. A local preview intentionally sends an `X-Robots-Tag: noindex` header; the audit records that header but excludes it from indexing failures on loopback hosts only. Page-level noindex directives still fail the audit. Do not remove preview protection just to pass a local audit.

Check desktop and mobile layouts, opening a story from the gallery, direct episode loads, and a curated subject page. Confirm long titles remain readable and dialogue-only episodes have complete server-rendered transcripts.

## Search Console baseline and follow-up

These require the site's Search Console property; technical fetches do not prove Google indexing.

1. Save the Pages indexing report and sitemap submission result.
2. Inspect the homepage plus five episode URLs, including the two newest. Record indexed state, exclusion reason, last crawl, Google-selected canonical, and live-test result.
3. Export performance by page and query for the previous 28 days. Track the ten headline-pilot URLs separately and distinguish branded from non-branded queries.
4. After deployment, submit the sitemap and request indexing for a small selection of priority pages.
5. Review discovery/crawling after two weeks and impressions/clicks after four to six weeks. Compare equal periods and note publication dates. These intervals are review points, not ranking promises.

If Google cannot fetch a URL, investigate the matching request/security logs. If it chooses a different canonical, inspect that URL. If a fetched page is excluded, examine its content and duplication before adding more pages.

## Editorial details still needed

The site now displays presenter disclosures supplied with episodes and explains its readable stories and attributed background. Do not invent an operator, author, reviewer, or human fact-checking process. The owner must supply those details before the About page can accurately describe them. Search Console access and a final domain choice are separate follow-ups.

## Local validation on 2026-10-03

- Production Next.js build and both TypeScript configurations passed.
- Gallery and Worker/application test suites passed, including headline revision fallback, dialogue-only publication checks, preserved script endings, and subject eligibility.
- HTTP smoke checks passed for the catalog, episodes, search, social PNGs, redirects, missing routes, sitemap, and preview robots protection.
- The focused HTML crawl covered 47 sitemap URLs (33 episodes, nine categories, three subject guides, home, and About), with no failed status codes, missing readable episode text, missing headings/descriptions, canonical mismatches, or unintended indexing exclusions. Report: `.seo/runs/seo-2026-10-03.json`.
- Mobile checks at 390 × 844 verified complete gallery headlines, story opening, the restored dialogue transcript, and a curated guide without horizontal overflow. Desktop gallery rendering was also inspected.

These results validate the local implementation, not production deployment or Google's index. A deeper crawl of non-sitemap subject links encountered an upstream timeout; it was not counted as a successful full-site link audit.
