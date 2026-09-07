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

module.exports = {
  FOIRM,
  isGuta,
  inSeimhithe,
  inUraithe,
  uraigh,
  cosuilLeUru,
  seimhigh,
  diseimhigh,
  cosuilLeSeimhiu,
  foirmDe,
  RIALU_BRIATHAIR,
  PARAIDIM_BI,
  foirmBhriathartha,
  paraidim,
  lemmaTuairim,
  reamhlitirH,
};
