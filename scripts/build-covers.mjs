import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const recipe = 'original-aspect-social-v4';

// Supply one or more website catalog endpoints. Defaults to the current preview,
// never imports stories into the catalog, and never writes to the media origin.
const endpoints = process.argv.slice(2);
if (!endpoints.length) endpoints.push(process.env.COVER_CATALOG_URL || 'https://angle-website.footy.workers.dev/api/episodes');
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const output = `${publicDir}images/covers`;
const manifestPath = `${publicDir}images/cover-renditions.json`;
await mkdir(output, { recursive: true });
const previous = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}'));
const manifest = {};
const covers = new Map();
for (const endpoint of endpoints) {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}: ${endpoint}`);
    const body = await response.json();
    if (!body.success || !Array.isArray(body.data)) throw new Error(`Invalid catalog: ${endpoint}`);
    for (const episode of body.data) if (episode.coverImage) covers.set(episode.coverImage, episode.updatedAt || episode.createdAt || '');
}

let inputBytes = 0;
let outputBytes = 0;
let failures = 0;
const queue = [...covers];
await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
        const [url, version] = queue.shift();
        try {
            // Rebuild when either the artwork or the resizing recipe changes.
            const cached = previous[url];
            if (cached?.version === version && cached.recipe === recipe && cached.sources?.length === 3) {
                const paths = [...cached.sources.map(s => s.url), cached.socialArtwork, cached.socialBackground];
                const files = await Promise.all(paths.map(path => path ? readFile(`${publicDir}${path.slice(1)}`).catch(() => null) : null));
                if (files.every(Boolean)) { manifest[url] = cached; continue; }
            }
            const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
            if (!response.ok) throw new Error(`Image returned ${response.status}`);
            const input = Buffer.from(await response.arrayBuffer());
            if (input.length > 25 * 1024 * 1024) throw new Error('Cover exceeds 25MB');
            inputBytes += input.length;
            const hash = createHash('sha256').update(input).update(recipe).digest('hex').slice(0, 24);
            const sources = [];
            for (const width of [500, 1000, 1500]) {
                const name = `${hash}-${width}.webp`;
                const bytes = await sharp(input, { limitInputPixels: 40_000_000 }).rotate()
                    .resize({ width })
                    .webp({ quality: 82, effort: 4 }).toBuffer();
                await writeFile(`${output}/${name}`, bytes);
                outputBytes += bytes.length;
                sources.push({ width, url: `/images/covers/${name}` });
            }
            const socialArtwork = `/images/covers/${hash}-social.jpg`;
            const socialBackground = `/images/covers/${hash}-mesh.jpg`;
            await sharp(input).rotate().resize({ width: 750 }).jpeg({ quality: 88 }).toFile(`${publicDir}${socialArtwork.slice(1)}`);
            // Separate pipelines keep the blur at the small resolution. Sharp
            // otherwise reorders resize before blur, leaving visible shapes.
            const small = await sharp(input).rotate().resize(120, 63, { fit: 'cover' }).toBuffer();
            const blurred = await sharp(small).blur(20).modulate({ brightness: 0.72, saturation: 1.15 }).toBuffer();
            await sharp(blurred).resize(1200, 630).jpeg({ quality: 85 }).toFile(`${publicDir}${socialBackground.slice(1)}`);
            manifest[url] = { version, recipe, sources, socialArtwork, socialBackground };
        } catch (error) {
            failures++;
            console.error(`Unable to resize ${url}: ${error.message}`);
            // A failed refresh must never make an existing cover unavailable.
            if (previous[url]) manifest[url] = previous[url];
        }
    }
}));
await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest));
await rename(`${manifestPath}.tmp`, manifestPath);
console.log(JSON.stringify({ covers: covers.size, generatedOrCached: Object.keys(manifest).length, failures, downloadedBytes: inputBytes, generatedBytes: outputBytes }));
if (failures) process.exitCode = 1;
