# Gallery deployment — 2026-09-24

Published the gallery optimization to Cloudflare production at approximately 09:34 UTC.

- Worker: `angle-website`
- Version: `b25f1238-abbe-4cc6-99ca-f8d6dbef5ae0`
- Source: isolated archive of commit `1fe9980`, excluding concurrent unfinished workspace edits.
- Previous version: `adb90f8b-1a13-4915-8443-c097455dde66`
- Routes: `newsangle.co/*`, `www.newsangle.co/*`
- Vercel was not updated.

Generated nine WebP renditions for the three stories currently returned by the Cloudflare catalog. All renditions and the manifest were verified on both the Worker URL and the production domain through Cloudflare. Covers return immutable caching headers; readiness reports a reachable catalog.

Validation: 12 gallery tests (including the new height-only mobile resize regression), eight Worker tests, Worker TypeScript checks, and the deployment dry run passed. The regression test was copied into the isolated archive for validation; it does not affect deployed assets.

The production browser loaded three ready images using the 500px renditions at a 390px viewport width. Changing viewport height from 844px to 744px left the accessibility tree unchanged and all covers loaded with the same sources. This is simulated mobile viewport verification, not a physical phone test.

The previous deployed homepage rebuilt its gallery on every window resize, including height-only changes. The deployed optimized gallery preserves image elements for those changes, addressing the identified blinking trigger.
