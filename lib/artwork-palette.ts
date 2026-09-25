export type ArtworkColor = { r: number; g: number; b: number };

// Keep the brightest mesh stops dark enough for white reading text.
export function readableArtworkColor({ r, g, b }: ArtworkColor): string {
  const midpoint = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  // Bring out subdued artwork hues without tinting genuinely neutral colors.
  const saturation = chroma >= 12 ? Math.max(1.7, 90 / chroma) : 1;
  let channels = [r, g, b].map(value => Math.round(Math.max(0, Math.min(255, midpoint + (value - midpoint) * saturation))));
  const luminance = (values: number[]) => values.reduce((sum, value, i) => {
    const s = value / 255;
    return sum + (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  while (luminance(channels) > 0.17) channels = channels.map(value => Math.floor(value * 0.95));
  return `rgb(${channels.join(', ')})`;
}

// Browser-only cache: reuse palettes when an episode is reopened, with a bounded size.
const palettes = new Map<string, { palette: string[]; dominant: string; darkText: boolean }>();
export async function extractArtworkColors(image: HTMLImageElement): Promise<{ palette: string[]; dominant: string; darkText: boolean } | null> {
  const source = image.currentSrc || image.src;
  const cached = palettes.get(source);
  if (cached) return cached;
  const { getPaletteSync, getColorSync } = await import('colorthief');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, 64, 64);
  const colors = getPaletteSync(canvas, { colorCount: 3, quality: 5 });
  if (!colors?.length) return null;
  const palette = colors.map(color => readableArtworkColor(color.rgb()));
  const { r, g, b } = (getColorSync(canvas, { quality: 5 }) || colors[0]).rgb();
  const channels = [r, g, b].map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  const result = { palette, dominant: `rgb(${r}, ${g}, ${b})`, darkText: luminance > .179 };
  if (palettes.size >= 32) palettes.delete(palettes.keys().next().value!);
  palettes.set(source, result);
  return result;
}

export async function extractArtworkPalette(image: HTMLImageElement): Promise<string[] | null> {
  return (await extractArtworkColors(image))?.palette || null;
}
