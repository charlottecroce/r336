'use strict';

// moirfeolaíocht.js — Irish initial mutation as a compiler subsystem.
//
// Knows nothing about programming: only Irish orthography — which words can
// take a séimhiú, what a word's lenited form is, how to recover a lemma from
// a mutated surface form. The semantic layer asks it questions and never the
// reverse: mutation is a property of the word, government a property of the
// syntax, agreement is what joins them.

const GUTAI = 'aeiouáéíóú';

// The nine consonants that take a written séimhiú.
const INSEIMHITHE = 'bcdfgmpst';

// Eclipsis replaces the initial sound; m, l, n, r, s, h have no eclipsed
// form, and a vowel takes a prefixed n instead.
const URU = { b: 'm', c: 'g', d: 'n', f: 'bh', g: 'n', p: 'b', t: 'd' };

/** Grammatical forms an identifier may take. */
const FOIRM = Object.freeze({
  BUN: 'bun',            // base / citation form
  SEIMHITHE: 'séimhithe', // lenited
  URAITHE: 'uraithe',    // eclipsed — demanded by `i` since 0.13
});

const isGuta = (ch) => !!ch && GUTAI.includes(ch.toLowerCase());

/**
 * Does this word already carry a written séimhiú? Genuinely ambiguous in
 * Irish (`thall` isn't a lenited `tall`), so callers also check the symbol
 * table before accepting a delenition.
 */
function cosuilLeSeimhiu(word) {
  if (!word || word.length < 2) return false;
  return INSEIMHITHE.includes(word[0].toLowerCase()) && word[1].toLowerCase() === 'h';
}

/**
 * Can this word bear a séimhiú at all? Returns { ok } or
 * { ok: false, cuis } where `cuis` is a tag the diagnostics turn into prose.
 */
function inSeimhithe(word) {
  if (!word) return { ok: false, cuis: 'folamh' };
  const c0 = word[0].toLowerCase();
  const c1 = (word[1] || '').toLowerCase();

  if (cosuilLeSeimhiu(word)) return { ok: false, cuis: 'seimhithe-cheana' };
  if (isGuta(c0)) return { ok: false, cuis: 'guta' };
  if ('lnrh'.includes(c0)) return { ok: false, cuis: 'lnrh' };
  if (!INSEIMHITHE.includes(c0)) return { ok: false, cuis: 'neamhlitir' };

  // `s` lenites before a vowel or l/n/r; resists it in sc-/sf-/sm-/sp-/st-.
  if (c0 === 's' && !(c1 !== '' && (isGuta(c1) || 'lnr'.includes(c1)))) {
    return { ok: false, cuis: 'cnuasach-s' };
  }
  return { ok: true };
}

/** Insert the h. Case is preserved on the radical: Duine -> Dhuine. */
function seimhigh(word) {
  return word[0] + 'h' + word.slice(1);
}

/** Strip a written séimhiú. Caller must check `cosuilLeSeimhiu` first. */
function diseimhigh(word) {
  return word[0] + word.slice(2);
}

/**
 * The surface realisation of `lemma` in grammatical form `foirm`.
 *
 * The SEIMHITHE fallback is the load-bearing rule of the language: a
 * leniting position demands lenition of anything that can be lenited and
 * nothing of anything that can't. A vowel-initial word after `ó` isn't an
 * exception — it's the rule applied to a word with an empty mutation slot.
 */
function foirmDe(lemma, foirm) {
  switch (foirm) {
    case FOIRM.BUN:
      return lemma;
    case FOIRM.SEIMHITHE:
      return inSeimhithe(lemma).ok ? seimhigh(lemma) : lemma;
    case FOIRM.URAITHE:
      // §5.2, 0.13 — same SEIMHITHE-arm fallback logic, different mutation,
      // demanded by `i`. `uraigh` still prefixes n- to a vowel, but nothing
      // demands that form: before a vowel `i` takes the `in` allomorph and
      // the noun is left alone (see `mirI`).
      return inUraithe(lemma).ok ? uraigh(lemma) : lemma;
    default:
      throw new Error(`foirm anaithnid: ${foirm}`);
  }
}

