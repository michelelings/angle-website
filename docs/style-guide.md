# Angle — Paper and ink

## Current artwork-led treatment

The following September 24 refinements supersede the original paper-and-ink colors and story-detail layout described below. The current Next.js site uses `app/episode.css` over the shared baseline stylesheet.

- Full-view mesh gradients sample five colors from the artwork using Color Thief. The gallery follows the centered story with an 850ms eased color blend that can retarget during rapid browsing; reduced-motion users get immediate changes. The stream starts with its leading story. Each fullscreen episode has its own palette. Stops are darkened for readable white text, with a fallback mesh when extraction fails.
- Artwork uses a true 3:4 frame in the homepage gallery, stream cards, and episode view. On desktop the episode artwork, player, and action row stay in the left column while native page scrolling moves the right column, including when scrolling over the artwork.
- Share sits beside Get Angle below the player. Publication date sits beside duration and speakers beneath the title. Transcripts are not rendered in the episode interface.
- Episode views fill the viewport without an inset card, border, or rounded outer corners. On mobile the artwork and controls stay above the scrolling story. The same presentation serves direct episode links and intercepted dialogs.
- Reckless Condensed headings and Inter reading text, metadata, and controls replace the original font choices. Regular and italic Reckless Standard files remain available for future use.
- Homepage category tabs filter the loaded catalog in place through native browser history. Keep the header, search index, and backdrop mounted; retain shareable category URLs, browser Back/Forward, and the selected filters when an episode is opened and closed.

Website style direction, September 24, 2026. Implemented locally in the gallery and stream view after approval of this direction. Deployment is separate. Shared tokens and component styles live in `public/styles/paper-ink.css`.

## Starting point

The website already uses LTT Recoleta for headlines, Berkeley Mono for labels and metadata, and system sans-serif for longer reading. These fonts are the foundation of the new direction. The repository did not contain a dedicated brand/style guide when this document was created.

The supplied screenshots show textured editorial illustrations in muted blue, cream, ochre, and terracotta. The current black page, full-image text overlays, and heavy black card gradients obscure their color and detail. The proposed website should feel like an illustrated news journal: calm, warm, readable, and precise.

## Color

These interface tokens complement the supplied artwork. They were introduced with this redesign rather than sampled from an older brand guide.

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F4F0E7` | Main page background |
| Sheet | `#FFFCF6` | Story cards and detail surfaces |
| Ink | `#252C2D` | Headlines, body copy, primary buttons |
| Secondary ink | `#596361` | Metadata and secondary text |
| Rule | `#D8D5CC` | Quiet separators and card borders |
| Deep blue | `#365D70` | Links, selected filters, focus indicators |
| Pale blue | `#E3EBEC` | Player backgrounds and supporting surfaces |
| Terracotta | `#AD5037` | Small editorial accents |

Use paper and ink for most of the interface. Let illustrations supply the wider palette. Use terracotta sparingly; do not assign arbitrary bright colors to every category. Verify text contrast for actual foreground/background combinations during implementation. Decorative rules must not be the sole indicator of a control or state.

## Typography

- **Headlines:** Reckless Condensed at regular weight. Card titles: 28–32px, line height 1.12. Detail titles: 40–48px desktop and 30–34px mobile, line height 1.1–1.15.
- **Reading:** Inter, 16px/1.6 for summaries; 17–18px/1.65 for story detail text. Keep paragraphs around 60–70 characters wide.
- **Labels and controls:** Inter, with labels at 11–12px/1.5 and modest tracking. Uppercase only for short category names and brief metadata.
- **Hierarchy:** category, headline, short summary, then duration/date/host. Headlines carry the emphasis; labels stay quiet.

