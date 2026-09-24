# Continuous gallery performance audit

24 September 2026. Scope: the continuous gallery at https://www.newsangle.co/ and its implementation in `public/index.html`.

## Recommendation

Preserve the continuous 15px/second animation. Replace the four full copies of the catalog with a bounded, recycling window of cards; supply thumbnail renditions; eliminate per-card icon fetches and unnecessary gallery rebuilds. Then compare a minimal requestAnimationFrame implementation with a compositor-driven Web Animations implementation on actual target devices.

These are evidence-backed optimization priorities, not a claim that a particular FPS improvement has already been measured. Application code was not changed in this research pass.

## Evidence collected

The live website and the local checkout differ: the live catalog currently has 227 older stories, while the local migration runbook describes a separate preview with three newer stories. The four-copy gallery implementation exists in both the fetched live HTML and the checkout. Testing only the small preview catalog would conceal the scaling problem.

| Observation | Evidence / interpretation |
| --- | --- |
| 227 stories | Live `/api/episodes`, successful JSON response |
| 908 card elements | Live DOM inspection at a 1280×720 viewport, DPR 2 |
| 9,799 total elements | Same DOM snapshot, including inline icons |
| 354,110 CSS-pixel gallery width | Live `.collection-grid.scrollWidth` |
| 380×500 CSS-pixel cards | Live image dimensions; mobile CSS specifies 340×450 |
| 2048×2048 source covers | First six loaded card images in live DOM |
| 512,396–829,894 bytes per cover | GETs of the first five catalog cover URLs; 3,297,190 bytes total |
| Covers already use WebP | HTTP content type; switching to WebP alone solves nothing |
| Lazy loading is functioning | First six inspected cards loaded; next six had no selected image source and zero natural dimensions |
| Catalog is 163,194 decoded bytes | HTTP body; Brotli response compression is enabled |
| Category response is 167 bytes | HTTP body |
| Shared SVG is 2,113 decoded bytes | HTTP body; per-card source calls `fetch` and parses/inserts it |
| Sample image cache lifetime is one hour | `Cache-Control: public, max-age=3600` |

The cover sample is five files, not a measurement of the entire library. The gallery does **not** download all 908 image elements immediately, and repeated URLs can share cached resources. Likewise, 908 JavaScript icon fetch calls do not prove 908 independent network transfers. The repeated asynchronous work and DOM insertion still exist.

No Chrome Performance trace interface was available in the connected tools. Browser inspection exposed DOM state but not the Performance API. Thus LCP, CLS, INP, dropped-frame percentage, GPU memory, and actual raster/decode durations are **unmeasured**. HTTP timings from a few GETs are not substitutes for Core Web Vitals. No Lighthouse score or claimed FPS improvement is reported.

## Findings and priorities

### 1. Bound the rendered gallery — highest priority

`renderEpisodes()` (`public/index.html:1828`) creates every filtered card, measures `scrollWidth`, then creates three further full copies (`:1879–1891`). Every card has nested text, a gradient, an image, a share button, inline SVG, and individual event handlers. Filters, modal close (`:1684`), and resize (`:2398`) recreate the gallery.

At the observed viewport only about four cards intersect the horizontal viewport. A pool of roughly 8–12 cards can cover those plus an overscan buffer. Compared with 908 cards, that is approximately **98.7–99.1% fewer card elements**. This is a structural reduction, not a predicted FPS percentage. Scale the pool with viewport width rather than hard-coding 12 for every display.

Keep all 227 story records in memory; mount only the visible window and a few neighbors. Recycling must preserve all stories, filters, share URLs, modal navigation, touch dragging, and keyboard focus. It does not require React, a new framework, or a carousel dependency. Google's virtualization guidance describes the underlying technique, despite using a React example. [Virtualize long lists](https://web.dev/articles/virtualize-long-lists-react-window).

Suggested geometry:

```text
stride = cardWidth + gap                 // desktop: 390px; mobile: 350px
logicalIndex = floor(logicalPosition / stride)
phase = logicalPosition - logicalIndex * stride
storyIndex = ((logicalIndex + offset) % storyCount + storyCount) % storyCount
poolSize = ceil(viewportWidth / stride) + 1 + 2 * overscan
```

