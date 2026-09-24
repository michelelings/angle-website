'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSearchIndex, searchEpisodes, type SearchDocument } from '@/lib/search';

export function QuickSearch() {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<SearchDocument[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/search-index', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Search unavailable');
      const body = await response.json() as { data?: SearchDocument[] };
      if (!Array.isArray(body.data)) throw new Error('Invalid search data');
      if (!controller.signal.aborted) { setDocuments(body.data); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [attempt]);
  const index = useMemo(() => createSearchIndex(documents), [documents]);
  const results = useMemo(() => searchEpisodes(index, query), [index, query]);
  const visible = results.slice(0, 8);
  const expanded = open && !!query.trim();
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-result-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, id]);
  function select(episodeId: string) {
    setOpen(false); setQuery(''); setActive(-1);
    router.push(`/episode/${encodeURIComponent(episodeId)}`, { scroll: false });
  }
  return <div className="quick-search" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label className="sr-only" htmlFor={id}>Search stories</label>
    <div className="quick-search-input">
      <span aria-hidden="true">⌕</span>
      <input ref={input} id={id} type="search" placeholder="Search stories, topics, transcripts…"
        autoComplete="off" value={query} role="combobox" aria-autocomplete="list"
        aria-expanded={expanded} aria-controls={`${id}-results`}
        aria-activedescendant={expanded && active >= 0 && visible[active] ? `${id}-result-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(value => !visible.length ? -1 : value < 0
              ? (event.key === 'ArrowDown' ? 0 : visible.length - 1)
              : (value + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length);
          }
          if (event.key === 'Enter' && expanded && visible.length) {
            event.preventDefault(); select(visible[Math.max(0, active)].document.id);
          }
        }} />
      {query && <button type="button" aria-label="Clear search" onClick={() => {
        setQuery(''); setActive(-1); input.current?.focus();
      }}>×</button>}
    </div>
    {expanded && <div className="quick-search-popup">
      <p className="quick-search-status" role="status">
        {state === 'loading' ? 'Loading searchable stories…' : state === 'error' ? 'Search is temporarily unavailable.'
          : results.length ? `${results.length} ${results.length === 1 ? 'story' : 'stories'} found${results.length > 8 ? ' · Top 8 shown' : ''}`
            : `No stories found for “${query.trim()}”. Try another word.`}
      </p>
      {state === 'error' && <button className="quick-search-retry" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
      <ul id={`${id}-results`} role="listbox" aria-label="Matching stories">
        {state === 'ready' && visible.map((result, i) => <li key={result.document.id} id={`${id}-result-${i}`}
          role="option" aria-selected={active === i} className="quick-search-result"
          onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(i)}
          onClick={() => select(result.document.id)}>
          {result.document.coverImage && <img src={result.document.coverImage} alt="" width={48} height={48} />}
          <div><span className="quick-search-category">{result.document.category}</span>
            <strong>{result.document.title}</strong>
            {result.matchedField !== 'Title' && <p><span>{result.matchedField}: </span>{result.excerpt}</p>}
          </div>
        </li>)}
      </ul>
    </div>}
  </div>;
}
