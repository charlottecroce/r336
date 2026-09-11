'use strict';

// léacsóir.js — tokenizer.
//
// `ó` is read as an identifier first and checked against the keyword table
// after, since it's also valid inside longer identifiers (óstach).
// `tar éis` is lexed as one frozen token, matching how a reader of Irish
// treats the idiom.

const { earraid } = require('./diagnostics');
const mf = require('./morphology');

const EOCHAIRFHOCAIL = new Set([
  'feidhm',      // function — produces a nominal
  'gníomh',      // imperative — performs, produces nothing
  'saor',        // autonomous — performed by nobody nameable (§8)
  'struchtúr',   // struct
  'suim',        // sum type
  'seasmhach',   // immutable binding
  'ó',           // possession / origin
  'as',          // provenance
  'comhaontú',   // treaty between two counties
  'ag',          // progressive aspect
  'tar éis',     // perfect aspect
  'is',          // copula, independent form
  'bí',          // substantive verb, citation form
  'tá',          //   independent form
  'bhfuil',      //   dependent form
  'má',          // if — realis, independent
  'mura',        // if not — irrealis, dependent
  // Copula fused with the particle (§5.5): `más` = má+is, `murab` = mura+is
  // before a vowel. Normalised back to the bare particle by the parser.
  'más',
  'murab',
  'sealadach',   // mutable binding
  // Lenited forms of the state/gender adjectives, normalised the same way.
  'sheasmhach',
  'shealadach',
  'firinscneach',
  'fhirinscneach',
  'baininscneach',
  'bhaininscneach',
  'cuir',        // mutation command
  // §7.6 — real keyword, not contextual, because it takes a type where an
  // expression would begin. Costs `faigh` as a possible verb name.
  'faigh',
  // §5.2 — containment preposition, demands urú. Two surfaces, `i`/`in`,
  // conditioned on the following word; normalised like `bhfuil`/`más`.
  'i',
  'in',
  'ar',          // lenites; also the adverse-state preposition
  'fíor',        // true
  'bréagach',    // false
  'neamhní',     // absence
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

/** Which words are verbs, known before parsing since R336 is VSO. */
const GNIOMHARTHA_IONSUITE = new Set(['scríobh', 'déan']);

/** Pre-scan for `ó "…"` import specifiers, without a full parse. */
function bunuis(toks) {
  const amach = [];
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i].cinéal === 'KW' && toks[i].luach === 'ó' && toks[i + 1].cinéal === 'STR') {
      amach.push({ foinse: toks[i + 1].luach, ionad: toks[i + 1].ionad });
    }
  }
  return amach;
}

/**
 * Two lexicons, gathered before parsing.
 * `gniomhartha`: imperatives (VSO statements take bare arguments).
 * `briathra`: every declared verb, needed for `a <verb>` nominalisation.
 */
function lexeain(toks, iasachta = null) {
  const gniomhartha = new Set(GNIOMHARTHA_IONSUITE);
  const briathra = new Set(GNIOMHARTHA_IONSUITE);
  // Imported imperatives join unqualified, same as a borrowed Irish verb.
  if (iasachta) {
    for (const g of iasachta.gniomhartha || []) { gniomhartha.add(g); briathra.add(g); }
    for (const b of iasachta.briathra || []) briathra.add(b);
  }
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i];
    if (t.cinéal !== 'KW' || toks[i + 1].cinéal !== 'IDENT') continue;
    if (t.luach === 'gníomh') { gniomhartha.add(toks[i + 1].luach); briathra.add(toks[i + 1].luach); }
    else if (t.luach === 'feidhm') briathra.add(toks[i + 1].luach);
    else if (t.luach === 'saor') {
      // Both the root and derived autonomous form enter the lexicon: the
      // root so a mistaken command still parses (then refused as E518).
      const lemma = toks[i + 1].luach;
      briathra.add(lemma);
      gniomhartha.add(lemma);
      try {
        const saor = mf.foirmShaor(lemma);
        gniomhartha.add(saor); briathra.add(saor);
        // Past form added too, so it can be refused by name (§8).
        const caite = mf.foirmShaorChaite(lemma);
        if (caite) { gniomhartha.add(caite); briathra.add(caite); }
      } catch { /* unformable; the analyzer reports it */ }
    }
  }
  return { gniomhartha, briathra };
}

module.exports = { leacs, lexeain, bunuis, EOCHAIRFHOCAIL, GNIOMHARTHA_IONSUITE };