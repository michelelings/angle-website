import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://127.0.0.1:3101';
const request = (path, options) => fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000), ...options });
const catalogResponse = await request('/api/episodes');
assert.equal(catalogResponse.status, 200);
const { success, data: episodes } = await catalogResponse.json();
assert.equal(success, true);
for (const path of ['/', '/new', '/popular', '/home-v2']) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.match(html, /_next\//, path);
  assert.match(html, /Stories worth listening\.|stories worth listening\./, path);
  assert.match(html, /rel="canonical"/, path);
  console.log('PASS page', path);
}
if (episodes.length) {
  const episode = episodes[0];
  const response = await request(`/episode/${episode.id}`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /application\/ld\+json/);
  assert.ok(html.includes('PodcastEpisode'));
  assert.ok(html.includes(`<h1 class="modal-title"`));
  const data = await (await request(`/api/episodes/${episode.id}`)).json();
  assert.equal(data.data.id, episode.id);
  for (const image of ['/api/og-image', `/api/og-image/${episode.id}`]) {
    const response = await request(image);
    assert.equal(response.status, 200, image);
    assert.match(response.headers.get('content-type'), /image\/png/);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  console.log('PASS direct episode HTML, API, and PNG sharing images');
}
for (const path of ['/episode/missing', '/not-a-real-category']) {
  const response = await request(path, { headers: { 'User-Agent': 'Googlebot' } });
  assert.equal(response.status, 404, path);
}
const failed = await request('/api/episodes/missing');
assert.equal(failed.status, 404);
const xml = await (await request('/sitemap.xml')).text();
assert.match(xml, /https:\/\/www.newsangle.co\/new/);
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
