import assert from 'node:assert/strict';
import test from 'node:test';
import { waveformPeaks } from '../lib/audio-waveform';

test('waveform preserves relative audio energy across the timeline', () => {
  const samples = new Float32Array([0, 0, .25, -.25, .5, -.5, 1, -1]);
  assert.deepEqual(waveformPeaks(samples, 4), [.08, .25, .5, 1]);
});

test('silence and short clips keep finite visible bars', () => {
  for (const samples of [new Float32Array(), new Float32Array(100), new Float32Array([.5])]) {
    const peaks = waveformPeaks(samples);
    assert.equal(peaks.length, 80);
    assert.ok(peaks.every(value => Number.isFinite(value) && value >= .08 && value <= 1));
  }
});