All fonts are self-hosted in `public/fonts/`. `--serif` selects Reckless Condensed, and `--sans` selects Inter; the legacy `--mono` token also resolves to Inter. Both Reckless Condensed S and Reckless Standard M include regular and true italic faces at weight 400. Reckless Standard is available through `--serif-standard` for future use. Inter includes variable regular and italic faces from [Inter 4.1](https://rsms.me/inter/), with its license alongside the files.

## Story covers and cards

The illustration is the cover. Present it at full brightness above an opaque sheet-colored text area. Remove the dark gradient and text-on-art treatment.

- Prefer a square artwork area to preserve the existing square covers. Use the original artwork in full; do not bake text, buttons, or dark overlays into it.
- Start with cards around 340–380px wide on desktop and `min(86vw, 360px)` on mobile. Align artwork and text-panel boundaries across the row.
- Use 24px padding in the text panel, a 16px outer radius, and a thin rule-colored border. Avoid prominent drop shadows.
- Put a short category label above the title. Allow up to four title lines in the gallery, with the full title available in the detail view. Show a maximum two-line summary; omit it where space is tight rather than shrinking type.
- Put listening duration and date in a quiet footer. Keep share as a separate, clearly accessible control with a minimum 44px target. Show host information in the detail view when card space is limited.
- Use flexible card heights or a consistent text-area minimum height. Do not force the complete new composition into the old 500px image-overlay card.
- Hover: slightly strengthen the border and move upward by at most 2px. Keyboard focus: a visible deep-blue outline. Honor reduced-motion preferences.

For artwork commissioned in this direction: retain tactile paper grain, simple geometric forms, restrained color, and a clear subject. Avoid heavy vignette effects and pre-darkened lower halves. Existing illustrations can be reused unchanged.

## Story detail

Use a sheet-colored reading surface with an ink headline and comfortable paragraph spacing. On desktop, pair square artwork with the heading in a two-column opening, or contain the complete image above the story. On mobile, stack artwork and text. Avoid forcing square artwork into the current shallow, cropped banner.

Use a translucent ink backdrop at roughly 35% opacity for a dialog, with only subtle blur. Keep close visible on an opaque sheet-colored button. The reading surface should remain bright when opened.

Give the audio player a pale-blue surface, ink controls, and a deep-blue progress indicator. Use an ink primary play button with a sheet-colored icon. Keep the timeline and time labels readable. Separate the app CTA from playback controls so the listening action remains clear.

Retain keyboard operation, visible focus, dialog focus containment, Escape-to-close, and focus return to the originating card. Use an opaque reading surface so contrast does not depend on the illustration or backdrop.

## Page and navigation

Use the warm paper background throughout, with an ink primary CTA. Retain the existing compact header and recognizable logo. Give the introduction and gallery enough vertical space without burying the stories.

Filters should be short and readable: quiet outlined controls by default, a deep-blue fill with sheet-colored text for selection. Long editorial topic descriptions belong in story details, not navigation chips. Allow filter rows to scroll on narrow screens.

For a catalog of three stories, show three distinct cards centered on desktop and a manually scrollable row on mobile. For larger catalogs, preserve the gallery's existing browsing and accessibility behavior. The visual direction does not require a new carousel implementation.

## Implementation scope

Apply these tokens and component rules together to the page, cards, filters, story dialog, player, and loading/empty/error states. Review `public/index.html` and the separate `public/home-v2.html` stream view for consistency. Social sharing images can inherit the same paper/ink framing in a separate pass.

Before shipping, review desktop and mobile layouts with long titles, missing images, long category names, and an open story; check text contrast, keyboard navigation, and playback. Card dimensions and image sizing must also be reconciled with the responsive gallery geometry in `public/js/gallery.js` and its existing tests.


## Implementation verification

The gallery and stream view share `public/styles/paper-ink.css`. The gallery uses 360px cards on desktop, 320px through the mobile breakpoint, and 280px below 375px; responsive image hints match those dimensions. Dialog artwork is square beside the reading panel on desktop and stacked above it on mobile.

Verified locally at 1280px, 390px, and 320px: gallery and stream appearance, three-story layout, empty catalog, category filtering, no horizontal page overflow, dialog open/close, initial close-button focus, reverse-tab wrapping, and focus restoration. Existing gallery and Worker tests and the Worker type check passed. The preview uses a saved public catalog; its artwork currently differs from the newer illustrations in the supplied screenshots. Nothing was deployed as part of this style change.
