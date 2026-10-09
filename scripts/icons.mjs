import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require(process.env.COPY_LINK_SHARP || 'sharp');
const folder = new URL('../extension/icons/', import.meta.url);
await mkdir(folder, { recursive: true });
for (const state of ['default', 'success']) {
  const svg = await readFile(new URL(`../assets/${state}.svg`, import.meta.url));
  for (const size of [16, 32, 48, 128]) {
    await sharp(svg, { density: 384 }).resize(size, size).png()
      .toFile(fileURLToPath(new URL(`${state}-${size}.png`, folder)));
  }
}
console.log('Generated 8 icons from the supplied SVG originals.');
