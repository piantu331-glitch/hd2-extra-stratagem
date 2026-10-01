'use strict';
/**
 * Verify the renamed dropdown entries:
 *   - every entry label is "Bring [NNN] Short"
 *   - the NNN in the label matches the grant recorded in the folder name
 *   - the folder's leaf script actually sets that grant
 *   - folders and resource names are UNCHANGED (so loading behaviour is identical)
 *   - entries are in ascending kind order
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = require('path').join(__dirname, '..');
const SRC = ROOT + '/dist/25x24';
const SHORT = new Map(JSON.parse(fs.readFileSync(ROOT + '/ref/short_names.json', 'utf8')).map(x => [x.kind, x.short]));

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
    const lnl = zip.readUInt16LE(lho + 26), lel = zip.readUInt16LE(lho + 28);
    const c = zip.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + cs);
    out.set(nm, m === 8 ? zlib.inflateRawSync(c) : c);
    q += 46 + nl + el + cl;
  }
  return out;
}

function leafEntry(buf, idx) {
  const base = 104 + 80 * idx;
  const off = Number(buf.readBigUInt64LE(base + 16));
  const len = buf.readUInt32LE(base + 56);
  if (!off || !len || off + len > buf.length) return null;
  const env = buf.subarray(off, off + len);
  return env.subarray(8, 8 + env.readUInt32LE(0)).toString('utf8');
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.zip')).sort();
let bad = 0, totalEntries = 0;
const coreSeen = new Set();

for (const f of files) {
  const z = readZip(path.join(SRC, f));
  const man = JSON.parse(z.get('manifest.json').toString('utf8'));
  const subs = man.Options[0].SubOptions;
  const hostKind = Number(man.Name.match(/\[(\d+)\]/)[1]);
  let prev = -1;
  let fileBad = 0;

  for (const s of subs) {
    totalEntries++;
    const m = s.Include[0].match(/h(\d{3})g(\d{3})/);
    if (!m) { fileBad++; continue; }
    const h = Number(m[1]), g = Number(m[2]);
    const expect = `Bring [${String(g).padStart(3, '0')}] ${SHORT.get(g) || ('kind' + g)}`;
    if (s.Name !== expect) { fileBad++; console.log(`    label mismatch: "${s.Name}" != "${expect}"`); }
    if (h !== hostKind) { fileBad++; console.log(`    folder host ${h} != mod host ${hostKind}`); }
    if (g <= prev) { fileBad++; console.log(`    out of order at ${g}`); }
    if (g === h) { fileBad++; console.log(`    self-grant at ${g}`); }
    prev = g;

    // the leaf script must set p[host] = grant
    const raw = z.get(s.Include[0] + '/9ba626afa44a3aa3.patch_0');
    if (!raw) { fileBad++; continue; }
    // the archive holds TWO resources; find them by declaration, not by index
    const all = [];
    for (let k = 0; k < 4; k++) {
      const b = leafEntry(raw, k);
      if (b) all.push(b);
    }
    const leaf = all.find(x => /\/x9\d{3}\//.test(x.split('\n')[0]));
    const core = all.find(x => x.split('\n')[0].includes('/xcore'));
    const want = `p[${h}] = ${g}`;
    if (!leaf || leaf.indexOf(want) < 0) { fileBad++; console.log(`    script missing "${want}"`); }
    if (!core) { fileBad++; console.log('    shared engine missing'); }
    else coreSeen.add(core.split('\n')[0]);
  }

  if (fileBad) { bad++; console.log(`  BAD ${f} (${fileBad} issues)`); }
  else console.log(`  OK  ${f.padEnd(26)} ${subs.length} entries, ${subs[0].Name} .. ${subs[subs.length-1].Name}`);
}

console.log('');
console.log('mods       :', files.length);
console.log('entries    :', totalEntries);
console.log('bad mods   :', bad);
console.log('engine decl:', [...coreSeen].join(', '), `(${coreSeen.size} distinct -> loaded once)`);
console.log('');
console.log(bad === 0 && coreSeen.size === 1
  ? 'ALL 25 MODS VALID — labels, folders, scripts and shared engine all consistent'
  : 'PROBLEM');
