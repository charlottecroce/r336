'use strict';

// modúil.js — the module graph.
//
// `ó "./sonraí.r336"` was already the right syntax; this file adds that the
// far side is now known. A module's dependencies (or at least their
// signatures) compile before it's parsed, since R336's VSO parsing needs the
// imported verb lexicon up front. Import specifiers are read off tokens by
// `bunuis`, no parse required.
//
// The filesystem is injected. With no project, `tiomsaigh(foinse)` is the
// whole pipeline for one string of source and every import is `Iasacht`,
// same as before the module graph existed.

const fs = require('fs');
const path = require('path');
const { leacs, lexeain, bunuis } = require('./lexer');
const { parsail } = require('./parser');
const { anailisigh } = require('./analyzer');
const { gin } = require('./codegen');
const { earraid, Cnuasach } = require('./diagnostics');

/** Only a `.r336` path is a R336 module. Everything else is borrowed. */
const isR336 = (foinse) => foinse.endsWith('.r336');

/** A relative specifier is relative to the importing file, as in Node. */
function reitigh(foinse, ofillteán) {
  return foinse.startsWith('.')
    ? path.resolve(ofillteán, foinse)
    : path.resolve(foinse);
}

class Tionscadal {
  /**
   * `comhadlann` is the file interface: `{ léigh(conair), ann(conair) }`.
   * Defaults to the real filesystem; tests hand it a Map.
   */
  constructor(comhadlann = null) {
    this.comhadlann = comhadlann || {
      ann: (c) => fs.existsSync(c),
      léigh: (c) => fs.readFileSync(c, 'utf8'),
    };
    this.taisce = new Map();     // absolute path → { siniu, js, ast, anailiseoir }
    this.cruach = [];            // absolute paths currently being compiled
  }

  /**
   * Compile one module and everything it stands on. Returns
   * `{ js, ast, anailiseoir, siniu }`.
   */
  tiomsaigh(conair) {
    const abs = path.resolve(conair);
    const taiscthe = this.taisce.get(abs);
    if (taiscthe) return taiscthe;

    if (this.cruach.includes(abs)) {
      const timthriall = [...this.cruach.slice(this.cruach.indexOf(abs)), abs]
        .map((c) => path.basename(c));
      throw new Cnuasach([earraid('E110', { comhad: path.basename(abs), line: 1, col: 1 }, timthriall)]);
    }
    if (!this.comhadlann.ann(abs)) {
      throw new Cnuasach([earraid('E109', { comhad: path.basename(abs), line: 1, col: 1 }, conair)]);
    }

    this.cruach.push(abs);
    try {
      const foinse = this.comhadlann.léigh(abs);
      const comhad = path.basename(abs);
      const toks = leacs(foinse, comhad);

      // Resolve origins before parsing: the lexicon must exist first.
      const modúil = new Map();
      const fillteán = path.dirname(abs);
      for (const b of bunuis(toks)) {
        if (!isR336(b.foinse) || modúil.has(b.foinse)) continue;
        const spleách = reitigh(b.foinse, fillteán);
        const { siniu } = this.tiomsaigh(spleách);
        modúil.set(b.foinse, { ...siniu, ionad: b.ionad });
      }

      const ast = parsail(toks, lexeain(toks, lexeanIompórtálacha(modúil)));
      const { anailiseoir } = anailisigh(ast, { modúil });
      const toradh = {
        js: gin(ast), ast, anailiseoir, siniu: anailiseoir.siniu(), conair: abs,
      };
      this.taisce.set(abs, toradh);
      return toradh;
    } finally {
      this.cruach.pop();
    }
  }

  /** Compile a module and write every `.r336` it depends on to a sibling `.js`. */
  scriobh(conair) {
    const t = this.tiomsaigh(conair);
    for (const [abs, m] of this.taisce) {
      fs.writeFileSync(abs.replace(/\.r336$/, '.js'), m.js);
    }
    return { ...t, amach: path.resolve(conair).replace(/\.r336$/, '.js') };
  }
}

/** The union of every imported module's verb lexicon. */
function lexeanIompórtálacha(modúil) {
  const gniomhartha = new Set();
  const briathra = new Set();
  for (const siniu of modúil.values()) {
    for (const g of siniu.gniomhartha) gniomhartha.add(g);
    for (const b of siniu.briathra) briathra.add(b);
  }
  return { gniomhartha, briathra };
}

module.exports = { Tionscadal, lexeanIompórtálacha, isR336, reitigh };