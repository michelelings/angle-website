# Angle SEO audit and plan

Audited 24 September 2026. Production: https://www.newsangle.co.

**Verdict: the technical foundation is sound, but search discovery, content presentation, and measurement need work.** We can verify that pages are accessible and contain useful text. We cannot yet say that SEO is producing traffic or app acquisition: Search Console and analytics reports were not available in this audit.

The recommended objective is qualified organic visitors who listen to a story and then consider the app. This is inferred from the existing product and TestFlight CTA; it should guide measurement until a different business objective is chosen.

## Evidence and scope

- Crawled all 10 production sitemap URLs and their internal links using the existing `seo:measure` script. These comprise 3 episodes and 7 catalog/collection pages.
- Compared sitemap episode coverage with the public episodes API.
- Inspected production robots.txt, canonical redirects, a search URL, nonexistent routes, all episode transcripts and structured data.
- Reviewed the current Next.js source, installed Next.js metadata and not-found documentation, and current Google Search Central guidance.
- This is an HTTP/source audit, not a browser performance audit, backlink audit, editorial fact-check, or Search Console indexing report. Search-engine spot checks did not establish visibility; absence from those results is not proof of non-indexing.
- Existing untracked duplicate files were left alone. No application code was changed or deployed.

Raw evidence: [crawl](../.seo/runs/research-2026-09-24.json), [additional probes](../.seo/runs/research-2026-09-24-extra.json). Earlier reports in this repository describe previous states; this audit uses fresh production observations.

## What is already working

| Area | Verified result |
| --- | --- |
| Availability | All 10 sitemap URLs return HTTP 200. |
| Indexing directives | All 10 have index/follow, with no blocking X-Robots-Tag observed. Production robots.txt allows crawling and references the sitemap. |
| Canonicals | All 10 match the intended production URLs after URL normalization. The homepage's trailing-slash variation is not a defect. |
| Basic metadata | All 10 have titles, descriptions, and one H1. Heading presence alone does not establish useful wording. |
| Links | No broken links, redirecting links, or orphan sitemap pages in the measured server-HTML graph. Episodes are reachable at depth two through the stream view. |
| Episode text | All 3 have approximately 1,359–1,619 transcript words in initial HTML, including the transcript toggle label. Expanding the details element is not needed to fetch that text. |
| Structured data | All 3 contain parseable PodcastEpisode JSON-LD with AudioObject, duration, image, and dates. This is not a rich-result eligibility certification. |
| Sitemap coverage | All 3 episodes exposed by the public API are included; no missing or extra episodes. |
| Redirects | HTTPS apex redirects to www with 308; `/index.html` redirects to `/`; `/sitemap_index.xml` redirects to `/sitemap.xml`. |

## Prioritized findings

### 1. High: we cannot measure whether SEO works

GA is present and `download_click` is implemented, but report access and event receipt are unverified. The current audio player does not instrument listening milestones. A TestFlight outbound click is not an installation.

**Action:** verify the Search Console domain property, submit the sitemap, and inspect the homepage and all three episodes. Export queries/pages/countries/devices for the available period, preferably 90 days. Verify existing GA events before adding `audio_start`, meaningful listening progress, and completion with episode IDs. Confirm page attribution for direct visits and intercepted episode dialogs.

**Done when:** a baseline records indexed canonical pages, impressions, clicks, CTR, organic landing pages, listening starts, and TestFlight clicks. Indexing and ranking remain Google's decisions, not engineering acceptance criteria.

### 2. High: the main gallery has no ordinary episode links in initial HTML

`components/gallery.tsx` initially emits an empty grid and a noscript fallback; `lib/gallery/card.ts` inserts real anchors after JavaScript runs. The homepage and category pages therefore have no episode links in the measured server HTML outside noscript. `/home-v2` supplies the working crawl path.

