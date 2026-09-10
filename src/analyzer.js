'use strict';

/*
 * anailíseoir.js — the grammatical / semantic stage.
 *
 * Four jobs, interleaved:
 *
 *  1. Cineálacha  — ordinary static type checking.
 *  2. Rialú       — *government*: each syntactic slot declares which
 *                   grammatical form it demands of the head of the phrase
 *                   filling it. One operator governs: `ó`, which lenites its
 *                   complement (Irish: ó dhuine, ó Chorcaigh, ó Dhuine).
 *  3. Réiteach    — *agreement*: the surface identifier written by the
 *                   programmer must be the realisation of some bound lemma
 *                   in the demanded form. One lemma, many surfaces.
 *  4. Modh/Aspect — *mood*: an imperative performs and cannot be mentioned;
 *                   an indicative produces a nominal and cannot be obeyed.
 *                   *Aspect*: `ag` marks an action under way, `tar éis` marks
 *                   it complete, and an action under way is not yet a value.
 *
 * A binding is never split into several symbols. `duine` and `dhuine` are one
 * entry in the table with a paradigm attached.
 */

const mf = require('./morphology');
const { FOIRM } = mf;
const { Bailitheoir } = require('./diagnostics');
const ctae = require('./contaetha');

// ── cineálacha ────────────────────────────────────────────────────────
const prim = (ainm) => ({ k: 'bun', ainm });
const UIMHIR = prim('Uimhir');
const TEAGHRAN = prim('Teaghrán');
const BOOL = prim('Bool');
const NEAMHNI = prim('Neamhní');

/**
 * `Iasacht` — "a loan; something borrowed". The type of every value that
 * crosses the boundary from JavaScript. It is vocabulary, not grammar: no
 * Irish phenomenon motivates it, and the notes say so plainly. It earns its
 * place by making the copula non-vacuous — `má luach is Uimhir` on a borrowed
 * value is a real question with a real answer.
 */
const IASACHT = { k: 'iasacht', ainm: 'Iasacht' };

const liosta = (mir) => ({ k: 'liosta', ainm: 'Liosta', mir });
const arSiul = (inner) => ({ k: 'arSiúl', inner });

/**
 * A Spicebag module reached through `ó`. Not `Iasacht`: the possessor is a
 * text written in this language, so its members keep their types, their mood
 * and their aspect. The relation is unchanged — the possessor is just better
 * known than it used to be.
 */
const modul = (ainm, siniu) => ({ k: 'modúl', ainm, siniu });

const BUNCHINEALACHA = new Map([
  ['Uimhir', UIMHIR], ['Teaghrán', TEAGHRAN], ['Bool', BOOL],
  ['Neamhní', NEAMHNI], ['Iasacht', IASACHT],
]);

function ainmCineail(t) {
  if (!t) return '?';
  switch (t.k) {
    case 'liosta': return `Liosta(${ainmCineail(t.mir)})`;
    case 'arSiúl': return `ag ${ainmCineail(t.inner)}`;
    case 'modúl': return `modúl ${t.ainm}`;
    // A variant is named on its own, because it is its own name in the type
    // namespace: `suim Toradh { Ceart … }` makes `Ceart` unavailable to
    // anything else, and E208 says so.
    case 'malairt': return t.ainm;
    case 'suim': return t.ainm;
    case 'feidhm': {
      // Render a verb type the way it is written, so a mismatch reads as the
      // declaration the caller should have made.
      const MODH = { ordaitheach: 'gníomh', saor: 'saor', táscach: 'feidhm' };
      const ceann = (t.leanunach ? 'ag ' : '') + (MODH[t.modh] || 'feidhm');
      const ps = (t.params || []).map(ainmCineail).join(', ');
      return t.modh === 'táscach'
        ? `${ceann}(${ps}) -> ${ainmCineail(t.toradh)}`
        : `${ceann}(${ps})`;
    }
    default: return t.ainm || '?';
  }
}

/** Is `b` one of the variants `a` enumerates? */
const isMalairtDe = (a, b) => a && b && a.k === 'suim' && b.k === 'malairt'
  && a.malairti.has(b.ainm) && b.suim === a.ainm;

function comhionann(a, b) {
  if (!a || !b) return false;
  if (a.k === 'iasacht' || b.k === 'iasacht') return true;
  // Introduction is widening and widening is free (§26.1): a `Ceart` already
  // *is* a `Toradh`, so there is no constructor to write and nothing to
  // convert. Directional on purpose — `comhionann(súil, fuarthas)` — because
  // the reverse is the narrowing the copula does and it is not free.
  if (isMalairtDe(a, b)) return true;
  if (a.k !== b.k) return false;
  if (a.k === 'liosta') return comhionann(a.mir, b.mir);
  if (a.k === 'arSiúl') return comhionann(a.inner, b.inner);
  if (a.k === 'modúl') return a.ainm === b.ainm;
  if (a.k === 'feidhm') {
    // Mood and aspect are part of what a verb is, so they are part of its
    // type: a `gníomh` is never a `feidhm`, however the arguments line up.
    if (a.modh !== b.modh) return false;
    if (!!a.leanunach !== !!b.leanunach) return false;
    const pa = a.params || [], pb = b.params || [];
    if (pa.length !== pb.length) return false;
    for (let i = 0; i < pa.length; i++) if (!comhionann(pa[i], pb[i])) return false;
    return comhionann(a.toradh || NEAMHNI, b.toradh || NEAMHNI);
  }
  return a.ainm === b.ainm;
}

/**
 * The type that covers both, or null if nothing does.
 *
 * Used where two types meet without one of them being expected — the branches
 * of a value `má`, and the items of a list literal. Two variants of one sum
 * meet at the sum, which is what finally gives a heterogeneous list literal
 * somewhere to go and makes E211 reachable (§26.5).
 */
function nasc(a, b, cinealacha) {
  if (!a || !b) return null;
  if (a.k === 'iasacht') return b;
  if (b.k === 'iasacht') return a;
  if (comhionann(a, b)) return a;
  if (comhionann(b, a)) return b;
  const suimDe = (t) => (t.k === 'malairt' ? cinealacha.get(t.suim) : null);
  const sa = suimDe(a) || (a.k === 'suim' ? a : null);
  const sb = suimDe(b) || (b.k === 'suim' ? b : null);
  if (sa && sb && sa.ainm === sb.ainm) return sa;
  return null;
}

// ── scóip ─────────────────────────────────────────────────────────────
class Scoip {
  constructor(tuis = null) { this.clar = new Map(); this.tuis = tuis; }
  cuir(ceangal) { this.clar.set(ceangal.lemma, ceangal); return ceangal; }
  faighAitiuil(lemma) { return this.clar.get(lemma) || null; }
  faigh(lemma) {
    for (let s = this; s; s = s.tuis) { const c = s.clar.get(lemma); if (c) return c; }
    return null;
  }
}

const FOCAIL_JS = new Set(['var', 'let', 'const', 'function', 'class', 'return', 'if', 'else',
  'new', 'delete', 'typeof', 'in', 'of', 'do', 'while', 'for', 'switch', 'case', 'this', 'null',
  'true', 'false', 'void', 'with', 'try', 'catch', 'throw', 'default', 'export', 'import',
  'await', 'async', 'yield', 'require', 'module', 'exports']);
const jsAinm = (lemma) => (FOCAIL_JS.has(lemma) ? '_' + lemma : lemma);

/**
 * A treaty is unordered, so it is keyed by the sorted pair. County names
 * contain spaces, so the separator is one that cannot occur in a name.
 */
const comhaontuEochair = (a, b) => [a, b].sort().join('\u0000');

class Ceangal {
  constructor(lemma, cineal, kind = 'luach', sealadach = false) {
    this.lemma = lemma;
    this.cineal = cineal;
    this.kind = kind;                    // 'luach' | 'feidhm' | 'gníomh'
    // seasmhach: what the thing permanently is. sealadach: what it happens
    // to be right now. The same essence/accident split that separates `is`
    // from `bí` (§13, §14), applied to bindings rather than predicates.
    this.sealadach = sealadach;
    this.paraidim = mf.paraidim(lemma);
    this.jsAinm = jsAinm(lemma);
  }
}

