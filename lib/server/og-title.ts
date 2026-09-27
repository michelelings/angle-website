// Advance widths of RecklessCondensedS-Regular (1000 units per em) for U+0020–U+007E.
const ascii = [184, 225, 278, 520, 443, 502, 510, 155, 309, 309, 402, 402, 193, 283, 199, 340, 515, 297, 448, 456, 493, 453, 490, 430, 472,
  490, 222, 224, 402, 402, 402, 379, 760, 578, 526, 533, 591, 519, 488, 589, 637, 280, 414, 575, 495, 762, 598, 615, 488, 615, 547, 456, 521,
  591, 575, 822, 559, 542, 484, 267, 340, 267, 402, 383, 233, 428, 462, 403, 474, 412, 286, 412, 492, 237, 214, 475, 228, 764, 501, 455, 477,
  461, 326, 368, 291, 492, 438, 657, 435, 429, 402, 304, 188, 303, 402];
const punctuation: Record<string, number> = { '‘': 193, '’': 192, '“': 365, '”': 365, '–': 410, '—': 776, '…': 642 };
// Accented letters share their base letter's width; anything else is assumed to be wide.
const advance = (char: string) => ascii[char.charCodeAt(0) - 32] ?? punctuation[char] ?? ascii[char.normalize('NFD').charCodeAt(0) - 32] ?? 800;
export const titleWidth = (text: string) => [...text].reduce((sum, char) => sum + advance(char), 0) / 1000;

// Greedy word wrap like Satori's, in ems; null when one word is wider than the line.
// Balanced wrapping keeps the same number of lines.
export function lineCount(text: string, width: number): number | null {
  let count = 0;
  for (const paragraph of text.split('\n')) {
    let line = 0;
    count++;
    for (const word of paragraph.split(' ').filter(Boolean)) {
      const length = titleWidth(word);
      if (length > width) return null;
      if (line && line + titleWidth(' ') + length > width) { count++; line = length; }
      else line += (line ? titleWidth(' ') : 0) + length;
    }
  }
  return count;
}

type TitleBox = { width: number; height: number; lines: number; max: number; min: number; lineHeight: number };
/**
 * The largest size up to `max` at which the title wraps to at most `lines` lines inside the box.
 * A title too long even at `min` keeps as many words as fit, ending in an ellipsis.
 * Kerning only narrows real text; 3% absorbs rounding.
 */
export function fitTitle(text: string, box: TitleBox): { size: number; text: string } {
  const fits = (value: string, size: number) => {
    const lines = lineCount(value, box.width * 0.97 / size);
    return !!lines && lines <= box.lines && lines * size * box.lineHeight <= box.height;
  };
  for (let size = box.max; size >= box.min; size -= 2) if (fits(text, size)) return { size, text };
  const words = text.split(' ');
  for (let count = words.length - 1; count > 0; count--) {
    const shortened = words.slice(0, count).join(' ').replace(/[\s,.:;–—-]+$/, '') + '…';
    if (fits(shortened, box.min)) return { size: box.min, text: shortened };
  }
  // Only a single word wider than the line remains: shrink it to fit.
  const first = words.length > 1 ? `${words[0]}…` : words[0];
  return { size: Math.min(box.min, Math.floor(box.width * 0.97 / titleWidth(first))), text: first };
}
