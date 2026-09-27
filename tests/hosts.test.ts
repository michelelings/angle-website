import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { GET as robots } from '../app/robots.txt/route';

test('angle.fm and www.newsangle.co both serve the site; each www or apex variant redirects within its domain', () => {
  const angle = middleware(new NextRequest('https://www.angle.fm/episode/story?t=12'));
  assert.equal(angle.status, 308);
  assert.equal(angle.headers.get('location'), 'https://angle.fm/episode/story?t=12');
  assert.equal(middleware(new NextRequest('https://newsangle.co/about')).headers.get('location'), 'https://www.newsangle.co/about');
  for (const host of ['angle.fm', 'www.newsangle.co']) {
    const response = middleware(new NextRequest(`https://${host}/episode/story`));
    assert.equal(response.headers.get('location'), null, host);
    assert.equal(response.headers.get('x-robots-tag'), null, host);
  }
  assert.equal(middleware(new NextRequest('https://angle-website.footy.workers.dev/')).headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('robots.txt allows crawling on both site domains and blocks preview hosts', async () => {
  for (const host of ['angle.fm', 'www.newsangle.co']) {
    assert.equal(await robots(new Request(`https://${host}/robots.txt`)).text(), 'User-agent: *\nAllow: /\nSitemap: https://www.newsangle.co/sitemap.xml\n');
  }
  assert.equal(await robots(new Request('https://angle-website.footy.workers.dev/robots.txt')).text(), 'User-agent: *\nDisallow: /\n');
});
