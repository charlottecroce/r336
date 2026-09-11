#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  comhaidR336, paraidimi, paraidimChopail, duchasanna, Tionscadal, Earraid, Cnuasach,
} = require('../src/index');
const ctae = require('../src/contaetha');

const args = process.argv.slice(2);
const bratacha = new Set(args.filter((a) => a.startsWith('--')));
const spriocanna = args.filter((a) => !a.startsWith('--'));

if (!spriocanna.length) {
  console.error(`r336c - tiomsaitheoir R336

  r336c <comhad.r336>              tiomsaigh agus scríobh <comhad>.js
  r336c <fillteán>               tiomsaigh gach .r336 faoin bhfillteán
  r336c <comhad.r336> --rith       tiomsaigh agus rith
  r336c <comhad.r336> --amharc     taispeáin an JavaScript gan é a scríobh
  r336c <comhad.r336> --paraidím   taispeáin foirmeacha gramadaí na gceangal
  r336c <comhad.r336> --crann      taispeáin an crann teibí (AST)
  r336c <comhad.r336> --graf       taispeáin na modúil, na cúigí, agus dúchas gach cineáil`);
  process.exit(1);
}

const comhaid = spriocanna.flatMap((s) =>
  (fs.existsSync(s) && fs.statSync(s).isDirectory() ? comhaidR336(s) : [s]));

// One project across every target: a shared dependency compiles once, and
// compile order follows the graph rather than readdirSync's whim.
const tionscadal = new Tionscadal();

/** `--graf`'s province block: which provinces are taken, by whom, what's free. */
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

/**
 * `--graf`'s copula block. Shows both live and dead cells (dead ones labelled
 * "gan bhrí" like an eclipsed form) so a deliberate absence reads as
 * deliberate rather than an oversight.
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
      const { js, ast, anailiseoir } = tionscadal.tiomsaigh(c);
      if (bratacha.has('--crann')) {
        console.log(JSON.stringify(ast, (k, v) =>
          (['ceangal', 'scoip', 'cineálSocraithe', 'modhR336', 'ailiasanna', 'siniu'].includes(k)
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

        const naimhde = d.contae === d.deoraíocht ? [] : ctae.iomaitheoiri(d.contae);
        if (naimhde.length) {
          console.log(`\n  seanaighneas — ní dhéanann ${d.contae} comhaontú le ${naimhde.join(', ')}  (E608)`);
        }
      } else if (bratacha.has('--json')) {
        console.log(JSON.stringify({
          comhad: c,
          ceangail: paraidimi(anailiseoir),
          copail: paraidimChopail(anailiseoir),
        }, null, 2));
      } else {
        console.log(`foirmeacha gramadaí — ${c}`);
        for (const p of paraidimi(anailiseoir)) {
          const s = p.inséimhithe ? p.séimhithe : `${p.bun}  (ní féidir: ${p.cúis})`;
          const u = p.urúFéideartha ? `  [urú: ${p.urúFéideartha} — gan bhrí, §12]` : '';
          const ó = p.foinse ? `  ← ${p.foinse}` : '';
          const sa = p.saor
            ? `  [saor: ${p.saor}${p.saorCaite ? `; caite: ${p.saorCaite} — gan aimsir, §37` : ''}]`
            : '';
          const aid = p.sealadach ? 'sealadach' : 'seasmhach';
          const inscne = `${p.inscne === 'bain' ? 'bain' : 'fir'}${p.inscneRéamhshocraithe ? '*' : ' '}`;
          const foirmAid = require('../src/morphology').foirmAidiachta(aid, p.inscne);
          console.log(`  ${p.lemma.padEnd(14)} ${inscne.padEnd(5)}${foirmAid.padEnd(12)} ${String(p.cineál).padEnd(22)} bun=${p.bun.padEnd(13)} séimhithe=${s}${u}${sa}${ó}`);
        }
        console.log('\n  * inscne réamhshocraithe: ní raibh slot aidiachta ann lena rá (§40.4)');
        cloChopail(paraidimChopail(anailiseoir));
      }
      continue;
    }
    const { amach } = tionscadal.scriobh(c);
    if (!bratacha.has('--rith')) { console.error(`scríofa: ${amach}`); continue; }
    const mod = require(path.resolve(amach));
    // Convention: `príomh` is where `tar éis` lives, since module top level
    // is imperative but not ongoing.
    if (typeof mod.príomh === 'function') await mod.príomh();
  }
}

príomh().catch((e) => {
  if (e instanceof Cnuasach) { for (const x of e.earraidi) console.error(x.message); process.exit(1); }
  if (e instanceof Earraid) { console.error(e.message); process.exit(1); }
  throw e;
});