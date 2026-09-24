import assert from 'node:assert/strict';
import test from 'node:test';
import { shareEpisode } from '../components/share-button';

test('sharing uses native sharing, falls back on failure, and respects cancellation', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const copied: string[] = [];
  const clipboard = { async writeText(value: string) { copied.push(value); } };
  const setNavigator = (share?: (data: { url: string }) => Promise<void>) =>
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share, clipboard } });
  try {
    setNavigator(async ({ url }) => { assert.equal(url, 'https://www.newsangle.co/episode/story'); });
    assert.equal(await shareEpisode('story'), 'Shared');
    assert.equal(copied.length, 0);
    setNavigator(async () => { throw new Error('Native sharing unavailable'); });
    assert.equal(await shareEpisode('story'), 'Link copied');
    assert.deepEqual(copied, ['https://www.newsangle.co/episode/story']);
    setNavigator(async () => { throw new DOMException('Cancelled', 'AbortError'); });
    await assert.rejects(shareEpisode('story'), { name: 'AbortError' });
    assert.equal(copied.length, 1);
    setNavigator();
    assert.equal(await shareEpisode('a/b'), 'Link copied');
    assert.equal(copied[1], 'https://www.newsangle.co/episode/a%2Fb');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
