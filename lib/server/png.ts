// Reads the Images binding's PNG sample (non-interlaced, 8-bit or packed palette/gray);
// its raw RGBA output is unavailable in local development.
export async function decodePng(bytes: Uint8Array<ArrayBuffer>): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Record<string, Uint8Array<ArrayBuffer>> = {};
  const compressed: Uint8Array<ArrayBuffer>[] = [];
  for (let offset = 8; offset + 12 <= bytes.length; offset += 12 + view.getUint32(offset)) {
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const chunk = bytes.subarray(offset + 8, offset + 8 + view.getUint32(offset));
    if (type === 'IDAT') compressed.push(chunk); else chunks[type] ??= chunk;
  }
  const header = chunks.IHDR;
  const [depth, colorType] = header ? [header[8], header[9]] : [0, 0];
  const channels = header && ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels || header[12] !== 0 || (depth !== 8 && !(channels === 1 && [1, 2, 4].includes(depth))) || (colorType === 3 && !chunks.PLTE)) return null;
  const width = view.getUint32(16), height = view.getUint32(20);
  const step = Math.max(1, channels * depth / 8), stride = Math.ceil(width * channels * depth / 8);
  const raw = new Uint8Array(await new Response(new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  if (raw.length < (stride + 1) * height) return null;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) return null;
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= step ? pixels[i - step] : 0, b = y ? pixels[i - stride] : 0, c = x >= step && y ? pixels[i - stride - step] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      pixels[i] = raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width, y = (i - x) / width, target = i * 4;
    if (channels === 1) {
      const bit = x * depth, value = (pixels[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      if (colorType === 3) rgba.set(chunks.PLTE.subarray(value * 3, value * 3 + 3), target);
      else rgba.fill(value * 255 / ((1 << depth) - 1), target, target + 3);
      rgba[target + 3] = colorType === 3 ? chunks.tRNS?.[value] ?? 255 : 255;
    } else {
      const source = y * stride + x * channels;
      if (channels === 2) rgba.fill(pixels[source], target, target + 3);
      else rgba.set(pixels.subarray(source, source + 3), target);
      rgba[target + 3] = channels === 3 ? 255 : pixels[source + channels - 1];
    }
  }
  return { data: rgba, width, height };
}