// ── anailís ───────────────────────────────────────────────────────────
class Anailiseoir {
  constructor(comhthéacs = {}) {
    this.bail = new Bailitheoir();
    this.cinealacha = new Map(BUNCHINEALACHA);
    this.domhanda = new Scoip();
    this.modhanna = [];   // method declarations, for the backend
    // foinse → síniú, filled in by the module graph before analysis. Empty by
    // default, which is exactly the pre-0.5 behaviour: every import is a loan.
    this.modúil = comhthéacs.modúil || new Map();
    this.ailiasanna = new Map();   // foinse → the JS alias the backend requires
    /*
     * Where this module is from (§24.2).
     *
     * A mismatch needs two provenances and only one of them is on the value,
     * so the other has to be the code doing the accessing. It is the module
     * and not the verb, for one honest reason and several engineering ones.
     *
     * The honest one: Irish `as` predicates provenance of people and things —
     * *is as Corcaigh mé*, *fear as Doire* — and a text is a thing, so
     * *nuachtán as Baile Átha Cliath* is ordinary. There is no construction in
     * which an *action* is from somewhere; you cannot say *déanamh as
     * Corcaigh*. That is a tiebreaker between the two candidates, not a
     * justification for the county system, which has none and does not claim
     * one.
     *
     * The engineering: one line per file instead of ceremony on every verb; no
     * per-verb override, because a local escape hatch would defeat the point;
     * and a receiver-based county would make every method access trivially
     * pass, which is precisely where the check most needs to bite.
     *
     * `deoraíocht` until declared otherwise, so every 0.5 program keeps
     * compiling untouched: counties cost nothing until you use one.
     */
    this.contae = ctae.DEORAIOCHT;
    this.ionadContae = null;
    /*
     * cúige → { contae, struchtúr }. One province, one struct, across the
     * whole graph — an imported type brings its claim with it.
     *
     * Keyed by province and not by county, which is the headline of 0.7
     * (§25.2). Four slots, not 32. The county is still recorded, because
     * E603 has to be able to say who is sitting there and under what name,
     * and because the county is what the rivalry table is keyed on.
     *
     * Province exclusivity is the point, not an implementation detail. The
     * 32 names remain the vocabulary and remain checked; 28 of them are
     * decoys at any given moment, and choosing between the decoys is the
     * game, because the county you choose decides who will not deal with
     * you (§25.4).
     */
    this.cuigeGafa = new Map();
    // The treaties in force in *this file*. Sorted-pair keys, so a treaty is
    // the same treaty whichever way round it was written.
    this.comhaontuithe = new Set();
    // A module body is a sequence of commands, so top level is imperative.
    // It is not ongoing, so `tar éis` at top level is an error.
    this.ctx = { modh: 'ordaitheach', leanunach: false, ainm: '<barr>' };
    // Which form of the substantive verb the surrounding clause selects.
    // Independent unless a particle governs the clause.
    this.rialuBriathair = mf.RIALU_BRIATHAIR.NEAMHSPLEACH;
    this.copailMhir = null;             // the particle governing the copula (§31)
    // surface → { lemma, foirm } for every autonomous verb in scope, present
    // and past. Built at declaration and at import; the Ordú path looks a
    // written form up here before it looks it up as an identifier (§37).
    this.saorFoirmeacha = new Map();
    this.tusaigh();
  }

  tusaigh() {
    this.domhanda.cuir(new Ceangal('scríobh', {
      k: 'feidhm', modh: 'ordaitheach', leanunach: false,
      params: [IASACHT], toradh: NEAMHNI,
    }, 'gníomh'));

    /*
     * `déan a fhógair ar dhaoine` — iteration (DEARADH.md §21).
     *
     * `déan` is the Irish light verb that turns a verbal noun into an action
     * performed: *déan scrúdú ar na cáipéisí*, *déan iniúchadh ar*, *déan cur
     * síos ar*. The verbal noun names the action and `ar` marks what it is
     * done to; with a plural object the action distributes over its members,
     * which is what a loop is.
     *
     * Nothing new in the grammar. `déan` is a bare imperative root (§4);
     * `a fhógair` is the nominalising particle already in the language (§13);
     * `ar` is the preposition already governing `cuir … ar …` (§12), and it
     * lenites here through the same code path. The only addition is the
     * lexical fact that `déan` selects `ar`, which is ordinary Irish verb
     * government of prepositions.
     *
     * Its argument must be a `gníomh`, not a `feidhm`: `déan` discards what
     * the verb yields, and in the indicative a mention must be used (E503).
     */
    const d = new Ceangal('déan', {
      k: 'feidhm', modh: 'ordaitheach', leanunach: false,
      params: [{ k: 'feidhm', modh: 'ordaitheach', leanunach: false, params: [IASACHT], toradh: NEAMHNI }],
      toradh: NEAMHNI, frama: 'ar', ionsuite: 'déan',
    }, 'gníomh');
    this.domhanda.cuir(d);
  }

  // ---- modúil --------------------------------------------------------
  /**
   * Bring an imported module's vocabulary into this one, before anything
   * local is declared — so a local declaration that collides with an import
   * is E208 in the ordinary way.
   *
   * Verbs come in unqualified, because a verb is vocabulary and vocabulary is
   * not qualified: you cannot write `cuirDuine ó shonraí stór, …` and still
   * have a command, since `ó` builds noun phrases and E501 exists precisely
   * to say an imperative is not a nominal. Values do not come in unqualified,
   * because a value is a possession and possession is exactly what `ó` is for.
   */
  iompórtail() {
    let uimh = 0;
    for (const [foinse, siniu] of this.modúil) {
      const ailias = `__m${uimh++}`;
      this.ailiasanna.set(foinse, ailias);

      for (const [ainm, t] of siniu.cinealacha) {
        if (!this.cinealacha.has(ainm)) this.cinealacha.set(ainm, t);
        // The province is the type's identity and the county is its name, so
        // the claim is global and arrives with the import. One struct per
        // province, globally, across the whole graph.
        if (!t.contae || t.contae === ctae.DEORAIOCHT) continue;
        const cuige = ctae.cuigeDe(t.contae);
        const gafa = this.cuigeGafa.get(cuige);
        if (gafa && gafa.struchtur !== ainm) {
          this.bail.cuir('E603', siniu.ionad, cuige, gafa.contae, gafa.struchtur);
        } else {
          this.cuigeGafa.set(cuige, { contae: t.contae, struchtur: ainm });
        }
      }

      for (const [lemma, onn] of siniu.onnmhairi) {
        if (onn.kind === 'luach') continue;              // a possession, not a word
        const ann = this.domhanda.faighAitiuil(lemma);
        if (ann) { this.bail.cuir('E106', siniu.ionad, lemma, [ann.foinse || '<áitiúil>', foinse]); continue; }
        const c = new Ceangal(lemma, onn.cineal, onn.kind);
        c.jsAinm = `${ailias}.${onn.jsAinm || lemma}`;
        c.foinse = foinse;
        this.domhanda.cuir(c);
        // A borrowed autonomous verb is stated the same way a native one is.
        if (onn.cineal && onn.cineal.saor) {
          this.saorFoirmeacha.set(onn.cineal.saor, { lemma, aimsir: 'láithreach' });
          if (onn.cineal.saorCaite) {
            this.saorFoirmeacha.set(onn.cineal.saorCaite, { lemma, aimsir: 'caite' });
          }
        }
      }
    }
  }

  /** The signature this module presents to anything importing it. */
  siniu(ionad = null) {
    const onnmhairi = new Map();
    for (const c of this.domhanda.clar.values()) {
      if (c.foinse) continue;                            // re-export nothing
      if (c.lemma === 'scríobh' || c.lemma === 'déan') continue;
      onnmhairi.set(c.lemma, {
        cineal: c.cineal, kind: c.kind, sealadach: c.sealadach, jsAinm: c.jsAinm,
      });
    }
    const cinealacha = new Map();
    for (const [ainm, t] of this.cinealacha) {
      if (BUNCHINEALACHA.has(ainm)) continue;
      if (['struchtúr', 'suim', 'malairt'].includes(t.k)) cinealacha.set(ainm, t);
    }
    const gniomhartha = new Set();
    const briathra = new Set();
    for (const [lemma, onn] of onnmhairi) {
      if (onn.kind === 'gníomh') { gniomhartha.add(lemma); briathra.add(lemma); }
      else if (onn.kind === 'feidhm') briathra.add(lemma);
      // An imported autonomous verb brings its forms with it, as a borrowed
      // verb brings its conjugation (§19.2). They are re-derived rather than
      // carried, because the lemma is the thing that was exported and the
      // form is a fact about the lemma.
      if (onn.cineal && onn.cineal.saor) {
        gniomhartha.add(onn.cineal.saor); briathra.add(onn.cineal.saor);
        if (onn.cineal.saorCaite) {
          gniomhartha.add(onn.cineal.saorCaite); briathra.add(onn.cineal.saorCaite);
        }
      }
    }
    // The module's own county rides in the signature so `--graf` can print it.
    // Nothing consults it from the far side: a county is a property of a
    // place, and reading someone else's text is not moving house (§24.2). The
    // struct types in `cinealacha` carry theirs, and those *are* consulted,
    // because a type's county is its identity.
    return { onnmhairi, cinealacha, gniomhartha, briathra, ionad, contae: this.contae };
  }