This is a rendering dependency, **not proof that Google cannot index the episodes**. Google can discover JavaScript-generated anchors. Providing them in initial HTML makes discovery more direct and robust. [Google's JavaScript link guidance](https://developers.google.com/search/blog/2020/05/frequently-asked-questions-about)

**Action:** server-render a useful, visible initial gallery/list with episode titles, summaries, and real anchors; progressively enhance the existing motion and modal behavior. Add a linked category/breadcrumb and genuinely related episodes on detail pages.

**Done when:** initial homepage/category HTML contains links to relevant episodes, direct episode routes still work, and keyboard navigation and modal behavior survive enhancement. Do this before consolidating the stream view.

### 3. High: titles and headings communicate little search intent

The homepage title is `Angle`; its description is `Stories worth listening.` Category headings show a story count rather than the topic. One category is a full Greenland story description, while another displays the raw `sanctions-and-aviation` slug. Episode meta descriptions reuse long editorial summaries.

**Action:** make the product and subject clear in titles and prominent headings; give categories curated labels and useful introductory copy. Add a separate concise SEO description instead of truncating or replacing the full on-page summary. Preserve editorial uncertainty in political/news titles.

Draft starting points, to validate against product positioning and query data:

| Page | Proposed direction |
| --- | --- |
| Home | `Angle — Audio Stories and News Explainers` |
| Home description | `Listen to stories about technology and world events. Explore audio episodes, read transcripts, and discover Angle.` |
| Technology | `Technology Audio Stories and Explainers | Angle` |
| Airline episode | `How Sanctions Can Disrupt Airline Operations | Angle`, only if editorial review confirms that this captures the episode's scope. |

These are editorial hypotheses, not researched keyword-volume claims. Google may rewrite titles and snippets; there is no mandatory 60/160-character limit. [Title guidance](https://developers.google.com/search/docs/appearance/title-link), [snippet guidance](https://developers.google.com/search/docs/appearance/snippet)

The apparent doubled H1 text in the crawler report comes from an animated aria-hidden span plus a screen-reader span. It is not two H1 elements and should not be treated as a ranking defect.

### 4. High: news explainers need visible provenance

Episodes mention source organizations in prose, but the audited pages have no outbound source links. Their external links are TestFlight and social profiles. The current templates provide no linked editorial identity, methodology, corrections policy, or About page. Presenter names alone do not establish who researched or reviewed a story.

**Action:** add source links tied to claims, editorial/reviewer attribution where accurate, publication and genuine update dates, an About/editorial-methodology page, and a corrections/contact route. Explain AI involvement if applicable; do not invent human review or credentials. Use transcript section headings and speaker labels for readability, preserving the existing server-rendered text.

**Done when:** every published episode lets a reader verify sources and understand who is responsible for it. Reassess content accuracy separately; this audit did not validate the news claims. These recommendations follow Google's emphasis on clear sourcing and authorship, not a promise of a ranking boost. [Helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

### 5. Medium: collection URLs need an intentional indexing policy

There are seven collection URLs for three episodes. `/new` repeats the full catalog; `/home-v2` is an alternative presentation. Each category currently contains one episode. This is not a duplicate-content penalty, but several pages offer little distinct value. `/popular` currently selects the newest 30% rather than using popularity signals.

**Action:** retain indexable category pages when they serve a distinct purpose with useful content. Canonicalize equivalent alternate views to `/` and remove noncanonical URLs from the sitemap once direct episode links are established. For distinct internal search result pages, use a deliberate noindex policy rather than relying solely on the current base-page canonical. Avoid conflicting canonical/noindex signals on the same duplicate views. Replace the popularity placeholder with real data or an accurate label.

Maintain a small controlled taxonomy; do not automatically create new landing pages for every title or tag. Redirect category URLs if normalization changes them. Keep stable episode IDs; a cosmetic slug migration is not a priority. [Canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### 6. Medium: missing-page status and modification dates need cleanup

Both nonexistent category and episode probes returned **200 with noindex**, including a Googlebot-user-agent episode probe. Installed Next.js documentation explicitly describes this behavior for streamed not-found responses. The noindex provides protection; this is not evidence of indexed error pages.

**Action:** investigate whether route validation can finish before headers stream, returning actual 404s while retaining noindex. Verify both ordinary and crawler responses on the deployed runtime.

The sitemap has no lastmod values, and the existing coverage script flags all three episodes. Lastmod is optional, so the sitemap remains valid. The V2 mapping sets `updatedAt` to `createdAt`, which would conceal later revisions.

**Action:** propagate truthful content-update timestamps, then emit accurate lastmod. Do not set dates to request time or deployment time. [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

### 7. Medium: performance is unproven

Observed request-to-headers times were 256–1,372 ms, with 348,181 total uncompressed HTML bytes across the ten responses. These are single network-inclusive observations, not Core Web Vitals or proof of a regression against an earlier run.

**Action:** measure mobile home, category, and episode templates with a browser and consult Search Console/CrUX if enough field data exists. Investigate gallery initialization, cover images, fonts, and data latency only where measurements implicate them. Targets at the 75th percentile: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. Use lab results diagnostically if field data is unavailable. [Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals)

## Delivery plan

Estimates are planning ranges, not commitments; access and content preparation may dominate elapsed time.

| Timing | Work and owner | Completion evidence |
| --- | --- | --- |
| Days 1–2 | Product/analytics owner: Search Console baseline and event verification. Engineer: server-render gallery links. | Baseline saved; all 3 episodes linked directly in initial HTML; existing UI verified. |
| Days 3–5 | Product/editor + engineer: homepage copy, topic headings, category labels, concise descriptions, episode category links. | Review all 10 pages; retain valid canonicals and working direct/modal routes. |
| Week 2 | Editor: source links, attribution, methodology, corrections; engineer: 404 investigation, truthful timestamps, sitemap and alternate-view policy. | Sources available for all 3 episodes; intended canonical URLs in sitemap; missing-page and timestamp checks. |
| Weeks 3–4 | Product/editor: validate query themes and improve 2–3 existing episode pages; engineer: measured performance fixes and richer transcript presentation. | Query-to-page map, dated change log, browser/field performance baseline, verified listening events. |
| Day 30, then day 60 | Review indexing, nonbrand discovery and listening/acquisition outcomes. | Compare consistent periods and page cohorts; record uncertainty where impressions are too sparse. |

Initial demand hypotheses: audio news explainers, technology audio stories, and precise subject questions answered by the existing episodes. Prioritize questions where Angle can add distinctive value. Review actual result pages and Search Console queries before selecting targets. No search volumes, competition scores, backlink counts, or traffic forecasts were established here.

After foundational improvements, publish only useful, sourced episodes within a coherent editorial scope. Seek legitimate distribution through relevant communities and credited collaborators; no outreach was performed in this audit. Do not set an arbitrary article quota or expand into broad topics merely to obtain more indexed URLs.

## Measurement and release checks

- Track intended indexable URLs and Google-selected canonicals, rather than treating every alternate view as an indexing target.
- Track nonbrand impressions/clicks, query-to-page fit, and CTR with position and query mix in view. More impressions alone is not a business outcome.
- Track organic listening starts, meaningful listening progress, and TestFlight clicks. Label clicks as outbound interest, not installs.
- Run `npm run seo:measure -- https://www.newsangle.co <unique-label>` after deployment and compare against this baseline. Expand the checker to distinguish generic H1 presence from useful headings, assert direct episode links, and verify missing-route behavior.
- Fix the sitemap coverage check so confirmed coverage/freshness failures can fail CI; it currently logs discrepancies without setting a failure code for them. Missing optional lastmod should only become a release failure once accurate lastmod is an agreed requirement.
- Review technical effects immediately; review organic outcomes after sufficient observations. Thirty days may be too short for reliable conclusions on a three-episode catalog.

Keep structured data maintenance behind the higher-impact work. Add truthful publisher/series relationships if useful, but do not promise special podcast results. Preview video metadata alone does not make an audio page eligible for video results; only invest in video SEO if watchable video becomes a primary product experience. [Video guidance](https://developers.google.com/search/docs/appearance/video)

Unresolved checks: verified Search Console indexing/performance, browser rendering and Core Web Vitals, actual analytics event delivery, backlinks, and preview-host behavior. An HTTP-to-HTTPS probe timed out from this environment; the HTTPS apex-to-www redirect was verified successfully.
