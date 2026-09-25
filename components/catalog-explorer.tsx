import Link from 'next/link';
import { Header } from './header';
import { SiteFooter } from './site-footer';
import { Gallery } from './gallery';
import { EpisodeCard } from './episode-card';
import { CatalogSearch } from './catalog-search';
import { categorySlug, filterEpisodes, type Episode } from '@/lib/episodes';
import { categoryLabel } from '@/lib/catalog-copy';
import { catalogHref, type catalogResults } from '@/lib/catalog-search';

export function CatalogExplorer({ episodes, categories, active, query, model, searchFailed = false }: {
  episodes: Episode[]; categories: string[]; active: string; query: string;
  model: ReturnType<typeof catalogResults>; searchFailed?: boolean;
}) {
  const visible = model.results;
  const pathname = active === 'all' ? '/' : '/' + categorySlug(active);
  const filters = ['all', 'new', ...(filterEpisodes(episodes, 'popular').length ? ['popular'] : []), ...categories.filter(c => !['all', 'new', 'popular'].includes(c))];
  return <main>
    <Header count={visible.length} search={null} />
    <div className="catalog-toolbar server-catalog-toolbar">
      <CatalogSearch pathname={pathname} query={query} />
      <nav className="filters" aria-label="Story categories">
        {filters.map(category => {
          const path = category === 'all' ? '/' : '/' + categorySlug(category);
          const allowed = new Set(filterEpisodes(episodes, category).map(e => e.id));
          const count = model.matching.filter(e => allowed.has(e.id)).length;
          return <Link key={category} href={catalogHref(path, query, '')} prefetch={false}
            className={`category-tag ${active === category ? 'active' : 'inactive'}`}
            aria-current={active === category ? 'page' : undefined}>
            {categoryLabel(category)}<span className="filter-count">{count}</span>
          </Link>;
        })}
      </nav>
    </div>
    {!!query && <section className="catalog-refinements" aria-label="Search status">
      <p className="catalog-search-status" role="status">{searchFailed ? 'Search is temporarily unavailable. Please try again.' : `${visible.length} ${visible.length === 1 ? 'story matches' : 'stories match'} your search.`}</p>
    </section>}
    <div id="catalog-results">
      {!visible.length && !searchFailed && <div className="catalog-empty">
        <h2>No stories match these filters.</h2>
        {active !== 'all' && model.matching.length > 0
          ? <Link href={catalogHref('/', query, '')} prefetch={false}>Search all categories · {model.matching.length} stories</Link>
          : <p>Try another word or remove a filter.</p>}
        <Link href="/" prefetch={false}>Clear all filters</Link>
      </div>}
      {!!visible.length && <Gallery episodes={visible} paused={!!query}>
        {visible.map((episode, index) => <EpisodeCard key={episode.id} episode={episode} gallery priority={index === 0} />)}
      </Gallery>}
    </div>
    <SiteFooter showStream />
  </main>;
}
