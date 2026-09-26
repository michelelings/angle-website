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

Both changes are local until deployed. Deploying the API enables the smaller
response; the website change opts into it. Either deployment order is compatible:
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
