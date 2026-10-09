import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
const source = new URL('../extension/', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
async function list(folder, prefix = '') {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await list(new URL(`${entry.name}/`, folder), `${relative}/`));
    else files.push(relative);
  }
  return files.sort();
}
// A deterministic ZIP containing the loadable extension only; no build dependencies.
const localParts = [], centralParts = [];
let offset = 0;
const files = await list(source);
for (const relative of files) {
  const name = Buffer.from(relative);
  const data = await readFile(new URL(relative, source));
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
  localParts.push(local, name, compressed); centralParts.push(central, name);
  offset += local.length + name.length + compressed.length;
}
const directory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(output, { recursive: true });
await writeFile(new URL('copy-openproject-link.zip', output), Buffer.concat([...localParts, directory, end]));
console.log(`Packaged ${files.length} files: dist/copy-openproject-link.zip`);
