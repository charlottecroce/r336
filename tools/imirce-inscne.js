#!/usr/bin/env node
'use strict';

/*
 * tools/imirce-inscne.js — an t-aistriú focail do chéim 0.11 (§40).
 *
 *     node tools/imirce-inscne.js <fillteán|comhad> …        (turraing thirim)
 *     node tools/imirce-inscne.js --scríobh <fillteán|comhad> …
 *
 * Aon athrú meicniúil amháin:
 *
 *     seasmhach duine = …     →   duine seasmhach = …
 *     sealadach cuntas: T     →   cuntas shealadach: T   (más baininscneach é)
 *
 * Leanann an aidiacht a hainmfhocal sa Ghaeilge, agus is aidiachtaí iad
 * `seasmhach` agus `sealadach` (§40.2). Ní chuireann an uirlis seo séimhiú ar
 * bith: fágann sí gach aidiacht ina bunfhoirm, is é sin le rá go bhfógraíonn
 * sí gach ainm mar fhocal firinscneach. Ní féidir léi a fháil amach gur
 * baininscneach é `aois`, agus ní dhéanfaidh sí buille faoi thuairim air.
 * Rith `r336c <comhad> --paraidím` ina diaidh: tá colún inscne ann anois, agus
 * is é an liosta sin an obair atá fágtha do dhuine.
 *
 * Dhá riail faoin méid nach n-athraítear:
 *
 *   1. Ní bhaintear le prós. Is gnáthfhocail Ghaeilge iad `seasmhach` agus
 *      `suim` chomh maith le heochairfhocail, agus tá leath an stóir seo ina
 *      thráchtaireacht. Fágtar gach rud i ndiaidh `//` agus gach rud istigh i
 *      mbloc `/* … *​/` mar atá.
 *
 *   2. Athscríobhtar foinse R336 atá istigh i dteaghráin JavaScript.
 *      Tá thart ar thrí oiread níos mó fógraí i `test/*.js` ná mar atá sna
 *      comhaid `.r336`, agus is ann a bheadh botún i bhfolach. Tabhair faoi
 *      deara go bhfuil `\n` roimh eochairfhocal ina theorainn fhocail chomh
 *      maith: `'…\nseasmhach x = 3'` — sin an cás a chaill an chéad leagan
 *      den uirlis seo, agus sin an fáth a bhfuil sé luaite anseo.
 */

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