/** Does this word already carry a written urú? */
function cosuilLeUru(word) {
  if (!word || word.length < 2) return false;
  const dhá = word.slice(0, 2).toLowerCase();
  if (word[0].toLowerCase() === 'n' && (word[1] === '-' || isGuta(word[1]))) return true;
  if (dhá === 'bh' && word.length > 2 && word[2].toLowerCase() === 'f') return true;
  return ['mb', 'gc', 'nd', 'ng', 'bp', 'dt'].includes(dhá);
}

/** Can this word bear an urú? */
function inUraithe(word) {
  if (!word) return { ok: false, cuis: 'folamh' };
  if (cosuilLeUru(word)) return { ok: false, cuis: 'uraithe-cheana' };
  const c0 = word[0].toLowerCase();
  if (isGuta(c0)) return { ok: true };
  if (URU[c0]) return { ok: true };
  return { ok: false, cuis: 'gan-uru' };
}

/**
 * Eclipse. Prefix always lowercase, radical untouched: baile -> mbaile,
 * Baile -> mBaile, fuil -> bhfuil, áit -> n-áit, Éire -> nÉire.
 */
function uraigh(word) {
  const c0 = word[0];
  if (isGuta(c0)) return (/\p{Lu}/u.test(c0) ? 'n' : 'n-') + word;
  return URU[c0.toLowerCase()] + word;
}

/**
 * Every lemma that `word` could be the eclipsed form of. A set, not a value,
 * since the mapping isn't one-to-one (`n` before a vowel could undo to
 * nothing, `ng-` could be eclipsed `g-` or just start `ng-`). Used only to
 * recognise an eclipsed identifier well enough to refuse it (E108); the
 * symbol table decides which candidate is real.
 */
function lemmaiFaoiUru(word) {
  const amach = [];
  const iseal = word.toLowerCase();
  if (iseal.startsWith('n-')) amach.push(word.slice(2));
  if (iseal[0] === 'n' && isGuta(iseal[1])) amach.push(word.slice(1));
  if (iseal.startsWith('bhf')) amach.push(word.slice(2));
  for (const [urú, radacach] of [['mb', 'b'], ['gc', 'c'], ['nd', 'd'],
    ['ng', 'g'], ['bp', 'p'], ['dt', 't']]) {
    if (iseal.startsWith(urú)) amach.push(radacach + word.slice(2));
  }
  return amach;
}

/** The full paradigm of a lemma, for `--paraidím` and symbol dumps. */
function paraidim(lemma) {
  const can = inSeimhithe(lemma);
  const ur = inUraithe(lemma);
  return {
    lemma,
    [FOIRM.BUN]: lemma,
    [FOIRM.SEIMHITHE]: can.ok ? seimhigh(lemma) : lemma,
    inSeimhithe: can.ok,
    cuis: can.cuis || null,
    // Shown even for vowel-initial words where it's never demanded (`i`
    // takes the `in` allomorph there instead).
    uruFéideartha: ur.ok ? uraigh(lemma) : null,
  };
}

/**
 * `bí`. Irish verbs have an independent form (heading their own assertion)
 * and a dependent form (under a governing particle — question, negation,
 * subordinator). `bí`'s dependent form is `fuil`, which never appears bare:
 * the particles selecting it also eclipse it, giving `bhfuil`.
 *
 *   má tá duine        assertion under a realis particle → independent
 *   mura bhfuil duine  negated condition                 → dependent
 *   bí                 imperative / citation form
 *
 * Morphology, not semantics: `bí` means the same thing in every form.
 */
const RIALU_BRIATHAIR = Object.freeze({
  NEAMHSPLEACH: 'neamhspleách',  // independent
  SPLEACH: 'spleách',            // dependent, eclipsed by its particle
});

const PARAIDIM_BI = Object.freeze({
  lemma: 'bí',
  ordaitheach: 'bí',
  [RIALU_BRIATHAIR.NEAMHSPLEACH]: 'tá',
  [RIALU_BRIATHAIR.SPLEACH]: uraigh('fuil'),
});

const foirmBhriathartha = (rialu) => PARAIDIM_BI[rialu];

/**
 * The copula `is`. Same shape as `bí` — one word, several forms chosen by
 * environment — but the alternation is *fusion*: the governing particle and
 * copula are written as one word.
 *
 *   is Duine é          independent, ungoverned
 *   má + is  → más      realis particle absorbs it
 *   mura + is → mura    irrealis particle absorbs it
 *            → murab      … -b before a vowel
 *
 * Two allomorph rules, both regressive (conditioned on the word *after* the
 * copula), so the caller must pass it in:
 *
 *   mura → murab  before a vowel
 *   ní   → ní h-  before a vowel
 *
 * Four of the seven cells have no syntactic slot in R336 (no question, bare
 * negation, or subordinate assertion). `foirmChopail` throws for those;
 * `paraidimChopail` still prints them, labelled dead.
 */
