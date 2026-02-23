#!/usr/bin/env node

/**
 * Validate transcript URL sitemap coverage/freshness against published episode source.
 *
 * Usage:
 *   node scripts/check-sitemap-coverage.mjs
 *   node scripts/check-sitemap-coverage.mjs --source https://preview.vercel.app --canonical https://www.newsangle.co
 */

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = value instanceof Date ? value : toDate(value);
  return date ? date.toISOString().split('T')[0] : null;
}

function latestDate(...values) {
  let latest = null;
  for (const value of values) {
    const date = toDate(value);
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

function extractUrlEntries(xml) {
  const entries = [];
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  const locRegex = /<loc>(.*?)<\/loc>/;
  const lastmodRegex = /<lastmod>(.*?)<\/lastmod>/;

  let match;
  while ((match = urlBlockRegex.exec(xml)) !== null) {
    const block = match[1] || '';
    const locMatch = block.match(locRegex);
    const lastmodMatch = block.match(lastmodRegex);
    if (!locMatch?.[1]) continue;

    entries.push({
      loc: locMatch[1].trim(),
      lastmod: (lastmodMatch?.[1] || '').trim(),
    });
  }

  return entries;
}

async function main() {
  const sourceBase = normalizeBaseUrl(getArg('--source', 'https://www.newsangle.co'));
  const canonicalBase = normalizeBaseUrl(getArg('--canonical', 'https://www.newsangle.co'));

  const [episodesRes, sitemapRes] = await Promise.all([
    fetch(`${sourceBase}/api/episodes`),
    fetch(`${sourceBase}/sitemap.xml`),
  ]);

  if (!episodesRes.ok) {
    throw new Error(`Failed to fetch episodes: ${episodesRes.status}`);
  }
  if (!sitemapRes.ok) {
    throw new Error(`Failed to fetch sitemap: ${sitemapRes.status}`);
  }

  const episodesJson = await episodesRes.json();
  const episodes = Array.isArray(episodesJson?.data) ? episodesJson.data : [];
  const sitemapXml = await sitemapRes.text();
  const entries = extractUrlEntries(sitemapXml);

  const transcriptPrefix = `${canonicalBase}/episode/`;
  const transcriptEntries = entries.filter((entry) => entry.loc.startsWith(transcriptPrefix));

  const malformedEntries = entries.filter((entry) => {
    if (!entry.loc.startsWith(canonicalBase)) return true;
    if (entry.loc.includes('/episode//')) return true;
    if (/\s/.test(entry.loc)) return true;
    return false;
  });

  const episodeIds = new Set(
    episodes
      .map((episode) => String(episode?.id || '').trim())
      .filter(Boolean)
  );

  const transcriptIdsInSitemap = new Set(
    transcriptEntries
      .map((entry) => {
        const id = decodeURIComponent(entry.loc.slice(transcriptPrefix.length));
        return id.trim();
      })
      .filter(Boolean)
  );

  const missingTranscriptIds = [...episodeIds].filter((id) => !transcriptIdsInSitemap.has(id));
  const extraTranscriptIds = [...transcriptIdsInSitemap].filter((id) => !episodeIds.has(id));

  const transcriptLastmodMismatches = [];
  const entryByTranscriptId = new Map(
    transcriptEntries.map((entry) => [decodeURIComponent(entry.loc.slice(transcriptPrefix.length)).trim(), entry])
  );

  for (const episode of episodes) {
    const id = String(episode?.id || '').trim();
    if (!id) continue;

    const entry = entryByTranscriptId.get(id);
    if (!entry) continue;

    const expectedLastmod = formatDate(latestDate(episode?.updatedAt, episode?.createdAt));
    if (entry.lastmod !== expectedLastmod) {
      transcriptLastmodMismatches.push({
        id,
        sitemapLastmod: entry.lastmod,
        expectedLastmod,
      });
    }
  }

  console.log(`source_base=${sourceBase}`);
  console.log(`canonical_base=${canonicalBase}`);
  console.log(`sitemap_total_urls=${entries.length}`);
  console.log(`sitemap_unique_urls=${new Set(entries.map((entry) => entry.loc)).size}`);
  console.log(`transcript_source_count=${episodeIds.size}`);
  console.log(`transcript_sitemap_count=${transcriptEntries.length}`);
  console.log(`malformed_entries=${malformedEntries.length}`);
  console.log(`missing_transcript_entries=${missingTranscriptIds.length}`);
  console.log(`extra_transcript_entries=${extraTranscriptIds.length}`);
  console.log(`transcript_lastmod_mismatches=${transcriptLastmodMismatches.length}`);

  const sampleRows = transcriptEntries.slice(0, 5).map((entry) => ({
    loc: entry.loc,
    lastmod: entry.lastmod,
  }));

  console.log('\nSample transcript rows:');
  sampleRows.forEach((row) => {
    console.log(`- ${row.loc} | lastmod=${row.lastmod}`);
  });

  if (transcriptLastmodMismatches.length > 0) {
    console.log('\nSample lastmod mismatches:');
    transcriptLastmodMismatches.slice(0, 5).forEach((row) => {
      console.log(`- ${row.id} | sitemap=${row.sitemapLastmod} | expected=${row.expectedLastmod}`);
    });
  }

  if (malformedEntries.length > 0) {
    console.log('\nSample malformed entries:');
    malformedEntries.slice(0, 5).forEach((entry) => {
      console.log(`- ${entry.loc}`);
    });
  }
}

main().catch((error) => {
  console.error('check-sitemap-coverage failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
