import { type Episode, formatDate, formatMinutes } from '../episodes';
import { categoryLabel } from '../catalog-copy';
import { progressiveArtworkProps } from '../artwork';
import { artworkFallback } from '../artwork-fallback';
import { artworkCornerColor } from '../artwork-corner';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
// The animation engine owns this small DOM island. React owns the surrounding
// page and dialog; ordinary animation frames never rerender the React tree.
export function createGalleryCard(episode: Episode): HTMLElement {
  const card = document.createElement('article');
  card.className = 'episode-card';
  card.dataset.episodeId = episode.id;
  card.innerHTML = `<span class="progressive-artwork corner-shaded"><img alt="${escape(episode.title)}" width="600" height="800" draggable="false"><img class="artwork-full" alt="" aria-hidden="true" width="600" height="800" draggable="false">${episode.category ? `<span class="episode-category artwork-category">${escape(categoryLabel(episode.category))}</span>` : ''}</span>
    <div class="episode-info">
    <h3 class="episode-title"><a href="/episode/${encodeURIComponent(episode.id)}" draggable="false">${escape(episode.title)}</a></h3>
    ${episode.hookLine ? `<p class="episode-description">${escape(episode.hookLine)}</p>` : ''}
    <div class="episode-footer">${episode.duration !== null ? `<span>${formatMinutes(episode.duration)}</span>` : ''}<span>${formatDate(episode.createdAt)}</span></div></div>
`;
  const image = card.querySelector('img')!;
  const props = progressiveArtworkProps(episode);
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.loading = 'lazy';
  image.onload = () => {
    const source = image.currentSrc || image.src;
    void artworkCornerColor(image).then(color => {
      if (color && source === (image.currentSrc || image.src)) image.parentElement?.style.setProperty('--artwork-corner', color);
    }).catch(() => { /* Keep the neutral fallback if image sampling is unavailable. */ });
  };
  image.src = props.src;
  image.onerror = () => artworkFallback(image, null);
  const full = card.querySelector<HTMLImageElement>('.artwork-full')!;
  full.crossOrigin = 'anonymous';
  full.decoding = 'async';
  full.loading = 'lazy';
  full.fetchPriority = 'low';
  full.src = props.fullSrc;
  void full.decode().then(() => full.classList.add('is-ready')).catch(() => {});
  return card;
}
