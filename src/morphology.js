'use strict';

/*
 * moirfeolaíocht.js — Irish initial mutation as a compiler subsystem.
 *
 * This module knows nothing about programming. It knows about Irish
 * orthography: which words can bear a séimhiú, what the lenited form of a
 * word is, and how to recover the lemma from a mutated surface form.
 *
 * The semantic layer asks it questions; it does not ask the semantic layer
 * anything. That separation is the whole point: mutation is a property of
 * the word, government is a property of the syntax, and agreement is the
 * check that joins them.
 */

const GUTAI = 'aeiouáéíóú';

// The nine consonants that take a written séimhiú (b c d f g m p s t).
const INSEIMHITHE = 'bcdfgmpst';

// Eclipsis replaces the initial sound; m, l, n, r, s and h have no eclipsed
// form, and a vowel takes a prefixed n instead.
const URU = { b: 'm', c: 'g', d: 'n', f: 'bh', g: 'n', p: 'b', t: 'd' };

/** Grammatical forms an identifier may take. */
const FOIRM = Object.freeze({
  BUN: 'bun',            // base / citation form
  SEIMHITHE: 'séimhithe', // lenited
  URAITHE: 'uraithe',    // eclipsed — recognised, deliberately unimplemented (§12)
});

const isGuta = (ch) => !!ch && GUTAI.includes(ch.toLowerCase());

/**
 * Does this word already carry a written séimhiú?
 * Genuinely ambiguous in Irish (`thall` is not a lenited `tall`), which is
 * why we also require the lemma to exist in a symbol table before we accept
 * a delenition.
 */
function cosuilLeSeimhiu(word) {
  if (!word || word.length < 2) return false;
  return INSEIMHITHE.includes(word[0].toLowerCase()) && word[1].toLowerCase() === 'h';
}

/**
 * Can this word bear a séimhiú at all?
 * Returns { ok } or { ok: false, cuis } where `cuis` ("reason") is a tag the
 * diagnostic layer turns into Irish prose.
 */
