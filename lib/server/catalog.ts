import 'server-only';
import { cache } from 'react';
import { getCloudflareContext } from '../opennext-context.js';
import { readCatalog, readEpisode, readSubjectHub, type Env } from '../../worker/catalog';
import { subjectIdPattern } from '../subject-hub';

export async function catalogEnv(): Promise<Env> {
  const { env } = await getCloudflareContext({ async: true });
  // A local service binding has no running backend unless angle-api is also being
  // developed. Use its public read-only API locally; production uses the binding.
  return { ...env, ANGLE_BACKEND: process.env.NODE_ENV === 'development' || env.ENVIRONMENT === 'local' ? undefined : env.ANGLE_BACKEND };
}
// Deduplicate within the render; readCatalog also has a 60-second edge cache.
export const getCatalog = cache(async () => readCatalog(await catalogEnv()));
export const getEpisode = cache(async (id: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return readEpisode(await catalogEnv(), id);
});
export const getSubjectHub = cache(async (id: string) => {
  if (!subjectIdPattern.test(id)) return null;
  return readSubjectHub(await catalogEnv(), id);
});
