#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  comhaidSb, paraidimi, duchasanna, Tionscadal, Earraid, Cnuasach,
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
  sbc <comhad.sb> --crann      taispeáin an crann teibí (AST)
  sbc <comhad.sb> --graf       taispeáin na modúil, agus dúchas gach cineáil`);
  process.exit(1);
}

const comhaid = spriocanna.flatMap((s) =>
  (fs.existsSync(s) && fs.statSync(s).isDirectory() ? comhaidSb(s) : [s]));

// One project across every target, so a shared dependency is compiled once and
// so compilation order follows the graph rather than whatever readdirSync
// happened to return.
const tionscadal = new Tionscadal();

async function príomh() {
  for (const c of comhaid) {
    if (bratacha.has('--crann') || bratacha.has('--amharc')
      || bratacha.has('--paraidím') || bratacha.has('--paraidim') || bratacha.has('--graf')) {
      // Read through the project, so imported signatures are in scope and
      // --paraidím shows an imported verb's real mood rather than Iasacht.
      const { js, ast, anailiseoir } = tionscadal.tiomsaigh(c);
      if (bratacha.has('--crann')) {
        console.log(JSON.stringify(ast, (k, v) =>
          (['ceangal', 'scoip', 'cineálSocraithe', 'modhSpicebag', 'ailiasanna', 'siniu'].includes(k)
            ? undefined : v), 2));
      } else if (bratacha.has('--amharc')) {
        console.log(js);
      } else if (bratacha.has('--graf')) {
        console.log(`modúil — ${c}`);
        for (const [foinse, ailias] of ast.ailiasanna || []) {
          console.log(`  ${ailias.padEnd(6)} ${foinse}`);
        }
        for (const p of paraidimi(anailiseoir).filter((x) => x.foinse)) {
          console.log(`    ${p.lemma.padEnd(14)} ${p.kind.padEnd(9)} ${p.cineál}   ← ${p.foinse}`);
        }
        // §24 — provenance. Exile is annotated the way an eclipsed form is
        // annotated in --paraidím: the thing is real, and it demands nothing.
        const d = duchasanna(anailiseoir);
        const ganAit = (x) => (x === d.deoraíocht ? '  (gan áit, §24)' : '');
        console.log(`\ndúchas — as ${d.contae}${ganAit(d.contae)}`);
        for (const t of d.cinealacha) {
          console.log(`  ${t.ainm.padEnd(18)} as ${t.contae}${ganAit(t.contae)}`);
        }
        for (const c of d.comhaontuithe) {
          console.log(`  comhaontú          ${c.a} ↔ ${c.b}${c.iomaíocht ? '  (seanaighneas)' : ''}`);
        }
        if (!d.comhaontuithe.length && d.contae !== d.deoraíocht) {
          console.log('  comhaontú          (ceann ar bith)');
        }
      } else {
        console.log(`foirmeacha gramadaí — ${c}`);
        for (const p of paraidimi(anailiseoir)) {
          const s = p.inséimhithe ? p.séimhithe : `${p.bun}  (ní féidir: ${p.cúis})`;
          const u = p.urúFéideartha ? `  [urú: ${p.urúFéideartha} — gan bhrí, §12]` : '';
          const ó = p.foinse ? `  ← ${p.foinse}` : '';
          console.log(`  ${p.lemma.padEnd(14)} ${(p.sealadach ? 'sealadach' : p.kind).padEnd(9)} ${String(p.cineál).padEnd(24)} bun=${p.bun.padEnd(13)} séimhithe=${s}${u}${ó}`);
        }
      }
      continue;
    }
    const { amach } = tionscadal.scriobh(c);
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