function inSeimhithe(word) {
  if (!word) return { ok: false, cuis: 'folamh' };
  const c0 = word[0].toLowerCase();
  const c1 = (word[1] || '').toLowerCase();

  if (cosuilLeSeimhiu(word)) return { ok: false, cuis: 'seimhithe-cheana' };
  if (isGuta(c0)) return { ok: false, cuis: 'guta' };
  if ('lnrh'.includes(c0)) return { ok: false, cuis: 'lnrh' };
  if (!INSEIMHITHE.includes(c0)) return { ok: false, cuis: 'neamhlitir' };

  // `s` lenites before a vowel and before l, n, r; it resists lenition in the
  // clusters sc-, sf-, sm-, sp-, st- (and generally s + consonant).
  // Note `''.includes` is vacuously true in JS, so c1 is tested explicitly.
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
 * The fallback in the SEIMHITHE branch is the load-bearing line of the whole
 * language: a lenition-triggering environment demands lenition *of anything
 * that can be lenited*, and demands nothing of anything that cannot. A
 * vowel-initial identifier after `ó` is not an exception to the rule, it is
 * the rule applied to a word with an empty mutation slot.
 */
function foirmDe(lemma, foirm) {
  switch (foirm) {
    case FOIRM.BUN:
      return lemma;
    case FOIRM.SEIMHITHE:
      return inSeimhithe(lemma).ok ? seimhigh(lemma) : lemma;
    case FOIRM.URAITHE:
      // §12 stands: no identifier has an eclipsed form, because eclipsis has
      // been given no programming meaning. `uraigh` below exists, and is used
      // only where Irish itself puts eclipsis — on a verb after a
      // subordinating particle. See DEARADH.md §12.
      throw new Error('urú: níl brí ríomhchláraithe sannta dó (§12)');
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
 * Eclipse. The prefix is always lowercase and the radical is untouched:
 * baile -> mbaile, Baile -> mBaile, fuil -> bhfuil, áit -> n-áit, Éire -> nÉire.
 */
function uraigh(word) {
  const c0 = word[0];
  if (isGuta(c0)) return (/\p{Lu}/u.test(c0) ? 'n' : 'n-') + word;
  return URU[c0.toLowerCase()] + word;
}

/**
 * Every lemma that `word` could be the eclipsed form of.
 *
 * The inverse of `uraigh`, and it is a set rather than a value because the
 * mapping is not one-to-one: `n` before a vowel undoes to nothing (nÉire →
 * Éire), and `ng-` could be an eclipsed `g-` or a word that simply starts
 * `ng-`. Used only to recognise an eclipsed identifier well enough to refuse
 * it by name (E108, §12); the symbol table decides which candidate is real.
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

/** The full paradigm of a lemma, for `--paraidím` output and symbol dumps. */
function paraidim(lemma) {
  const can = inSeimhithe(lemma);
  const ur = inUraithe(lemma);
  return {
    lemma,
    [FOIRM.BUN]: lemma,
    [FOIRM.SEIMHITHE]: can.ok ? seimhigh(lemma) : lemma,
    inSeimhithe: can.ok,
    cuis: can.cuis || null,
    // Shown but never demanded: no syntactic slot asks for it (§12).
    uruFéideartha: ur.ok ? uraigh(lemma) : null,
  };
}

/**
 * The substantive verb `bí`. Irish verbs have an *independent* form used when
 * the verb heads its own assertion, and a *dependent* form used when a
 * particle governs the clause — a question, a negation, or a subordinator.
 * The dependent form of `bí` is `fuil`, which never appears bare: the
 * particles that select it also eclipse it, giving `bhfuil`.
 *
 *   má tá duine        an assertion under a realis particle → independent
 *   mura bhfuil duine  a negated condition                  → dependent
 *   bí                 the imperative; the citation form; the lemma
 *
 * This is morphology, not semantics. `bí` still means existence and state in
 * every form; only its shape agrees with its environment.
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
 * The copula `is`. Céim 0.9, §31.
 *
 * The second paradigm in this file, and the first evidence that the design
 * generalises past initial mutation. It has the same shape as `bí` above: one
 * word, several forms, the form chosen by the environment and never by the
 * meaning. What differs is that `bí`'s alternation is independent/dependent,
 * while the copula's is a *fusion* — the governing particle and the copula
 * are written as one word:
 *
 *   is Duine é          the copula heading its own assertion  → independent
 *   má + is  → más      the realis particle swallows it
 *   mura + is → mura    the irrealis particle swallows it
 *            → murab      … and takes -b before a vowel
 *
 * Two allomorph rules live here and nowhere else, both conditioned on the
 * first letter of the *following* word, which is why the caller has to pass
 * it in:
 *
 *   mura → murab  before a vowel   (mura Ceart, murab Easpa)
 *   ní   → ní h-  before a vowel   (ní Ceart, ní hEaspa)
 *
 * The second is computed and never demanded, exactly as `uraigh` is computed
 * and never demanded (§12). Four of the seven cells have no syntactic slot in
 * Spicebag, because the language has no question, no bare negation and no
 * subordinate assertion. `foirmChopail` throws for those, `paraidimChopail`
 * prints them, and `--paraidím` labels them *gan bhrí, §31*.
 */
const RIALU_COPAIL = Object.freeze({
  BUN: 'bun',                            // is    — independent
  MA: 'má',                              // más   — under the realis particle
  MURA: 'mura',                          // mura / murab — under the irrealis
  DIULTACH: 'diúltach',                  // ní    — no slot: no bare negation
  CEISTEACH: 'ceisteach',                // an    — no slot: no question
  CEISTEACH_DIULTACH: 'ceisteach diúltach', // nach — no slot, likewise
  FAISNEISEACH: 'faisnéiseach',          // gur   — no slot: no `go` clause
});

/** The cells a syntactic position actually demands. */
const COPAIL_BEO = Object.freeze([
  RIALU_COPAIL.BUN, RIALU_COPAIL.MA, RIALU_COPAIL.MURA,
]);

/**
 * The surface form of the copula under `rialu`, before the word `focal`.
 *
 * `focal` is the predicate — the type name — because the two allomorph rules
 * are both regressive: the copula's shape depends on what comes after it, not
 * on what comes before. Passing the predicate is therefore not a convenience,
 * it is the rule.
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
      // §31 stands, on the §12 pattern: the form is real Irish and is
      // computed below for display, but no slot in the language demands it.
      throw new Error(`copail: níl brí ríomhchláraithe sannta don fhoirm "${rialu}" (§31)`);
    default:
      throw new Error(`rialú copaile anaithnid: ${rialu}`);
  }
}

/**
 * The whole present paradigm before `focal`, for `--paraidím` and for tests.
 * `beo` marks the three cells a position can demand; the rest are shown the
 * way an eclipsed form is shown, so that the reader can see what the language
 * is declining to use.
 */
function paraidimChopail(focal = 'Cineál') {
  const guta = isGuta(focal[0]);
  const R = RIALU_COPAIL;
  return [
    { rialu: R.BUN, foirm: 'is', frasa: `is ${focal}`, beo: true },
    { rialu: R.MA, foirm: 'más', frasa: `más ${focal}`, beo: true },
    { rialu: R.MURA, foirm: guta ? 'murab' : 'mura', frasa: `${guta ? 'murab' : 'mura'} ${focal}`, beo: true },
    // `ní` prefixes h- to a vowel, the same rule `le` follows in E201.
    { rialu: R.DIULTACH, foirm: 'ní', frasa: `ní ${reamhlitirH(focal)}`, beo: false },
    { rialu: R.CEISTEACH, foirm: 'an', frasa: `an ${focal}`, beo: false },
    { rialu: R.CEISTEACH_DIULTACH, foirm: 'nach', frasa: `nach ${focal}`, beo: false },
    { rialu: R.FAISNEISEACH, foirm: 'gur', frasa: `gur ${focal}`, beo: false },
  ];
}

/** Every written form of the copula, for the lexer's keyword table. */
const FOIRMEACHA_COPAIL = Object.freeze(['is', 'más', 'mura', 'murab']);

/**
 * An briathar saor — the autonomous verb. Céim 0.10, §37.
 *
 * The third paradigm here and the first *productive* one. `bí` and the copula
 * are closed tables of function words: the compiler looks them up. The
 * autonomous is formed from any verb the author declares, which means this is
 * the first time the file has had to conjugate rather than recognise.
 *
 *   scríobh   →  scríobhtar        1st conjugation, broad
 *   cuir      →  cuirtear          1st conjugation, slender
 *   caith     →  caitear           … -th is absorbed by the ending
 *   léigh     →  léitear           … -gh likewise
 *   sábháil   →  sábháiltear       polysyllabic loan, still 1st
 *   ceannaigh →  ceannaítear       2nd conjugation, -aigh dropped
 *   bailigh   →  bailítear         2nd, slender
 *   fógair    →  fógraítear        2nd, syncopating: fógair → fógr-
 *   oscail    →  osclaítear        likewise
 *   inis      →  insítear          likewise
 *
 * The ending agrees in quality with the final consonant of the stem, which
 * Irish orthography signals with the preceding vowel: broad (a, o, u) takes
 * -tar / -aítear, slender (e, i) takes -tear / -ítear. Quality is read off the
 * stem *after* any syncopation, because syncopation is what changes it —
 * `fógair` looks slender and `fógr-` is broad, and the ending follows the
 * second.
 *
 * Nothing here knows what a verb is used for. As with lenition, the question
 * "what is the autonomous form of this word" is answered without reference to
 * whether any position demands it.
 */

const LEATHAN = 'aouáóú';
const CAOL = 'eiéí';

/** The handful that do not follow the rules. Irish has eleven irregular verbs. */
const SAOR_MIREGULTA = Object.freeze({
  // Stem-internal irregularity: `taispeáin` broadens to `taispeán-` before the
  // ending, where `sábháil` keeps its slender consonant. No orthographic rule
  // separates the two, so this is lexical and belongs in a table — which is
  // what a printed grammar does with it too.
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

/** Syllable count, counted the way Irish counts it: one per vowel group. */
const siollai = (word) => gutai(word).length;

/**
 * Is the stem broad? Decided by its last vowel group's last vowel, which is
 * the letter that carries the quality of the consonant after it.
 */
function isLeathan(stem) {
  const gs = gutai(stem);
  if (!gs.length) return true;                 // no vowel: nothing to agree with
  const g = gs[gs.length - 1];
  return LEATHAN.includes(g[g.length - 1]);
}

/**
 * Second conjugation: polysyllabic verbs in -(a)igh, and the syncopating
 * stems in -il, -in, -ir, -is. Polysyllabic verbs in -áil and friends are
 * first-conjugation loans and are excluded before the -il test can catch
 * them, which is why the order of these clauses matters.
 */
function isDaraReimniu(lemma) {
  const w = lemma.toLowerCase();
  if (siollai(w) < 2) return false;
  if (/(áil|eáil|óil|úil|áin|úin)$/.test(w)) return false;   // loans stay 1st
  if (/(aigh|igh)$/.test(w)) return true;
  return /[aeiouáéíóú][ilnrs]$/.test(w);
}

/**
 * Syncopation: the unstressed vowel of the final syllable drops before a
 * vowel-initial ending. fógair → fógr, oscail → oscl, inis → ins.
 */
function coimriu(stem) {
  return stem.replace(/[aeiouáéíóú]+([^aeiouáéíóú]+)$/i, '$1');
}

/** Can this word be conjugated as a verb at all? */
function inShaor(lemma) {
  if (!lemma) return { ok: false, cuis: 'folamh' };
  if (!gutai(lemma).length) return { ok: false, cuis: 'gan-ghuta' };
  return { ok: true };
}

/**
 * The present autonomous of `lemma`.
 *
 * The imperative root is the citation form, so this is derivation from the
 * lemma exactly as `seimhigh` is — but with a suffix rather than a prefix,
 * and with the shape of the ending decided by the stem rather than by the
 * environment. That is the difference between this paradigm and the other
 * two, and the reason it is the one that shows the file generalising.
 */
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

  // First conjugation. A stem in -th or -gh is absorbed by the ending: the
  // ending begins with the same sound, and Irish does not write it twice.
  let stem = lemma;
  if (/th$/i.test(stem)) stem = stem.slice(0, -2);
  else if (/gh$/i.test(stem)) stem = stem.slice(0, -2);
  return stem + (isLeathan(stem) ? 'tar' : 'tear');
}

/** The past autonomous. Recognised so it can be refused; see below. */
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
 * The *past* autonomous — `moladh`, `scríobhadh`, `liostaíodh`, `fuarthas`.
 *
 * Computed for one reason only: so that writing it can be refused with a
 * message that names what it is. Spicebag has no tense anywhere, which is the
 * same ground on which §31 kept `ba` out of the copula's table — a cell for a
 * distinction the language cannot express would claim more than it can do.
 * But a reader of Irish will write `liostaíodh` for "it was listed", and an
 * unrecognised identifier is a worse answer than "that is the past and there
 * is no past here".
 *
 * `fuarthas` is in the table above, and it is the form that made `Fuarthas` an
 * unsafe variant name in `feidhmchlár/duine.sb` before 0.9 renamed it.
 *
 * Returns null where the regular rule does not reach — the monosyllabic verbs
 * in -igh (`léigh` → `léadh`, `nigh` → `níodh`) are genuinely irregular here
 * and are not guessed at.
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

/**
 * The autonomous paradigm of one verb, for `--paraidím`.
 *
 * Laid out like `paraidimChopail`: the cell a position demands is plain, and
 * the cell that exists in Irish with no slot here is returned so that it can
 * be printed and labelled. Same treatment as an eclipsed form (§12), the
 * copula's four dead cells (§31), and for the same reason.
 */
function paraidimShaor(lemma) {
  const caite = foirmShaorChaite(lemma);
  return [
    { aimsir: 'láithreach', foirm: foirmShaor(lemma), beo: true },
    { aimsir: 'caite', foirm: caite, beo: false },
  ];
}

/**
 * Best guess at the lemma behind a surface form. Only a guess: the symbol
 * table has the final say.
 */
function lemmaTuairim(surface) {
  return cosuilLeSeimhiu(surface) ? diseimhigh(surface) : surface;
}

/**
 * `le` prefixes h- to a vowel-initial word (le hUimhir, but le Teaghrán).
 * Used by the diagnostic formatter so error messages are themselves
 * grammatical Irish.
 */
function reamhlitirH(word) {
  return isGuta(word[0]) ? 'h' + word : word;
}

/*
 * §40 — inscne ghramadaí.
 *
 * Tá gach ainmfhocal Gaeilge firinscneach nó baininscneach, agus is beag
 * loighic atá leis. Ní athraíonn an inscne brí ar bith. Ní dhéanann sí ach
 * foirm a éileamh — agus is é sin an fáth a bhfuil sí anseo agus nach raibh
 * sí i §36: dhiúltaigh §36 don inscne mar rud a iompraíonn brí (cé leis é),
 * agus ní hé sin an rud atá anseo ar chor ar bith.
 *
 * Sa tuiseal ainmneach séimhítear an aidiacht i ndiaidh ainmfhocail
 * bhaininscnigh agus ní shéimhítear i ndiaidh ainmfhocail fhirinscnigh:
 *
 *     fear mór          bean mhór
 *     duine aois seasmhach sheasmhach
 *
 * Níl aon rud anseo ach `seimhigh` á ghairm nó gan é a ghairm. Sin an
 * ceathrú paraidím, agus is é an ceann is lú de na ceithre cinn.
 */
const INSCNE = { FIR: 'fir', BAIN: 'bain' };

/** The Irish name, for messages and for `--paraidím`. */
const ainmInscne = (i) => (i === INSCNE.BAIN ? 'baininscneach' : 'firinscneach');

/**
 * The form an attributive adjective takes after a noun of this gender, in the
 * nominative singular.
 *
 * The genitive is not here and cannot be. Irish reverses the rule in the
 * genitive singular — *hata an fhir* lenites the masculine, *doras na scoile*
 * leaves the feminine bare — and that chiasmus is the most distinctive thing
 * about the system. Spicebag has no genitive construction at all: `ainm ó
 * dhuine` is a prepositional phrase, not *ainm an duine*. So there is no slot
 * the reversed rule could attach to, and its absence is forced rather than
 * chosen (§40.6).
 */
function foirmAidiachta(aidiacht, inscne) {
  if (inscne !== INSCNE.BAIN) return aidiacht;
  // Straight through `foirmDe`, which is the load-bearing line of the whole
  // language: a leniting environment demands lenition of anything that can be
  // lenited and demands nothing of anything that cannot. An adjective with an
  // empty mutation slot after a feminine noun is not an exception to gender
  // agreement — it is gender agreement applied to a word with nothing to
  // change (§5).
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
  FOIRMEACHA_COPAIL,
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
