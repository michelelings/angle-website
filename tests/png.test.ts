import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { decodePng } from '../lib/server/png';

// A gradient with noise makes the encoder use every row filter; an odd width leaves
// padding bits at the end of packed rows.
const width = 37, height = 23;
function pixels(channels: number) {
  let seed = 1;
  return Buffer.from(Array.from({ length: width * height * channels }, (_, i) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const pixel = Math.floor(i / channels);
    return Math.min(255, (pixel % width) * 5 + Math.floor(pixel / width) * 7 + Math.floor(seed / 2147483648 * 60));
  }));
}
const bytes = (buffer: Buffer) => new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
// Packed grayscale is not written by sharp; build it with unfiltered rows.
function grayscalePng(depth: number, values: number[][]) {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]); // The decoder skips CRCs.
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(values[0].length, 0); header.writeUInt32BE(values.length, 4); header[8] = depth;
  const rows = values.map(row => {
    const line = Buffer.alloc(1 + Math.ceil(row.length * depth / 8));
    row.forEach((value, x) => { line[1 + ((x * depth) >> 3)] |= value << (8 - depth - ((x * depth) & 7)); });
    return line;
  });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, encode] of [
  ['RGB', () => sharp(pixels(3), { raw: { width, height, channels: 3 } }).png({ adaptiveFiltering: true })],
  ['RGBA', () => sharp(pixels(4), { raw: { width, height, channels: 4 } }).png({ adaptiveFiltering: true })],
  ...[2, 4, 16, 256].map(colours => [`${colours}-color palette`, () => sharp(pixels(3), { raw: { width, height, channels: 3 } })
    .png({ palette: true, colours, dither: 0, adaptiveFiltering: true })] as const),
] as const) {
  test(`decodes ${name} PNG samples exactly like sharp`, async () => {
    const png = await encode().toBuffer();
    const expected = await sharp(png).ensureAlpha().raw().toBuffer();
    const decoded = await decodePng(bytes(png));
    assert.ok(decoded);
    assert.equal(decoded.width, width); assert.equal(decoded.height, height);
    assert.deepEqual(Buffer.from(decoded.data), expected);
  });
}
test('decodes packed grayscale samples', async () => {
  for (const depth of [1, 2, 4, 8]) {
    const max = (1 << depth) - 1;
    const values = Array.from({ length: 3 }, (_, y) => Array.from({ length: 11 }, (_, x) => (x * 3 + y) % (max + 1)));
    const decoded = await decodePng(bytes(grayscalePng(depth, values)));
    assert.ok(decoded, `${depth}-bit grayscale`);
    assert.deepEqual([...decoded.data].filter((_, i) => i % 4 === 0), values.flat().map(value => value * 255 / max), `${depth}-bit grayscale`);
  }
});
test('unsupported PNG layouts are rejected rather than misread', async () => {
  const image = sharp(pixels(3), { raw: { width, height, channels: 3 } });
  assert.equal(await decodePng(bytes(await image.clone().png({ progressive: true }).toBuffer())), null);
  assert.equal(await decodePng(bytes(await image.clone().toColourspace('rgb16').png().toBuffer())), null);
  assert.equal(await decodePng(new Uint8Array(8)), null);
});