const RIALU_COPAIL = Object.freeze({
  BUN: 'bun',                            // is    — independent
  MA: 'má',                              // más   — under realis particle
  MURA: 'mura',                          // mura / murab — under irrealis
  DIULTACH: 'diúltach',                  // ní    — no slot
  CEISTEACH: 'ceisteach',                // an    — no slot
  CEISTEACH_DIULTACH: 'ceisteach diúltach', // nach — no slot
  FAISNEISEACH: 'faisnéiseach',          // gur   — no slot
});

/** The cells a syntactic position can actually demand. */
const COPAIL_BEO = Object.freeze([
  RIALU_COPAIL.BUN, RIALU_COPAIL.MA, RIALU_COPAIL.MURA,
]);

/**
 * The surface form of the copula under `rialu`, before `focal` (the
 * predicate/type name). Both allomorph rules are regressive, so passing it
 * isn't a convenience — it's required.
 */
function foirmChopail(rialu, focal = '') {
  switch (rialu) {
    case RIALU_COPAIL.BUN: return 'is';
    case RIALU_COPAIL.MA: return 'más';
    case RIALU_COPAIL.MURA: return isGuta(focal[0]) ? 'murab' : 'mura';
    case RIALU_COPAIL.DIULTACH:
    case RIALU_COPAIL.CEISTEACH:
    case RIALU_COPAIL.CEISTEACH_DIULTACH:
    case RIALU_COPAIL.FAISNEISEACH:
      // Real Irish, computed below for display, but no slot demands it.
      throw new Error(`copail: níl brí ríomhchláraithe sannta don fhoirm "${rialu}" (§5.5)`);
    default:
      throw new Error(`rialú copaile anaithnid: ${rialu}`);
  }
}

/**
 * The whole present paradigm before `focal`, for `--paraidím` and tests.
 * `beo` marks the three demandable cells; the rest are shown the way an
 * eclipsed form is shown, so declining-to-use reads as deliberate.
 */
function paraidimChopail(focal = 'Cineál') {
  const guta = isGuta(focal[0]);
  const R = RIALU_COPAIL;
  return [
    { rialu: R.BUN, foirm: 'is', frasa: `is ${focal}`, beo: true },
    { rialu: R.MA, foirm: 'más', frasa: `más ${focal}`, beo: true },
    { rialu: R.MURA, foirm: guta ? 'murab' : 'mura', frasa: `${guta ? 'murab' : 'mura'} ${focal}`, beo: true },
    { rialu: R.DIULTACH, foirm: 'ní', frasa: `ní ${reamhlitirH(focal)}`, beo: false },
    { rialu: R.CEISTEACH, foirm: 'an', frasa: `an ${focal}`, beo: false },
    { rialu: R.CEISTEACH_DIULTACH, foirm: 'nach', frasa: `nach ${focal}`, beo: false },
    { rialu: R.FAISNEISEACH, foirm: 'gur', frasa: `gur ${focal}`, beo: false },
  ];
}

/** Every written form of the copula, for the lexer's keyword table. */
const FOIRMEACHA_COPAIL = Object.freeze(['is', 'más', 'mura', 'murab']);

/**
 * Is this a cell some syntactic position can demand? Guard for
 * `foirmChopail`'s four dead cells, so a caller checks before calling
 * instead of parsing a thrown message.
 */
function cealBeo(rialu) {
  return COPAIL_BEO.includes(rialu);
}

/**
 * The preposition `i`. Eclipses (*i mbaile*), but takes the `in` allomorph
 * before a vowel where the noun is left alone (*in áit*, not *i n-áit*).
 * Regressive, like the copula's allomorph rule — the demanded form depends
 * on the following word, so a lookup keyed only on the preposition can't
 * answer it.
 */
function mirI(ceadFhocal) {
  return isGuta((ceadFhocal || '')[0])
    ? { mir: 'in', foirm: FOIRM.BUN }
    : { mir: 'i', foirm: FOIRM.URAITHE };
}

