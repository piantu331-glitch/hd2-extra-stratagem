'use strict';
/**
 * Produce the Chinese reference table: kind -> short name -> US -> CN.
 * The CN strings come from the game's own zh localization, so they match what
 * the user sees in game.
 */
const fs = require('fs');
const B = require('path').join(__dirname,'..','docs')+'/';
const cn = JSON.parse(fs.readFileSync(B + 'names_cn.json', 'utf8'));
const us = JSON.parse(fs.readFileSync(B + 'names_us.json', 'utf8'));
const short = JSON.parse(fs.readFileSync(B + 'short_names.json', 'utf8'));

// internal name for each kind, established from the asset/icon evidence
const INTERNAL = {
  1:   'dropoff_bastion_tank',        // from icon_strat_hud_vehicle_bastion_tank
  3:   'eagle_bomb',
  4:   'orbital_gatling_barrage',
  10:  'dropoff_combatwalker_autocannon',
  18:  'eagle_airstrike',
  23:  'turret_laser_cannon',
  26:  'dropoff_frv_supply',
  27:  'dropoff_combatwalker',
  30:  'eagle_base',
  46:  'emplacement_mine_deployer_gas',
  53:  'turret_rocket',
  58:  'orbital_railcannon',
  65:  'eagle_clusterbombs',
  66:  'turret_machinegun',
  74:  'orbital_smoke',
  88:  'dropoff_combatwalker_breacher',
  91:  'dropoff_combatwalker_lumberer',
  101: 'backpack_ammo',
  105: 'dropoff_frv',
  106: 'orbital_napalm_barrage',
  107: 'orbital_laser',
  121: 'turret_machinegun_gpmg',
  124: 'reinforcement',
  137: 'turret_autocannon',
  147: 'eat17',                       // EAT-17; localization key differs
};

const NAMES_CN = {
  1:   'TD-220 “堡垒”坦克',
  26:  'M-103 补给型快速侦察载具',
  105: 'M-102 快速侦察载具',
  88:  'EXO-84 “破门者”外骨骼装甲',
  91:  'EXO-51 “伐木者”外骨骼装甲',
  147: 'EAT-17 一次性反坦克武器',
};

console.log('| kind | 简称 | 英文全名 | 中文名 |');
console.log('|---|---|---|---|');
for (const s of short) {
  const k = s.kind;
  const internal = INTERNAL[k];
  let c = internal ? cn[internal] : null;
  if (!c) c = NAMES_CN[k] || '(待补)';
  const u = internal ? us[internal] : null;
  console.log(`| ${k} | ${s.short} | ${u || s.full} | ${c} |`);
}
console.log('');

// write a JSON too
const table = short.map(s => {
  const internal = INTERNAL[s.kind];
  return {
    kind: s.kind,
    short: s.short,
    fullEn: (internal && us[internal]) || s.full,
    cn: (internal && cn[internal]) || NAMES_CN[s.kind] || null,
    asset: s.full,
  };
});
fs.writeFileSync(B + 'name_table.json', JSON.stringify(table, null, 2));
const missing = table.filter(t => !t.cn);
console.log('entries:', table.length, ' with Chinese:', table.filter(t => t.cn).length);
if (missing.length) console.log('missing Chinese:', missing.map(m => m.kind + ' ' + m.short).join(', '));
