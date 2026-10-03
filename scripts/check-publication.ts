import { readFile } from 'node:fs/promises';
import { mapV2Episode } from '../worker/catalog';
import { publicationIssues } from '../lib/publication-readiness';

// Accept exported v2 detail payloads from the publishing pipeline, without credentials.
// An array supports auditing a batch; list payloads intentionally fail completeness.
const file = process.argv[2];
if (!file) throw new Error('Usage: npm run check:publication -- /path/to/episode-detail.json');
const payload = JSON.parse(await readFile(file, 'utf8'));
const rows: unknown[] = Array.isArray(payload) ? payload : [payload];
if (!rows.length) throw new Error('No episode detail payloads supplied');
const results = rows.map(row => {
  try {
    const episode = mapV2Episode(row);
    return { id: episode.id, issues: publicationIssues(episode) };
  } catch (error) {
    return { id: null, issues: [error instanceof Error ? error.message : 'Invalid episode payload'] };
  }
});
console.log(JSON.stringify({ checked: results.length, failures: results.filter(result => result.issues.length) }, null, 2));
if (results.some(result => result.issues.length)) process.exitCode = 1;
