import type { Episode } from './episodes';

// Editorial pilot, reviewed against the published stories on 2026-10-03.
// Revision pins prevent old headlines being applied to rewritten stories.
export const headlinePilot: Record<string, { revisionId: string; title: string }> = {
  "ba376a1f-9638-4b9b-82fa-822b1f858a67": {
    "revisionId": "8adf719b-318f-4484-96e0-2e565fb99297",
    "title": "How would SpaceX bring astronauts back from Mars?"
  },
  "88ad1e24-dd7f-44e3-9882-87cded3946f3": {
    "revisionId": "d4c3b4e0-adc5-4c06-a910-968d5269005c",
    "title": "Who owns Earth’s orbit? Space debris and the Kessler syndrome"
  },
  "5af3b0b0-0e1a-4e0c-b224-997d06b60a82": {
    "revisionId": "a4250abc-16e6-4cf0-b135-0f8b5ed22fd8",
    "title": "Could AI or quantum computers break Bitcoin’s encryption?"
  },
  "f1267178-52c7-4052-a45d-98d8656927f5": {
    "revisionId": "2f00511c-f8d6-4fe2-bada-05f85dc4aa77",
    "title": "What replaces money during war and hyperinflation?"
  },
  "3ee549dc-3d90-4f23-84a5-68658ade5ff4": {
    "revisionId": "ad61bcf9-f73e-41e7-9ddd-987af8793cff",
    "title": "Why do active funds struggle to beat index funds?"
  },
  "31959d69-2bf8-408b-ab7e-ef6c3275b815": {
    "revisionId": "1252e420-8837-464f-a856-7cbd7a16b008",
    "title": "Did Jack Dorsey create Bitcoin? Examining the Satoshi claims"
  },
  "6fbdade9-1727-4270-ba59-ba7c44598fb0": {
    "revisionId": "8823b622-a1c1-49b4-91de-584488fbf5e7",
    "title": "Universal basic income: what cash trials can and cannot tell us"
  },
  "384224b1-ef33-4c19-b8d1-ce05e23af63f": {
    "revisionId": "f0c57378-ade1-40e1-80ba-afe7e7ab3146",
    "title": "AI and entry-level jobs: who pays when work disappears?"
  },
  "6c030d1d-0b7e-477c-9f96-61d66ca6f7bc": {
    "revisionId": "ce551b9f-2847-46d7-b2b4-41e6be9b7abc",
    "title": "Moore’s law: why power and heat limit faster chips"
  },
  "d9a59bb0-6612-4fc6-b494-1336d8db901d": {
    "revisionId": "013f894d-a578-4419-b0ed-1de7f4d6e869",
    "title": "Why batteries do not improve as fast as computer chips"
  }
};

export function episodeHeadline(episode: Pick<Episode, 'id' | 'revisionId' | 'title' | 'searchTitle'>): string {
  const supplied = episode.searchTitle?.trim();
  if (supplied) return supplied;
  const pilot = Object.hasOwn(headlinePilot, episode.id) ? headlinePilot[episode.id] : undefined;
  return pilot && pilot.revisionId === episode.revisionId ? pilot.title : episode.title;
}
