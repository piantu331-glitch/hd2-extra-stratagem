'use strict';
/**
 * ★ IS THERE ANY WAY TO GET 25 INDEPENDENT SELECTIONS? ★
 *
 * Established: with 25 Options x 24 SubOptions, the manager applies column 0 to
 * 24 of the 25 groups. It only persisted ONE real selection.
 *
 * So the question is not "how do I format the manifest" -- I have tried naming,
 * unique names, unique resource names, shared engines. The manager simply does
 * not store 25 per-Option selections.
 *
 * WHAT ELSE COULD CARRY 25 VALUES?
 *
 * The manager persists ONE choice per Option... what if there are 25 SEPARATE
 * MODS, each with ONE Option? That gives 25 independent selections, because each
 * mod is independent.
 *
 * I half-built this earlier ("20 independent mods") but the zip-of-zips failed
 * to import, and then I moved on. The per-mod manifests were then fixed to the
 * Option->SubOptions->Include shape. That fix was never actually retested.
 *
 * So this is the untested path that directly answers "25 independent choices":
 *
 *     25 mods, each with ONE Option and 24 SubOptions.
 *     Import all 25. Each shows its own dropdown.
 *     Select freely in each -- they are separate mods, so nothing collides.
 *
 * ★ THE RISK ★
 * Only ONE SubOption per mod is applied, so 25 mods each apply one leaf = 25
 * leaves. That is exactly the configuration that previously broke the loadout
 * (25 engines). BUT the shared-engine design fixes that: if all 25 leaves ship
 * the SAME engine under the SAME resource name, the loader de-duplicates it to
 * ONE engine, and the leaves are pure data.
 *
 * So:
 *   - 25 separate mods        -> 25 independent dropdowns (the user's request)
 *   - each mod ships xcore    -> only ONE engine actually runs
 *   - each leaf sets one pick -> 25 picks collected in a global
 *   - one engine applies all  -> proven to work (STACK 5, sentries)
 *
 * ★ WHAT WAS ACTUALLY WRONG BEFORE ★
 * In the single-manifest grid, all 25 groups lived in ONE manifest and the
 * manager collapsed the selections. With 25 SEPARATE manifests there is nothing
 * to collapse.
 *
 * THIS IS THE MOST PROMISING UNTRIED APPROACH. Let me build it properly and
 * verify the engine de-duplication story holds.
 */
const fs = require('fs');
const path = require('path');

const ROOT = require('path').join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(ROOT + '/ref/final24.json', 'utf8'));
const SHORT = new Map(JSON.parse(fs.readFileSync(ROOT + '/ref/short_names.json', 'utf8')).map(x => [x.kind, x.short]));

const EXTRA_HOST = { kind: 23, name: 'A/LAS-98 Laser Sentry' };
const HOSTS = [...LIST];
if (!HOSTS.some(h => h.kind === EXTRA_HOST.kind)) HOSTS.push(EXTRA_HOST);
const GRANTS = [...LIST, EXTRA_HOST].filter((g, i, a) => a.findIndex(x => x.kind === g.kind) === i);

const ENGINE = fs.readFileSync(ROOT + '/src/extra_engine.lua', 'utf8')
  .replace(/^-- HD2-Addon: [^\n]*\n/, '');

const OUT = ROOT + '/build/grid9';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function leaf(host, grant) {
  return `-- ${SHORT.get(host.kind)} -> ${SHORT.get(grant.kind)}\n` +
         `local p = rawget(_G,'DSH_EXTRA_PICKS')\n` +
         `if type(p) ~= 'table' then p = {} rawset(_G,'DSH_EXTRA_PICKS',p) end\n` +
         `p[${host.kind}] = ${grant.kind}\n`;
}

const mods = [];
let leaves = 0;
for (const host of HOSTS) {
  const subs = [];
  for (const grant of GRANTS) {
    if (host.kind === grant.kind) continue;
    const id = `h${String(host.kind).padStart(3, '0')}g${String(grant.kind).padStart(3, '0')}`;
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    const f = path.join(OUT, id, 'entry.lua');
    fs.writeFileSync(f, leaf(host, grant));
    leaves++;
    subs.push({
      Name: `${SHORT.get(host.kind)} -> ${SHORT.get(grant.kind)}`,
      Description: `${SHORT.get(host.kind)} delivers one extra ${SHORT.get(grant.kind)}.`,
      Include: [`Choices/${id}`],
      Entry: f,
      Name4: `mods/dsh/x9${String(host.kind).padStart(3, '0')}/${id}`,
      CoreName: 'mods/dsh/xcore',
      CoreBody: ENGINE,
    });
  }
  mods.push({
    host: host.kind,
    resName: `mods/dsh/x9${String(host.kind).padStart(3, '0')}`,
    displayName: `Extra ${SHORT.get(host.kind)}`,
    options: [{
      Name: `What ${SHORT.get(host.kind)} brings`,
      Description: 'Choose one extra stratagem this host delivers.',
      SubOptions: subs,
    }],
  });
}

fs.writeFileSync(ROOT + '/build/grid9.json', JSON.stringify(mods, null, 2));

console.log('mods   :', mods.length, '(each its OWN manifest -> its own dropdown)');
console.log('leaves :', leaves);
console.log('every mod ships the SAME engine name:', mods[0].options[0].SubOptions[0].CoreName);
console.log('');
console.log('=== the first mod as an example ===');
const m = mods[0];
console.log('  resource :', m.resName);
console.log('  display  :', m.displayName);
console.log('  option   :', m.options[0].Name, '->', m.options[0].SubOptions.length, 'choices');
console.log('  choices  :', m.options[0].SubOptions.slice(0, 3).map(s => s.Name).join(' | '), '...');
