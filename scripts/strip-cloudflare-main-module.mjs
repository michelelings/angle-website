import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../cloudflare-env.d.ts', import.meta.url);
const generated = await readFile(path, 'utf8');
// Keep generated bundle implementation outside the application's type graph.
await writeFile(path, generated.replace(/\n\tinterface GlobalProps \{\n\t\tmainModule: typeof import\("\.\/\.open-next\/worker"\);\n\t\}/u, '\n\tinterface GlobalProps {}'));
