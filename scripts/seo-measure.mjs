import { JSDOM } from 'jsdom';
import { mkdir, writeFile } from 'node:fs/promises';
const base = new URL(process.argv[2] || 'https://www.newsangle.co');
const label = process.argv[3] || 'latest';
const enforce = process.argv.includes('--assert');
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Use a simple report label');
const canonicalOrigin = 'https://www.newsangle.co';
const sitemap = await fetch(new URL('/sitemap.xml', base), { signal: AbortSignal.timeout(30000) });
if (!sitemap.ok) throw new Error(`Sitemap HTTP ${sitemap.status}`);
const xml = await sitemap.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
const pages = [];
for (const url of urls) {
  const pathname = new URL(url).pathname;
  const started = performance.now();
  const response = await fetch(new URL(pathname, base), { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'AngleSEOCheck/1.0' } });
  const ttfbMs = Math.round(performance.now() - started);
  const html = await response.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  doc.querySelectorAll('script,style,noscript').forEach(node => node.remove());
  const links = [...new Set([...doc.querySelectorAll('a[href]')].map(a => new URL(a.getAttribute('href'), canonicalOrigin + pathname)).filter(u => u.origin === canonicalOrigin).map(u => u.pathname + u.search))];
  pages.push({ path: pathname, status: response.status, location: response.headers.get('location'), ttfbMs, htmlBytes: Buffer.byteLength(html), title: doc.title,
    h1: [...doc.querySelectorAll('h1')].map(n => n.textContent.trim()),
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || null,
    canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
    robots: doc.querySelector('meta[name="robots"]')?.getAttribute('content') || null,
    robotsHeader: response.headers.get('x-robots-tag'),
    internalLinks: links, imagesWithoutAlt: doc.querySelectorAll('img:not([alt])').length });
  dom.window.close();
}
const known = new Map(pages.map(p => [p.path,p]));
const extraLinks = [...new Set(pages.flatMap(p => p.internalLinks))].filter(path => !known.has(path));
const extra = [];
for (const path of extraLinks) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  extra.push({path,status:response.status,location:response.headers.get('location')});
  await response.body?.cancel();
}
const incoming = Object.fromEntries(pages.map(p => [p.path, pages.filter(other => other.path !== p.path && other.internalLinks.includes(p.path)).length]));
const depth = {'/':0}; const queue = ['/'];
while(queue.length) { const current = queue.shift(); for(const link of known.get(current)?.internalLinks || []) if(known.has(link) && depth[link] === undefined) { depth[link]=depth[current]+1;queue.push(link); } }
const report = { measuredAt: new Date().toISOString(), base:base.origin,
  methodology:'Single sequential HTTP observation per sitemap page; TTFB includes network time. Server HTML links exclude script/style/noscript. These timings are not Core Web Vitals or a ranking measurement.',
  vitals: { speed:{maxTtfbMs:Math.max(...pages.map(p=>p.ttfbMs)),totalHtmlBytes:pages.reduce((sum,p)=>sum+p.htmlBytes,0)},
    relevance:{status:'unverified',reason:'No approved keyword map or Search Console query data'},
    googleCtr:{status:'unavailable',reason:'No Search Console connection available in this session'},
    links:{broken:[...pages,...extra].filter(p=>p.status>=400),redirecting:[...pages,...extra].filter(p=>p.status>=300&&p.status<400),orphans:pages.filter(p=>p.path!=='/'&&!incoming[p.path]).map(p=>p.path),unreachableFromHome:pages.filter(p=>depth[p.path]===undefined).map(p=>p.path)} },
  findings:{missingH1:pages.filter(p=>p.h1.length!==1).map(p=>p.path),canonicalMismatch:pages.filter(p=>!p.canonical || new URL(p.canonical).href!==new URL(p.path,canonicalOrigin).href).map(p=>p.path),missingDescription:pages.filter(p=>!p.description).map(p=>p.path)},
  pages:pages.map(p=>({...p,incomingLinks:incoming[p.path],clickDepth:depth[p.path]??null})), extraLinks:extra };
await mkdir('.seo/runs',{recursive:true});
await writeFile(`.seo/runs/${label}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pages:pages.length,vitals:report.vitals,findings:report.findings,report:`.seo/runs/${label}.json`},null,2));

if (enforce && (Object.values(report.findings).some(items => items.length) || report.vitals.links.broken.length || report.vitals.links.orphans.length)) process.exitCode = 1;
