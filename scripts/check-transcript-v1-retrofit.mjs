#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = (process.env.BASE_URL || 'https://www.newsangle.co').replace(/\/+$/, '');
const LINK_BASE_URL = (process.env.LINK_BASE_URL || BASE_URL).replace(/\/+$/, '');
const DATA_PATH = resolve(process.cwd(), 'data/transcript-v1-retrofit.json');

function extractSingle(html, regex) {
  const match = html.match(regex);
  return match?.[1] ?? '';
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeWhitespace(value) {
  return decodeEntities(String(value || '')).replace(/\s+/g, ' ').trim();
}

async function loadDataset() {
  const content = await readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error('retrofit dataset must be an array');
  }
  return parsed;
}

async function fetchPage(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const html = await res.text();
  return { status: res.status, html };
}

function checkField(actual, expected) {
  return normalizeWhitespace(actual) === normalizeWhitespace(expected);
}

async function main() {
  const entries = await loadDataset();
  const checklist = [];

  for (const entry of entries) {
    const url = `${BASE_URL}/episode/${entry.id}`;
    const { status, html } = await fetchPage(url);

    const title = extractSingle(html, /<title>([^<]+)<\/title>/i);
    const metaDescription = extractSingle(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const h1 = extractSingle(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '');
    const summary = extractSingle(html, /<p[^>]*>([\s\S]*?)<\/p>/i).replace(/<[^>]+>/g, '');

    const linkChecks = (entry.internalLinks || []).map((link) => {
      const expectedHref = link.href.startsWith('http') ? link.href : `${LINK_BASE_URL}${link.href}`;
      const hrefRegex = new RegExp(`href=["']${expectedHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
      return {
        href: expectedHref,
        label: link.label,
        pass: hrefRegex.test(html),
      };
    });

    const row = {
      id: entry.id,
      url,
      status,
      fields: {
        title: { expected: entry.seoTitle, actual: title, pass: checkField(title, entry.seoTitle) },
        metaDescription: { expected: entry.metaDescription, actual: metaDescription, pass: checkField(metaDescription, entry.metaDescription) },
        h1: { expected: entry.h1, actual: h1, pass: checkField(h1, entry.h1) },
        summaryOpener: {
          expected: entry.summaryOpener,
          actual: summary,
          pass: normalizeWhitespace(html).includes(normalizeWhitespace(entry.summaryOpener)),
        },
        internalLinks: {
          expected: linkChecks.map((item) => `${item.label} (${item.href})`).join(' | '),
          actual: linkChecks.filter((item) => item.pass).map((item) => `${item.label} (${item.href})`).join(' | '),
          pass: linkChecks.every((item) => item.pass),
        },
      },
    };

    row.pass = status === 200 && Object.values(row.fields).every((field) => field.pass);
    checklist.push(row);
  }

  const summary = {
    baseUrl: BASE_URL,
    linkBaseUrl: LINK_BASE_URL,
    total: checklist.length,
    passed: checklist.filter((row) => row.pass).length,
    failed: checklist.filter((row) => !row.pass).length,
  };

  console.log(JSON.stringify({ summary, checklist }, null, 2));

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('check-transcript-v1-retrofit failed:', error);
  process.exit(1);
});