  // ---- government + agreement ---------------------------------------
  /**
   * The single agreement check. Given what the programmer wrote (`surface`),
   * the form the slot demands (`foirm`), and a way to ask whether a lemma is
   * known here, either return the lemma or file a precise diagnostic.
   */
  reitighFoirm(surface, foirm, lemmaAnn, oibreoir) {
    const lemma = mf.lemmaTuairim(surface);
    if (!lemmaAnn(lemma)) {
      // §12 — an eclipsed identifier is recognised so that it can be refused
      // by name. Eclipsis has no programming meaning, `foirmDe(…, URAITHE)`
      // throws, and `--paraidím` prints every eclipsed form annotated *gan
      // bhrí*. Falling through to E101 would answer a form that is correct
      // Irish with "undefined identifier", which is the worst of the two
      // available answers. Same move as E519 makes for the past autonomous.
      if (mf.cosuilLeUru(surface)) {
        for (const iarracht of mf.lemmaiFaoiUru(surface)) {
          if (lemmaAnn(iarracht)) return { earraid: ['E108', surface] };
        }
      }
      return { earraid: ['E101', lemma] };
    }

    const ceart = mf.foirmDe(lemma, foirm);
    if (ceart === surface) return { lemma };

    const scriobhSeimhithe = mf.cosuilLeSeimhiu(surface);
    const inSeim = mf.inSeimhithe(lemma);

    if (scriobhSeimhithe && !inSeim.ok) return { earraid: ['E104', lemma, inSeim.cuis] };
    if (scriobhSeimhithe && foirm === FOIRM.BUN) return { earraid: ['E103', surface, lemma] };
    if (!scriobhSeimhithe && foirm === FOIRM.SEIMHITHE) {
      return { earraid: ['E102', surface, ceart, oibreoir || 'ó'] };
    }
    return { earraid: ['E105', surface, lemma, ceart] };
  }

  /**
   * The copula's agreement check, and the twin of the `Substaint` one (§31).
   *
   * `bí` alternates independent/dependent and is checked against
   * `rialuBriathair`; the copula fuses with its particle and is checked
   * against `copailMhir`. The demanded form is a function of two things and
   * both are grammatical: which particle governs the clause, and the first
   * letter of the type named after it.
   *
   *   más Ceart toradh      má   + is,  consonant → más
   *   murab Easpa toradh    mura + is,  vowel     → murab
   *   is Ceart              nothing governs it    → the independent form
   */
  foirmChopaile(e, mhir) {
    if (!mhir) {
      // Ungoverned, so the independent form, which is the only one the
      // parser can produce here. Nothing to check.
      return;
    }
    const rialu = mhir.diultach ? mf.RIALU_COPAIL.MURA : mf.RIALU_COPAIL.MA;
    const ceart = mf.foirmChopail(rialu, e.cineal.ainm);
    // A separate `is` after the particle is the pre-0.9 word order. It is not
    // a wrong allomorph but a missing fusion, so it is named as it was
    // written rather than as a single word.
    const scriofa = e.faoiMhir ? mhir.scriofa : `${mhir.scriofa} … is`;
    if (scriofa !== ceart) this.bail.cuir('E517', e.ionad, scriofa, ceart);
  }

  /** File a resolution failure, remapping "unbound" to the caller's code. */
  teip(res, ionad, codGanSainmhiniu, ...breise) {
    const cod = res.earraid[0] === 'E101' && codGanSainmhiniu ? codGanSainmhiniu : res.earraid[0];
    const args = cod === codGanSainmhiniu ? [res.earraid[1], ...breise] : res.earraid.slice(1);
    this.bail.cuir(cod, ionad, ...args);
  }

  /**
   * An `as` phrase to a county, or `deoraíocht` if there was no phrase.
   *
   * `as` governs the head of its complement and demands FOIRM.BUN, which is
   * what every operator except `ó`, `ar` and `a` already demands. So this
   * routes through `reitighFoirm` like everything else and the fourth operator
   * adds no fifth mechanism. `as Chorcaigh` comes back E103 with no new code:
   * unlicensed lenition is already an error everywhere, and `as` is policed
   * correctly by the machinery doing nothing special for it.
   *
   * Only the head is governed. `Fhailí` in *Uíbh Fhailí* and `nGall` in *Dún
   * na nGall* are frozen inside proper names and are nobody's business here;
   * in particular the eclipsed slot is still empty (§12).
   */
  reitighContae(nód) {
    if (!nód) return ctae.DEORAIOCHT;
    const [ceann, ...eile] = nód.focail;
    // Exile is not a place, so you cannot be from it. It is what you are when
    // you declare nothing.
    if (ceann === ctae.DEORAIOCHT) { this.bail.cuir('E605', nód.ionad); return ctae.DEORAIOCHT; }
    const res = this.reitighFoirm(ceann, FOIRM.BUN, (l) => ctae.isCeannAinm(l), 'as');
    if (res.earraid) { this.teip(res, nód.ionad, 'E602'); return ctae.DEORAIOCHT; }
    const ainm = [res.lemma, ...eile].join(' ');
    if (!ctae.isContae(ainm)) { this.bail.cuir('E602', nód.ionad, ainm); return ctae.DEORAIOCHT; }
    return ainm;
  }

  /**
   * The county a possessor carries, or `null` if provenance does not apply.
   *
   * A struct instance and an `Iasacht` are things you hold. A Spicebag module,
   * a list and a primitive are not, and their exemption is a decision rather
   * than an accident of where the check sits (§24.3): a `modúl` is a text you
   * have read, not a thing you own, and reading vocabulary out of a text is
   * not trade. Without that exemption the import graph and the treaty graph
   * collapse into each other and `ó` ends up doing two jobs.
   *
   * A JavaScript module is deliberately *not* exempt, and the line falls
   * exactly where 0.5 put it. `ó "./sonraí.sb"` is a `modúl`, because the
   * compiler has read it; `ó "express"` is an `Iasacht`, because it has not.
   * The first is a text, the second is a borrowed thing, and a borrowed thing
   * is in exile like every other borrowed thing.
   */
  contaeDe(t) {
    if (!t) return null;
    if (t.k === 'iasacht') return ctae.DEORAIOCHT;
    if (t.k === 'struchtúr') return t.contae || ctae.DEORAIOCHT;
    if (t.k === 'suim') return t.contae || ctae.DEORAIOCHT;
    // A variant answers with the sum's county and holds none of its own. That
    // is §26.2 in one line: the sum is the identity that claims a province,
    // and the variant is a name that identity goes by. If a variant carried
    // its own county it would claim a province of its own, and a two-variant
    // sum would eat half the program's budget.
    if (t.k === 'malairt') return t.contaeSuime || ctae.DEORAIOCHT;
    return null;
  }

  /**
   * The border check on `ó` (§24.3, §25.3). Every `ó` on a county-bearing
   * possessor, which is the pervasive option and was chosen deliberately.
   *
   * Two rules, in this order, and the order is the design.
   *
   * **Rivals do not trade.** The veto sits *above* the four cases rather
   * than inside one of them, so it is not an exception to the border rule —
   * it is a precondition on all of it. Not across a province line, not
   * inside one province, and not under a treaty, because no treaty between
   * rivals can exist (E608). It is the only irremediable relation in the
   * language besides exile, and the two are a pair: exile trades with nobody
   * because it is not a party, rivals trade with nobody because they will
   * not. Exile is nobody's rival, so this never fires on a pre-0.7 program.
   *
   * **Otherwise, the border.** A *border* check, not a sameness check — one
   * comparison covers both legal cases, because two things from nowhere are
   * the same nowhere. Same province passes, and `cuigeDe(deoraíocht)` is
   * `deoraíocht`, so exile reading exile passes through the same equality
   * rather than through a second branch. That is why the rule is still four
   * cases and one comparison after the province change, and why every 0.4,
   * 0.5 and 0.6 program compiles untouched. Exile against a placed county
   * fails with no remedy available, because an agreement is between two
   * parties and exile is not a party.
   *
   * The province is the jurisdiction and the county is the name it goes by.
   * §24.4 said the county *was* the type's identity; that is now split, and
   * the split is what makes the county choice load-bearing again instead of
   * a synonym for the province (§25.4).
   *
   * What is *not* checked is construction, argument passing, and returning:
   * a county is a lock on the box, not a border on the road. Values travel
   * anywhere; they simply cannot be opened except at home. That is what
   * makes exile-trades-with-nobody survivable — an exile module can parse
   * the outside world, build placed structs out of primitives, and hand
   * them on.
   */
  seiceailDuchas(t, ball) {
    const as = this.contaeDe(t);
    if (as === null) return;
    if (ctae.isIomaiocht(as, this.contae)) {
      this.bail.cuir('E609', ball.ionad, ball.surface, as, this.contae);
      return;
    }
    if (ctae.cuigeDe(as) === ctae.cuigeDe(this.contae)) return;
    // The only place a treaty is ever consulted. Exile needs no special case
    // here: `fogairComhaontu` refuses to key a pair containing `deoraíocht`,
    // so no lookup involving exile can ever succeed, and exile trades with
    // nobody as a consequence of the table rather than as a rule about it.
    if (this.comhaontuithe.has(comhaontuEochair(as, this.contae))) return;
    this.bail.cuir('E601', ball.ionad, ball.surface, as, this.contae);
  }

