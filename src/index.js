'use strict';

const fs = require('fs');
const path = require('path');
const { leacs, lexeain } = require('./lexer');
const { parsail } = require('./parser');
const { anailisigh } = require('./analyzer');
const { gin } = require('./codegen');
const mf = require('./morphology');
const { Earraid, Cnuasach } = require('./diagnostics');

/**
 * .sb → JS.
 * Returns { js, ast, anailiseoir }. Throws Earraid or Cnuasach on failure.
 */
function tiomsaigh(foinse, comhad = '<foinse>') {
  const toks = leacs(foinse, comhad);
  const ast = parsail(toks, lexeain(toks));
  const { anailiseoir } = anailisigh(ast);
  return { js: gin(ast), ast, anailiseoir };
}

/** Compile one file to a sibling .js. */
function tiomsaighComhad(conair) {
  const foinse = fs.readFileSync(conair, 'utf8');
  const t = tiomsaigh(foinse, path.basename(conair));
  const amach = conair.replace(/\.sb$/, '.js');
  fs.writeFileSync(amach, t.js);
  return { ...t, amach };
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

module.exports = {
  tiomsaigh, tiomsaighComhad, comhaidSb, paraidimi,
  Earraid, Cnuasach, morphology: mf,
};
