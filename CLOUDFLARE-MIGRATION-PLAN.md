# Angle → Cloudflare migration plan

Investigated 24 September 2026. Implementation is now underway: the website Worker is deployed and verified against the existing Angle v2 API. See [CLOUDFLARE-RUNBOOK.md](CLOUDFLARE-RUNBOOK.md) for current status, verified resources and rollback records. The original investigation below records the initial assumptions; its access and backend unknowns have since been resolved.

## Recommendation

Move the website and HTTP API to **Cloudflare Workers with Static Assets** and connect it to the **existing Cloudflare Angle backend and publisher**. The user confirmed that episode creation/upload already happens in Cloudflare Angle. Reuse its existing database, media storage, API and authorization rather than introducing a second catalog or publisher. Keep the current frontend and public API contract. Do not import historical Supabase episode records or media. Preserve any new content already present in Cloudflare.

D1 for metadata and R2 for media are a suitable fallback design only if the existing backend still needs those capabilities. Their use in Angle has not yet been verified. References below to D1/R2 describe that conditional implementation; substitute the existing backend contract where it already provides the capability.

Reuse the existing `angle` application where appropriate, after checking what it actually contains. Its type and resources have not been verified. If it is a Pages project, do not assume it can be deployed to as a Worker: assess keeping Pages with Functions versus a separate Worker, preserving any existing backend. Do not overwrite an existing publisher or API just to reuse the name.

The recommendation fits the simple website visible here. Full retirement of Supabase depends on verifying the existing Cloudflare publisher no longer writes to Supabase and checking any mobile app consumers first.

## Evidence and limits

| Area | Verified finding | Migration implication |
| --- | --- | --- |
| Frontend | `public/index.html` contains the frontend, routing, gallery, and player. No Next.js or other frontend framework. | No framework conversion or Next.js adapter is needed. |
| Hosting | `vercel.json` defines API and HTML rewrites; handlers use `VercelRequest` / `VercelResponse`. | Convert handlers to Web `Request` / `Response` and explicit routes. |
| Data | `lib/supabase.ts` reads `episodes`, filters `status = completed`, and derives categories. | Replace this small data layer with parameterized D1 queries. |
| HTML rendering | Episode/category handlers read `public/index.html` using filesystem paths and inject metadata. | Read the template through the static asset binding or bundle it as text. |
| Share images | Three production image routes use `@vercel/og`; a separate test route exists. | Decide and validate a Cloudflare-compatible image strategy before launch. |
| Live site | `/api/health` responded successfully. `/api/episodes` returned 227 episodes; nonempty audio/cover hostnames were the Supabase project hostname. | Metadata and media both need replacements for future episodes. No old media copy is required. |
| Deployment drift | Live episode JSON includes `updatedAt`, absent from the checked-out mapping. | Identify the production commit/configuration before using this checkout as the migration baseline. |
| Domains | Public requests redirect to `www.newsangle.co`. Nameservers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`; `www` CNAME points to `f79de36434619d0a.vercel-dns-016.com`. | DNS authority migration is a separate operational step from moving the app. |
| Canonical URLs | Source mixes apex, `www`, and request-derived origins. | Standardize on the currently live `https://www.newsangle.co`, with apex redirecting there. |
| Publisher/auth | No publisher, upload handler, Supabase Auth usage, Realtime usage, schema migrations, or scheduled job configuration found in this repository. There is a TestFlight link. | Their absence here does not prove the wider product has no such dependencies. |

Account access limits: Supabase MCP returned an empty project list. Saved Wrangler authentication returned HTTP 403 from Cloudflare's accounts API; the available browser reached the Cloudflare login page. Consequently, the existing `angle` project, actual Supabase schema/policies/functions, storage configuration, Vercel deployment settings, and complete DNS zone have not been inspected. Public endpoint checks do not establish those facts.

## Target design

Preferred: Browser → website Worker → existing Cloudflare Angle API/service for published episode metadata. Use a private service binding where supported, otherwise its authenticated API. Map its response to the website contract and expose only public fields.

Conditional fallback if no reusable API exists: website Worker → existing/new D1 binding for published episode metadata.

Browser/player → existing Angle media delivery URLs. Use an R2 media custom domain if that is the existing or chosen storage architecture.

Existing Angle publisher → its current media storage and catalog. Verify how it marks publication complete; avoid changing a working publisher unnecessarily.

