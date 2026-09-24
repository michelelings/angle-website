import assert from 'node:assert/strict';
import test from 'node:test';
import { mapV2Episode } from '../worker/catalog';
import { episodeMetadata } from '../lib/metadata';

const source = {
  id: 'video-test', title: 'Video preview', createdAt: '2026-09-24',
  coverUrl: 'https://example.com/cover.png', availableModes: ['duo'],
  renditions: { duo: { url: 'https://example.com/audio.mp3' } },
};

test('v2 video data reaches episode metadata while preserving image fallback', () => {
  const baseline = episodeMetadata(mapV2Episode(source));
  const metadata = episodeMetadata(mapV2Episode({ ...source,
    previewVideoUrl: 'https://example.com/preview.mp4',
    previewVideoWidth: 1280, previewVideoHeight: 720,
  }));
  assert.deepEqual(metadata.openGraph?.videos, [{
    url: 'https://example.com/preview.mp4', secureUrl: 'https://example.com/preview.mp4',
    type: 'video/mp4', width: 1280, height: 720,
  }]);
  assert.deepEqual(metadata.openGraph?.images, baseline.openGraph?.images);
  assert.deepEqual(metadata.twitter, baseline.twitter);
  assert.equal(metadata.alternates?.canonical, baseline.alternates?.canonical);
});

test('missing and invalid video URLs retain image-only metadata', () => {
  for (const previewVideoUrl of [undefined, null, '', '/preview.mp4', 'http://example.com/a.mp4',
    'javascript:alert(1)', 'https://user:password@example.com/a.mp4', 42]) {
    const metadata = episodeMetadata(mapV2Episode({ ...source, previewVideoUrl }));
    assert.equal(metadata.openGraph?.videos, undefined);
    assert.ok(metadata.openGraph?.images);
  }
});

test('invalid or unknown dimensions are omitted without suppressing the video', () => {
  for (const dimension of [undefined, null, 0, -1, 1.5, '720', Infinity]) {
    const metadata = episodeMetadata(mapV2Episode({ ...source,
      previewVideoUrl: 'https://example.com/preview.mp4',
      previewVideoWidth: dimension, previewVideoHeight: dimension,
    }));
    assert.deepEqual(metadata.openGraph?.videos, [{
      url: 'https://example.com/preview.mp4', secureUrl: 'https://example.com/preview.mp4', type: 'video/mp4',
    }]);
  }
});
