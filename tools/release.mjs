// Packages dist/ into spellstroke-itch.zip for itch.io (index.html at the zip root).
// Run via `npm run release`, which builds first. Dependency-free: uses Node's zlib.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const distDir = join(root, 'dist');
const outFile = join(root, 'spellstroke-itch.zip');

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Fixed DOS timestamp (1980-01-01 00:00) so identical builds produce a byte-identical zip
// and the tracked file only changes when the game actually changes.
const dosTime = 0;
const dosDate = (1 << 5) | 1;

const locals = [];
const centrals = [];
let offset = 0;

for (const file of walk(distDir)) {
  const name = Buffer.from(relative(distDir, file).split(sep).join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);

  locals.push(local, name, comp);
  centrals.push(central, name);
  offset += local.length + name.length + comp.length;
  console.log(`  ${name.toString().padEnd(36)} ${String(data.length).padStart(8)} B`);
}

const centralBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(centrals.length / 2, 8);
end.writeUInt16LE(centrals.length / 2, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...locals, centralBuf, end]);
writeFileSync(outFile, zip);
console.log(`\nWrote spellstroke-itch.zip (${(zip.length / 1024).toFixed(1)} KB) — upload it to itch.io.`);
