# Angle SEO work record

This is a project-owned measurement scaffold based on the publicly visible workflow at https://initialcommit.co/library/skills/seo. It is **not** the complete Initial Commit skill, an installation of it, or a declaration of compatibility with its private configuration schema. The full 89-file bundle is members-only and was not available. No recurring automation is enabled.

Measure → compare candidate actions → repair one verified issue → verify → record. Do not manufacture search traffic, keyword demand, CTR, rankings, conversions, or AI citation data.

## Run

```sh
npm run seo:measure -- https://www.newsangle.co latest
npm run seo:measure -- http://localhost:3101 candidate --assert
```

The report measures server-returned HTML, canonical tags, metadata, headings, internal link responses, incoming links and depth from home. It records single-observation TTFB and response weight, not browser Core Web Vitals. Scripts and noscript content are excluded from the discovery graph. Requests are read-only and follow the site's sitemap; no paid data provider is called.

Preserve dated run records when comparing releases. The initial `before.json` used a string comparison that flagged the root canonical without its trailing slash; these URLs normalize to the same URL. That was a measurement false positive, not a site defect. The script now compares normalized URLs.

## Verified foundation

- Site: https://www.newsangle.co — Angle, an audio-story website.
- Stack: Next.js, React, Cloudflare Workers/OpenNext; public catalog from angle-api.
- Product facts supported by the code: episodes have playable audio, summaries, transcripts, categories and share links; the acquisition CTA links to TestFlight. Do not claim paid/free pricing, publishing frequency, editorial verification, audience reach or app-store availability without evidence.
- Existing voice/design: `docs/style-guide.md`; product copy: `lib/site.ts`, `components/`.
- Working objective: help visitors discover relevant episodes and reach the app. This is inferred from the existing CTA, not a user-approved growth target.

## Missing connections, in value order

1. Google Search Console for this domain: actual queries, impressions, clicks, CTR and indexing evidence. No callable Search Console connector was available in this session.
2. Conversion reporting: verify which existing analytics events represent episode listening and app acquisition before optimizing toward a business outcome. A GA tag alone is not verified access to reports.
3. Optional OpenSEO/DataForSEO: keyword, competitor and backlink research. OpenSEO is a separate service with MCP support; self-hosting still needs paid DataForSEO data. No account, API spend or service deployment is configured here.

The exact Initial Commit ZIP is also needed to install its full skill and supporting scripts. Once supplied, follow its migration workflow against this project-owned state rather than assuming the files here match its schema.