Move a small track by `phase`, recycling offscreen slots only when a card boundary is crossed. Use logical indexes to jump directly on large drags rather than processing every skipped story. Prepare incoming content offscreen. At 15px/second, a 390px card boundary occurs only every 26 seconds during automatic motion; the existing animation still writes a transform every frame.

Handle 0, 1, 2, and 3-story categories explicitly; a short catalog may repeat within the bounded pool. Do not recycle a focused control into a different story. Preserve focus or pause motion while focus is inside the gallery. Delegate clicks to the track and resolve the current story ID rather than retaining stale closures in recycled slots.

### 2. Serve images sized for the cards — highest priority

2048px square covers are unnecessarily large for this presentation. A hypothetical full RGBA decode is 16MiB for one 2048×2048 image, compared with about 3.8MiB for 1000×1000. These are pixel-buffer calculations, not measured browser memory: decoders may downsample and browsers share or evict resources.

Provide either square renditions around 500/1000/1500px, or card-shaped crops at appropriate 1×/2×/3× resolutions. Preserve the existing crop. **For square sources with `object-fit: cover`, account for the 500px card height**: a 760px square is not enough for a full 2× rendering of a 380×500 card. A 1000px square or a 760×1000 crop is the appropriate 2× starting point. Mobile's 450px height similarly requires about 900px square at 2×.

