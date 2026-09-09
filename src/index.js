'use strict';

const fs = require('fs');
const path = require('path');
const { leacs, lexeain } = require('./lexer');
const { parsail } = require('./parser');
const { anailisigh } = require('./analyzer');
const { gin } = require('./codegen');
const { Tionscadal, lexeanIompórtálacha } = require('./modúil');
const mf = require('./morphology');
const { Earraid, Cnuasach } = require('./diagnostics');

/**
 * .sb → JS, for one string of source.
 *
 * `comhthéacs.modúil` is a Map from the written origin to that module's
 * signature. Left out, it is empty, and every import is an `Iasacht` exactly
 * as it was before the module graph existed — which is what the test harness
 * and `--amharc` want, and why 0.4's behaviour is still reachable in one call.
 */
function tiomsaigh(foinse, comhad = '<foinse>', comhthéacs = {}) {
  const toks = leacs(foinse, comhad);
  const modúil = comhthéacs.modúil || new Map();
  const ast = parsail(toks, lexeain(toks, lexeanIompórtálacha(modúil)));
  const { anailiseoir } = anailisigh(ast, { modúil });
  return { js: gin(ast), ast, anailiseoir };
}

/**
 * Compile one file, and everything it stands on, to sibling .js files.
 * Dependencies are compiled first: with a module graph, order is no longer
 * whatever `readdirSync` happened to return.
 */
function tiomsaighComhad(conair, tionscadal = null) {
  return (tionscadal || new Tionscadal()).scriobh(conair);
}

/** Compile every .sb under a directory, skipping node_modules. */
function comhaidSb(fillteán) {
  const amach = [];
  for (const iontráil of fs.readdirSync(fillteán, { withFileTypes: true })) {
    if (iontráil.name === 'node_modules' || iontráil.name.startsWith('.')) continue;
    const p = path.join(fillteán, iontráil.name);
    if (iontráil.isDirectory()) amach.push(...comhaidSb(p));
    else if (iontráil.name.endsWith('.sb')) amach.push(p);
  }
  return amach;
}

/** Every grammatical form of every top-level binding, for `sbc --paraidím`. */
function paraidimi(anailiseoir) {
  const amach = [];
  for (const c of anailiseoir.domhanda.clar.values()) {
    amach.push({
      lemma: c.lemma,
      kind: c.kind,
      sealadach: c.sealadach,
      foinse: c.foinse || null,
      cineál: require('./analyzer').ainmCineail(c.cineal),
      bun: c.paraidim[mf.FOIRM.BUN],
      séimhithe: c.paraidim[mf.FOIRM.SEIMHITHE],
      inséimhithe: c.paraidim.inSeimhithe,
      cúis: c.paraidim.cuis,
      urúFéideartha: c.paraidim.uruFéideartha,
    });
  }
  return amach;
}

/**
 * Provenance of the module and of every type it knows, plus the treaties in
 * force, for `sbc --graf`.
 *
 * Read off the analyzer rather than the emitted code, because there is nothing
 * about provenance in the emitted code — no `__contae` and no county name. The
 * front end is the only place this exists (§24.5).
 */
function duchasanna(anailiseoir) {
  const ctae = require('./contaetha');
  const cinealacha = [];
  for (const [ainm, t] of anailiseoir.cinealacha) {
    // A variant is not a placed type and must not be listed as one: it holds
    // no county of its own, and printing it would claim a slot that the sum
    // already holds under a different name (§26.2).
    if (t.k !== 'struchtúr' && t.k !== 'suim') continue;
    cinealacha.push({ ainm, contae: t.contae || ctae.DEORAIOCHT });
  }
  // No `iomaíocht` flag. A treaty between rivals cannot exist — E608 refuses
  // it before the table is ever written to — so the field could never be true
  // and was reporting on a state the compiler makes unreachable.
  const comhaontuithe = [...anailiseoir.comhaontuithe]
    .map((k) => k.split('\u0000'))
    .map(([a, b]) => ({ a, b }));
  return { contae: anailiseoir.contae, deoraíocht: ctae.DEORAIOCHT, cinealacha, comhaontuithe };
}

module.exports = {
  tiomsaigh, tiomsaighComhad, comhaidSb, paraidimi, duchasanna, Tionscadal,
  Earraid, Cnuasach, morphology: mf,
};
