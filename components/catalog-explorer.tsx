'use client';
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { GetAngleLink } from './get-angle-link';
import { SiteFooter } from './site-footer';
import { Gallery } from './gallery';
import { EpisodeCard } from './episode-card';
import { categorySlug, filterEpisodes, type Episode } from '@/lib/episodes';
import { categoryLabel } from '@/lib/catalog-copy';
import { createSearchIndex, type SearchDocument } from '@/lib/search';
import { catalogCategory, catalogHref, catalogResults } from '@/lib/catalog-search';

// Keep real, shareable links, but filter the already-loaded catalog on ordinary navigation.
// Next's onNavigate preserves modifier-click and open-in-new-tab behavior.
function CatalogLink({ href, onSelect, ...props }: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & {
  href: string; onSelect?: () => void;
}) {
  return <Link {...props} href={href} prefetch={false} onNavigate={event => {
    event.preventDefault();
    onSelect?.();
    if (href !== window.location.pathname + window.location.search) window.history.pushState(null, '', href);
  }} />;
}

export function CatalogExplorer({ episodes, categories, active: initialActive, initialDocuments, initialSearchFailed = false }: { episodes: Episode[]; categories: string[]; active: string; initialDocuments?: SearchDocument[]; initialSearchFailed?: boolean }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const requestedQuery = params.get('q') || '';
  const routeCategory = catalogCategory(pathname, categories);
  const [lastCatalog, setLastCatalog] = useState({ category: initialActive, query: requestedQuery });
  // An intercepted episode changes the URL while this catalog remains behind it.
  const active = routeCategory ?? lastCatalog.category;
  const query = routeCategory ? requestedQuery : lastCatalog.query;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const expanded = searchOpen || !!query;
  const [documents, setDocuments] = useState<SearchDocument[]>(initialDocuments || []);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(initialSearchFailed ? 'error' : initialDocuments ? 'ready' : 'idle');
  const [attempt, setAttempt] = useState(0);
  const documentsReady = useRef(!!initialDocuments && !initialSearchFailed);
  useEffect(() => {
    if (!routeCategory) return;
    setLastCatalog(previous => previous.category === routeCategory && previous.query === requestedQuery
      ? previous : { category: routeCategory, query: requestedQuery });
    const label = routeCategory === 'new' ? 'New' : routeCategory === 'popular' ? 'Popular' : routeCategory;
    document.title = routeCategory === 'all' ? 'Angle — Audio Stories and News Explainers' : `${label} Stories | Angle`;
  }, [routeCategory, requestedQuery]);
  useEffect(() => {
    if (!expanded || documentsReady.current) return;
    const controller = new AbortController();
    setState('loading');
    fetch('/api/search-index?v=2', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Search unavailable');
      const body = await response.json() as { data?: SearchDocument[] };
      if (!Array.isArray(body.data)) throw new Error('Invalid search data');
      if (!controller.signal.aborted) { documentsReady.current = true; setDocuments(body.data); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt, expanded]);
  useEffect(() => {
    const stopEditing = () => { editing.current = false; };
    window.addEventListener('popstate', stopEditing);
    return () => window.removeEventListener('popstate', stopEditing);
  }, []);
  const index = useMemo(() => createSearchIndex(documents), [documents]);
  const model = useMemo(() => catalogResults(episodes, index, query, '', active), [episodes, index, query, active]);
  const filtering = !!query.trim();
  const pending = filtering && state !== 'ready';
  const visible = useMemo(() => pending ? [] : model.results, [pending, model.results]);
  const filters = ['all', 'new', ...(filterEpisodes(episodes, 'popular').length ? ['popular'] : []), ...categories.filter(c => !['all', 'new', 'popular'].includes(c))];
  function update(nextQuery: string, typing = false) {
    const url = catalogHref(pathname, nextQuery, '');
    if (typing && editing.current) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    editing.current = typing;
  }
  function closeSearch() {
    update('');
    setSearchOpen(false);
    searchToggle.current?.focus();
  }
  const search = <div className="quick-search catalog-search" onBlur={event => {
    if (!query && !event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
  }}>
    <label className="sr-only" htmlFor={id}>Search stories</label>
    <div className="quick-search-input">
      <button ref={searchToggle} className="search-toggle" type="button"
        aria-label={expanded ? 'Focus search' : 'Open search'} aria-expanded={expanded} aria-controls={id}
        onClick={() => { flushSync(() => setSearchOpen(true)); input.current?.focus({ preventScroll: true }); }}>
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
      </button>
      <input ref={input} id={id} type="search" maxLength={200} value={query} autoComplete="off" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1}
        placeholder="Search stories…" aria-controls="catalog-results"
        onChange={event => update(event.target.value, true)}
        onBlur={() => { editing.current = false; }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }} />
      <button className="search-close" type="button" aria-label="Close search" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1} onClick={closeSearch}>×</button>
    </div>
  </div>;
  return <main className="catalog-page">
    <h1 className="sr-only">Angle stories</h1>
    <noscript><form action={initialActive === 'all' ? '/' : '/' + categorySlug(initialActive)} method="get" role="search">
      <label>Search stories <input name="q" type="search" defaultValue={requestedQuery} maxLength={200} /></label>
      <button type="submit">Search</button>
    </form></noscript>
    <header className="catalog-header">
    <Link href="/" className="catalog-home" aria-label="Angle home"><img src="/images/logo.svg" alt="" className="brand-logo" width="36" height="36" /></Link>
    <div className={`catalog-toolbar${expanded ? ' is-searching' : ''}`}>
    <div className="catalog-search-slot">{search}</div>
    <nav className="filters" aria-label="Story categories" inert={expanded} aria-hidden={expanded}>
      {filters.map(category => {
        const path = category === 'all' ? '/' : '/' + categorySlug(category);
        const allowed = new Set(filterEpisodes(episodes, category).map(e => e.id));
        const count = model.matching.filter(e => allowed.has(e.id)).length;
        return <CatalogLink key={category} href={catalogHref(path, query, '')}
          className={`category-tag ${active === category ? 'active' : 'inactive'}`}
          aria-current={active === category ? 'page' : undefined} onSelect={() => { editing.current = false; }}>
          {categoryLabel(category)}{!pending && <span className="filter-count">{count}</span>}
        </CatalogLink>;
      })}
    </nav>
    </div>
    <GetAngleLink location="header" />
    </header>
    <section className="catalog-refinements" aria-label="Search status" hidden={!expanded || (!filtering && state !== 'error' && state !== 'loading')}>
      <p className="catalog-search-status" role="status">
        {state === 'loading' ? 'Loading searchable stories…'
          : state === 'error' ? 'Search is temporarily unavailable.'
          : filtering ? `${visible.length} ${visible.length === 1 ? 'story matches' : 'stories match'} your filters.` : ''}
      </p>
      {state === 'error' && <button className="quick-search-retry" onClick={() => setAttempt(n => n + 1)}>Try again</button>}
    </section>
    <div id="catalog-results" aria-busy={pending && state === 'loading'}>
      {!pending && !visible.length && <div className="catalog-empty">
        <h2>No stories match these filters.</h2>
        {active !== 'all' && model.matching.length > 0
          ? <CatalogLink href={catalogHref('/', query, '')} onSelect={() => { editing.current = false; }}>Search all categories · {model.matching.length} {model.matching.length === 1 ? 'story' : 'stories'}</CatalogLink>
          : <p>Try another word or remove a filter.</p>}
        <CatalogLink href="/" onSelect={() => { editing.current = false; }}>Clear all filters</CatalogLink>
      </div>}
      <div hidden={!visible.length}><Gallery episodes={visible} paused={filtering}>
        {visible.map((episode, index) => <EpisodeCard key={episode.id} episode={episode} gallery priority={index === 0} />)}
      </Gallery></div>
    </div>
    <SiteFooter />
  </main>;
}