Use responsive image selection, with a separate larger modal rendition. Compare quality before choosing encoder settings; target roughly 80–150KB for a typical 2× card as an initial budget, not a promised result. Five images at 100KB would total 0.5MB rather than the measured 3.3MB sample, approximately 85% less. Actual savings require encoding and visual review. [Responsive images and cropping](https://web.dev/learn/design/responsive-images).

Load visible cards eagerly; assign high fetch priority only to the likely LCP image, if profiling identifies one. Load a bounded set of upcoming cards in advance. Set `decoding="async"`; when replacing a recycled image, wait for `decode()` before revealing it, with a placeholder/error path. Avoid holding the whole gallery behind every image promise, and do not keep an unbounded cache of decoded Image objects. Native lazy loading is useful but its lookahead is browser-dependent. [Image loading](https://web.dev/articles/browser-level-image-lazy-loading), [decode()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode).

If renditions are cached for a long time, use versioned/content-addressed URLs so changing artwork is reliable. Moving the original large image to a different host alone does not reduce its pixel count.

### 3. Remove icon work and unnecessary rebuilds — high confidence, inexpensive

`createEpisodeCard()` calls `loadShareIcon()` for every card (`:1126–1189`). Embed the existing SVG once as a symbol/template or fetch it once via a shared promise. Reuse its markup without a request and asynchronous completion per card. Preserve the existing icon design.

Closing a modal should resume the existing gallery at the stored position, not reconstruct 908 cards. Resize should update geometry and the small pool only when needed; the existing resize callback also rescales position after `renderEpisodes()` already did so, potentially applying the adjustment twice. Attach audio lifecycle listeners once: `initAudioPlayer()` currently adds listeners on each open, while `cleanupAudio()` clears the source without removing those listeners. This creates accumulating callbacks across modal visits. Fix as part of modal lifecycle work.

### 4. Refine animation scheduling — after reducing content

The current animation already uses `transform` and the track has `will-change: transform`. It is not animating `left`, and there is no geometry read inside its frame loop. Do not describe it as per-frame layout thrashing or expect `translate3d()` alone to solve it.

A lean requestAnimationFrame loop over a bounded track may suffice. Cache element references, batch drag input into one write per frame, and perform no card construction or image swaps on routine frames. Stop when the modal is open, the gallery is outside the viewport, the document is hidden, or reduced motion is requested. Reset the timestamp on resume to prevent a large catch-up jump; background rAF is ordinarily suspended by the browser. [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

Benchmark CSS/Web Animations transforms as an alternative for automatic motion. Eligible animations can run on the compositor without a JavaScript transform write every frame, but rasterization and layer size still matter. Web Animations offers pause/play and a readable/writable current time for dragging. Recycling and restarting segments must preserve phase, and delayed main-thread callbacks must not reveal an empty edge. This adds synchronization complexity: do not assume the API switch is the first or sufficient fix. [Rendering pipeline and compositor animations](https://web.dev/articles/animations-overview), [Web Animations controls](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API).

Use `will-change` on the small moving track; do not promote hundreds of cards individually. The measured long strip does not mean the browser allocates a single 354,110px texture: browsers tile and cull. Actual layer/raster costs need a trace.

### 5. Correct seam and lifecycle problems

The current one-set `scrollWidth` excludes the inter-set gap. For N desktop cards it measures `N × 380 + (N − 1) × 10`, while the first card of the next copy starts at `N × 390`. Wrapping at the former introduces a **10px mismatch**. At 227 stories and 15px/second the complete loop takes about 98 minutes, so this cannot explain constant initial stutter; it is more noticeable in short filters or when dragging across the boundary.

Mobile currently discards two stories out of every five (`:1852`). This is not virtualization and makes part of the catalog inaccessible there. The bounded renderer should retain the full list unless that omission is an explicit product requirement.

The share buttons use backdrop blur, and the modal blurs the page while the gallery animation continues behind it. Pause the gallery behind the modal first. A/B-test share-button blur only if traces still show expensive rendering; do not remove the visual treatment based on speculation.

### 6. Loading/API cleanup — secondary for this symptom

The 163KB decoded catalog is modest relative to the sampled cover files. Keep catalog metadata if it makes random order and filters easy. A summary-only catalog and detail-on-open can help future scale, but pagination alone leaves fourfold DOM duplication and image decode costs unresolved. Do not fetch audio bodies for gallery cards; the current card markup does not do this.

The entry page waits for both categories and episodes via `Promise.all`; derive categories from the same catalog or render cards before a separate category request finishes. Verify caching against publication/withdrawal requirements before introducing stale catalog responses. The in-progress hosting migration is a separate concern from the frontend bottlenecks measured here.

## Alternatives assessed

| Approach | Assessment |
| --- | --- |
| Four copies → two copies | Useful temporary reduction, but still 454 cards and scales with the catalog; repeat enough content to cover the viewport for tiny categories |
| `content-visibility: auto` | Possible interim paint/layout reduction; retains DOM and does not eliminate icon work or oversized sources; check behavior on the horizontally transformed track |
| CSS/WAAPI over the existing huge strip | Can reduce main-thread motion dependence, but leaves the large DOM and assets in place |
| Bounded recycling + responsive images | Recommended: rendering cost follows viewport size rather than story count |
| Framework/carousel-library rewrite | Unnecessary for this fixed-size vanilla-JS gallery |
| Hosting switch alone | Can affect response latency; cannot remove client rendering and image decode work |

`content-visibility` keeps offscreen content in the DOM and accessibility tree. It is a different tradeoff from recycling, not an equivalent replacement. [Browser rendering guidance](https://web.dev/articles/content-visibility).

## Verification before calling it smooth

Use a production-like fixture with at least 227 and 1,000 unique stories, plus categories containing 0/1/2/3 stories. Ensure image diversity: reusing one cover hundreds of times hides decoding pressure.

1. Capture baseline and optimized Performance traces on the same device, viewport, refresh rate, and cache state. Test desktop Chrome plus a real iPhone/Safari; include a mid-range Android if it is a target audience. CPU throttling is a useful supplement, not a substitute for device/GPU testing.
2. Record cold load, 60 seconds of warmed auto-scroll (enough to cross two desktop card boundaries), rapid forward/backward drags, filters, resize/orientation change, modal open/close, and background/foreground transitions.
3. Inspect frame presentation/dropped frames, long tasks, image decoding, style/layout, paint/raster, and layers. A 60Hz frame has 16.7ms; 120Hz has 8.3ms. Average FPS or a good loading score alone can conceal visible hitches. [Chrome runtime performance tooling](https://developer.chrome.com/docs/devtools/performance).
4. Proposed acceptance targets: card DOM stays viewport-bounded as catalog grows; no routine per-frame layout; at most one share-icon fetch per page; no complete gallery rebuild on modal close; no blank incoming images, seam jump, or sustained memory growth across repeated browsing.
5. Measure LCP/CLS and interaction latency separately. For a deliberately ambitious smoothness budget, aim for less than 1% dropped frames in each warmed 60-second lab scenario; report device-specific results rather than promising universal FPS.
6. Verify all stories remain reachable on mobile, focus is stable, reduced motion works, and category/episode deep links, sharing, browser history, and audio still work.

Implementation order: eliminate repeated icon work and needless rebuilds; introduce the bounded renderer; add image renditions and controlled predecode; then use traces to decide whether compositor-driven auto-motion or blur changes add a meaningful benefit.
