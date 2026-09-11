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
 * .r336 -> JS for one string of source. `comhthéacs.modúil` maps import
 * specifiers to signatures; left out, every import is `Iasacht`.
 */
function tiomsaigh(foinse, comhad = '<foinse>', comhthéacs = {}) {
  const toks = leacs(foinse, comhad);
  const modúil = comhthéacs.modúil || new Map();
  const ast = parsail(toks, lexeain(toks, lexeanIompórtálacha(modúil)));
  const { anailiseoir } = anailisigh(ast, { modúil });
  return { js: gin(ast), ast, anailiseoir };
}

/** Compile one file and everything it stands on, to sibling .js files. */
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
      saor: (c.cineal && c.cineal.saor) || null,
      saorCaite: (c.cineal && c.cineal.saorCaite) || null,
      // A binding always states its own gender via its adjective's form, so
      // null here means a parameter or receiver — masculine by default,
      // not by statement.
      inscne: c.inscne || mf.INSCNE.FIR,
      inscneRéamhshocraithe: !c.inscne,
    });
  }
  return amach;
}

/**
 * The copula's paradigm, for `--paraidím`. Shown against two real type names
 * from the file (consonant- and vowel-initial), since both allomorph rules
 * are conditioned on the type name that follows.
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
 * Provenance of the module and every type it knows, plus treaties, for
 * `--graf`. Read off the analyzer, since none of this shows up in emitted code.
 */
function duchasanna(anailiseoir) {
  const ctae = require('./contaetha');
  const cinealacha = [];
  for (const [ainm, t] of anailiseoir.cinealacha) {
    // Variants hold no county of their own — skip them, or we'd double-count
    // a province slot the sum already holds.
    if (t.k !== 'struchtúr' && t.k !== 'suim') continue;
    cinealacha.push({ ainm, contae: t.contae || ctae.DEORAIOCHT });
  }
  const comhaontuithe = [...anailiseoir.comhaontuithe]
    .map((k) => k.split('\u0000'))
    .map(([a, b]) => ({ a, b }));
  // §7.6 — tables reported here rather than separately: a table is a
  // province county with a column list attached.
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