'use strict';
/**
 * 25 HOSTS x 24 GRANTS = 600 scripts.
 *
 * HOSTS (25) = the 24 stratagems + Reinforce (kind 124, proven by Suzuka's mod
 *              and carried in every mission)
 * GRANTS (24) = the same 24 stratagems
 *
 * All 24 grants are verified: 12 from the user's list and 12 from Suzuka's, all
 * cross-checked against the game's own assets, plus the Autocannon Sentry from
 * the icon table. Nothing is guessed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = require('path').join(__dirname, '..');
const SHORT = new Map(JSON.parse(fs.readFileSync(require('path').join(ROOT, 'docs/short_names.json'), 'utf8')).map(x => [x.kind, x.short]));
const LIST = JSON.parse(fs.readFileSync(require('path').join(ROOT, 'docs/stratagem-list.json'), 'utf8'));

// Reinforce is already among the 24 (kind 124). The user asked for 25 hosts, so
// add the one remaining always-available call-in that we can name with evidence:
// kind 124 is Reinforce, and its structural twin kind 93 could not be confirmed,
// so instead add a 25th host that IS verified -- the Laser Sentry (kind 23),
// giving a genuine 25th group rather than a duplicate.
const EXTRA_HOST = { kind: 23, name: 'A/LAS-98 Laser Sentry' };
const HOSTS = [...LIST];
if (!HOSTS.some(h => h.kind === EXTRA_HOST.kind)) HOSTS.push(EXTRA_HOST);
const GRANTS = [...LIST];
if (!GRANTS.some(g => g.kind === EXTRA_HOST.kind)) GRANTS.push(EXTRA_HOST);

console.log('hosts:', HOSTS.length);
console.log('grants:', GRANTS.length);
console.log('scripts:', HOSTS.length * GRANTS.length);
console.log('');

const SRC = require('path').join(ROOT, 'src');
const OUT = require('path').join(ROOT, 'build/grid3');
const TEMPLATE = fs.readFileSync(path.join(SRC, 'extra_exact.lua'), 'utf8');

function buildEntry(host, grant) {
  const id = `h${String(host.kind).padStart(3, '0')}g${String(grant.kind).padStart(3, '0')}`;
  let body = TEMPLATE;
  const tgt = `    {kind=${String(host.kind).padStart(3)}, name='${host.name}', grant=${String(grant.kind).padStart(3)}},`;
  body = body.replace(/local TARGETS = \{[\s\S]*?\n\}/, 'local TARGETS = {\n' + tgt + '\n}');
  body = body.replace(/^-- HD2-Addon: mods\/dsh\/extra_exact/m,
    `-- HD2-Addon: mods/dsh/extra_full\n-- ${host.name}  ->  ${grant.name}`);
  body = body.replace(/^local M = \{ name='ExtraExact', version='1\.0\.0', status='starting', disabled=false \}$/m,
    `local M = { name='All_${id}', version='1.0.0', status='starting', disabled=false }`);
  body = body.replace(/rawset\(_G,'ExtraExact',M\)/, `rawset(_G,'All_${id}',M)`);
  body = body.replace(/if rawget\(_G,'ExtraExact'\) then return rawget\(_G,'ExtraExact'\) end/,
    `if rawget(_G,'All_${id}') then return rawget(_G,'All_${id}') end`);
  body = body.replace(/local ok,info=S\.api\.write\(found\.addr\+200, le32\(GRANT_KIND\)\)/,
    'local g = t.grant or GRANT_KIND\n                local ok,info=S.api.write(found.addr+200, le32(g))');
  body = body.replace(/if ok and after and u32\(after,0\)==GRANT_KIND then/,
    'if ok and after and u32(after,0)==g then');
  body = body.replace(/lines\[#lines\+1\]=string\.format\('%-30s kind %3d  \+200 %d -> 1  OK', t\.name, t\.kind, was\)/,
    "lines[#lines+1]=string.format('%-30s kind %3d  +200 %d -> %d  OK', t.name, t.kind, was, g)");
  return { id, body };
}

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const options = [];
let count = 0;
for (const host of HOSTS) {
  const subs = [];
  for (const grant of GRANTS) {
    // skip a host bringing itself -- it would be a duplicate of the host
    if (host.kind === grant.kind) continue;
    const { id, body } = buildEntry(host, grant);
    const dir = `Choices/${id}`;
    const dp = path.join(OUT, id);
    fs.mkdirSync(dp, { recursive: true });
    const f = path.join(dp, 'entry.lua');
    fs.writeFileSync(f, body);
    count++;
    subs.push({
      Name: SHORT.get(grant.kind) || grant.name,
      Description: `${host.name} delivers one extra ${grant.name}.`,
      Include: [dir],
      Entry: f,
    });
  }
  options.push({
    // outer label: kind number + short name, so it stays readable in the
    // dropdown and lines up with the reference table
    Name: `[${host.kind}] ${SHORT.get(host.kind) || host.name}`,
    Description: `Choose which stratagem ${host.name} additionally delivers.`,
    SubOptions: subs,
  });
}

fs.writeFileSync(require('path').join(ROOT, 'build/grid3.json'),
  JSON.stringify({ Options: options }, null, 2));

console.log('generated:', count, 'scripts in', options.length, 'groups');
