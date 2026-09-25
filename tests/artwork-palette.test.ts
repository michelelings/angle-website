import assert from 'node:assert/strict';
import test from 'node:test';
import { readableArtworkColor } from '../lib/artwork-palette';

test('vibrant mesh stops preserve white-text contrast across the RGB range', () => {
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    const channels = readableArtworkColor({ r, g, b }).match(/\d+/g)!.map(Number);
    const luminance = channels.reduce((sum, value, i) => {
      const s = value / 255;
      return sum + (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    assert.ok(1.05 / (luminance + 0.05) >= 4.5);
  }
});

test('subdued colors gain chroma while neutral artwork remains neutral', () => {
  const channels = readableArtworkColor({ r: 90, g: 75, b: 60 }).match(/\d+/g)!.map(Number);
  assert.ok(channels[0] - channels[2] > 30);
  const neutral = readableArtworkColor({ r: 100, g: 100, b: 100 }).match(/\d+/g)!.map(Number);
  assert.equal(new Set(neutral).size, 1);
});
