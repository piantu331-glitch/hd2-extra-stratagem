'use strict';
/**
 * ★ "MOD CONFLICTS" — IS IT A PROBLEM? ★
 *
 * The dialog says:
 *
 *   "EXTRA GATLING SENTRY" MOD CONFLICTS
 *   #7  Extra Eagle 500kg            [warning icon 1]
 *       Option 1 -> Suboption 1  <->  Option 1 -> Suboption 1        1
 *
 * WHAT THE MANAGER IS DETECTING
 * ------------------------------
 * It flags two mods whose CHOSEN OPTION PATH is identical:
 *     "Option 1 -> Suboption 1"
 * That is literally the same path in both manifests, because EVERY one of my 25
 * mods has exactly ONE Option with ONE selected SubOption.
 *
 * So the manager sees 25 mods that all say "Option 1 -> Suboption 1" and assumes
 * they must be fighting over the same thing.
 *
 * WHY THE WARNING IS A FALSE POSITIVE HERE
 * ----------------------------------------
 * The path is the same, but the CONTENT is not. The SubOption's Include points
 * at a DIFFERENT folder in each mod:
 *
 *     Extra Gatling Sentry  -> Choices/h066gNNN   (writes host 66)
 *     Extra Eagle 500kg     -> Choices/h003gNNN   (writes host 3)
 *
 * Different folders, different leaf scripts, different hosts, different grants.
 * They cannot conflict: each writes its own record's +200.
 *
 * The evidence that they do NOT actually conflict:
 *   the log from the run the user just did:
 *       host   3  +200 49 -> 88  OK
 *       host 147  +200  0 -> 66  OK
 *   BOTH writes succeeded, on DIFFERENT hosts. No fight.
 *   And the screenshot showed BOTH extras in the loadout.
 *
 * ★ HOW TO CONFIRM IT IS BENIGN ★
 * The manager's conflict detection is path-based, not content-based. A genuine
 * conflict would be two mods including the SAME folder. None of mine do.
 *
 * Let me prove it from the built zips: no two of the 25 mods share an Include
 * path, and no two leaf archives contain the same leaf resource name.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const dir = require('path').join(__dirname, '..', 'dist/25x24');
const zips = fs.readdirSync(dir).filter(f => f.endsWith('.zip')).sort();

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

const paths = [];
const leafNames = [];
for (const f of zips) {
  const z = readZip(path.join(dir, f));
  const man = JSON.parse(z.get('manifest.json').toString('utf8'));
  const sub = man.Options[0].SubOptions[0];
  paths.push({ file: f, include: sub.Include[0], subName: sub.Name });
  // leaf resource name(s) inside the archive
  const raw = z.get(sub.Include[0] + '/9ba626afa44a3aa3.patch_0');
  for (let i = 0; i < 2; i++) {
    const base = 104 + 80 * i;
    const off = Number(raw.readBigUInt64LE(base + 16));
    const len = raw.readUInt32LE(base + 56);
    if (!off || !len) continue;
    const env = raw.subarray(off, off + len);
    const decl = env.subarray(8, 8 + env.readUInt32LE(0)).toString('utf8').split('\n')[0];
    leafNames.push({ file: f, decl });
  }
}

console.log('=== Include paths across the 25 mods ===');
const incCount = {};
for (const p of paths) incCount[p.include] = (incCount[p.include] || 0) + 1;
console.log('  distinct Include paths:', Object.keys(incCount).length, 'of', paths.length);
const dupInc = Object.entries(incCount).filter(([, c]) => c > 1);
console.log('  shared Include paths  :', dupInc.length, dupInc.length ? '(REAL CONFLICT)' : '(none - no real conflict)');

console.log('');
console.log('=== leaf resource names ===');
const seqLeaf = leafNames.filter(x => !x.decl.includes('xcore'));
const leafCount = {};
for (const l of seqLeaf) leafCount[l.decl] = (leafCount[l.decl] || 0) + 1;
console.log('  leaf declarations      :', seqLeaf.length);
console.log('  distinct leaf names    :', Object.keys(leafCount).length);
const dupLeaf = Object.entries(leafCount).filter(([, c]) => c > 1);
console.log('  duplicated leaf names  :', dupLeaf.length, dupLeaf.length ? '(REAL CONFLICT)' : '(none)');

console.log('');
console.log('=== the ONLY shared name, by design ===');
const core = leafNames.filter(x => x.decl.includes('xcore'));
console.log('  xcore appears in', core.length, 'archives  <- intentional, the loader');
console.log('  de-duplicates it so exactly ONE engine runs.');

console.log('');
console.log('=== verdict ===');
if (dupInc.length === 0 && dupLeaf.length === 0) {
  console.log('  The manager warns because every mod uses the path');
  console.log('  "Option 1 -> Suboption 1" -- that path is just its indexing scheme.');
  console.log('  The CONTENT differs: no shared folder, no shared leaf name.');
  console.log('  => FALSE POSITIVE. Safe to ignore.');
} else {
  console.log('  REAL conflicts found -- must fix.');
}
