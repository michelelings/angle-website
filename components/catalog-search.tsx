export function CatalogSearch({ pathname = '/', query = '' }: { pathname?: string; query?: string }) {
  return <details className="server-catalog-search" open={!!query}>
    <summary aria-label="Open or close story search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
    </summary>
    <form action={pathname} method="get" role="search">
      <input aria-label="Search stories" name="q" type="search" placeholder="Search stories…" defaultValue={query} maxLength={200} />
      <button type="submit">Search</button>
      {!!query && <a href={pathname}>Clear</a>}
    </form>
  </details>;
}