/** Every written form of `i`, for the lexer's keyword table. */
const MIREANNA_I = Object.freeze(['i', 'in']);

/**
 * The autonomous verb — céim 0.10, §8. The first *productive* paradigm here:
 * `bí` and the copula are closed function-word tables; this conjugates
 * whatever verb the author declares.
 *
 *   scríobh   →  scríobhtar        1st conj, broad
 *   cuir      →  cuirtear          1st conj, slender
 *   caith     →  caitear           -th absorbed by the ending
 *   léigh     →  léitear           -gh likewise
 *   sábháil   →  sábháiltear       polysyllabic loan, still 1st
 *   ceannaigh →  ceannaítear       2nd conj, -aigh dropped
 *   bailigh   →  bailítear         2nd, slender
 *   fógair    →  fógraítear        2nd, syncopating: fógair → fógr-
 *   oscail    →  osclaítear        likewise
 *   inis      →  insítear          likewise
 *
 * Broad (a/o/u) takes -tar/-aítear, slender (e/i) takes -tear/-ítear,
 * decided after syncopation since that's what changes quality.
 */

const LEATHAN = 'aouáóú';
const CAOL = 'eiéí';

/** The handful of irregular verbs (Irish has eleven). */
const SAOR_MIREGULTA = Object.freeze({
  taispeáin: 'taispeántar',
  bí: 'táthar',
  faigh: 'faightear',
  abair: 'deirtear',
  tabhair: 'tugtar',
  tar: 'tagtar',
  téigh: 'téitear',
  feic: 'feictear',
  clois: 'cloistear',
  beir: 'beirtear',
});

/** Vowel groups, in order. `fógair` → ['ó', 'ai']; `scríobh` → ['ío']. */
function gutai(word) {
  return word.toLowerCase().match(/[aeiouáéíóú]+/g) || [];
}

/** Syllable count: one per vowel group. */
const siollai = (word) => gutai(word).length;

/** Is the stem broad? Decided by the last vowel of its last vowel group. */
function isLeathan(stem) {
  const gs = gutai(stem);
  if (!gs.length) return true;
  const g = gs[gs.length - 1];
  return LEATHAN.includes(g[g.length - 1]);
}

/**
 * Second conjugation: polysyllabic -(a)igh verbs, and syncopating stems in
 * -il/-in/-ir/-is. -áil loans stay 1st conjugation and are excluded first,
 * since order matters here.
 */
function isDaraReimniu(lemma) {
  const w = lemma.toLowerCase();
  if (siollai(w) < 2) return false;
  if (/(áil|eáil|óil|úil|áin|úin)$/.test(w)) return false;
  if (/(aigh|igh)$/.test(w)) return true;
  return /[aeiouáéíóú][ilnrs]$/.test(w);
}

/** Syncopation: unstressed final-syllable vowel drops before a vowel-initial ending. */
function coimriu(stem) {
  return stem.replace(/[aeiouáéíóú]+([^aeiouáéíóú]+)$/i, '$1');
}

/** Can this word be conjugated as a verb at all? */
function inShaor(lemma) {
  if (!lemma) return { ok: false, cuis: 'folamh' };
  if (!gutai(lemma).length) return { ok: false, cuis: 'gan-ghuta' };
  return { ok: true };
}

/** The present autonomous of `lemma`. */
function foirmShaor(lemma) {
  const iseal = lemma.toLowerCase();
  if (SAOR_MIREGULTA[iseal]) return SAOR_MIREGULTA[iseal];
  const cead = inShaor(lemma);
  if (!cead.ok) throw new Error(`briathar saor: ${cead.cuis} — "${lemma}"`);

  if (isDaraReimniu(lemma)) {
    let stem = lemma.replace(/(aigh|igh)$/i, '');
    if (stem === lemma) stem = coimriu(lemma);           // the syncopating kind
    return stem + (isLeathan(stem) ? 'aítear' : 'ítear');
  }

  // 1st conjugation. A stem in -th/-gh is absorbed by the ending.
  let stem = lemma;
  if (/th$/i.test(stem)) stem = stem.slice(0, -2);
  else if (/gh$/i.test(stem)) stem = stem.slice(0, -2);
  return stem + (isLeathan(stem) ? 'tar' : 'tear');
}

