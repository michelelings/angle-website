# Episode data loading

The website requests `GET /v2/episodes/:id?view=website-v1`. The implementation
is in the Angle backend's `cloudflare/api/website-episode.mjs`, called from the
existing published-episode route. The default API response remains unchanged.

The compact view keeps the article/story, taxonomy, corrections, source links,
key facts, readable solo script and the selected playback transcript. It sends
only the selected rendition's section timings and IDs needed for story, map,
key-fact and paragraph highlights. Word checkpoints, switching checkpoints and
repeated evidence metadata are omitted. Duo is selected when available;
otherwise the first available rendition is used, matching the website mapper.

This is one complete reading response, not a sequence of paragraph requests.
Existing navigation previews and hover/focus prefetching make the header available
while it loads. Episode data uses a 60-second edge cache keyed by publication;
search reuses the same compact response and retains its transcript index.

## Rollout

Deploying the API enables the smaller response; the website change opts into it.
Either deployment order is compatible:
the older API ignores the query and the website can still parse its full response.
No media backfill, database migration or published-artifact mutation is needed.
The API still checks publication access and returns 404 for drafts/withdrawals.

## Verification

A saved public response for The Trailing Heel produced identical website models
before and after projection: 517,971 → 72,997 JSON bytes; local gzip compression
85,951 → 23,275 bytes. These are payload measurements, not a page-load benchmark.
The stored manifest is still read and parsed; the projection reduces serialization,
transfer and downstream parsing, and links only the selected mode's story sections.

Backend projection and D1/R2 route tests cover selected timing, missing alignment,
source IDs, preserved default responses and release access. Website tests cover
the compact request, caching, solo-only transcript search and playback highlights.

## Production rollout — September 26, 2026

- Website code: `169e4c9`; Cloudflare version `ff018926-543c-4ab8-b0b9-2edf52234eea`.
- API code (Angle repository): `6839e93`; Cloudflare version `bfc38303-2861-44ce-a743-39da7c994dbb`.
- Both were pushed to GitHub and deployed from clean commit archives. The API's
  previously untracked runtime dependencies were included; staged iOS work and
  unrelated local website files were left untouched.
- Website tests (96), isolated API tests (66), the OpenNext build, Worker type
  check and both deployment dry runs passed.
- Live full/compact responses mapped identically and matched the sizes above.
  The default API response and API bindings/runtime were preserved. Audio range
  requests returned 206, and a nonexistent compact episode returned 404.
- Homepage, direct episode, readiness and sitemap returned 200. Browser navigation
  showed the immediate preview, completed the story load, and returned to the
  overview when closed.
- A prepared cover's small (29,688 bytes) and medium (175,380 bytes) WebPs matched
  the upstream files byte-for-byte through the website artwork route.
