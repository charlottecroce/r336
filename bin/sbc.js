#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  tiomsaigh, tiomsaighComhad, comhaidSb, paraidimi, Earraid, Cnuasach,
} = require('../src/index');

const args = process.argv.slice(2);
const bratacha = new Set(args.filter((a) => a.startsWith('--')));
const spriocanna = args.filter((a) => !a.startsWith('--'));

if (!spriocanna.length) {
  console.error(`sbc - tiomsaitheoir Spicebag

  sbc <comhad.sb>              tiomsaigh agus scríobh <comhad>.js
  sbc <fillteán>               tiomsaigh gach .sb faoin bhfillteán
  sbc <comhad.sb> --rith       tiomsaigh agus rith
  sbc <comhad.sb> --amharc     taispeáin an JavaScript gan é a scríobh
  sbc <comhad.sb> --paraidím   taispeáin foirmeacha gramadaí na gceangal
  sbc <comhad.sb> --crann      taispeáin an crann teibí (AST)`);
  process.exit(1);
}

const comhaid = spriocanna.flatMap((s) =>
  (fs.existsSync(s) && fs.statSync(s).isDirectory() ? comhaidSb(s) : [s]));

async function príomh() {
  for (const c of comhaid) {
    if (bratacha.has('--crann') || bratacha.has('--amharc')
      || bratacha.has('--paraidím') || bratacha.has('--paraidim')) {
      const { js, ast, anailiseoir } = tiomsaigh(fs.readFileSync(c, 'utf8'), path.basename(c));
      if (bratacha.has('--crann')) {
        console.log(JSON.stringify(ast, (k, v) =>
          (['ceangal', 'scoip', 'cineálSocraithe', 'modhSpicebag'].includes(k) ? undefined : v), 2));
      } else if (bratacha.has('--amharc')) {
        console.log(js);
      } else {
        console.log(`foirmeacha gramadaí — ${c}`);
        for (const p of paraidimi(anailiseoir)) {
          const s = p.inséimhithe ? p.séimhithe : `${p.bun}  (ní féidir: ${p.cúis})`;
          const u = p.urúFéideartha ? `  [urú: ${p.urúFéideartha} — gan bhrí, §12]` : '';
          console.log(`  ${p.lemma.padEnd(14)} ${(p.sealadach ? 'sealadach' : p.kind).padEnd(9)} ${String(p.cineál).padEnd(15)} bun=${p.bun.padEnd(13)} séimhithe=${s}${u}`);
        }
      }
      continue;
    }
    const { amach } = tiomsaighComhad(c);
    if (!bratacha.has('--rith')) { console.error(`scríofa: ${amach}`); continue; }
    const mod = require(path.resolve(amach));
    // Convention, not syntax: a module's top level is imperative but not
    // ongoing, so anything needing `tar éis` lives in an entry point named
    // `príomh` ("chief"), which the runner completes.
    if (typeof mod.príomh === 'function') await mod.príomh();
  }
}

príomh().catch((e) => {
  if (e instanceof Cnuasach) { for (const x of e.earraidi) console.error(x.message); process.exit(1); }
  if (e instanceof Earraid) { console.error(e.message); process.exit(1); }
  throw e;
});
