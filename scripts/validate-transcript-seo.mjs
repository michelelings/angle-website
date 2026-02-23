#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'https://www.newsangle.co';

function normalize(url) {
  return url.replace(/\/+$/, '');
}

function extractTag(html, regex) {
  const m = html.match(regex);
  return m?.[1] ?? null;
}

async function getSampleEpisodeUrls() {
  const apiUrl = `${normalize(BASE_URL)}/api/episodes?limit=5`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Failed to fetch episodes: ${res.status}`);
  const data = await res.json();
  const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
  return episodes.slice(0, 3).map((e) => `${normalize(BASE_URL)}/episode/${e.id}`);
}

async function checkUrl(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const html = await res.text();
  const canonical = extractTag(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots = extractTag(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);

  const expectedCanonical = url;
  const canonicalOk = canonical === expectedCanonical;
  const robotsOk = robots?.toLowerCase() === 'index, follow';

  return {
    url,
    status: res.status,
    canonical,
    robots,
    canonicalOk,
    robotsOk,
    ok: res.ok && canonicalOk && robotsOk,
  };
}

async function main() {
  const sampleUrls = await getSampleEpisodeUrls();
  if (!sampleUrls.length) {
    throw new Error('No sample episode URLs found for validation.');
  }

  const checks = [];
  for (const url of sampleUrls) {
    checks.push(await checkUrl(url));
  }

  const failures = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ baseUrl: BASE_URL, checks, failures: failures.length }, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
