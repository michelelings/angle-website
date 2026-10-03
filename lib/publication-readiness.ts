import type { Episode } from './episodes';

/** Run against a detail payload before promoting it; list responses omit scripts. */
export function publicationIssues(episode: Episode): string[] {
  const issues: string[] = [];
  if (!episode.title.trim()) issues.push('Missing episode title');
  if (!(episode.description || episode.fullDescription)?.trim()) issues.push('Missing summary');
  const hasScript = episode.script?.some(chapter => chapter.segments.some(segment => segment.paragraphs.some(text => text.trim())));
  const hasDialogue = episode.chapters?.some(chapter => chapter.turns.some(turn => turn.text.trim()));
  if (!hasScript && !hasDialogue && !episode.transcript?.trim()) issues.push('Missing readable script or transcript');
  return issues;
}
