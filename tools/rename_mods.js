'use strict';
/**
 * Rename the 25 mods with consistent numbering and a clear, sortable scheme.
 *
 * Current names are inconsistent: "01 Extra Tank", "13 Extra Gatling Sentry",
 * but the numbering was assigned by list order, not by kind, and the display
 * name and file name carry "Extra" with no kind number.
 *
 * NEW SCHEME
 *   display name : "Extra [018] Eagle Airstrike"      (kind number + name)
 *   file name    : "018 Eagle Airstrike.zip"           (sorts by kind)
 *
 * Why kind-based numbering:
 *   - sorts into the same order as the in-game stratagem list
 *   - the kind number matches the reference tables (中文名对照表 / stratagem_kinds)
 *   - the user can see at a glance which record each mod owns
 *
 * The resource name stays `mods/dsh/x9NNN` so nothing about loading changes --
 * this is a rename of the manifest Name and the zip file, not a rebuild of the
 * engine. But the manifest lives INSIDE the zip, so the zips must be rebuilt.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = require('path').join(__dirname, '..');
const SRC = ROOT + '/delivery/ExtraSlot/25个独立下拉';
const DST = ROOT + '/delivery/ExtraSlot/25个独立下拉-规范命名';

const SHORT = new Map(JSON.parse(fs.readFileSync(ROOT + '/ref/short_names.json', 'utf8')).map(x => [x.kind, x.short]));

// read a zip -> Map(name -> Buffer)
function readZip(p) {
  const zip = fs.readFileSync(p);
  let e = -1;
  for (let i = zip.length - 22; i >= 0; i--) if (zip.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  const n = zip.readUInt16LE(e + 10), cd = zip.readUInt32LE(e + 16);
  let q = cd;
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const nl = zip.readUInt16LE(q + 28), el = zip.readUInt16LE(q + 30), cl = zip.readUInt16LE(q + 32);
    const lho = zip.readUInt32LE(q + 42);
    const nm = zip.subarray(q + 46, q + 46 + nl).toString();
    const cs = zip.readUInt32LE(q + 20), m = zip.readUInt16LE(q + 10);
    const lnl = zip.readUInt16LE(lho + 26), lel = zlib ? zip.readUInt16LE(lho + 28) : 0;
    const c = zip.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + cs);
    out.set(nm, m === 8 ? zlib.inflateRawSync(c) : c);
    q += 46 + nl + el + cl;
  }
  return out;
}

const B = require(ROOT + '/tools/build_addon.js');

if (fs.existsSync(DST)) fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

const src = fs.readdirSync(SRC).filter(f => f.endsWith('.zip')).sort();
const list = [];

for (const f of src) {
  const z = readZip(path.join(SRC, f));
  const man = JSON.parse(z.get('manifest.json').toString('utf8'));
  const sub = man.Options[0].SubOptions[0];
  // recover the host kind from the Include folder (hNNNgNNN)
  const m = sub.Include[0].match(/h(\d{3})g(\d{3})/);
  if (!m) { console.log('  skip (no kind):', f); continue; }
  const kind = Number(m[1]);
  const short = SHORT.get(kind) || `kind${kind}`;
  list.push({ file: f, zip: z, kind, short, guid: man.Guid });
}

list.sort((a, b) => a.kind - b.kind);

const report = [];
for (const e of list) {
  const fileBase = `${String(e.kind).padStart(3, '0')} ${e.short}`;
  const display = `Extra [${String(e.kind).padStart(3, '0')}] ${e.short}`;

  // rebuild files map with the new manifest Name
  const files = {};
  for (const [name, buf] of e.zip) {
    if (name === 'manifest.json') {
      const man = JSON.parse(buf.toString('utf8'));
      man.Name = display;
      man.Description = `${display} -- choose one extra stratagem this host delivers.`;
      man.Options[0].Name = `What ${e.short} brings`;
      files[name] = Buffer.from(JSON.stringify(man, null, 2) + '\n', 'utf8');
    } else {
      files[name] = buf;
    }
  }
  const out = path.join(DST, fileBase + '.zip');
  fs.writeFileSync(out, B.zipWrite(files));
  report.push({ file: fileBase + '.zip', display, kind: e.kind, bytes: fs.statSync(out).size });
}

console.log('renamed', report.length, 'mods');
console.log('');
for (const r of report) {
  console.log(`  ${r.file.padEnd(30)} name="${r.display}"`);
}
fs.writeFileSync(ROOT + '/build/renamed.json', JSON.stringify(report, null, 2));
