'use strict';

/*
 * modúil.js — the module graph.
 *
 * This is a compiler problem rather than a language one: `ó "./sonraí.sb"` was
 * already the right syntax (§6), and nothing here adds a keyword. What it adds
 * is that the thing on the far side of the preposition is now *known*.
 *
 * Order is forced by the grammar, not chosen for convenience. `lexeain` exists
 * because a reader of Irish parses VSO by already knowing which words are
 * verbs; a reader working from another text's vocabulary must have read that
 * text first. So a module's dependencies are compiled — or at least reduced to
 * a signature — before it is parsed, and the import list is read off the token
 * stream by `bunuis`, which needs no parse.
 *
 * The filesystem is injected. `tiomsaigh(foinse)` with no project is still the
 * whole pipeline for one string of source, which is what the test harness and
 * `--amharc` use, and in that mode every import is an `Iasacht` exactly as
 * before. Nothing about the module graph reaches into the language.
 */

const fs = require('fs');
const path = require('path');
const { leacs, lexeain, bunuis } = require('./lexer');
const { parsail } = require('./parser');
const { anailisigh } = require('./analyzer');
const { gin } = require('./codegen');
const { earraid, Cnuasach } = require('./diagnostics');

/** Only a `.sb` path is a Spicebag module. Everything else is borrowed. */
const isSpicebag = (foinse) => foinse.endsWith('.sb');

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

      // Resolve the origins before parsing: the lexicon has to exist first.
      const modúil = new Map();
      const fillteán = path.dirname(abs);
      for (const b of bunuis(toks)) {
        if (!isSpicebag(b.foinse) || modúil.has(b.foinse)) continue;
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

  /** Compile a module and write every `.sb` it depends on to a sibling `.js`. */
  scriobh(conair) {
    const t = this.tiomsaigh(conair);
    for (const [abs, m] of this.taisce) {
      fs.writeFileSync(abs.replace(/\.sb$/, '.js'), m.js);
    }
    return { ...t, amach: path.resolve(conair).replace(/\.sb$/, '.js') };
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

module.exports = { Tionscadal, lexeanIompórtálacha, isSpicebag, reitigh };
