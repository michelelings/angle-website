import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { EpisodeCard } from '@/components/episode-card';
import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, filterEpisodes } from '@/lib/episodes';
import { pageMetadata } from '@/lib/metadata';
import { ArtworkThemeSource } from '@/components/artwork-theme';
import { categoryLabel } from '@/lib/catalog-copy';
export const dynamic = 'force-dynamic';
export const metadata = pageMetadata('/', 'Audio Story Stream | Angle');
export default async function Stream() {
  const episodes = await getCatalog();
  return <main><ArtworkThemeSource src={episodes[0]?.coverImage || '/images/icon.webp'} /><Header count={episodes.length} stream /><div className="rails-container">
    {!episodes.length && <p className="empty-state">New stories are on their way.</p>}
    {['new', 'popular', ...categoriesFor(episodes)].map(category => {
      const items = filterEpisodes(episodes, category);
      return items.length ? <section className="rail" key={category}>
        <div className="rail-header"><h2 className="rail-title">{categoryLabel(category)}</h2><span className="rail-count">{items.length} stories</span></div>
        <div className="rail-track">{items.map(episode => <EpisodeCard key={episode.id} episode={episode} />)}</div>
      </section> : null;
    })}
  </div><SiteFooter /></main>;
}
