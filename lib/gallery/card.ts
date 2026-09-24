import { type Episode, type Renditions, formatDate, formatTime } from '../episodes';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
// The animation engine owns this small DOM island. React owns the surrounding
// page and dialog; ordinary animation frames never rerender the React tree.
export function createGalleryCard(episode: Episode, renditions: Renditions): HTMLElement {
  const card = document.createElement('article');
  card.className = 'episode-card';
  card.dataset.episodeId = episode.id;
  card.innerHTML = `<img alt="${escape(episode.title)}" width="600" height="800" draggable="false" class="ready">
    <div class="episode-info">${episode.category ? `<span class="episode-category">${escape(episode.category)}</span>` : ''}
    <h3 class="episode-title"><a href="/episode/${encodeURIComponent(episode.id)}" draggable="false">${escape(episode.title)}</a></h3>
    <p class="episode-description">${escape(episode.description || '')}</p>
    <div class="episode-footer">${episode.duration !== null ? `<span>${formatTime(episode.duration)}</span>` : ''}<span>${formatDate(episode.createdAt)}</span></div></div>
    <button class="episode-share-btn" aria-label="Share ${escape(episode.title)}" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/></svg></button>`;
  const image = card.querySelector('img')!;
  const original = episode.coverImage || '/images/icon.webp';
  const sources = renditions[original]?.sources;
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';
  image.loading = 'eager';
  if (sources?.length) {
    image.sizes = '(orientation: landscape) and (max-height: 500px) and (max-width: 1000px) 144px, (max-width: 374px) 248px, (max-width: 768px) 260px, (max-width: 1366px) 280px, 360px';
    image.srcset = sources.map(s => `${s.url} ${s.width}w`).join(', ');
  }
  image.src = sources?.[0]?.url || original;
  image.onerror = () => {
    image.removeAttribute('srcset');
    image.onerror = () => { image.onerror = null; image.src = '/images/icon.webp'; };
    image.src = original;
  };
  return card;
}