- Keep `public/` as static assets. Give API and rendered page routes explicit priority so SPA fallback does not swallow JSON endpoints or crawler metadata. Use an asset binding to retrieve the HTML template.
- Preserve `{ success, data, error }` JSON envelopes and existing camelCase episode fields, including any confirmed production additions. Normalize nullable fields and duration units (seconds).
- Use D1 only through server bindings; public reads must select published records and an explicit field list. D1 uses SQLite semantics, so Supabase/Postgres policies and functions are not portable. Implement authorization in the Worker for every write.
- Design a fresh schema for the confirmed publisher contract: text episode IDs, title, excerpt/description, category, status, timestamps, duration, audio/cover object keys, transcript, host, episode number, tags as JSON, and optional share-image key. Index status/date and status/category/date. Do not treat this proposed schema as a verified copy of production.
- Keep only publishable media in a public R2 bucket. If the publisher produces private drafts, use a separate private location until publishing. Prefer a media custom domain such as `media.newsangle.co`; verify availability first. Do not use the development `r2.dev` URL for production.
- Prefer generating share PNGs when publishing an episode, storing them in R2, with a static brand PNG for home/empty categories. Preserve the existing image route URLs by serving or redirecting to the appropriate image. If the publisher cannot generate images, prove a Workers-compatible renderer in staging before choosing it. Do not assume `@vercel/og` transfers unchanged.
- Use versioned media/image object keys, long cache lifetimes for those immutable objects, and short/revalidated metadata caches. Avoid today's year-long immutable cache on a mutable category image URL. Purge/update category pointers on publication.
- Keep preview and production databases, buckets, secrets, and publisher targets separate. Preview pages should be noindex.

## Implementation and rollout

### 1. Resolve the baseline and existing resources

Before any deployment, inspect Cloudflare `angle`: account, Workers versus Pages, deployed code, Git connection/branch, bindings, D1 databases, R2 buckets, custom domains, secrets by name, and active jobs. Determine whether a new backend already exists and reuse its API/schema where suitable rather than creating a competing one.

Verify Vercel's production commit against this checkout and capture the live route/response contract. Record configuration and environment variable names without putting secret values into the repository.

Inspect the user-confirmed Cloudflare Angle publisher and identify every remaining reader/writer of the Supabase project, including mobile builds, webhooks, scheduled jobs, and credentials. Inspect Supabase schemas, buckets, policies, functions and auth usage once account access is available. If users or other non-episode data exist, make a separate preservation plan: permission to omit episodes is not permission to discard accounts or other data.

**Exit gate:** correct application baseline, known destination, and a complete publishing/consumer dependency map. Full Supabase shutdown cannot be scheduled before this gate.

### 2. Port and validate on a preview hostname

Add Wrangler configuration, pinned tooling/lockfile updates, Worker entrypoint, resource bindings, migrations, and deployment scripts. Preserve the frontend design and move only the hosting/data integration.

Port these routes:

| Routes | Required behavior |
| --- | --- |
| `/`, `/icons/*`, `/images/*`, `/fonts/*`, `/robots.txt` | Static assets, correct content types, working fonts and share icon. |
| `/api/episodes`, `/api/episodes/:id`, `/api/categories` | Compatible JSON, GET/OPTIONS handling, 400/404/405/500 distinctions, published records only. |
| `/episode/:id`, `/:category`, `/new`, `/popular` | HTML metadata present before client JS; stable slugs and deep links. |
| `/sitemap.xml` and `/api/sitemap` | Only new published episode URLs, canonical hostname, escaped XML, consistent category slugs. |
| `/api/og-image`, `/api/og-image/:id`, `/api/og-image/category/:category` | Valid image responses, brand fallback, correct refresh behavior. |
| `/api/health` | Observable liveness; add a lightweight database readiness check without exposing internals. |

Retain direct `/api/render/...` aliases if the production contract shows consumers need them. Remove or restrict the diagnostic `/api/og-test` route. Ensure database failures are reported as failures rather than silently becoming 404s or home redirects.

For omitted episodes, serve a useful unavailable page with HTTP 404 and a link to current stories. Use 410 only if an ID is known to have been deliberately retired; an unknown ID alone does not prove that. Do not broadly redirect every removed episode to the homepage. Exclude all old IDs from sitemaps.

The gallery already has a basic empty message, but validate the entire zero-episode experience: loading state stops, story counter reads zero, filters work, share image falls back, no player errors occur, and the page still offers the app link. Unify category slug generation across frontend, metadata, API lookups, and sitemap.

### 3. Connect new publishing

First verify the existing Angle publisher end to end and connect the website to its published read API and media URLs. Do not rebuild it. Only if that publisher still depends on Supabase, adapt its remaining storage/writes to the existing Cloudflare resources (or R2/D1 if needed), through a private authenticated endpoint or service binding. Validate payloads, object existence and allowed media types; make retries idempotent using stable episode IDs. Mark an episode completed only after required media is available. Failed publication must not expose half-finished episodes.

Generate or upload the share image as part of publishing. Exercise a complete new episode in staging, including updating an episode and retrying a failed upload. No historical rows or files are imported.

If the iOS app talks directly to Supabase, decide its compatible update/rollout before retirement. Old installed builds may continue to depend on Supabase even when the website no longer does. An updated website alone is not a complete backend migration.

**Exit gate:** one new episode can be published, discovered, played, sought through, and shared end to end without Supabase.

### 4. Move DNS authority separately, retaining Vercel hosting

For the proposed Workers Custom Domain setup, establish the domain as an active Cloudflare zone. Obtain a complete zone export/inventory from the current DNS provider; public lookups cannot enumerate every record.

