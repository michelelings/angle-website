#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'https://www.newsangle.co';
const CANONICAL_BASE_URL = process.env.CANONICAL_BASE_URL || 'https://www.newsangle.co';
const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE || 5);

const FALLBACK_EPISODE_IDS = [
  'ccfc5b7d-7d24-4aaf-9886-d7410d7dcdeb',
  '289c653a-1142-4503-8f6f-808e5dc66576',
  '0c5857fc-0d19-419e-9c65-d8d51fab74e8',
  'c2bbf8ba-79b3-46ca-8096-3d498b54724a',
  '87ede454-3768-487d-b03b-ba05c427cf97',
];

function normalize(url) {
  return url.replace(/\/+$/, '');
}

function extractTag(html, regex) {
  const m = html.match(regex);
  return m?.[1] ?? null;
}

function parseEpisodeIdsFromApiPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [];
  if (Array.isArray(payload)) candidates.push(...payload);
  if (Array.isArray(payload.episodes)) candidates.push(...payload.episodes);
  if (Array.isArray(payload.data)) candidates.push(...payload.data);

  return candidates
    .map((entry) => (entry && typeof entry === 'object' ? entry.id : null))
    .filter((id) => typeof id === 'string' && id.length > 0);
}

async function getEpisodeIdsFromApi() {
  const apiUrl = `${normalize(BASE_URL)}/api/episodes`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Failed to fetch episodes API (${res.status})`);
  const payload = await res.json();
  return parseEpisodeIdsFromApiPayload(payload);
}

async function getEpisodeIdsFromSitemap() {
  const sitemapUrl = `${normalize(BASE_URL)}/sitemap.xml`;
  const res = await fetch(sitemapUrl);
  if (!res.ok) throw new Error(`Failed to fetch sitemap (${res.status})`);

  const xml = await res.text();
  const matches = Array.from(xml.matchAll(/<loc>(https?:\/\/[^<]+\/episode\/([a-f0-9-]+))<\/loc>/gi));
  return matches.map((m) => m[2]);
}

function buildEpisodeUrls(ids) {
  return ids
    .filter(Boolean)
    .slice(0, SAMPLE_SIZE)
    .map((id) => `${normalize(BASE_URL)}/episode/${id}`);
}

async function getSampleEpisodeUrls() {
  const warnings = [];

  try {
    const apiIds = await getEpisodeIdsFromApi();
    if (apiIds.length > 0) {
      return {
        source: 'api/episodes',
        warnings,
        urls: buildEpisodeUrls(apiIds),
      };
    }
    warnings.push('api/episodes returned 0 episode IDs; trying sitemap fallback.');
  } catch (error) {
    warnings.push(`api/episodes unavailable (${error.message}); trying sitemap fallback.`);
  }

  try {
    const sitemapIds = await getEpisodeIdsFromSitemap();
    if (sitemapIds.length > 0) {
      return {
        source: 'sitemap.xml',
        warnings,
        urls: buildEpisodeUrls(sitemapIds),
      };
    }
    warnings.push('sitemap.xml returned 0 episode URLs; using static fallback IDs.');
  } catch (error) {
    warnings.push(`sitemap.xml unavailable (${error.message}); using static fallback IDs.`);
  }

  return {
    source: 'static-fallback',
    warnings,
    urls: buildEpisodeUrls(FALLBACK_EPISODE_IDS),
  };
}

function expectedCanonicalFor(url) {
  const parsed = new URL(url);
  return `${normalize(CANONICAL_BASE_URL)}${parsed.pathname}`;
}

function canonicalMatches(expectedUrl, actualCanonical) {
  if (!actualCanonical) return false;
  return normalize(actualCanonical) === normalize(expectedUrl);
}

function robotsIsIndexFollow(robotsValue) {
  if (!robotsValue) return false;
  const normalized = robotsValue
    .toLowerCase()
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return normalized.includes('index') && normalized.includes('follow') && !normalized.includes('noindex');
}

async function checkUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const html = await res.text();

  const canonical = extractTag(
    html,
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i
  );
  const robots = extractTag(
    html,
    /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i
  );

  const expectedCanonical = expectedCanonicalFor(url);
  const canonicalOk = canonicalMatches(expectedCanonical, canonical);
  const robotsOk = robotsIsIndexFollow(robots);

  return {
    url,
    status: res.status,
    expectedCanonical,
    canonical,
    robots,
    canonicalOk,
    robotsOk,
    ok: res.ok && canonicalOk && robotsOk,
  };
}

async function main() {
  const sample = await getSampleEpisodeUrls();

  if (!sample.urls.length) {
    throw new Error('No sample episode URLs available for validation.');
  }

  const checks = [];
  for (const url of sample.urls) {
    checks.push(await checkUrl(url));
  }

  const failures = checks.filter((c) => !c.ok);
  const output = {
    baseUrl: BASE_URL,
    canonicalBaseUrl: CANONICAL_BASE_URL,
    sampleSource: sample.source,
    warnings: sample.warnings,
    sampleSize: sample.urls.length,
    checks,
    failures: failures.length,
  };

  console.log(JSON.stringify(output, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