/** The past autonomous. Recognised so it can be refused (§8, no tense in R336). */
const SAOR_CAITE_MIREGULTA = Object.freeze({
  taispeáin: 'taispeánadh',
  bí: 'bhíothas',
  faigh: 'fuarthas',
  tabhair: 'tugadh',
  abair: 'dúradh',
  déan: 'rinneadh',
  feic: 'chonacthas',
  clois: 'chualathas',
  tar: 'thángthas',
  téigh: 'chuathas',
  beir: 'rugadh',
});

/**
 * The past autonomous — `moladh`, `scríobhadh`, `liostaíodh`, `fuarthas`.
 * Computed only so writing it can be refused with a message naming what it
 * is, rather than "unbound identifier". Returns null where the regular rule
 * doesn't reach (monosyllabic -igh verbs are genuinely irregular here).
 */
function foirmShaorChaite(lemma) {
  const iseal = lemma.toLowerCase();
  if (SAOR_CAITE_MIREGULTA[iseal]) return SAOR_CAITE_MIREGULTA[iseal];
  if (!inShaor(lemma).ok) return null;
  if (/igh$/i.test(lemma) && siollai(lemma) < 2) return null;

  if (isDaraReimniu(lemma)) {
    let stem = lemma.replace(/(aigh|igh)$/i, '');
    if (stem === lemma) stem = coimriu(lemma);
    return stem + (isLeathan(stem) ? 'aíodh' : 'íodh');
  }
  return lemma + (isLeathan(lemma) ? 'adh' : 'eadh');
}

/** The autonomous paradigm of one verb, for `--paraidím`. */
function paraidimShaor(lemma) {
  const caite = foirmShaorChaite(lemma);
  return [
    { aimsir: 'láithreach', foirm: foirmShaor(lemma), beo: true },
    { aimsir: 'caite', foirm: caite, beo: false },
  ];
}

/** Best guess at the lemma behind a surface form; the symbol table has final say. */
function lemmaTuairim(surface) {
  return cosuilLeSeimhiu(surface) ? diseimhigh(surface) : surface;
}

/** `le` prefixes h- to a vowel-initial word (le hUimhir, le Teaghrán). */
function reamhlitirH(word) {
  return isGuta(word[0]) ? 'h' + word : word;
}

// §5.10 — grammatical gender. Doesn't carry meaning, only requires form:
// the adjective after a feminine noun lenites, after masculine it doesn't
// (fear mór / bean mhór, duine seasmhach / aois sheasmhach).
const INSCNE = { FIR: 'fir', BAIN: 'bain' };

/** The Irish name, for messages and `--paraidím`. */
const ainmInscne = (i) => (i === INSCNE.BAIN ? 'baininscneach' : 'firinscneach');

/**
 * The form an attributive adjective takes after a noun of this gender
 * (nominative singular only — R336 has no genitive construction, so the
 * reversed genitive rule has no slot to attach to).
 */
function foirmAidiachta(aidiacht, inscne) {
  if (inscne !== INSCNE.BAIN) return aidiacht;
  return foirmDe(aidiacht, FOIRM.SEIMHITHE);
}

/** Which gender, if any, this written adjective form is agreeing with. */
function inscneOFhoirm(scriofa, bun) {
  if (scriofa === bun) return INSCNE.FIR;
  if (scriofa === foirmAidiachta(bun, INSCNE.BAIN) && scriofa !== bun) return INSCNE.BAIN;
  return null;
}

module.exports = {
  INSCNE,
  ainmInscne,
  foirmAidiachta,
  inscneOFhoirm,
  FOIRM,
  isGuta,
  inSeimhithe,
  inUraithe,
  uraigh,
  cosuilLeUru,
  lemmaiFaoiUru,
  seimhigh,
  diseimhigh,
  cosuilLeSeimhiu,
  foirmDe,
  RIALU_BRIATHAIR,
  PARAIDIM_BI,
  foirmBhriathartha,
  RIALU_COPAIL,
  COPAIL_BEO,
  cealBeo,
  FOIRMEACHA_COPAIL,
  mirI,
  MIREANNA_I,
  foirmChopail,
  paraidimChopail,
  foirmShaor,
  foirmShaorChaite,
  paraidimShaor,
  inShaor,
  isDaraReimniu,
  SAOR_MIREGULTA,
  paraidim,
  lemmaTuairim,
  reamhlitirH,
};