'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { flushSync } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { Header } from './header';
import { SiteFooter } from './site-footer';
import { Gallery } from './gallery';
import { categorySlug, filterEpisodes, type Episode } from '@/lib/episodes';
import { createSearchIndex, type SearchDocument } from '@/lib/search';
import { catalogHref, catalogResults } from '@/lib/catalog-search';

export function CatalogExplorer({ episodes, categories, active }: { episodes: Episode[]; categories: string[]; active: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const query = params.get('q') || '';
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const expanded = searchOpen || !!query;
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/search-index?v=2', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Search unavailable');
      const body = await response.json() as { data?: SearchDocument[] };
      if (!Array.isArray(body.data)) throw new Error('Invalid search data');
      if (!controller.signal.aborted) { setDocuments(body.data); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt]);
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
  const filters = ['all', 'new', 'popular', ...categories.filter(c => !['all', 'new', 'popular'].includes(c))];
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
      <input ref={input} id={id} type="search" value={query} autoComplete="off" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1}
        placeholder="Search stories…" aria-controls="catalog-results"
        onChange={event => update(event.target.value, true)}
        onBlur={() => { editing.current = false; }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }} />
      <button className="search-close" type="button" aria-label="Close search" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1} onClick={closeSearch}>×</button>
    </div>
  </div>;
  return <main>
    <Header count={visible.length} search={null} />
    <div className={`catalog-toolbar${expanded ? ' is-searching' : ''}`}>
    <div className="catalog-search-slot">{search}</div>
    <nav className="filters" aria-label="Story categories" inert={expanded} aria-hidden={expanded}>
      {filters.map(category => {
        const path = category === 'all' ? '/' : '/' + categorySlug(category);
        const allowed = new Set(filterEpisodes(episodes, category).map(e => e.id));
        const count = model.matching.filter(e => allowed.has(e.id)).length;
        return <Link key={category} prefetch={false} href={catalogHref(path, query, '')}
          className={`category-tag ${active === category ? 'active' : 'inactive'}`}
          aria-current={active === category ? 'page' : undefined} onClick={() => { editing.current = false; }}>
          {category}{!pending && <span className="filter-count">{count}</span>}
        </Link>;
      })}
    </nav>
    </div>
    <section className="catalog-refinements" aria-label="Refine stories">
      {(filtering || active !== 'all') && <div className="selected-filters">
        <span>Showing</span>
        {query && <button onClick={() => update('')} aria-label={`Remove search ${query}`}>“{query}” ×</button>}
        {active !== 'all' && <Link href={catalogHref('/', query, '')} aria-label={`Remove category ${active}`}>{active} ×</Link>}
        <Link href="/" className="clear-filters">Clear all</Link>
      </div>}
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
          ? <Link href={catalogHref('/', query, '')}>Search all categories · {model.matching.length} {model.matching.length === 1 ? 'story' : 'stories'}</Link>
          : <p>Try another word or remove a filter.</p>}
        <Link href="/">Clear all filters</Link>
      </div>}
      <div hidden={!visible.length}><Gallery episodes={visible} paused={filtering} /></div>
    </div>
    <SiteFooter showStream />
  </main>;
}
