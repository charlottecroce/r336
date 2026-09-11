#!/usr/bin/env node
'use strict';

// tools/imirce-inscne.js — word-order migration for céim 0.11 (§40).
//
//     node tools/imirce-inscne.js <fillteán|comhad> …        (dry run)
//     node tools/imirce-inscne.js --scríobh <fillteán|comhad> …
//
// One mechanical change: `seasmhach duine` → `duine seasmhach` (attributive
// adjective follows its noun in Irish). Never adds lenition, so every noun
// comes out masculine — run `r336c <comhad> --paraidím` after to see the
// gender column and fill it in by hand.
//
// Two things intentionally left untouched:
//   1. Prose — `seasmhach`/`suim` appear as ordinary words too, and half
//      this repo is commentary. Comments and block comments are skipped.
//   2. R336 source embedded in JS strings (mostly in test/*.js), where a
//      missed word boundary (`'…\nseasmhach x = 3'`) bit the first version
//      of this tool.

const fs = require('fs');
const path = require('path');

const AINM = '[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*';
const NEAMHFHOCAL = '[^A-Za-zÀ-ÖØ-öø-ÿ0-9_]';
const RIALL = new RegExp(
  `(\\\\n|${NEAMHFHOCAL}|^)(seasmhach|sealadach)\\s+(${AINM})`, 'g',
);

/** Split a line into its code half and its comment half. */
function ganTrachtas(líne, iBloc) {
  if (iBloc) return ['', líne];
  const i = líne.indexOf('//');
  return i < 0 ? [líne, ''] : [líne.slice(0, i), líne.slice(i)];
}

/** `seasmhach x` → `x seasmhach`, in code only. */
const ordFocail = (cód) => cód.replace(RIALL, (m, roimhe, aid, ainm) => `${roimhe}${ainm} ${aid}`);

function aistrigh(téacs) {
  let iBloc = false;
  return téacs.split('\n').map((líne) => {
    const tosach = iBloc;
    const oscailtí = (líne.match(/\/\*/g) || []).length;
    const dúntaí = (líne.match(/\*\//g) || []).length;
    if (oscailtí > dúntaí) iBloc = true;
    else if (dúntaí > oscailtí) iBloc = false;
    const [cód, tracht] = ganTrachtas(líne, tosach);
    return ordFocail(cód) + tracht;
  }).join('\n');
}

function comhaid(conair, amach = []) {
  if (fs.statSync(conair).isFile()) { amach.push(conair); return amach; }
  for (const i of fs.readdirSync(conair, { withFileTypes: true })) {
    if (i.name === 'node_modules' || i.name.startsWith('.')) continue;
    const p = path.join(conair, i.name);
    if (i.isDirectory()) comhaid(p, amach);
    else if (/\.(sb|js|html|md)$/.test(i.name) && !p.includes('imirce-inscne')) amach.push(p);
  }
  return amach;
}

const argv = process.argv.slice(2);
const scríobh = argv.includes('--scríobh');
const spriocanna = argv.filter((a) => !a.startsWith('--'));
if (!spriocanna.length) {
  console.error('úsáid: node tools/imirce-inscne.js [--scríobh] <fillteán|comhad> …');
  process.exit(1);
}

let athraithe = 0;
for (const sprioc of spriocanna) {
  for (const c of comhaid(sprioc)) {
    const bun = fs.readFileSync(c, 'utf8');
    const nua = aistrigh(bun);
    if (nua === bun) continue;
    athraithe++;
    const b = bun.split('\n'); const n = nua.split('\n');
    console.log(`${scríobh ? 'scríofa' : 'athrófaí'}: ${c}  (${b.filter((l, i) => l !== n[i]).length} líne)`);
    if (scríobh) fs.writeFileSync(c, nua);
  }
}
console.log(`\n${athraithe} comhad.${scríobh ? '' : ' Cuir --scríobh leis chun é a dhéanamh.'}`);