Copy all relevant records, including apex/www hosting, MX, SPF, DKIM, DMARC, verification records, CAA and other subdomains. Record current nameservers and DNSSEC/DS configuration. Coordinate DNSSEC and nameserver changes to avoid validation failures; do not leave a stale DS record. Keep existing Vercel destination records working while delegation changes, then verify website, mail and other services before application cutover.

Lower relevant adjustable TTLs ahead of time (ideally a day in advance). Nameserver delegation has its own propagation behavior; do not promise an instantaneous switch. Prepare both apex and www certificates/redirect behavior before launch. Account for the existing www CNAME when attaching the Worker custom domain; reconcile the conflict as part of the controlled cutover.

**Exit gate:** stable Cloudflare DNS authority, working existing Vercel site/mail, and a proven Cloudflare preview with media TLS.

### 5. Launch with a fresh catalog

Record the last known-good Vercel deployment and DNS records. Deploy the tested Worker and production D1/R2 bindings. Start production with only the intended Cloudflare catalog, preserving any new episodes already there; do not reset existing Cloudflare data. If that catalog is empty, optionally publish the first new episode before switching traffic.

If backend writes must change, briefly pause publishing and switch its destination once; avoid two competing write paths. If the existing Cloudflare publisher is already independent, keep it running and switch only the website read integration. Attach/switch the approved web hostnames to Cloudflare, preserve apex → www behavior, then resume publishing after smoke checks. Record the cutover time.

Check real production requests for home, deep links, APIs, sitemap, robots, images, media, and both hostnames. Confirm requests for new content no longer reach Supabase/Vercel. Watch request errors, D1 errors, publication failures, and playback errors closely for the first day, then through a suggested seven-day observation period.

### 6. Rollback and retirement

Rollback on sustained API failures, failed publishing, broken playback, incorrect route/canonical behavior, or certificate failures. For a Worker-only regression, restore the previous compatible Worker version. For an initial migration failure, detach conflicting Worker domain configuration and restore the saved Vercel DNS records within Cloudflare; leave nameservers on Cloudflare if DNS itself is healthy. Use recorded DNS settings and verify recovery externally.

Pause publishing during rollback and preserve all new D1 records/R2 objects. The old Vercel/Supabase site will not display Cloudflare-only episodes: make that temporary limitation explicit. Returning hosting to Vercel does not automatically roll back data or publisher changes. Resume new publishing only after choosing the authoritative backend; reconcile new records before a subsequent launch.

Keep Vercel and Supabase intact during observation. After all consumers have moved and the new flow is stable, remove obsolete jobs/integrations and credentials, then retire old services deliberately. Not copying historical content is not authorization to delete the old production project during this investigation.

## Launch acceptance checklist

- [ ] Existing Cloudflare application and production source verified; no unrelated application overwritten.
- [ ] Empty, one-episode, and multiple-category catalogs behave correctly.
- [ ] API shapes, nullable fields, ordering and published-only filtering match the agreed contract.
- [ ] New publisher works with retries; unauthorized writes are rejected; drafts stay private.
- [ ] Audio plays and seeks on desktop and iPhone/Safari; range requests return appropriate partial responses and headers. Verify CORS for the actual media delivery path.
- [ ] Crawler fetches receive correct title, canonical/OG metadata, valid share PNGs, and sitemap URLs without executing JS.
- [ ] Old episode links show the unavailable page; malformed paths, missing assets and API errors do not become successful HTML responses.
- [ ] Apex/www redirects, TLS, fonts, analytics, TestFlight links and DNS/mail records work.
- [ ] Health checks/logs, backup/recovery procedures, resource limits and billing alerts are configured for expected usage.
- [ ] Rollback is rehearsed, including how to preserve new Cloudflare-only content.
- [ ] No Supabase-dependent mobile clients or other services remain before Supabase retirement.

## Effort and unresolved inputs

Planning estimate: 2–4 engineering days for the website port, existing Angle API integration, share-image compatibility, staging and launch validation, assuming a usable backend API and account access. If Angle still requires data/media migration work, budget roughly 3–5 days for that broader website/backend scope, with mobile changes estimated separately. Add DNS lead time and the observation window. This is not a fixed estimate for migrating the entire Angle product.

Still needed: access to inspect the existing Cloudflare project; production deployment identity; existing Angle API/service contract, media URLs and publishing behavior; full DNS zone inventory; confirmation of any app/auth/non-episode dependencies. Traffic and media volume are also needed for a meaningful cost estimate—do not assume a free plan from the episode count alone.

## Platform references checked

- [Workers Static Assets bindings and routing](https://developers.cloudflare.com/workers/static-assets/binding/): assets binding and Worker-first routing controls.
- [D1 overview](https://developers.cloudflare.com/d1/): managed database with SQLite semantics and Worker access.
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/): public delivery through a custom domain and caching.
- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/): zone/domain setup and domain routing.

These document platform capabilities; they do not verify the configuration of the user's existing account.
