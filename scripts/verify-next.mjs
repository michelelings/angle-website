import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const origin = process.argv[2] || 'http://127.0.0.1:3101';
const request = (path, options) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), ...options });
const catalogResponse = await request('/api/episodes');
assert.equal(catalogResponse.status, 200);
const { success, data: episodes } = await catalogResponse.json();
assert.equal(success, true);
for (const path of ['/', '/new', '/popular', '/home-v2', '/about']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, /_next\//, path);
  const heading = new JSDOM(html).window.document.querySelector('h1')?.textContent || '';
  assert.match(heading, path === '/about' ? /^About Angle$/ : path === '/home-v2' ? /\d+ stor(?:y|ies) worth listening/ : /^Angle stories$/, path);
  assert.match(html, /rel="canonical"/, path);
  console.log('PASS page', path);
}
for (const path of ['/new', '/popular', '/new?q=technology']) {
  const response = await request(path, { redirect: 'manual' });
  assert.equal(response.status, 200, path);
}
const home = new JSDOM(await (await request('/')).text()).window.document;
assert.ok(home.querySelectorAll('.filters a').length > 0);
assert.ok(home.querySelector('.filters a[aria-current="page"]'));
assert.ok(home.querySelector('form[method="get"] input[name="q"]'), 'Search works through a server GET request');
for (const image of home.querySelectorAll('.episode-card img')) {
  assert.match(image.getAttribute('src'), /^\/api\/artwork\/|^\/images\/icon\.webp$/);
}
assert.equal((await request('/api/artwork/story?w=999&v=x')).status, 400);
assert.equal(home.querySelector('.brand-logo')?.getAttribute('src'), '/images/logo.svg');
home.querySelectorAll('script,noscript').forEach(node => node.remove());
for (const episode of episodes) assert.ok(home.querySelector(`a[href="/episode/${episode.id}"]`), `SSR link to ${episode.id}`);
for (const path of ['/home-v2']) {
  const doc = new JSDOM(await (await request(path)).text()).window.document;
  assert.equal(new URL(doc.querySelector('link[rel="canonical"]').href).pathname, '/');
}
for (const path of ['/?q=technology', '/new?q=technology']) {
  const doc = new JSDOM(await (await request(path)).text()).window.document;
  assert.match(doc.querySelector('meta[name="robots"]').content, /noindex/);
  assert.equal(doc.querySelector('link[rel="canonical"]'), null);
}
if (episodes.length) {
  const episode = episodes[0];
  const searchDoc = new JSDOM(await (await request('/?q=' + encodeURIComponent(episode.title))).text()).window.document;
  assert.ok(searchDoc.querySelector(`.catalog-fallback a[href="/episode/${episode.id}"]`), 'Search results exist in server HTML');
  assert.match(searchDoc.querySelector('.catalog-search-status').textContent, /match/);
  const response = await request(`/episode/${episode.id}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /application\/ld\+json/);
  assert.ok(html.includes('PodcastEpisode'));
  assert.ok(html.includes(`<h1 class="modal-title"`));
  const data = await (await request(`/api/episodes/${episode.id}`)).json();
  assert.equal(data.data.id, episode.id);
  const doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelector('.episode-shell .episode-view'));
  assert.equal(doc.querySelectorAll('audio').length, data.data.audioUrl ? 1 : 0);
  assert.equal(doc.querySelectorAll('.episode-actions .modal-share-btn').length, 1);
  const sourceHrefs = new Set([...doc.querySelectorAll('.episode-sources a')].map(link => link.href));
  for (const source of data.data.sources || []) assert.ok(sourceHrefs.has(source.url), `Source link ${source.url}`);
  assert.equal(doc.querySelector('.presenter-disclosure'), null);
  assert.equal(doc.querySelectorAll('.transcript h2').length, data.data.chapters?.length || 0);
  for (const image of ['/api/og-image', `/api/og-image/${episode.id}`]) {
    const response = await request(image);
    assert.equal(response.status, 200, image);
    assert.match(response.headers.get('content-type'), /image\/png/);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  console.log('PASS direct episode HTML, API, and PNG sharing images');
}
for (const path of ['/episode/missing', '/not-a-real-category']) {
  for (const userAgent of ['Googlebot', 'Mozilla/5.0']) {
    const response = await request(path, { headers: { 'User-Agent': userAgent } });
    assert.equal(response.status, 404, `${path} ${userAgent}`);
  }
}
const failed = await request('/api/episodes/missing');
assert.equal(failed.status, 404);
const xml = await (await request('/sitemap.xml')).text();
assert.match(xml, /https:\/\/www.newsangle.co\/about/);
assert.ok(!xml.includes('/new</loc>') && !xml.includes('/home-v2</loc>'));
if (episodes.length) assert.match(xml, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
assert.ok(!xml.includes('localhost'));
const robots = await (await request('/robots.txt')).text();
assert.match(robots, origin.includes('www.newsangle.co') ? /Allow: \// : /Disallow: \//);
for (const [from, to] of [['/index.html','/'], ['/home-v2.html','/home-v2'], ['/sitemap_index.xml','/sitemap.xml']]) {
  const response = await request(from, { redirect: 'manual' });
  assert.ok([301,308].includes(response.status), from);
  assert.equal(new URL(response.headers.get('location'), origin).pathname, to);
}
assert.equal((await request('/api/episodes', { method: 'POST' })).status, 405);
assert.equal((await request('/api/episodes', { method: 'OPTIONS' })).status, 204);
console.log('PASS missing routes, canonical sitemap, robots, aliases, and methods');
