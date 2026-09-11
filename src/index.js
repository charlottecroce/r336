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
 * .r336 → JS, for one string of source.
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

/** Compile every .r336 under a directory, skipping node_modules. */
function comhaidR336(fillteán) {
  const amach = [];
  for (const iontráil of fs.readdirSync(fillteán, { withFileTypes: true })) {
    if (iontráil.name === 'node_modules' || iontráil.name.startsWith('.')) continue;
    const p = path.join(fillteán, iontráil.name);
    if (iontráil.isDirectory()) amach.push(...comhaidR336(p));
    else if (iontráil.name.endsWith('.r336')) amach.push(p);
  }
  return amach;
}

/** Every grammatical form of every top-level binding, for `r336c --paraidím`. */
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
      // §8 — present for autonomous verbs only. The past is carried too, and
      // is printed labelled, because R336 has no tense and a form that is
      // refused is worth showing next to the one that is demanded.
      saor: (c.cineal && c.cineal.saor) || null,
      saorCaite: (c.cineal && c.cineal.saorCaite) || null,
      // §5.10 — the first thing this output has ever carried that varies per
      // identifier rather than per construction. `réamhshocraithe` is not
      // decoration: a binding always declares its gender by the form of its
      // own adjective, so a null here means a parameter or a receiver, which
      // has no adjective slot and is therefore masculine by default rather
      // than by statement (Part 11 D).
      inscne: c.inscne || mf.INSCNE.FIR,
      inscneRéamhshocraithe: !c.inscne,
    });
  }
  return amach;
}

/**
 * The copula's paradigm, for `r336c --paraidím` (§5.5).
 *
 * Shown against two real type names from the file rather than a placeholder,
 * because both of the copula's allomorph rules are conditioned on the first
 * letter of the type that follows it and neither is visible against a single
 * exemplar. If the file has no vowel-initial type — or no consonant-initial
 * one — the missing column falls back to a stand-in, and says so.
 */
function paraidimChopail(anailiseoir) {
  const ainmneacha = [...anailiseoir.cinealacha]
    .filter(([, t]) => t.k === 'struchtúr' || t.k === 'suim' || t.k === 'malairt')
    .map(([ainm]) => ainm);
  const consan = ainmneacha.find((a) => !mf.isGuta(a[0]));
  const guta = ainmneacha.find((a) => mf.isGuta(a[0]));
  const eiseamlair = { consan: consan || 'Duine', guta: guta || 'Áit' };
  return {
    eiseamlair,
    ionadaithe: { consan: !consan, guta: !guta },
    consan: mf.paraidimChopail(eiseamlair.consan),
    guta: mf.paraidimChopail(eiseamlair.guta),
  };
}

/**
 * Provenance of the module and of every type it knows, plus the treaties in
 * force, for `r336c --graf`.
 *
 * Read off the analyzer rather than the emitted code, because there is nothing
 * about provenance in the emitted code — no `__contae` and no county name. The
 * front end is the only place this exists (§7.2).
 */
function duchasanna(anailiseoir) {
  const ctae = require('./contaetha');
  const cinealacha = [];
  for (const [ainm, t] of anailiseoir.cinealacha) {
    // A variant is not a placed type and must not be listed as one: it holds
    // no county of its own, and printing it would claim a slot that the sum
    // already holds under a different name (§6).
    if (t.k !== 'struchtúr' && t.k !== 'suim') continue;
    cinealacha.push({ ainm, contae: t.contae || ctae.DEORAIOCHT });
  }
  // No `iomaíocht` flag. A treaty between rivals cannot exist — E608 refuses
  // it before the table is ever written to — so the field could never be true
  // and was reporting on a state the compiler makes unreachable.
  const comhaontuithe = [...anailiseoir.comhaontuithe]
    .map((k) => k.split('\u0000'))
    .map(([a, b]) => ({ a, b }));
  // §7.6 — the tables, reported here rather than in a display of their own,
  // because a table is not a fifth thing a program has. It is a county with a
  // column list attached, and the interesting number is how many of the four
  // provinces are now spent on one. `uasmhéid` is carried so the reader can
  // see the budget beside the spend without knowing the rule.
  const tablai = anailiseoir.tabli.gach()
    .map((t) => ({ cineál: t.cineal, tábla: t.tabla, contae: t.contae, réimsí: t.reimsi }));
  return {
    contae: anailiseoir.contae, deoraíocht: ctae.DEORAIOCHT, cinealacha, comhaontuithe,
    tablai, uasmhéid: require('./táblaí').UASMHEID,
  };
}

module.exports = {
  tiomsaigh, tiomsaighComhad, comhaidR336, paraidimi, paraidimChopail, duchasanna, Tionscadal,
  Earraid, Cnuasach, morphology: mf, táblaí: require('./táblaí'),
};
