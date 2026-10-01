'use strict';
/**
 * ★ STANDARDISE THE SUB-OPTION (DROPDOWN ENTRY) NAMES ★
 *
 * Currently a dropdown entry reads:
 *     "MG Sentry -> EXO-84"
 *
 * That is readable but inconsistent with the new file/mod naming, and it does
 * not say what the entry DOES. Compare with the mod-level naming which now is
 *     "Extra [121] MG Sentry"
 *
 * NEW SCHEME for dropdown entries — lead with the ACTION, then the kind number:
 *
 *     "Bring [088] EXO-84"            <- what this choice does
 *     "Bring [010] EXO-49"
 *     "Bring [003] Eagle 500kg"
 *
 * Rationale:
 *   - the dropdown already tells you WHICH host ("What MG Sentry brings"),
 *     so the entry only needs to say what arrives
 *   - a leading verb makes the list scannable
 *   - the [NNN] number matches every other artefact (file names, mod names,
 *     the Chinese reference table)
 *   - sorting by the number inside the bracket puts entries in kind order,
 *     which is how the in-game list is ordered
 *
 * Also: the entries must be built in KIND ORDER so the dropdown reads
 * 001, 003, 004, 010, ... rather than the order they happened to be generated.
 *
 * IMPORTANT: only the manifest NAME changes. The Include folders and the
 * resource names stay exactly as they are, so nothing about loading changes.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const B = require(require('path').join(__dirname, 'build_addon.js'));

const ROOT = require('path').join(__dirname, '..');
const SRC = ROOT + '/delivery/ExtraSlot/25个独立下拉-规范命名';
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

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.zip')).sort();
let changed = 0;

for (const f of files) {
  const full = path.join(SRC, f);
  const z = readZip(full);
  const man = JSON.parse(z.get('manifest.json').toString('utf8'));
  const subs = man.Options[0].SubOptions;

  // rebuild each entry: parse the grant kind from its own folder name
  const rebuilt = subs.map(s => {
    const m = s.Include[0].match(/h(\d{3})g(\d{3})/);
    const grant = Number(m[2]);
    const label = `Bring [${String(grant).padStart(3, '0')}] ${SHORT.get(grant) || ('kind' + grant)}`;
    return { grant, entry: { Name: label, Description: s.Description, Include: s.Include } };
  });

  // sort by kind so the dropdown reads in the same order as everything else
  rebuilt.sort((a, b) => a.grant - b.grant);

  const out = {};
  for (const [name, buf] of z) out[name] = buf;
  man.Options[0].SubOptions = rebuilt.map(r => r.entry);
  out['manifest.json'] = Buffer.from(JSON.stringify(man, null, 2) + '\n', 'utf8');
  fs.writeFileSync(full, B.zipWrite(out));
  changed++;

  console.log(`${f.padEnd(26)} entries: ${rebuilt.slice(0, 3).map(r => r.entry.Name).join(' | ')} ...`);
}

console.log('');
console.log('updated', changed, 'mods (names only; folders and resource names untouched)');
