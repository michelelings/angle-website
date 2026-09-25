import Link from 'next/link';
import type { Episode } from '@/lib/episodes';
import type { TaxonomyEntry } from '@/lib/episode-taxonomy';
import { categoryLabel } from '@/lib/catalog-copy';
import { categorySlug } from '@/lib/episodes';
import { subjectPath } from '@/lib/subject-hub';

const entityGroups = [
  { label: 'People', kinds: ['person'] },
  { label: 'Organizations', kinds: ['organization', 'organisation'] },
  { label: 'Places', kinds: ['place', 'location', 'country', 'region'] },
  { label: 'Events', kinds: ['event'] },
];
interface Item { key: string; name: string; href?: string }
// The same Wikidata item can appear under two taxonomy IDs; key subjects by it so each is listed once.
const subjects = (entries: TaxonomyEntry[]): Item[] => entries.map(entry => ({ key: `subject:${entry.wikidataId || entry.id}`, name: entry.name, href: subjectPath(entry.id) }));
const labels = (names: string[]): Item[] => names.map(name => ({ key: `label:${name.trim()}`, name: name.trim() }));

export function EpisodeTaxonomy({ episode }: { episode: Episode }) {
  const taxonomy = episode.taxonomy;
  const entities = taxonomy?.entities || [];
  const knownKinds = new Set(entityGroups.flatMap(group => group.kinds));
  const seen = new Set<string>();
  const groups = [
    { label: 'Category', items: episode.category ? [{ key: `category:${episode.category}`, name: categoryLabel(episode.category), href: `/${categorySlug(episode.category)}` }] : [] },
    { label: 'Topics', items: taxonomy?.topics.length ? subjects(taxonomy.topics) : labels(episode.topicNames || []) },
    ...entityGroups.map(group => ({ label: group.label, items: subjects(entities.filter(entity => group.kinds.includes(entity.kind))) })),
    { label: 'Also mentioned', items: subjects(entities.filter(entity => !knownKinds.has(entity.kind))) },
    { label: 'Tags', items: labels(episode.tags || []) },
  ].map(group => ({ ...group, items: group.items.filter(item => item.name && !seen.has(item.key) && !!seen.add(item.key)) }))
    .filter(group => group.items.length);
  if (!groups.length) return null;
  return <section className="story-section episode-taxonomy" aria-label="In this story">
    <h2>In this story</h2>
    <dl className="taxonomy-groups">{groups.map(group => <div className="taxonomy-group" key={group.label}>
      <dt>{group.label}</dt>
      <dd><ul>{group.items.map(item => <li key={item.key}>{item.href ? <Link href={item.href} prefetch={false}>{item.name}</Link> : item.name}</li>)}</ul></dd>
    </div>)}</dl>
    {!!taxonomy?.connections.length && <details className="taxonomy-connections">
      <summary>Connections</summary>
      <ul>{taxonomy.connections.map(connection => <li key={connection.id}>{connection.explanation}</li>)}</ul>
    </details>}
  </section>;
}
