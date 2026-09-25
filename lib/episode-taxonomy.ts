export interface TaxonomyEntry {
  id: string;
  name: string;
  kind: string;
  /** Wikidata item (for example `Q55223040`) identifying the same subject across episodes. */
  wikidataId: string | null;
}
export interface EpisodeTaxonomy {
  entities: TaxonomyEntry[];
  topics: TaxonomyEntry[];
  connections: { id: string; explanation: string }[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Only expose named taxonomy entries and published connection copy. */
export function parseEpisodeTaxonomy(value: unknown): EpisodeTaxonomy {
  const taxonomy = record(value);
  const entries = (value: unknown) => array(value).flatMap(value => {
    const entry = record(value), id = text(entry.id), name = text(entry.name), wikidataId = text(entry.wikidataId);
    return id && name ? [{ id, name, kind: text(entry.kind), wikidataId: /^Q[1-9]\d{0,15}$/.test(wikidataId) ? wikidataId : null }] : [];
  }).filter((entry, index, all) => all.findIndex(other => other.id === entry.id) === index);
  const entities = entries(taxonomy.entities), topics = entries(taxonomy.topics);
  const ids = new Set([...entities, ...topics].map(entry => entry.id));
  const connections = array(taxonomy.relations).flatMap(value => {
    const relation = record(value), id = text(relation.id), explanation = text(relation.explanation);
    return id && explanation && ids.has(text(relation.fromId)) && ids.has(text(relation.targetId)) ? [{ id, explanation }] : [];
  }).filter((entry, index, all) => all.findIndex(other => other.id === entry.id) === index);
  return { entities, topics, connections };
}
