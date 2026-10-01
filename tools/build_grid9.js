'use strict';
/**
 * Build the 25 SEPARATE mods from grid9.
 *
 * Each mod = one zip with:
 *   manifest.json                     (ONE Option, 24 SubOptions)
 *   Choices/hNNNgNNN/patch_0          (the selected leaf + the shared engine)
 *
 * Every leaf archive declares TWO names:
 *   mods/dsh/xcore        <- the engine, IDENTICAL in all 600 archives
 *   mods/dsh/x9NNN/hNNNgNNN <- this leaf
 *
 * Because the engine name is identical everywhere, the loader loads it ONCE.
 * The leaves are pure data (one table assignment each).
 */
const fs = require('fs');
const path = require('path');
const B = require(require('path').join(__dirname, 'build_addon.js'));

const ROOT = require('path').join(__dirname, '..');
const mods = JSON.parse(fs.readFileSync(ROOT + '/build/grid9.json', 'utf8'));

const OUT = ROOT + '/delivery/ExtraSlot/25个独立下拉';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const ARCHIVE_NAME = '9ba626afa44a3aa3.patch_0';
let idx = 0;
const report = [];

for (const m of mods) {
  idx++;
  const guid = `${String(idx).padStart(8, '0')}-9abc-4def-8123-456789abcdef`;
  const files = {};
  const subs = [];
  // the engine body is identical in every archive; build its envelope once
  const coreEnvelope = B.envelope(B.entrySource(m.options[0].SubOptions[0].CoreName,
    Buffer.from(m.options[0].SubOptions[0].CoreBody, 'utf8')));

  for (const s of m.options[0].SubOptions) {
    const dir = s.Include[0];
    const leafSource = B.entrySource(s.Name4, fs.readFileSync(s.Entry));
    const resources = {
      [s.Name4]: B.envelope(leafSource),
      [s.CoreName]: coreEnvelope,   // computed ONCE, reused
    };
    const ar = B.makeArchive(resources);
    files[dir + '/' + ARCHIVE_NAME] = ar;
    files[dir + '/' + ARCHIVE_NAME + '.stream'] = Buffer.alloc(0);
    files[dir + '/' + ARCHIVE_NAME + '.gpu_resources'] = Buffer.alloc(0);
    subs.push({ Name: s.Name, Description: s.Description, Include: [dir] });
  }

  const manifest = {
    Version: 1,
    Guid: guid,
    Name: m.displayName,
    Description: `Choose one extra stratagem for ${m.displayName.replace('Extra ', '')}.`,
    Options: [{
      Name: m.options[0].Name,
      Description: m.options[0].Description,
      SubOptions: subs,
    }],
  };
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const out = path.join(OUT, `${String(idx).padStart(2, '0')} ${m.displayName}.zip`);
  fs.writeFileSync(out, B.zipWrite(files));
  report.push({ file: path.basename(out), res: m.resName, choices: subs.length, bytes: fs.statSync(out).size });
}

console.log('built', report.length, 'separate mods');
console.log('');
for (const r of report) {
  console.log(`  ${r.file.padEnd(34)} ${String(r.choices).padStart(2)} choices  ${(r.bytes/1024).toFixed(0)} KB`);
}
fs.writeFileSync(ROOT + '/build/grid9-report.json', JSON.stringify(report, null, 2));
