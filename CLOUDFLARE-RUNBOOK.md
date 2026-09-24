# Cloudflare deployment and cutover

## Verified on 24 September 2026

- Account: Angle (`118438a64acf487f0c03264439e49d9b`).
- Website Worker: `angle-website`; preview: https://angle-website.footy.workers.dev.
- Production version: `adb90f8b-1a13-4915-8443-c097455dde66`.
- Reads `angle-api` through a service binding and its published `/v2/episodes` contract. The backend owns D1, R2, publication and withdrawal. No database or media is copied or modified.
- Three current published episodes; historical Supabase episodes are omitted.
- Seven route tests, TypeScript check and Wrangler build pass. Deployed readiness, catalog, episode/category HTML, sitemap, stream view and PNG share image return successfully. Browser audio playback and pause verified. Media supports range requests. Old/missing episode URLs return 404.
- Frontend incorporates upstream `90a12afa9eff8eb4b6d497c498a125608fe4d9a3`, including stream view and sitemap redirect. Git fetch was unavailable; upstream files were retrieved through GitHub API. No commit or push has been made.

## Commands

```sh
npm ci
npm run types:cloudflare
npm run test:cloudflare
npm run type-check:cloudflare
npm run build:cloudflare
npx wrangler deploy
```

`wrangler.jsonc` deploys production with Worker routes for `newsangle.co/*` and `www.newsangle.co/*`. Both DNS records must remain proxied. The workers.dev hostname remains noindex; production www is indexable. Canonical origin is https://www.newsangle.co.

## Cutover completed — 24 September 2026, 09:03 UTC

Cloudflare zone is active. Registry and 1.1.1.1 confirm Cloudflare nameservers. Worker routes cover both hostnames; no origin fetch or pass-through is used. Apex DNS is proxied A `192.0.2.1` (placeholder for Worker routing); www is proxied CNAME `newsangle.co`. These replace the Vercel destinations. Existing MX and TXT records are unchanged.

Verified against Cloudflare's authoritative IP with normal TLS certificate validation: catalog HTTP 200 with exactly three new episodes, production robots allows indexing, apex redirects 308 to www, and omitted episode returns 404. Some recursive resolvers may retain old Vercel answers until cached TTLs expire. Vercel/Supabase subscriptions are not cancelled by this cutover.

Custom-domain attachment initially failed because existing records conflicted. The final deployed setup uses supported zone Worker routes and proxied DNS instead; future deploys preserve these routes.

## DNS rollback inventory

Read from Namecheap Advanced DNS and authoritative DNS on 24 September 2026. DNSSEC disabled; no DS record found. No email forwarders or catch-all configured in Namecheap.

| Type | Host | Value | Priority |
| --- | --- | --- | --- |
| A | @ | 216.150.1.1 | |
| CNAME | www | f79de36434619d0a.vercel-dns-016.com. | |
| TXT | @ | google-site-verification=sh8AbcSEsmXE4sDOIkNObS56kRw5ceMV1LMuh4r3kPk | |
| TXT | @ | v=spf1 include:spf.efwd.registrar-servers.com ~all | |
| MX | @ | eforward1.registrar-servers.com. | 10 |
| MX | @ | eforward2.registrar-servers.com. | 10 |
| MX | @ | eforward3.registrar-servers.com. | 10 |
| MX | @ | eforward4.registrar-servers.com. | 15 |
| MX | @ | eforward5.registrar-servers.com. | 20 |

Original nameservers: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`. Namecheap shows Automatic TTL. Preserve verification and mail records while changing website hosting.

Cloudflare zone `d6ebcf64de1a5cd533390b19557e49a8` was created on the free plan and all nine records were imported and compared with Namecheap. Namecheap saved `kobe.ns.cloudflare.com` and `liz.ns.cloudflare.com` as custom nameservers. Registration and renewal remain at Namecheap. Initial handoff preserved Vercel using DNS-only records; the completed cutover above supersedes that temporary configuration.

## Rollback

Keep Vercel and Supabase available during observation. For a Worker regression, use `wrangler rollback` with a verified previous version. To return website hosting to Vercel, restore the original A/CNAME records above as DNS-only (bypassing Worker routes). Keep Cloudflare nameservers if DNS itself is healthy. Verify both hostnames and TLS externally. The old site will show its old catalog, not the new Cloudflare-only stories.

Do not delete Supabase until all mobile/auth/other consumers are checked. Publishing remains on the existing Cloudflare backend throughout this website migration.

## Codex setup

Cloudflare's official setup installed 14 skills and registered cloudflare, cloudflare-docs, cloudflare-bindings, cloudflare-builds and cloudflare-observability MCP servers. Main cloudflare OAuth verified. Docs requires no OAuth; the three specialized servers still require login on use. Restart Codex to load the new tools.
