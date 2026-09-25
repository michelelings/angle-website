export function artworkFallback(image: HTMLImageElement, original: string | null) {
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  const next = original && image.src !== original ? original : '/images/icon.webp';
  if (image.src.endsWith('/images/icon.webp')) return;
  image.src = next;
}
