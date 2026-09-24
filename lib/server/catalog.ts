import 'server-only';
import { cache } from 'react';
import { getCloudflareContext } from '../opennext-context.js';
import { readCatalog, readEpisode, type Env } from '../../worker/catalog';

export async function catalogEnv(): Promise<Env> {
  const { env } = await getCloudflareContext({ async: true });
  // A local service binding has no running backend unless angle-api is also being
  // developed. Use its public read-only API locally; production uses the binding.
  return { ...env, ANGLE_BACKEND: process.env.NODE_ENV === 'development' || env.ENVIRONMENT === 'local' ? undefined : env.ANGLE_BACKEND };
}
// React cache deduplicates within a server render, without persisting a stale catalog.
export const getCatalog = cache(async () => readCatalog(await catalogEnv()));
export const getEpisode = cache(async (id: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return readEpisode(await catalogEnv(), id);
});
