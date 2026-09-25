import { readableArtworkColor } from './artwork-palette';

const corners = new Map<string, string>();

/** Sample only the top-left label area, using the already loaded small artwork. */
export async function artworkCornerColor(image: HTMLImageElement): Promise<string | null> {
  if (!image.naturalWidth) return null;
  const source = image.currentSrc || image.src;
  const cached = corners.get(source);
  if (cached) return cached;
  const { getColorSync } = await import('colorthief');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, image.naturalWidth * .5, image.naturalHeight * .25, 0, 0, 32, 32);
  const dominant = getColorSync(canvas, { quality: 5 });
  if (!dominant) return null;
  const color = readableArtworkColor(dominant.rgb());
  if (corners.size >= 64) corners.delete(corners.keys().next().value!);
  corners.set(source, color);
  return color;
}
