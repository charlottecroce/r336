'use strict';

/*
 * léacsóir.js — tokenizer.
 *
 * Two things worth noticing.
 *
 * `ó` is both a keyword and a perfectly good identifier character, so
 * identifiers are read maximally and *then* checked against the keyword
 * table. `ó` alone is the preposition; `óstach` is a name.
 *
 * `tar éis` is a fixed idiom, not two words. Irish marks completed aspect
 * with a prepositional phrase (`tá sé tar éis scríobh` — "he is after
 * writing"), and the phrase is lexically frozen. The lexer emits it as one
 * token, which is what a reader of Irish does too.
 */

const { earraid } = require('./diagnostics');

const EOCHAIRFHOCAIL = new Set([
  'feidhm',      // function — produces a nominal
  'gníomh',      // imperative — performs, produces nothing
  'struchtúr',   // struct
  'seasmhach',   // immutable binding
  'ó',           // possession / origin
  'ag',          // progressive aspect: an ongoing action
  'tar éis',     // perfect aspect: a completed action
  'is',          // copula — identity / classification
  'bí',          // substantive verb, citation form (imperative)
  'tá',          //   … independent form
  'bhfuil',      //   … dependent form, eclipsed by its particle
  'má',          // if — realis particle, selects the independent form
  'mura',        // if…not — selects the dependent form, and eclipses it
  'sealadach',   // mutable binding: what a thing happens to be right now
  'cuir',        // "put" — the imperative that changes a state
  'ar',          // "on" — the surface an action lands on; lenites
  'fíor',        // true
  'bréagach',    // false
  'neamhní',     // absence — the thing `bí` reports as not being there
]);

/** Compound keywords, matched as `[first, rest…]` after an identifier read. */
const COMHFHOCAIL = [['tar', ['éis']]];

const OIBREOIRI = ['->', '==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '<', '>', '='];
const NOID = ['{', '}', '(', ')', '[', ']', ',', ':'];

const isLitirTus = (ch) => /\p{L}|_/u.test(ch);
const isLitirLeanunach = (ch) => /\p{L}|\p{N}|_/u.test(ch);
const isDigit = (ch) => ch >= '0' && ch <= '9';

function leacs(src, comhad = '<foinse>') {
  const toks = [];
  let i = 0, line = 1, col = 1;

  const ionad = () => ({ comhad, line, col });
  const chun = (n) => {
    for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; } else col++; i++; }
  };

  /** After reading `tar`, look ahead for ` éis` and swallow it. */
  function comhfhocal(ceann) {
    for (const [tus, iarmhir] of COMHFHOCAIL) {
      if (ceann !== tus) continue;
      let j = i;
      const focail = [];
      for (const f of iarmhir) {
        while (j < src.length && /\s/.test(src[j])) j++;
        if (!src.startsWith(f, j)) return null;
        const iarDeireadh = src[j + f.length];
        if (iarDeireadh !== undefined && isLitirLeanunach(iarDeireadh)) return null;
        j += f.length;
        focail.push(f);
      }
      chun(j - i);
      return [tus, ...focail].join(' ');
    }
    return null;
  }

  while (i < src.length) {
    const ch = src[i];

    if (ch === '\n' || ch === ' ' || ch === '\t' || ch === '\r') { chun(1); continue; }

    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') chun(1); continue; }
    if (ch === '/' && src[i + 1] === '*') {
      chun(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) chun(1);
      chun(2);
      continue;
    }

    if (isLitirTus(ch)) {
      const tus = ionad();
      let s = '';
      while (i < src.length && isLitirLeanunach(src[i])) { s += src[i]; chun(1); }
      const comh = comhfhocal(s);
      if (comh) { toks.push({ cinéal: 'KW', luach: comh, ionad: tus }); continue; }
      toks.push({ cinéal: EOCHAIRFHOCAIL.has(s) ? 'KW' : 'IDENT', luach: s, ionad: tus });
      continue;
    }

    if (isDigit(ch)) {
      const tus = ionad();
      let s = '';
      while (i < src.length && (isDigit(src[i]) || (src[i] === '.' && isDigit(src[i + 1])))) { s += src[i]; chun(1); }
      toks.push({ cinéal: 'NUM', luach: parseFloat(s), ionad: tus });
      continue;
    }

    if (ch === '"') {
      const tus = ionad();
      chun(1);
      let s = '';
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') {
          const nxt = src[i + 1];
          s += ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[nxt] ?? nxt;
          chun(2);
        } else { s += src[i]; chun(1); }
      }
      if (i >= src.length) throw earraid('E403', tus);
      chun(1);
      toks.push({ cinéal: 'STR', luach: s, ionad: tus });
      continue;
    }

    const op = OIBREOIRI.find((o) => src.startsWith(o, i));
    if (op) { const tus = ionad(); chun(op.length); toks.push({ cinéal: 'OP', luach: op, ionad: tus }); continue; }

    if (NOID.includes(ch)) { const tus = ionad(); chun(1); toks.push({ cinéal: 'NOD', luach: ch, ionad: tus }); continue; }

    throw earraid('E402', ionad(), JSON.stringify(ch));
  }

  toks.push({ cinéal: 'EOF', luach: null, ionad: ionad() });
  return toks;
}

/**
 * Mood is a lexical property of the verb. A reader of Irish parses VSO order
 * because they already know which words are verbs; the parser is handed the
 * same lexicon by a pre-scan for `gníomh AINM` before it starts.
 */
const GNIOMHARTHA_IONSUITE = new Set(['scríobh']);

/**
 * Two lexicons, both gathered before parsing.
 *
 * `gniomhartha` are the imperatives, needed because a statement beginning
 * with one is VSO and takes bare arguments.
 *
 * `briathra` is every declared verb of either mood, needed because `a` is
 * the particle that turns a verb into a noun (`a fhógair`) and is otherwise
 * an ordinary identifier. Deciding by lexicon rather than by keyword means
 * `seasmhach a = 3` still works.
 */
function lexeain(toks) {
  const gniomhartha = new Set(GNIOMHARTHA_IONSUITE);
  const briathra = new Set(GNIOMHARTHA_IONSUITE);
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i];
    if (t.cinéal !== 'KW' || toks[i + 1].cinéal !== 'IDENT') continue;
    if (t.luach === 'gníomh') { gniomhartha.add(toks[i + 1].luach); briathra.add(toks[i + 1].luach); }
    else if (t.luach === 'feidhm') briathra.add(toks[i + 1].luach);
  }
  return { gniomhartha, briathra };
}

module.exports = { leacs, lexeain, EOCHAIRFHOCAIL, GNIOMHARTHA_IONSUITE };
