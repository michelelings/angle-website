import type { Episode } from './episodes';
import type { SubjectHub } from './subject-hub';

export interface SubjectEditorial {
  id: string;
  aliases: string[];
  title: string;
  description: string;
  introduction: string[];
  questions: { question: string; context: string; episodeId: string }[];
  updatedAt: string;
}

// Original reading guides: each question links to a story that addresses it.
// Keep these small and curated; encyclopedia excerpts alone do not qualify a hub.
export const subjectEditorial: SubjectEditorial[] = [
  {
    id: 'wikidata-Q131723', aliases: ['bitcoin'], title: 'Bitcoin: its origins and cryptographic security',
    description: 'Explore the evidence about Bitcoin’s creator and the questions AI and quantum computing raise about its security.',
    introduction: [
      'Bitcoin’s origins and its security invite different kinds of questions. Identifying its creator requires historical evidence; assessing its encryption requires understanding what a computer can actually do.',
      'These two stories separate claims about Satoshi Nakamoto from claims about breaking cryptography. Start with the origin story, then examine the distinction between an AI finding a flaw and a quantum computer attacking a cryptographic system.',
    ],
    questions: [
      { question: 'What is the evidence behind claims that Jack Dorsey created Bitcoin?', context: 'Examine the timeline and the limits of circumstantial evidence about Satoshi Nakamoto.', episodeId: '31959d69-2bf8-408b-ab7e-ef6c3275b815' },
      { question: 'Could AI or quantum computing undermine Bitcoin’s security?', context: 'Explore why finding a weakness in one encryption proposal does not establish that every digital vault can be opened.', episodeId: '5af3b0b0-0e1a-4e0c-b224-997d06b60a82' },
    ], updatedAt: '2026-10-03',
  },
  {
    id: 'wikidata-Q178655', aliases: ['moores-law'], title: 'Moore’s law and the physical limits of computing',
    description: 'Why faster chips need more than smaller transistors, and why battery improvements follow a different path from computing.',
    introduction: [
      'Expectations about faster computers often spill over into expectations about every other technology. These stories examine where that comparison works and where it breaks down.',
      'Read the chip story for power, heat, and packaging constraints. Then turn to batteries, where storing energy poses a different problem from processing information. Together they explain why progress in one component does not guarantee the same pace everywhere else.',
    ],
    questions: [
      { question: 'What limits faster chips as transistors get smaller?', context: 'Follow the shift from shrinking components to managing power, heat, and the connections between chips.', episodeId: '6c030d1d-0b7e-477c-9f96-61d66ca6f7bc' },
      { question: 'Why do batteries not improve at the same rate as computer chips?', context: 'Compare the physical constraints of energy storage with the scaling of semiconductor devices.', episodeId: 'd9a59bb0-6612-4fc6-b494-1336d8db901d' },
    ], updatedAt: '2026-10-03',
  },
  {
    id: 'wikidata-Q678522', aliases: ['universal-basic-income'], title: 'Universal basic income, cash trials, and the future of work',
    description: 'Explore what guaranteed-income trials can tell us, what they leave unanswered, and how AI changes the debate about work and income.',
    introduction: [
      'A cash trial and a permanent national basic income answer different questions. A trial can reveal how recipients respond, while a national policy also has to address funding, scale, and who participates.',
      'These stories connect evidence from cash programs with the debate about automation and entry-level work. Read them together to distinguish what has been observed from proposals about how society might respond to changing employment.',
    ],
    questions: [
      { question: 'What can guaranteed-income trials tell us about a national basic income?', context: 'Compare recipients’ experiences with the questions that appear when a local program is scaled up.', episodeId: '6fbdade9-1727-4270-ba59-ba7c44598fb0' },
      { question: 'How does AI change the debate about jobs and income?', context: 'Explore entry-level employment, automation levies, and proposals for sharing the gains from technology.', episodeId: '384224b1-ef33-4c19-b8d1-ce05e23af63f' },
    ], updatedAt: '2026-10-03',
  },
];

export function editorialForSubject(hub: Pick<SubjectHub, 'id' | 'profile'>): SubjectEditorial | undefined {
  return subjectEditorial.find(item => item.id === (hub.profile?.id ?? hub.id) || item.aliases.includes(hub.id));
}
export function eligibleSubject(hub: SubjectHub): boolean {
  const editorial = editorialForSubject(hub);
  return hub.profileStatus !== 'ambiguous' && !!editorial
    && editorial.questions.every(item => hub.episodes.some(episode => episode.id === item.episodeId));
}
export function featuredSubjects(episodes: Episode[]): SubjectEditorial[] {
  const ids = new Set(episodes.map(episode => episode.id));
  return subjectEditorial.filter(item => item.questions.every(question => ids.has(question.episodeId)));
}