  /** Declarations name the lemma, so they must be written in the base form. */
  seiceailBunfhoirm(ainm, ionad) {
    if (mf.cosuilLeSeimhiu(ainm)) {
      this.bail.cuir('E107', ionad, ainm, mf.diseimhigh(ainm));
      return false;
    }
    return true;
  }

  tagairtCineail(ref) {
    if (!ref) return IASACHT;
    if (ref.k === 'briathar') {
      return {
        k: 'feidhm', modh: ref.modh, leanunach: ref.leanunach,
        params: ref.params.map((p) => this.tagairtCineail(p)),
        toradh: ref.toradh ? this.tagairtCineail(ref.toradh) : NEAMHNI,
        faighteoir: null,
      };
    }
    if (ref.ainm === 'Liosta') {
      if (ref.argointi.length !== 1) {
        this.bail.cuir('E212', ref.ionad, 'Liosta', 1, ref.argointi.length);
        return liosta(IASACHT);
      }
      return liosta(this.tagairtCineail(ref.argointi[0]));
    }
    const t = this.cinealacha.get(ref.ainm);
    if (!t) { this.bail.cuir('E202', ref.ionad, ref.ainm); return IASACHT; }
    if (ref.argointi && ref.argointi.length) {
      this.bail.cuir('E212', ref.ionad, ref.ainm, 0, ref.argointi.length);
    }
    return t;
  }

  // ---- clár ----------------------------------------------------------
  clar(ast) {
    const briathra = [];
    const raitis = [];

    // Pass 0 — the imported lexicon, before anything local exists.
    this.iompórtail();
    ast.ailiasanna = this.ailiasanna;

    // Pass 0b — where this module is from. Nothing else can be judged until
    // the accessing side has a provenance to be judged against (§24.2).
    for (const m of ast.mireanna) if (m.cineál === 'Contae') this.fogairContaeModuil(m);

    // Pass 0c — the treaties in force here, before any access is judged. They
    // are file scope, so position within the file does not matter and a treaty
    // at the bottom licenses an access at the top.
    for (const m of ast.mireanna) if (m.cineál === 'Comhaontú') this.fogairComhaontu(m);

    // Pass A — hoist type and verb declarations.
    for (const m of ast.mireanna) {
      if (m.cineál === 'Contae' || m.cineál === 'Comhaontú') continue;
      if (m.cineál === 'Struchtúr') this.fogairStruchtur(m);
      else if (m.cineál === 'Suim') this.fogairSuim(m);
      else if (m.cineál === 'Briathar') briathra.push(m);
      else raitis.push(m);
    }
    // Pass A2 — field types, then signatures, so a call may precede its verb.
    for (const m of ast.mireanna) if (m.cineál === 'Struchtúr') this.socraighReimsi(m);
    for (const m of ast.mireanna) if (m.cineál === 'Suim') this.socraighMalairti(m);
    for (const b of briathra) this.fogairBriathar(b);
    for (const b of briathra) this.socraighSiniu(b);

    // Pass B — top-level statements, in order.
    for (const r of raitis) this.raiteas(r, this.domhanda);

    // Pass C — verb bodies, with the whole global scope visible.
    for (const b of briathra) this.corpBriathair(b);

    this.bail.caith();
    return ast;
  }

  fogairContaeModuil(m) {
    if (this.ionadContae) { this.bail.cuir('E604', m.ionad); return; }
    this.ionadContae = m.ionad;
    this.contae = this.reitighContae(m);
  }

  /**
   * `comhaontú Corcaigh Ciarraí` — a bilateral agreement, in force in this
   * file (§24.5).
   *
   * **Symmetric**, because an agreement between two parties binds both. The
   * key is the sorted pair, so writing it either way round names the same
   * treaty and the second writing is E607.
   *
   * **Not transitive**, deliberately. Corcaigh–Ciarraí together with
   * Ciarraí–Gaillimh does not give Corcaigh–Gaillimh. Transitivity would
   * partition the 32 into blocs, and a partition is not a treaty — it is the
   * thing a treaty exists instead of. Nothing here computes a closure and
   * nothing should.
   *
   * **File-scoped**, and it does not travel in the signature. The 0.5 boundary
   * carries type, mood and aspect because those are properties of a *value*
   * and go where the value goes; a treaty is a property of a *place*, and a
   * file is a place. Keeping it local is also what lets E601 be diagnosed from
   * the file in front of you rather than from a declaration three imports
   * away, and what stops `--graf` from lying about what is in force here.
   *
   * `deoraíocht` is not a party and cannot be one, so a rejected name simply
   * declares no treaty; `reitighContae` has already filed E605.
   */
  fogairComhaontu(m) {
    const a = this.reitighContae(m.a);
    const b = this.reitighContae(m.b);
    if (a === ctae.DEORAIOCHT || b === ctae.DEORAIOCHT) return;   // already reported
    if (a === b) { this.bail.cuir('E606', m.ionad, a); return; }
    if (ctae.isIomaiocht(a, b)) { this.bail.cuir('E608', m.ionad, a, b); return; }
    const eochair = comhaontuEochair(a, b);
    if (this.comhaontuithe.has(eochair)) { this.bail.cuir('E607', m.ionad, a, b); return; }
    this.comhaontuithe.add(eochair);
  }

  /**
   * Claim a province for a placed type, or report who holds it (§25.2).
   *
   * Shared by `struchtúr` and `suim`, which is the whole of what 0.8 does to
   * the province rule: sums compete for the same four slots on the same terms.
   * Nothing about the rule changed; there are simply more things that want one,
   * and that is what finally makes the budget scarce (§26.5).
   */
  eiligh(ainm, contae, ionad) {
    if (contae === ctae.DEORAIOCHT) return;
    const cuige = ctae.cuigeDe(contae);
    const gafa = this.cuigeGafa.get(cuige);
    if (gafa && gafa.struchtur !== ainm) {
      this.bail.cuir('E603', ionad, cuige, gafa.contae, gafa.struchtur);
    } else {
      this.cuigeGafa.set(cuige, { contae, struchtur: ainm });
    }
  }

