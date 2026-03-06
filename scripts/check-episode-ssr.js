#!/usr/bin/env node
/**
 * CI regression check for episode SSR content.
 *
 * Usage:
 *   node scripts/check-episode-ssr.js [--base-url=https://www.newsangle.co] [--sample=20]
 *
 * Fetches a random sample of episode URLs from sitemap.xml, then for each:
 *   - Counts words in the raw HTML response
 *   - Checks for shell error strings that indicate the SPA fallback is being served
 *
 * Exits 1 if:
 *   - Median word count across sample < 500
 *   - Any episode page contains the shell error string
 */

import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const baseUrl = args.find((a) => a.startsWith('--base-url='))?.split('=')[1] || 'https://www.newsangle.co';
const sampleSize = parseInt(args.find((a) => a.startsWith('--sample='))?.split('=')[1] || '20', 10);
const SHELL_STRINGS = ['0 stories worth listening.'];
const MIN_MEDIAN_WORDS = 500;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function countWords(html) {
  return html.split(/\s+/).filter(Boolean).length;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  console.log(`\n🔍 Episode SSR check — base: ${baseUrl}, sample: ${sampleSize}`);

  // Fetch sitemap
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  const sitemapXml = await fetchText(sitemapUrl);
  const allEpisodeUrls = [...sitemapXml.matchAll(/<loc>([^<]*)\/episode\/([^<]*)<\/loc>/g)]
    .map((m) => m[0].replace(/<\/?loc>/g, ''));

  if (allEpisodeUrls.length === 0) {
    console.error('❌ No episode URLs found in sitemap!');
    process.exit(1);
  }

  const sample = shuffle(allEpisodeUrls).slice(0, Math.min(sampleSize, allEpisodeUrls.length));
  console.log(`Checking ${sample.length} of ${allEpisodeUrls.length} episode URLs...\n`);

  let failures = 0;
  const wordCounts = [];

  for (const url of sample) {
    let html;
    try {
      html = await fetchText(url);
    } catch (e) {
      console.error(`  ❌ FETCH FAILED: ${url} — ${e.message}`);
      failures++;
      continue;
    }

    const words = countWords(html);
    wordCounts.push(words);

    const shellHits = SHELL_STRINGS.filter((s) => html.includes(s));
    const ok = shellHits.length === 0 && words >= MIN_MEDIAN_WORDS;

    if (ok) {
      console.log(`  ✅ ${words}w — ${url}`);
    } else {
      console.error(`  ❌ ${words}w, shell=[${shellHits.join(', ')}] — ${url}`);
      failures++;
    }
  }

  const med = wordCounts.length > 0 ? median(wordCounts) : 0;
  console.log(`\nMedian word count: ${med} (min required: ${MIN_MEDIAN_WORDS})`);

  if (med < MIN_MEDIAN_WORDS) {
    console.error(`❌ Median word count ${med} is below ${MIN_MEDIAN_WORDS} — SSR content is insufficient.`);
    failures++;
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log(`\n✅ All ${sample.length} episode pages pass SSR content check.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
