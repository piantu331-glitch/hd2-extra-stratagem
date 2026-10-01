'use strict';
/**
 * SHORTEN THE NAMES.
 *
 * The mod manager shows Option/SubOption names in a narrow dropdown, so long
 * names get truncated and the user cannot tell them apart.
 *
 * Design for short, distinguishable names:
 *   HOST group   : "<short>"            e.g. "Eagle Airstrike"
 *   GRANT choice : "<short>"            e.g. "EXO-45"
 *
 * Rules:
 *   - drop the manufacturer prefix where it does not disambiguate
 *     ("A/G-16 Gatling Sentry" -> "Gatling Sentry")
 *   - keep the number when it IS the identifier and the family has several
 *     ("EXO-45" / "EXO-49" / "EXO-51" / "EXO-84")
 *   - keep "Orbital"/"Eagle" because the family matters
 *   - shorten vehicles: "M-103 Supply FRV" -> "Supply FRV"
 *   - Reinforce stays one word
 *
 * Every short name must be UNIQUE so the dropdown is unambiguous.
 */
const fs = require('fs');

const SHORT = {
  // user's 12
  4:   'Orbital Gatling',
  106: 'Orbital Napalm',
  58:  'Orbital Railcannon',
  18:  'Eagle Airstrike',
  30:  'Eagle Strafing',
  65:  'Eagle Cluster',
  3:   'Eagle 500kg',
  101: 'Supply Pack',
  121: 'MG Sentry',
  66:  'Gatling Sentry',
  53:  'Rocket Sentry',
  46:  'Gas Mines',
  // Suzuka's 12
  26:  'Supply FRV',
  105: 'Recon FRV',
  27:  'EXO-45',
  10:  'EXO-49',
  91:  'EXO-51',
  88:  'EXO-84',
  1:   'Tank',
  147: 'EAT-17',
  107: 'Orbital Laser',
  74:  'Orbital Smoke',
  // extras
  124: 'Reinforce',
  137: 'Autocannon Sentry',
  23:  'Laser Sentry',
};

const LIST = JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','docs/stratagem-list.json'), 'utf8'));
const extra = { kind: 23, name: 'A/LAS-98 Laser Sentry' };
const all = [...LIST.filter(x => x.kind !== 23), extra];

console.log('=== short names ===');
const seen = new Map();
let bad = 0;
for (const x of all) {
  const s = SHORT[x.kind];
  if (!s) { console.log(`  MISSING short name for kind ${x.kind} (${x.name})`); bad++; continue; }
  if (seen.has(s)) { console.log(`  DUPLICATE short name "${s}" for kinds ${seen.get(s)} and ${x.kind}`); bad++; }
  seen.set(s, x.kind);
  console.log(`  ${String(x.kind).padStart(3)}  ${s.padEnd(20)} <- ${x.name}`);
}
console.log('');
console.log('total:', all.length, ' unique short names:', seen.size, ' problems:', bad);
console.log('  longest short name:', Math.max(...all.map(x => SHORT[x.kind].length)), 'chars');

fs.writeFileSync(require('path').join(__dirname,'..','docs/short_names.json'),
  JSON.stringify(all.map(x => ({ kind: x.kind, short: SHORT[x.kind], full: x.name })), null, 2));
console.log('');
console.log('written ref/short_names.json');