  fogairStruchtur(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    if (this.cinealacha.has(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }
    const contae = this.reitighContae(m.contae);
    if (contae !== ctae.DEORAIOCHT) {
      const cuige = ctae.cuigeDe(contae);
      const gafa = this.cuigeGafa.get(cuige);
      // Declaring `struchtúr Duine as Corcaigh` claims the whole of An
      // Mhumhain: Ciarraí, Luimneach, An Clár, Port Láirge and Tiobraid
      // Árann are closed for the rest of the program. Choosing a county is
      // choosing a province, and what is left over is the decision about
      // who you are willing to deal with (§25.2).
      //
      // Exile is the one place that is not exclusive, because it is not a
      // place: without that a program could hold four struct types in total.
      if (gafa && gafa.struchtur !== m.ainm) {
        this.bail.cuir('E603', m.contae.ionad, cuige, gafa.contae, gafa.struchtur);
      } else {
        this.cuigeGafa.set(cuige, { contae, struchtur: m.ainm });
      }
    }
    this.cinealacha.set(m.ainm, {
      k: 'struchtúr', ainm: m.ainm, reimsi: new Map(), modhanna: new Map(), contae,
    });
  }

  socraighReimsi(m) {
    const t = this.cinealacha.get(m.ainm);
    if (!t || t.k !== 'struchtúr') return;
    for (const r of m.reimsi) {
      if (!this.seiceailBunfhoirm(r.ainm, r.ionad)) continue;
      t.reimsi.set(r.ainm, this.tagairtCineail(r.cineal));
    }
  }

  /**
   * `suim Toradh as Corcaigh { Ceart { … } Earráid { … } }` — §26.
   *
   * Both the sum and every variant go into `cinealacha`, because both are
   * written: `Toradh` in a signature, `Ceart` in a literal and to the right of
   * `is`. That also means a variant name collides with anything else of that
   * name through E208 in the ordinary way, with nothing written here to make
   * it happen.
   *
   * Only the sum claims a province. See `contaeDe`.
   */
  fogairSuim(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    if (this.cinealacha.has(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }
    const contae = this.reitighContae(m.contae);
    this.eiligh(m.ainm, contae, m.contae ? m.contae.ionad : m.ionad);

    // §26.8 — a sum enumerates a choice, so it needs something to choose
    // between. Reported and then carried on with: the declaration is still
    // usable enough to check the rest of the file against, and stopping here
    // would hide every later error behind this one.
    if (m.malairti.length < 2) this.bail.cuir('E214', m.ionad, m.ainm, m.malairti.length);

    const t = { k: 'suim', ainm: m.ainm, contae, malairti: new Map() };
    this.cinealacha.set(m.ainm, t);
    for (const mal of m.malairti) {
      if (!this.seiceailBunfhoirm(mal.ainm, mal.ionad)) continue;
      if (this.cinealacha.has(mal.ainm)) { this.bail.cuir('E208', mal.ionad, mal.ainm); continue; }
      const tm = {
        k: 'malairt', ainm: mal.ainm, suim: m.ainm, contaeSuime: contae, reimsi: new Map(),
      };
      this.cinealacha.set(mal.ainm, tm);
      t.malairti.set(mal.ainm, tm);
    }
  }

  /**
   * Variant field types, and the one new rule: no field may be `Iasacht`.
   *
   * A sum is the language's statement of exactly what a value may be, and
   * `Iasacht` is the statement that its category is unknown. A payload of
   * unknown category inside an enumeration of categories is a sum that has not
   * finished being written, so it is E213 rather than something to normalise
   * away. It is also what forces the conversion to happen at the exile
   * boundary, which is what lets §25.9's third finding actually close.
   *
   * A `struchtúr` field may still be `Iasacht`, and the asymmetry is
   * deliberate: a record is a bag of fields and has never claimed otherwise,
   * while a sum claims to enumerate. Every 0.4–0.7 program keeps compiling.
   */
  socraighMalairti(m) {
    const t = this.cinealacha.get(m.ainm);
    if (!t || t.k !== 'suim') return;
    for (const mal of m.malairti) {
      const tm = t.malairti.get(mal.ainm);
      if (!tm) continue;
      for (const r of mal.reimsi) {
        if (!this.seiceailBunfhoirm(r.ainm, r.ionad)) continue;
        const tr = this.tagairtCineail(r.cineal);
        const iasachtach = tr.k === 'iasacht' || (tr.k === 'liosta' && tr.mir.k === 'iasacht');
        if (iasachtach) {
          this.bail.cuir('E213', r.ionad, m.ainm, mal.ainm, r.ainm, ainmCineail(tr));
          continue;
        }
        tm.reimsi.set(r.ainm, tr);
      }
    }
  }

  fogairBriathar(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    const cineal = {
      k: 'feidhm', modh: m.modh, leanunach: m.leanunach,
      params: [], toradh: NEAMHNI, faighteoir: null,
    };
    m.cineálSocraithe = cineal;

    if (m.faighteoir) {
      // `ó Dhuine` — the method belongs to a category, and `ó` lenites it.
      const res = this.reitighFoirm(m.faighteoir.surface, FOIRM.SEIMHITHE,
        (l) => this.cinealacha.has(l), 'ó');
      if (res.earraid) { this.teip(res, m.faighteoir.ionad, 'E202'); return; }
      const t = this.cinealacha.get(res.lemma);
      if (t.k !== 'struchtúr') { this.bail.cuir('E509', m.faighteoir.ionad, res.lemma); return; }
      if (t.reimsi.has(m.ainm) || t.modhanna.has(m.ainm)) {
        this.bail.cuir('E208', m.ionad, m.ainm); return;
      }
      cineal.faighteoir = t;
      m.jsAinm = `${t.ainm}$${m.ainm}`;
      t.modhanna.set(m.ainm, { cineal, jsAinm: m.jsAinm, modh: m.modh });
      this.modhanna.push(m);
      return;
    }

    if (this.domhanda.faighAitiuil(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }

    // §37 — the autonomous. Its forms are derived here, once, from the lemma,
    // because that is where the lemma is known to be a verb.
    if (m.modh === 'saor') {
      const cead = mf.inShaor(m.ainm);
      if (!cead.ok) { this.bail.cuir('E521', m.ionad, m.ainm, cead.cuis); return; }
      cineal.saor = mf.foirmShaor(m.ainm);
      cineal.saorCaite = mf.foirmShaorChaite(m.ainm);
      this.saorFoirmeacha.set(cineal.saor, { lemma: m.ainm, aimsir: 'láithreach' });
      if (cineal.saorCaite) {
        this.saorFoirmeacha.set(cineal.saorCaite, { lemma: m.ainm, aimsir: 'caite' });
      }
    }

    m.jsAinm = jsAinm(m.ainm);
    this.domhanda.cuir(new Ceangal(m.ainm, cineal, m.modh === 'táscach' ? 'feidhm' : 'gníomh'));
  }

  socraighSiniu(m) {
    const cineal = m.cineálSocraithe;
    if (!cineal) return;
    cineal.params = m.params.map((p) => {
      const t = p.faighteoir ? (cineal.faighteoir || IASACHT) : this.tagairtCineail(p.cineal);
      p.cinealSocraithe = t;
      return t;
    });
    cineal.toradh = m.toradh ? this.tagairtCineail(m.toradh) : NEAMHNI;
  }

  corpBriathair(m) {
    const cineal = m.cineálSocraithe;
    if (!cineal) return;
    const scoip = new Scoip(this.domhanda);
    for (const p of m.params) {
      if (!this.seiceailBunfhoirm(p.ainm, p.ionad)) continue;
      p.ceangal = scoip.cuir(new Ceangal(p.ainm, p.cinealSocraithe || IASACHT, 'luach', !!p.sealadach));
    }

    const roimhe = this.ctx;
    this.ctx = { modh: m.modh, leanunach: m.leanunach, ainm: m.ainm };
    const tugtha = this.bloc(m.corp, scoip);
    this.ctx = roimhe;

    if (m.modh === 'ordaitheach') return;   // an imperative returns nothing
    if (!comhionann(tugtha, cineal.toradh)) {
      this.bail.cuir('E209', (m.corp.luach || m.corp).ionad, m.ainm,
        ainmCineail(cineal.toradh), ainmCineail(tugtha));
    }
  }

  // ---- ráitis --------------------------------------------------------
  bloc(b, tuisScoip, caolu = null) {
    const scoip = new Scoip(tuisScoip);
    b.scoip = scoip;
    // The narrowed binding shadows the outer one for the length of the branch.
    // It is the same lemma with a different type, which is what the copula
    // just established, so it is one more entry in a scope rather than a new
    // concept: `t` inside `má t is Ceart { … }` is a `Ceart`.
    if (caolu) scoip.cuir(new Ceangal(caolu.lemma, caolu.cineal));
    for (const r of b.raitis) this.raiteas(r, scoip);
    if (!b.luach) return NEAMHNI;
    // An imperative body has no return value, so a trailing conditional is a
    // statement rather than the block's value. The parser cannot know which
    // mood it is in; the analyzer does, so it demotes the node here.
    if (this.ctx.modh === 'ordaitheach' && b.luach.cineál === 'Má') {
      const nód = b.luach;
      b.luach = null;
      b.raitis.push(nód);
      this.raiteas(nód, scoip);
      return NEAMHNI;
    }
    const t = this.luach(b.luach, scoip);
    if (this.ctx.modh === 'ordaitheach') this.seiceailLuaite(b.luach, t);
    return t;
  }

  /**
   * A verb standing alone was mentioned and not obeyed. That is E501 whether
   * the mention came from a name or from `a` + verbal noun; the parser cannot
   * catch it, because its lexicon holds the verbs of the language and a
   * parameter of verb type is a bound name rather than a word.
   */
  seiceailLuaite(e, t) {
    if (t && t.k === 'feidhm' && t.modh === 'ordaitheach') {
      this.bail.cuir('E501', e.ionad, e.lemma || e.surface || '?');
    }
  }

  raiteas(r, scoip) {
    switch (r.cineál) {
      case 'Ceangal': {
        const t = this.luach(r.luach, scoip);
        if (!this.seiceailBunfhoirm(r.ainm, r.ionad)) return;
        let dearbh = t;
        if (r.cineal) {
          dearbh = this.tagairtCineail(r.cineal);
          if (!comhionann(dearbh, t)) {
            this.bail.cuir('E201', r.luach.ionad, ainmCineail(dearbh), ainmCineail(t));
          }
        }
        if (scoip.faighAitiuil(r.ainm)) { this.bail.cuir('E208', r.ionad, r.ainm); return; }
        r.ceangal = scoip.cuir(new Ceangal(r.ainm, dearbh, 'luach', !!r.sealadach));
        return;
      }

      case 'Má': {
        this.coinniall(r, scoip);
        const caol = this.caolu(r, scoip);
        // A branch that produces a value in statement position is discarding
        // it, which the indicative does not permit — same rule as E503.
        const craobh = (b, c) => {
          if (b.cineál === 'Má') { this.raiteas(b, scoip); return; }
          const t = this.bloc(b, scoip, c);
          if (b.luach && this.ctx.modh === 'táscach' && !comhionann(t, NEAMHNI)) {
            this.bail.cuir('E503', b.luach.ionad);
          }
        };
        craobh(r.ansin, caol && caol.ansin);
        if (r.eile) craobh(r.eile, caol && caol.eile);
        return;
      }

      // Mutation is a command: `cuir 3 ar chomhaireamh`.
      case 'Cuir': {
        if (this.ctx.modh === 'táscach') this.bail.cuir('E502', r.ionad, 'cuir');
        const tLuach = this.luach(r.luach, scoip);
        // `ar` governs its complement exactly as `ó` does.
        const tSprioc = this.luach(r.sprioc, scoip, FOIRM.SEIMHITHE, 'ar');
        if (!['Aitheantóir', 'Sealbhach'].includes(r.sprioc.cineál)) {
          this.bail.cuir('E511', r.sprioc.ionad);
        } else {
          const fréamh = this.fréamhCheangal(r.sprioc);
          if (fréamh && !fréamh.sealadach) this.bail.cuir('E510', r.ionad, fréamh.lemma);
        }
        if (!comhionann(tSprioc, tLuach)) {
          this.bail.cuir('E201', r.luach.ionad, ainmCineail(tSprioc), ainmCineail(tLuach));
        }
        return;
      }

      case 'Briathar': {
        this.fogairBriathar(r); this.socraighSiniu(r); this.corpBriathair(r); return;
      }

      case 'Struchtúr': {
        this.fogairStruchtur(r); this.socraighReimsi(r); return;
      }

      // An imperative is obeyed, never mentioned.
      case 'Ordú': {
        if (this.ctx.modh === 'táscach') this.bail.cuir('E502', r.ionad, r.ainm);
        // An autonomous form is not a lemma and never will be, so it is
        // resolved through its own table before the ordinary identifier path
        // gets a chance to call it undefined.
        const saorAinm = this.saorFoirmeacha.get(r.ainm);
        const lorg = saorAinm ? saorAinm.lemma : r.ainm;
        const res = this.reitighFoirm(lorg, FOIRM.BUN, (l) => !!scoip.faigh(l), null);
        if (res.earraid) { this.teip(res, r.ionad); return; }
        const c = scoip.faigh(res.lemma);
        if (c.kind !== 'gníomh') {
          this.bail.cuir('E207', r.ionad, ainmCineail(c.cineal)); return;
        }
        // §37 — the form agreement, and the same shape as E512 and E517: what
        // was written against what this position demands.
        if (c.cineal.saor && r.ainm !== c.cineal.saor) {
          if (r.ainm === res.lemma) this.bail.cuir('E518', r.ionad, res.lemma, c.cineal.saor);
          else this.bail.cuir('E519', r.ionad, r.ainm, c.cineal.saor, res.lemma);
          return;
        }
        // The converse: an ordinary imperative written in an autonomous shape
        // resolved to nothing, so it is already E101 and needs no code here.
        r.ceangal = c;

        // Verb government of prepositions: the verb says which phrase, if any,
        // belongs with it. A verb without a frame takes none.
        const frama = c.cineal.frama || null;
        if (frama && !r.fras) { this.bail.cuir('E514', r.ionad, res.lemma, frama); return; }
        if (!frama && r.fras) { this.bail.cuir('E515', r.fras.ionad, res.lemma); return; }

        // A command to an ongoing imperative is sequenced by the imperative
        // itself: it is implicitly completed, so the caller must be ongoing.
        if (c.cineal.leanunach) {
          r.leanunach = true;
          if (!this.ctx.leanunach) this.bail.cuir('E504', r.ionad);
        }
        if (c.cineal.ionsuite === 'déan') { this.deanIteraid(r, scoip, res.lemma); return; }
        this.argointi(r, c.cineal, scoip, res.lemma);
        return;
      }

      case 'Slonn': {
        // In the indicative you mention things, and a mention must be used.
        if (this.ctx.modh === 'táscach') this.bail.cuir('E503', r.ionad);
        // In the imperative you do them: a verb left standing is E501.
        this.seiceailLuaite(r.slonn, this.luach(r.slonn, scoip));
        return;
      }

      default:
        throw new Error(`ráiteas anaithnid: ${r.cineál}`);
    }
  }

  /**
   * The narrowing a condition licenses, or null (§26.3).
   *
   * `má t is Ceart` says that in the affirmative branch `t` is a `Ceart`, and
   * that is elimination: the copula is a predicate over a value, and once the
   * predicate has been asked the answer is known for as long as the branch
   * lasts. Recognised in exactly one shape — an identifier, `is`, a variant of
   * that identifier's own sum — because a wider shape would be inference
   * rather than agreement, and the project has one piece of inference already
   * and confines it to `déan` (§21).
   *
   * **The complement narrows only when the sum has two variants**, because
   * only then is "not `Ceart`" the name of something. With three, the negative
   * branch keeps the sum and the author asks again. That is a real limit and
   * not a temporary one: naming the complement of one variant among many would
   * need anonymous unions, which 0.8 does not have.
   *
   * **Only a `seasmhach` binding narrows.** A `sealadach` one may be assigned
   * inside the branch, and a narrowing that a `cuir` can invalidate is a
   * narrowing that is not true. Essence narrows; accident does not.
   */
  caolu(r, scoip) {
    const c = r.coinniall;
    if (!c || c.cineál !== 'Copail' || c.abhar.cineál !== 'Aitheantóir') return null;
    const lemma = mf.lemmaTuairim(c.abhar.surface);
    const ceangal = scoip.faigh(lemma);
    if (!ceangal || ceangal.kind !== 'luach' || ceangal.sealadach) return null;
    const tS = ceangal.cineal;
    if (!tS || tS.k !== 'suim') return null;
    const tM = tS.malairti.get(c.cineal.ainm);
    if (!tM) return null;                                   // E302 has it, or E202

    let eile = null;
    if (tS.malairti.size === 2) {
      for (const [ainm, t] of tS.malairti) if (ainm !== tM.ainm) eile = t;
    }
    const dearfach = { lemma, cineal: tM };
    const diultach = eile ? { lemma, cineal: eile } : null;
    // `mura t is Ceart` inverts which branch learned what.
    return r.diultach ? { ansin: diultach, eile: dearfach } : { ansin: dearfach, eile: diultach };
  }

  /** Analyse a condition under the particle that governs its verb. */
  coinniall(r, scoip) {
    if (!r.coinniall) return;
    const roimhe = this.rialuBriathair;
    const roimheC = this.copailMhir;
    this.rialuBriathair = r.diultach
      ? mf.RIALU_BRIATHAIR.SPLEACH
      : mf.RIALU_BRIATHAIR.NEAMHSPLEACH;
    // The particle governs the copula the same way it governs `bí`, so it is
    // published the same way: set for the condition, restored after it (§31).
    this.copailMhir = r.copail
      ? { scriofa: r.copail, diultach: r.diultach, ionad: r.ionad }
      : null;
    const c = this.luach(r.coinniall, scoip);
    this.copailMhir = roimheC;
    this.rialuBriathair = roimhe;

    // A fused particle with nothing to classify. `más` is `má` + the copula,
    // so writing it in front of an ordinary condition claims a classification
    // that is not there; the fix is to unfuse it.
    const fusta = r.copail === 'más' || r.copail === 'murab';
    if (fusta && (!r.coinniall || r.coinniall.cineál !== 'Copail')) {
      this.bail.cuir('E517', r.ionad, r.copail, r.diultach ? 'mura' : 'má');
    }
    if (!comhionann(c, BOOL)) this.bail.cuir('E201', r.coinniall.ionad, 'Bool', ainmCineail(c));
  }

  /**
   * `déan <a bhriathar> ar <bailiúchán>` — the action distributed over the
   * members of what `ar` marks.
   *
   * Checked here rather than through the ordinary arity path because the
   * relation between the two halves is a dependency: the verb's one parameter
   * must be the element type of the collection. That is the only piece of
   * inference in the language and it is deliberately confined to this verb —
   * generalising it is what sum types and a real quantifier are for.
   */
  deanIteraid(r, scoip, ainm) {
    if (r.argointi.length !== 1) {
      this.bail.cuir('E206', r.ionad, ainm, 1, r.argointi.length);
      for (const a of r.argointi) this.luach(a, scoip);
      this.luach(r.fras.abhar, scoip, FOIRM.SEIMHITHE, 'ar');
      return;
    }
    const tG = this.luach(r.argointi[0], scoip);
    // `ar` governs its complement here exactly as it does in `cuir … ar …`.
    const tXs = this.luach(r.fras.abhar, scoip, FOIRM.SEIMHITHE, 'ar');

    const mir = tXs.k === 'liosta' ? tXs.mir : (tXs.k === 'iasacht' ? IASACHT : null);
    if (mir === null) {
      this.bail.cuir('E201', r.fras.abhar.ionad, 'Liosta(Iasacht)', ainmCineail(tXs));
      return;
    }
    if (tG.k === 'iasacht') { r.iteraid = true; return; }
    if (tG.k !== 'feidhm' || tG.modh !== 'ordaitheach') {
      this.bail.cuir('E201', r.argointi[0].ionad,
        ainmCineail({ k: 'feidhm', modh: 'ordaitheach', params: [mir], toradh: NEAMHNI }),
        ainmCineail(tG));
      return;
    }
    if ((tG.params || []).length !== 1) {
      this.bail.cuir('E206', r.argointi[0].ionad, ainm, 1, (tG.params || []).length);
      return;
    }
    if (!comhionann(tG.params[0], mir)) {
      this.bail.cuir('E201', r.argointi[0].ionad, ainmCineail(mir), ainmCineail(tG.params[0]));
      return;
    }
    // The aspect of the verb is the aspect of the loop: commands are
    // sequential, so an ongoing verb makes the whole command ongoing.
    if (tG.leanunach) {
      r.leanunach = true;
      if (!this.ctx.leanunach) this.bail.cuir('E504', r.ionad);
    }
    r.iteraid = true;
  }

  /** The binding a `cuir … ar …` target ultimately rests on. */
  fréamhCheangal(e) {
    if (e.cineál === 'Aitheantóir') return e.ceangal || null;
    if (e.cineál === 'Sealbhach') return this.fréamhCheangal(e.sealbhoir);
    return null;
  }

  argointi(nód, cinealF, scoip, ainm) {
    for (const a of nód.argointi) this.luach(a, scoip);
    if (cinealF.params.length !== nód.argointi.length) {
      this.bail.cuir('E206', nód.ionad, ainm, cinealF.params.length, nód.argointi.length);
      return;
    }
    nód.argointi.forEach((a, i) => {
      if (!comhionann(cinealF.params[i], a.cineálSocraithe)) {
        this.bail.cuir('E201', a.ionad, ainmCineail(cinealF.params[i]), ainmCineail(a.cineálSocraithe));
      }
    });
  }

  // ---- sloinn --------------------------------------------------------
  /** An action under way is not a value until `tar éis` completes it. */
  luach(e, scoip, foirm = FOIRM.BUN, oibreoir = null) {
    const t = this.slonn(e, scoip, foirm, oibreoir);
    if (t && t.k === 'arSiúl') {
      this.bail.cuir('E505', e.ionad, ainmCineail(t));
      return t.inner;
    }
    return t;
  }

  /**
   * `foirm` is the grammatical form demanded of the *head* of this phrase by
   * whatever governs it. It propagates to the head daughter only: in
   * `ainm ó athair ó dhuine`, each `ó` lenites the initial word of its own
   * complement, exactly as a preposition does in Irish.
   */
  slonn(e, scoip, foirm = FOIRM.BUN, oibreoir = null) {
    const t = this.slonnInmhe(e, scoip, foirm, oibreoir);
    e.cineálSocraithe = t;
    return t;
  }

  slonnInmhe(e, scoip, foirm, oibreoir) {
    switch (e.cineál) {
      case 'Uimhir': return UIMHIR;
      case 'Teaghrán': return TEAGHRAN;
      case 'Bool': return BOOL;
      case 'Neamhní': return NEAMHNI;

      case 'Liosta': {
        if (!e.mireanna.length) return liosta(IASACHT);
        const ts = e.mireanna.map((m) => this.luach(m, scoip));
        // Until 0.8 a heterogeneous literal widened to `Liosta(Iasacht)`,
        // because there was nothing else to widen it to, and E211 was
        // unreachable as a result. There is now: two variants of one sum meet
        // at the sum. What has no meeting point is an error, which is what
        // E211 has been reserved to say since 0.4 (§26.5).
        let acc = ts[0];
        for (let i = 1; i < ts.length && acc; i++) acc = nasc(acc, ts[i], this.cinealacha);
        // Two variants of one sum meet at the sum, which is new in 0.8 and is
        // what a list of results needs. What has no meeting point still widens
        // to `Liosta(Iasacht)`, and E211 stays unreachable — see §26.7. The
        // reason is `[ainm, aois]` in `sonraí.sb`: a driver's parameter list is
        // legitimately heterogeneous and no sum can or should cover it.
        return liosta(acc || IASACHT);
      }

      // `Router ó "express"` / `ó "express"` — origin, the same relation `ó`
      // always expresses, with a foreign module in the possessor slot.
      case 'Bunús': {
        if (e.ball && e.ball.cineál !== 'Aitheantóir') {
          this.bail.cuir('E401', e.ball.ionad, '"slonn"', '"ball"');
          return IASACHT;
        }
        const siniu = this.modúil.get(e.foinse);
        if (siniu) {
          // A native origin. The member is an Irish lemma with a paradigm, so
          // it goes through the ordinary agreement check in whatever form
          // *this* phrase's own governor demands — base at the top level, as
          // for any head. A foreign member is exempt from all of that, and
          // that exemption is now a statement about the word rather than
          // about the syntax: a foreign name has no mutation slot, the same
          // way `áit` and `stór` have none.
          if (!e.ball) return modul(e.foinse, siniu);
          const r = this.reitighFoirm(e.ball.surface, foirm, (l) => siniu.onnmhairi.has(l), oibreoir);
          if (r.earraid) { this.teip(r, e.ball.ionad, 'E203', e.foinse); return IASACHT; }
          e.ball.lemma = r.lemma;
          e.ball.foirm = foirm;
          const onn = siniu.onnmhairi.get(r.lemma);
          if (onn.kind === 'gníomh') { this.bail.cuir('E501', e.ball.ionad, r.lemma); return IASACHT; }
          return onn.cineal;
        }
        // A borrowed member keeps its borrowed name: you do not get to rename
        // someone else's API by importing it (§7).
        if (e.ball) e.ball.lemma = e.ball.surface;
        return IASACHT;
      }

      case 'Aitheantóir': {
        const res = this.reitighFoirm(e.surface, foirm, (l) => !!scoip.faigh(l), oibreoir);
        if (res.earraid) { this.teip(res, e.ionad); return IASACHT; }
        const c = scoip.faigh(res.lemma);
        if (c.kind === 'gníomh') { this.bail.cuir('E501', e.ionad, res.lemma); return IASACHT; }
        e.ceangal = c;
        e.lemma = c.lemma;
        e.foirm = foirm;
        return c.cineal;
      }

      case 'Sealbhach': {
        // `ó` governs its complement: the head of the possessor phrase lenites.
        const tS = this.luach(e.sealbhoir, scoip, FOIRM.SEIMHITHE, 'ó');
        if (e.ball.cineál !== 'Aitheantóir') {
          this.bail.cuir('E401', e.ball.ionad, '"slonn"', '"ball"');
          return IASACHT;
        }
        // §24.3 — provenance, before agreement. The surface is used in the
        // message because it is what was written; resolution continues either
        // way, so a wrong member in the wrong county reports both faults.
        this.seiceailDuchas(tS, e.ball);
        // The member is the head of *this* phrase, so it takes whatever form
        // this phrase's own governor demands (base at the top level).
        const socraigh = (lemma) => { e.ball.lemma = lemma; e.ball.foirm = foirm; };

        if (tS.k === 'iasacht') {
          const res = this.reitighFoirm(e.ball.surface, foirm, () => true, oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad); return IASACHT; }
          socraigh(res.lemma);
          return IASACHT;
        }

        if (tS.k === 'modúl') {
          // The same relation, a better-typed possessor. `ó` still governs the
          // possessor and the member is still the head of this phrase, so not
          // one line of the government machinery changes — only the question
          // asked of the symbol table.
          const res = this.reitighFoirm(e.ball.surface, foirm,
            (l) => tS.siniu.onnmhairi.has(l), oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', tS.ainm); return IASACHT; }
          socraigh(res.lemma);
          const onn = tS.siniu.onnmhairi.get(res.lemma);
          // Mood survives the boundary, which is the whole point: a
          // cross-module imperative is a command you give, not a value you
          // call and complete.
          if (onn.kind === 'gníomh') { this.bail.cuir('E501', e.ball.ionad, res.lemma); return IASACHT; }
          return onn.cineal;
        }

        if (tS.k === 'liosta') {
          // Library members of a builtin type, reached through the ordinary
          // `ó` relation. Not new syntax, and not a claim about Irish.
          const ballaí = new Map([['fad', UIMHIR], ['folamh', BOOL], ['céad', tS.mir]]);
          const res = this.reitighFoirm(e.ball.surface, foirm, (l) => ballaí.has(l), oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', ainmCineail(tS)); return IASACHT; }
          socraigh(res.lemma);
          e.ionsuite = res.lemma;
          return ballaí.get(res.lemma);
        }

        // A narrowed variant is opened exactly as a struct is: it has fields
        // and `ó` is how fields are read. An *un*-narrowed sum is E205 with no
        // new code, and the message is the right one — you cannot open a box
        // you have not yet identified. Ask the copula first (§26.3).
        if (tS.k !== 'struchtúr' && tS.k !== 'malairt') {
          this.bail.cuir('E205', e.sealbhoir.ionad, ainmCineail(tS)); return IASACHT;
        }

        const res = this.reitighFoirm(e.ball.surface, foirm,
          (l) => tS.reimsi.has(l) || (tS.modhanna && tS.modhanna.has(l)), oibreoir);
        if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', tS.ainm); return IASACHT; }
        socraigh(res.lemma);

        if (tS.reimsi.has(res.lemma)) return tS.reimsi.get(res.lemma);

        // A method: the same `ó` relation, retrieved from the value rather
        // than declared on the category. Receiver drops out of the arity.
        const md = tS.modhanna.get(res.lemma);
        if (md.modh === 'ordaitheach') { this.bail.cuir('E501', e.ball.ionad, res.lemma); return IASACHT; }
        e.modhSpicebag = md;
        return { ...md.cineal, params: md.cineal.params.slice(1) };
      }

      case 'Glao': {
        const tF = this.slonn(e.feidhm, scoip, foirm, oibreoir);
        if (tF.k === 'iasacht') {
          for (const a of e.argointi) this.luach(a, scoip);
          return IASACHT;
        }
        if (tF.k !== 'feidhm') {
          for (const a of e.argointi) this.luach(a, scoip);
          this.bail.cuir('E207', e.ionad, ainmCineail(tF));
          return IASACHT;
        }
        if (tF.modh === 'ordaitheach') {
          for (const a of e.argointi) this.luach(a, scoip);
          this.bail.cuir('E501', e.ionad, e.feidhm.lemma || '?');
          return IASACHT;
        }
        this.argointi(e, tF, scoip, e.feidhm.lemma || e.feidhm.ball?.lemma || '?');
        return tF.leanunach ? arSiul(tF.toradh) : tF.toradh;
      }

      case 'Déantús': {
        const t = this.tagairtCineail(e.cineal);
        // A variant literal is a struct literal. Introduction needed no new
        // syntax and gets none: `Ceart { duine: d }` is the record form the
        // language already had, and every field check below is the one
        // `struchtúr` already used (§26.1).
        if (t.k !== 'struchtúr' && t.k !== 'malairt') {
          if (t.k !== 'iasacht') this.bail.cuir('E205', e.ionad, ainmCineail(t));
          for (const r of e.reimsi) this.luach(r.luach, scoip);
          return IASACHT;
        }
        const tugtha = new Set();
        for (const r of e.reimsi) {
          const tv = this.luach(r.luach, scoip);
          const res = this.reitighFoirm(r.ainm, FOIRM.BUN, (l) => t.reimsi.has(l), null);
          if (res.earraid) { this.teip(res, r.ionad, 'E203', t.ainm); continue; }
          r.lemma = res.lemma;
          tugtha.add(res.lemma);
          const suil = t.reimsi.get(res.lemma);
          if (!comhionann(suil, tv)) {
            this.bail.cuir('E201', r.luach.ionad, ainmCineail(suil), ainmCineail(tv));
          }
        }
        const easpa = [...t.reimsi.keys()].filter((k) => !tugtha.has(k));
        if (easpa.length) this.bail.cuir('E204', e.ionad, t.ainm, easpa);
        return t;
      }

      case 'Dénártha':
        return this.denartha(e, this.luach(e.clé, scoip), this.luach(e.deas, scoip));

      case 'Aonártha': {
        const a = this.luach(e.abhar, scoip);
        if (!comhionann(a, UIMHIR)) this.bail.cuir('E201', e.ionad, 'Uimhir', ainmCineail(a));
        return UIMHIR;
      }

      // §13 — the copula: identification / classification. The right operand
      // is a category, never a value, so this is not `==` with Irish paint.
      case 'Copail': {
        // Taken and cleared before descending, so that a copula nested inside
        // the subject is not checked against the outer particle.
        const mhir = this.copailMhir;
        this.copailMhir = null;
        const tA = this.luach(e.abhar, scoip);
        this.copailMhir = mhir;
        this.foirmChopaile(e, mhir);
        const tC = this.cinealacha.get(e.cineal.ainm);
        if (!tC) { this.bail.cuir('E202', e.cineal.ionad, e.cineal.ainm); return BOOL; }
        // E302 was reserved in 0.4 for a classification that cannot be true
        // and had nothing to fire on, because any value might be anything.
        // A sum is a closed statement of what a value may be, so asking
        // whether a `Toradh` is an `Áit` is now answerable in advance — and
        // answering it is the whole job of the copula (§26.3).
        if (tA.k === 'suim' && tC.k === 'malairt' && !tA.malairti.has(tC.ainm)) {
          this.bail.cuir('E302', e.cineal.ionad, tA.ainm, tC.ainm);
        }
        return BOOL;
      }



      // §14 — the substantive verb: existence / presence, never category.
      // Its *form* agrees with the particle governing the clause, exactly as
      // an identifier's form agrees with `ó`. Its *meaning* never changes.
      case 'Substaint': {
        const ceart = mf.foirmBhriathartha(this.rialuBriathair);
        if (e.surface !== ceart) {
          this.bail.cuir('E512', e.ionad, e.surface, ceart, this.rialuBriathair);
        }
        this.luach(e.abhar, scoip, foirm, oibreoir);
        return BOOL;
      }

      // `a` + lenited verb: the particle that makes a noun of a verb, and so
      // the one licensed way to mention an imperative instead of obeying it.
      case 'Ainmniú': {
        const res = this.reitighFoirm(e.surface, FOIRM.SEIMHITHE,
          (l) => { const c = scoip.faigh(l); return !!c && c.kind !== 'luach'; }, 'a');
        if (res.earraid) { this.teip(res, e.ionad); return IASACHT; }
        const c = scoip.faigh(res.lemma);
        e.ceangal = c;
        return c.cineal;
      }

      // §18 — perfect aspect. `tá sé tar éis scríobh`: the action is over,
      // so what was under way is now a value.
      case 'Críoch': {
        if (!this.ctx.leanunach) this.bail.cuir('E504', e.ionad);
        const t = this.slonn(e.abhar, scoip);
        if (t.k === 'arSiúl') return t.inner;
        if (t.k === 'iasacht') return IASACHT;   // a borrowed promise
        this.bail.cuir('E508', e.ionad, ainmCineail(t));
        return t;
      }

      case 'Má': {
        this.coinniall(e, scoip);
        const caol = this.caolu(e, scoip);
        if (!e.eile) {
          this.bail.cuir('E507', e.ionad);
          this.bloc(e.ansin, scoip, caol && caol.ansin);
          return IASACHT;
        }
        const a = this.bloc(e.ansin, scoip, caol && caol.ansin);
        const b = e.eile.cineál === 'Má'
          ? this.slonn(e.eile, scoip)
          : this.bloc(e.eile, scoip, caol && caol.eile);
        // The branches meet rather than match. One arm yielding `Ceart` and
        // the other `Earráid` is a `Toradh`, not a type error — which is the
        // same join the list literal uses, for the same reason.
        const n = nasc(a, b, this.cinealacha);
        if (!n) {
          this.bail.cuir('E201', e.eile.ionad, ainmCineail(a), ainmCineail(b));
          return a.k === 'iasacht' ? b : a;
        }
        return n;
      }

      default:
        throw new Error(`slonn anaithnid: ${e.cineál}`);
    }
  }

  denartha(e, a, b) {
    const op = e.op;
    if (a.k === 'iasacht' || b.k === 'iasacht') {
      return ['==', '!=', '<', '>', '<=', '>='].includes(op) ? BOOL : IASACHT;
    }
    if (op === '+') {
      if (comhionann(a, UIMHIR) && comhionann(b, UIMHIR)) return UIMHIR;
      if (comhionann(a, TEAGHRAN) && comhionann(b, TEAGHRAN)) return TEAGHRAN;
      this.bail.cuir('E210', e.ionad, op, ainmCineail(a), ainmCineail(b));
      return IASACHT;
    }
    if (['-', '*', '/', '%'].includes(op)) {
      if (comhionann(a, UIMHIR) && comhionann(b, UIMHIR)) return UIMHIR;
      this.bail.cuir('E210', e.ionad, op, ainmCineail(a), ainmCineail(b));
      return UIMHIR;
    }
    if (['<', '>', '<=', '>='].includes(op)) {
      if (!comhionann(a, UIMHIR) || !comhionann(b, UIMHIR)) {
        this.bail.cuir('E210', e.ionad, op, ainmCineail(a), ainmCineail(b));
      }
      return BOOL;
    }
    if (['==', '!='].includes(op)) {
      if (!comhionann(a, b)) this.bail.cuir('E210', e.ionad, op, ainmCineail(a), ainmCineail(b));
      return BOOL;
    }
    throw new Error(`oibreoir anaithnid: ${op}`);
  }
}

function anailisigh(ast, comhthéacs = {}) {
  const a = new Anailiseoir(comhthéacs);
  a.clar(ast);
  return { ast, anailiseoir: a };
}

module.exports = {
  anailisigh, Anailiseoir, Scoip, Ceangal, ainmCineail, comhionann,
  IASACHT, UIMHIR, TEAGHRAN, BOOL, NEAMHNI,
};
