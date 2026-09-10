#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  comhaidSb, paraidimi, paraidimChopail, duchasanna, Tionscadal, Earraid, Cnuasach,
} = require('../src/index');
const ctae = require('../src/contaetha');

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
  sbc <comhad.sb> --graf       taispeáin na modúil, na cúigí, agus dúchas gach cineáil`);
  process.exit(1);
}

const comhaid = spriocanna.flatMap((s) =>
  (fs.existsSync(s) && fs.statSync(s).isDirectory() ? comhaidSb(s) : [s]));

// One project across every target, so a shared dependency is compiled once and
// so compilation order follows the graph rather than whatever readdirSync
// happened to return.
const tionscadal = new Tionscadal();

/*
 * §25 — the province block.
 *
 * Four slots is the whole of the 0.7 game, so this is the first thing the
 * flag prints and the per-type list is demoted to whatever is left over in
 * exile. What a reader wants to know, in order: which provinces are gone,
 * who took them, what is still free, and what this file cannot reach.
 *
 * The refusal annotation is the useful new thing. A rivalry is absolute —
 * no treaty lifts it (E608) and the province does not help (E609) — so a
 * placed type that this file can never open is worth saying out loud before
 * the author writes the access and finds out.
 *
 * Read off the analyzer, like everything else here. There is no `__contae`
 * and no county name in the emitted JavaScript, and there is no province
 * either (§24.5).
 */
function cloCuigi(d) {
  const gafa = new Map();
  for (const t of d.cinealacha) {
    if (t.contae === d.deoraíocht) continue;
    gafa.set(ctae.cuigeDe(t.contae), t);
  }
  console.log('\n  cúigí');
  for (const cuige of ctae.CUIGI_UILE) {
    const t = gafa.get(cuige);
    if (!t) { console.log(`    ${cuige.padEnd(14)} (saor)`); continue; }
    const cosc = ctae.isIomaiocht(t.contae, d.contae)
      ? `   ✗ seanaighneas le ${d.contae}, §25.4`
      : '';
    console.log(`    ${cuige.padEnd(14)} ${t.ainm.padEnd(18)} as ${t.contae}${cosc}`);
  }
  const saor = ctae.CUIGI_UILE.filter((c) => !gafa.has(c)).length;
  console.log(`    ${String(4 - saor)}/4 tógtha`);
}

/*
 * §31 — the copula block.
 *
 * The second paradigm in the language, and the first thing `--paraidím` has
 * had to print that is not initial mutation. Laid out the same way as the
 * eclipsed forms above it: the cells a syntactic position can demand are
 * shown plainly, and the cells that exist in Irish and have no slot here are
 * annotated *gan bhrí, §31* exactly as an eclipsed form is annotated *gan
 * bhrí, §12*. Showing them is the point — the reader can see what the
 * language is declining, which is the only way a deliberate absence is
 * distinguishable from an oversight.
 *
 * Two columns, because both allomorph rules are regressive: `mura` becomes
 * `murab` and `ní` prefixes h-, and each is triggered by the type that comes
 * after the copula rather than by anything before it.
 */
function cloChopail(c) {
  const stampa = (k) => (c.ionadaithe[k] ? '  (samhail)' : '');
  console.log('\n  an chopail — §31');
  console.log(`    ${''.padEnd(22)}${(c.eiseamlair.consan + stampa('consan')).padEnd(26)}${c.eiseamlair.guta + stampa('guta')}`);
  for (let i = 0; i < c.consan.length; i++) {
    const a = c.consan[i];
    const b = c.guta[i];
    const nota = a.beo ? '' : '   ← gan bhrí, §31';
    console.log(`    ${a.rialu.padEnd(22)}${a.frasa.padEnd(26)}${b.frasa}${nota}`);
  }
}

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
        // §24, §25 — provenance. Exile is annotated the way an eclipsed form
        // is annotated in --paraidím: the thing is real, and it demands
        // nothing.
        const d = duchasanna(anailiseoir);
        const áitiúil = d.contae === d.deoraíocht
          ? `${d.contae}  (gan áit, §24)`
          : `${d.contae} (${ctae.cuigeDe(d.contae)})`;
        console.log(`\ndúchas — as ${áitiúil}`);

        cloCuigi(d);

        const deoraithe = d.cinealacha.filter((t) => t.contae === d.deoraíocht);
        if (deoraithe.length) {
          console.log('\n  ar deoraíocht  (gan áit, §24 — gan uimhir uirthi)');
          for (const t of deoraithe) console.log(`    ${t.ainm}`);
        }

        console.log('\n  comhaontuithe');
        for (const t of d.comhaontuithe) {
          console.log(`    ${t.a} ↔ ${t.b}`);
        }
        if (!d.comhaontuithe.length) {
          console.log(d.contae === d.deoraíocht
            ? '    (ceann ar bith — ní páirtí í an deoraíocht, §24.3)'
            : '    (ceann ar bith)');
        }

        // Who this file could never agree with, whether or not it tried.
        const naimhde = d.contae === d.deoraíocht ? [] : ctae.iomaitheoiri(d.contae);
        if (naimhde.length) {
          console.log(`\n  seanaighneas — ní dhéanann ${d.contae} comhaontú le ${naimhde.join(', ')}  (E608)`);
        }
      } else {
        console.log(`foirmeacha gramadaí — ${c}`);
        for (const p of paraidimi(anailiseoir)) {
          const s = p.inséimhithe ? p.séimhithe : `${p.bun}  (ní féidir: ${p.cúis})`;
          const u = p.urúFéideartha ? `  [urú: ${p.urúFéideartha} — gan bhrí, §12]` : '';
          const ó = p.foinse ? `  ← ${p.foinse}` : '';
          // The autonomous verb's own paradigm, on the same line as the
          // mutation forms because it is a form of the same word (§37).
          const sa = p.saor
            ? `  [saor: ${p.saor}${p.saorCaite ? `; caite: ${p.saorCaite} — gan aimsir, §37` : ''}]`
            : '';
          console.log(`  ${p.lemma.padEnd(14)} ${(p.sealadach ? 'sealadach' : p.kind).padEnd(9)} ${String(p.cineál).padEnd(24)} bun=${p.bun.padEnd(13)} séimhithe=${s}${u}${sa}${ó}`);
        }
        cloChopail(paraidimChopail(anailiseoir));
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
