'use strict';

// anailíseoir.js — the grammatical / semantic stage.
//
// Four interleaved jobs:
//  1. Cineálacha  — ordinary static type checking.
//  2. Rialú       — government: a syntactic slot demands a grammatical form
//                   of the head of its complement. `ó` lenites (ó dhuine,
//                   ó Chorcaigh, ó Dhuine).
//  3. Réiteach    — agreement: the surface form written must realise some
//                   bound lemma in the demanded form. One lemma, many surfaces.
//  4. Modh/Aspect — mood: an imperative performs and can't be mentioned; an
//                   indicative produces a nominal and can't be obeyed.
//                   Aspect: `ag` marks an action under way, `tar éis` marks
//                   it complete.
//
// A binding is never split into several symbols — `duine`/`dhuine` are one
// table entry with a paradigm attached.

const mf = require('./morphology');
const { FOIRM } = mf;
const { Bailitheoir } = require('./diagnostics');
const ctae = require('./contaetha');
const tbl = require('./táblaí');

// ── cineálacha ────────────────────────────────────────────────────────
const prim = (ainm) => ({ k: 'bun', ainm });
const UIMHIR = prim('Uimhir');
const TEAGHRAN = prim('Teaghrán');
const BOOL = prim('Bool');
const NEAMHNI = prim('Neamhní');

/**
 * `Iasacht` — "a loan". The type of every value crossing the JS boundary.
 * Vocabulary, not grammar — earns its place by making the copula
 * non-vacuous (`má luach is Uimhir` on a borrowed value is a real question).
 */
const IASACHT = { k: 'iasacht', ainm: 'Iasacht' };

const liosta = (mir) => ({ k: 'liosta', ainm: 'Liosta', mir });
const arSiul = (inner) => ({ k: 'arSiúl', inner });

/** A R336 module reached through `ó`, keeping type, mood and aspect (not `Iasacht`). */
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
    // A variant is named on its own — its own name in the type namespace.
    case 'malairt': return t.ainm;
    case 'suim': return t.ainm;
    // §5.11 — written as the signature writes it, so a mismatch reads back
    // as the declaration that produced it.
    case 'dochar': return `${ainmCineail(t.toradh)} ar ${ainmCineail(t.dochar)}`;
    case 'feidhm': {
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
  // A variant already *is* its sum, so this widening is free and directional
  // (the reverse is the copula's narrowing, which is not free).
  if (isMalairtDe(a, b)) return true;
  // §5.11 — same widening, one level up: inside a verb declared
  // `-> Uimhir ar Earráid`, a bare Uimhir or bare Earráid are both
  // acceptable results. The reverse is `tá … ar …` narrowing, not free —
  // that asymmetry is the whole protection (E523).
  if (a.k === 'dochar' && b.k !== 'dochar') {
    return comhionann(a.toradh, b) || comhionann(a.dochar, b);
  }
  if (a.k !== b.k) return false;
  if (a.k === 'dochar') return comhionann(a.toradh, b.toradh) && comhionann(a.dochar, b.dochar);
  if (a.k === 'liosta') return comhionann(a.mir, b.mir);
  if (a.k === 'arSiúl') return comhionann(a.inner, b.inner);
  if (a.k === 'modúl') return a.ainm === b.ainm;
  if (a.k === 'feidhm') {
    // Mood and aspect are part of a verb's type: gníomh never matches feidhm.
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
 * The type that covers both, or null. Used where two types meet without one
 * being expected: `má` branches and list literal items. Two variants of one
 * sum meet at the sum (what makes a heterogeneous list literal go somewhere,
 * and what makes E211 reachable).
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
  // §5.11 — a verb's Uimhir/Earráid branches meet at the afflicted type.
  // Only fires when `dochrach` is actually set by an `ar` clause, so this
  // never quietly joins two unrelated types.
  if (a.dochrach && !b.dochrach) return { k: 'dochar', toradh: b, dochar: a };
  if (b.dochrach && !a.dochrach) return { k: 'dochar', toradh: a, dochar: b };
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

/** A treaty is unordered, keyed by the sorted pair (county names have spaces). */
const comhaontuEochair = (a, b) => [a, b].sort().join('\u0000');

class Ceangal {
  constructor(lemma, cineal, kind = 'luach', sealadach = false) {
    this.lemma = lemma;
    this.cineal = cineal;
    this.kind = kind;                    // 'luach' | 'feidhm' | 'gníomh'
    // seasmhach = permanent essence; sealadach = current state — the
    // same is/bí split applied to bindings.
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
    // §5.10 — one gender per noun, per module.
    this.inscni = new Map();   // lemma → { inscne, ionad }
    // foinse → síniú, filled by the module graph before analysis. Empty by
    // default, matching pre-module-graph behaviour (every import is a loan).
    this.modúil = comhthéacs.modúil || new Map();
    this.ailiasanna = new Map();   // foinse → the JS alias the backend requires
    /*
     * Where this module is from (§7.3). A mismatch needs two provenances,
     * so the accessing side is the module, not the verb: `as` predicates
     * provenance of things ("nuachtán as Baile Átha Cliath"), not actions.
     * Also engineering: one line per file, no per-verb override, and a
     * receiver-based county would make every method access trivially pass.
     *
     * `deoraíocht` until declared otherwise, so every pre-county program
     * keeps compiling: counties cost nothing until used.
     */
    this.contae = ctae.DEORAIOCHT;
    this.ionadContae = null;
    /*
     * cúige → { contae, struchtúr }. One province, one struct, across the
     * whole graph — an imported type brings its claim with it. Keyed by
     * province (4 slots), not county (32) — that's the 0.7 headline. County
     * is still recorded, since E603 has to say who's sitting there and
     * under what name, and it's what the rivalry table keys on.
     */
    this.cuigeGafa = new Map();
    /*
     * §7.6 — contae → type name, for `stór` types only. The finer
     * registry: an ordinary type claims a province, a table claims a county.
     */
    this.contaeGafa = new Map();
    /*
     * §7.6 — the whole-graph view of tables, for `--graf` and the ceiling.
     * The authoritative fact is `cineal.stor`, which travels through
     * `síniú` on its own; this is just the aggregate view.
     */
    this.tabli = new tbl.ClarlannTablai();
    // Treaties in force in this file. Sorted-pair keys.
    this.comhaontuithe = new Set();
    // Top level is a sequence of commands: imperative, not ongoing.
    this.ctx = { modh: 'ordaitheach', leanunach: false, ainm: '<barr>' };
    // Which form of the substantive verb the surrounding clause selects.
    this.rialuBriathair = mf.RIALU_BRIATHAIR.NEAMHSPLEACH;
    this.copailMhir = null;             // the particle governing the copula (§5.5)
    // surface → { lemma, foirm } for every autonomous verb in scope.
    this.saorFoirmeacha = new Map();
    this.tusaigh();
  }

  tusaigh() {
    this.domhanda.cuir(new Ceangal('scríobh', {
      k: 'feidhm', modh: 'ordaitheach', leanunach: false,
      params: [IASACHT], toradh: NEAMHNI,
    }, 'gníomh'));

    /*
     * `déan a fhógair ar dhaoine` — iteration. `déan` is the Irish light
     * verb turning a verbal noun into a performed action, distributing over
     * a plural object. Nothing new grammatically: `déan` is a bare
     * imperative root, `a fhógair` the existing nominalising particle, `ar`
     * the existing preposition. Only addition: `déan` lexically selects `ar`.
     * Its argument must be a `gníomh` (a `feidhm`'s result would be discarded, E503).
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
   * Bring an imported module's vocabulary in before anything local is
   * declared, so a collision is E208 in the ordinary way. Verbs come in
   * unqualified (vocabulary, not a possession — `ó` builds noun phrases and
   * E501 says an imperative isn't one). Values stay qualified through `ó`.
   */
  iompórtail() {
    let uimh = 0;
    for (const [foinse, siniu] of this.modúil) {
      const ailias = `__m${uimh++}`;
      this.ailiasanna.set(foinse, ailias);

      for (const [ainm, t] of siniu.cinealacha) {
        if (!this.cinealacha.has(ainm)) this.cinealacha.set(ainm, t);
        // §7.6 — a table arrives with its type, via the marker on the type
        // record, the same way county does.
        if (t.stor) this.tabli.cuir(ainm, t.contae, t.stor.reimsi || [], siniu.ionad);
        if (!t.contae || t.contae === ctae.DEORAIOCHT) continue;
        this.eiligh(ainm, t.contae, siniu.ionad, !!t.stor);
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
      // Autonomous forms are re-derived, not carried, since the lemma is
      // what was exported and the form follows from the lemma.
      if (onn.cineal && onn.cineal.saor) {
        gniomhartha.add(onn.cineal.saor); briathra.add(onn.cineal.saor);
        if (onn.cineal.saorCaite) {
          gniomhartha.add(onn.cineal.saorCaite); briathra.add(onn.cineal.saorCaite);
        }
      }
    }
    // The module's own county rides along purely for `--graf` — nothing on
    // the importing side ever reads it (reading vocabulary isn't trade).
    return { onnmhairi, cinealacha, gniomhartha, briathra, ionad, contae: this.contae };
  }

  // ---- government + agreement -----------------------------------------
  /**
   * The lemma a surface form stands for, or null. Split out of
   * `reitighFoirm` since `i`'s allomorph needs the lemma first (§5.2): the
   * particle picks its shape from the governed word's first letter, so the
   * lemma has to be resolved before the demanded form is known.
   */
  lemmaCeangailte(surface, lemmaAnn) {
    const lemma = mf.lemmaTuairim(surface);
    if (lemmaAnn(lemma)) return lemma;
    if (mf.cosuilLeUru(surface)) {
      for (const iarracht of mf.lemmaiFaoiUru(surface)) {
        if (lemmaAnn(iarracht)) return iarracht;
      }
    }
    return null;
  }

  reitighFoirm(surface, foirm, lemmaAnn, oibreoir) {
    // An eclipsed surface is recognised here so `i` can license it (0.13),
    // whereas before it was recognised only to refuse it (E108).
    const lemma = this.lemmaCeangailte(surface, lemmaAnn);
    if (lemma === null) return { earraid: ['E101', mf.lemmaTuairim(surface)] };

    const ceart = mf.foirmDe(lemma, foirm);
    if (ceart === surface) return { lemma };

    const scriobhSeimhithe = mf.cosuilLeSeimhiu(surface);
    const scriobhUraithe = mf.cosuilLeUru(surface);
    const inSeim = mf.inSeimhithe(lemma);
    const inUr = mf.inUraithe(lemma);

    // Six arms, three per mutation, in parallel order: can't take this
    // mutation, position didn't license it, position demanded it and didn't
    // get it.
    if (scriobhSeimhithe && !inSeim.ok) return { earraid: ['E104', lemma, inSeim.cuis] };
    if (scriobhUraithe && !inUr.ok) return { earraid: ['E114', lemma, inUr.cuis] };
    if (scriobhSeimhithe && foirm !== FOIRM.SEIMHITHE) {
      return { earraid: ['E103', surface, lemma] };
    }
    if (scriobhUraithe && foirm !== FOIRM.URAITHE) {
      return { earraid: ['E113', surface, lemma] };
    }
    if (!scriobhSeimhithe && foirm === FOIRM.SEIMHITHE) {
      return { earraid: ['E102', surface, ceart, oibreoir || 'ó'] };
    }
    if (!scriobhUraithe && foirm === FOIRM.URAITHE) {
      return { earraid: ['E112', surface, ceart, oibreoir || 'i'] };
    }
    return { earraid: ['E105', surface, lemma, ceart] };
  }

  /**
   * The copula's agreement check. `bí` alternates independent/dependent
   * against `rialuBriathair`; the copula fuses with its particle and is
   * checked against `copailMhir`, chosen by particle + the first letter of
   * the type name after it.
   *
   *   más Ceart toradh      má   + is,  consonant → más
   *   murab Easpa toradh    mura + is,  vowel     → murab
   *   is Ceart              ungoverned              → independent form
   */
  foirmChopaile(e, mhir) {
    if (!mhir) return;
    const rialu = mhir.diultach ? mf.RIALU_COPAIL.MURA : mf.RIALU_COPAIL.MA;
    // Guarded, since only MA/MURA are constructible above; kept so this
    // still can't fire when a fifth particle is added.
    if (!mf.cealBeo(rialu)) return;
    const ceart = mf.foirmChopail(rialu, e.cineal.ainm);
    // A separate `is` after the particle is the old word order: a missing
    // fusion, not a wrong allomorph, so named as what was actually written.
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
   * `as` demands FOIRM.BUN through the same `reitighFoirm` everything else
   * uses, so it adds no fifth mechanism. Only the head word is governed —
   * multi-word names like `Uíbh Fhailí` are frozen and untouched.
   */
  reitighContae(nód) {
    if (!nód) return ctae.DEORAIOCHT;
    const [ceann, ...eile] = nód.focail;
    if (ceann === ctae.DEORAIOCHT) { this.bail.cuir('E605', nód.ionad); return ctae.DEORAIOCHT; }
    const res = this.reitighFoirm(ceann, FOIRM.BUN, (l) => ctae.isCeannAinm(l), 'as');
    if (res.earraid) { this.teip(res, nód.ionad, 'E602'); return ctae.DEORAIOCHT; }
    const ainm = [res.lemma, ...eile].join(' ');
    if (!ctae.isContae(ainm)) { this.bail.cuir('E602', nód.ionad, ainm); return ctae.DEORAIOCHT; }
    return ainm;
  }

  /**
   * The county a possessor carries, or null if provenance doesn't apply.
   * A struct instance and `Iasacht` are things you hold; a R336 module, a
   * list and a primitive are not (reading a module's vocabulary isn't trade).
   * A foreign JS module IS treated as `Iasacht`/exile — it's a borrowed thing.
   */
  contaeDe(t) {
    if (!t) return null;
    if (t.k === 'iasacht') return ctae.DEORAIOCHT;
    if (t.k === 'struchtúr') return t.contae || ctae.DEORAIOCHT;
    if (t.k === 'suim') return t.contae || ctae.DEORAIOCHT;
    // A variant answers with the sum's county and holds none of its own —
    // the sum claims the province, the variant is a name it goes by.
    if (t.k === 'malairt') return t.contaeSuime || ctae.DEORAIOCHT;
    return null;
  }

  /**
   * The border check on `ó` (§7.2). Two rules, in this order:
   *
   * Rivals never trade — the veto sits above the four cases as a
   * precondition, not inside one of them; no treaty between rivals can
   * exist (E608). Exile is nobody's rival, so this never fires pre-county-system.
   *
   * Otherwise, the border: same province passes, and since
   * cuigeDe(deoraíocht) = deoraíocht, exile-vs-exile passes through the same
   * equality rather than a second branch — why every pre-county program
   * still compiles untouched.
   *
   * Construction, argument passing and returns are never checked — a
   * county is a lock on the box, not a border on the road.
   */
  seiceailDuchas(t, ball) {
    const as = this.contaeDe(t);
    if (as === null) return;
    if (ctae.isIomaiocht(as, this.contae)) {
      this.bail.cuir('E609', ball.ionad, ball.surface, as, this.contae);
      return;
    }
    if (ctae.cuigeDe(as) === ctae.cuigeDe(this.contae)) return;
    // The only place a treaty is consulted. `fogairComhaontu` never keys a
    // pair containing `deoraíocht`, so exile trades with nobody as a
    // consequence of the table rather than a rule about it.
    if (this.comhaontuithe.has(comhaontuEochair(as, this.contae))) return;
    this.bail.cuir('E601', ball.ionad, ball.surface, as, this.contae);
  }

  /** Declarations name the lemma, so must be written in the base form. */
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
      return this.dochraigh(ref, liosta(this.tagairtCineail(ref.argointi[0])));
    }
    const t = this.cinealacha.get(ref.ainm);
    if (!t) { this.bail.cuir('E202', ref.ionad, ref.ainm); return IASACHT; }
    if (ref.argointi && ref.argointi.length) {
      this.bail.cuir('E212', ref.ionad, ref.ainm, 0, ref.argointi.length);
    }
    return this.dochraigh(ref, t);
  }

  /**
   * §5.11 — `Uimhir ar Earráid`. The affliction wraps the result instead of
   * sitting beside it, so every existing type check sees it automatically.
   * The adverse type must be a declared struct/sum/variant: a bare number
   * isn't a misfortune, and `Iasacht` is exactly "category unknown" — E213's
   * argument one level up.
   */
  dochraigh(ref, t) {
    if (!ref.dochar) return t;
    const td = this.tagairtCineail(ref.dochar);
    if (!['struchtúr', 'suim', 'malairt'].includes(td.k)) {
      this.bail.cuir('E525', ref.dochar.ionad, ainmCineail(td));
      return t;
    }
    // Declaring an affliction is what makes a type an affliction — `nasc` relies on this.
    td.dochrach = true;
    return { k: 'dochar', toradh: t, dochar: td };
  }

  // ---- clár ----------------------------------------------------------
  clar(ast) {
    const briathra = [];
    const raitis = [];

    // Pass 0 — imported lexicon, before anything local exists.
    this.iompórtail();
    ast.ailiasanna = this.ailiasanna;

    // Pass 0b — this module's own county, before anything can be judged
    // against it.
    for (const m of ast.mireanna) if (m.cineál === 'Contae') this.fogairContaeModuil(m);

    // Pass 0c — treaties in force here, before any access is judged
    // (file-scoped, so order in the file doesn't matter).
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
   * `comhaontú Corcaigh Ciarraí` — bilateral, file-scoped, in force
   * regardless of where in the file it's written. Symmetric (sorted-pair
   * key, so writing it either way names the same treaty — second writing is
   * E607). Not transitive, deliberately: A-B + B-C doesn't give A-C, since
   * transitivity would silently partition the 32 into blocs.
   *
   * File-scoped and not in the signature: a treaty is a property of a
   * place, not a value. `deoraíocht` can't be a party — already refused by
   * E605 before this runs.
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
   * Claim a place for a placed type, and report who holds it (§7.2, §7.6).
   * Two granularities: an ordinary type claims a PROVINCE (4 slots), a
   * `stór` type claims a COUNTY (32 slots) — a type is the vocabulary of a
   * region, a table is a building in one town.
   *
   * The two registries collide deliberately: a table blocks the whole
   * province from an ordinary claim, and an ordinary claim blocks every
   * county in its province from holding a table. `stór` doesn't remove a
   * type from contention, it changes the shape of its claim.
   */
  eiligh(ainm, contae, ionad, stor = false) {
    if (contae === ctae.DEORAIOCHT) return;
    const cuige = ctae.cuigeDe(contae);
    const gafa = this.cuigeGafa.get(cuige);

    if (stor) {
      const tabla = this.contaeGafa.get(contae);
      if (tabla && tabla !== ainm) {
        this.bail.cuir('E612', ionad, contae, tabla);
        return;
      }
      if (gafa && gafa.struchtur !== ainm) {
        this.bail.cuir('E603', ionad, cuige, gafa.contae, gafa.struchtur);
        return;
      }
      this.contaeGafa.set(contae, ainm);
      return;
    }

    if (gafa && gafa.struchtur !== ainm) {
      this.bail.cuir('E603', ionad, cuige, gafa.contae, gafa.struchtur);
      return;
    }
    // A province claim sweeps its own counties, since a table might already
    // be sitting in one.
    for (const c of ctae.contaethaCuige(cuige)) {
      const tabla = this.contaeGafa.get(c);
      if (tabla && tabla !== ainm) {
        this.bail.cuir('E603', ionad, cuige, c, tabla);
        return;
      }
    }
    this.cuigeGafa.set(cuige, { contae, struchtur: ainm });
  }

  /**
   * §5.10 — the gender a *type declaration* states, and whether the form
   * matches. `firinscneach`/`baininscneach` are adjectives, so the
   * declaration checks itself. Optional: nothing yet demands agreement with
   * a type's gender, so requiring it would be ceremony against a rule that
   * doesn't exist. Masculine by default when absent.
   */
  inscneFhogartha(ainm, aid) {
    if (!aid) return mf.INSCNE.FIR;
    const dearbhaithe = aid.bun === 'baininscneach' ? mf.INSCNE.BAIN : mf.INSCNE.FIR;
    const foirm = mf.inscneOFhoirm(aid.scriofa, aid.bun);
    if (foirm !== dearbhaithe) {
      this.bail.cuir('E526', aid.ionad, ainm, aid.scriofa,
        mf.foirmAidiachta(aid.bun, dearbhaithe), mf.ainmInscne(dearbhaithe));
    }
    return dearbhaithe;
  }

  /**
   * §5.10 — the gender a *binding* states: its own state adjective's form
   * IS the declaration, nothing new needed. One gender per lemma per
   * module — a second, different spelling is E527, naming the first-seen line.
   */
  inscneCheangail(ainm, aid) {
    if (!aid) return null;                      // a receiver: no adjective slot
    const inscne = mf.inscneOFhoirm(aid.scriofa, aid.bun) || mf.INSCNE.FIR;
    const roimhe = this.inscni.get(ainm);
    if (roimhe && roimhe.inscne !== inscne) {
      this.bail.cuir('E527', aid.ionad, ainm, mf.ainmInscne(roimhe.inscne),
        mf.foirmAidiachta(aid.bun, roimhe.inscne), roimhe.ionad.line);
      return roimhe.inscne;
    }
    if (!roimhe) this.inscni.set(ainm, { inscne, ionad: aid.ionad });
    return inscne;
  }

  fogairStruchtur(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    if (this.cinealacha.has(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }
    const contae = this.reitighContae(m.contae);
    // §7.6 — exile isn't a place, so a table has nowhere to sit.
    if (m.stor && contae === ctae.DEORAIOCHT) this.bail.cuir('E610', m.stor, m.ainm);
    const stor = !!m.stor && contae !== ctae.DEORAIOCHT;
    this.eiligh(m.ainm, contae, m.contae && m.contae.ionad, stor);
    this.cinealacha.set(m.ainm, {
      k: 'struchtúr', ainm: m.ainm, reimsi: new Map(), modhanna: new Map(), contae,
      inscne: this.inscneFhogartha(m.ainm, m.inscne),
      // Field names aren't known until pass A2, filled in `socraighReimsi`.
      stor: stor
        ? { tabla: tbl.ainmTabla(m.ainm), reimsi: null, ionad: m.stor }
        : null,
    });
  }

  socraighReimsi(m) {
    const t = this.cinealacha.get(m.ainm);
    if (!t || t.k !== 'struchtúr') return;
    for (const r of m.reimsi) {
      if (!this.seiceailBunfhoirm(r.ainm, r.ionad)) continue;
      t.reimsi.set(r.ainm, this.tagairtCineail(r.cineal));
    }
    // §7.6 — the column list is the declared field list, no second place to write it.
    if (t.stor) {
      t.stor.reimsi = [...t.reimsi.keys()];
      this.tabli.cuir(m.ainm, t.contae, t.stor.reimsi, t.stor.ionad);
    }
  }

  /**
   * `suim Toradh firinscneach as Corcaigh { Ceart { … } Earráid { … } }`
   * Both the sum and every variant go into `cinealacha`, since both are
   * written (Toradh in a signature, Ceart in a literal or after `is`). Only
   * the sum claims a province — see `contaeDe`.
   */
  fogairSuim(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    if (this.cinealacha.has(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }
    const contae = this.reitighContae(m.contae);
    this.eiligh(m.ainm, contae, m.contae ? m.contae.ionad : m.ionad);

    // Reported, then carried on with, so later errors aren't hidden behind this one.
    if (m.malairti.length < 2) this.bail.cuir('E214', m.ionad, m.ainm, m.malairti.length);

    const t = {
      k: 'suim', ainm: m.ainm, contae, malairti: new Map(),
      inscne: this.inscneFhogartha(m.ainm, m.inscne),
    };
    this.cinealacha.set(m.ainm, t);
    for (const mal of m.malairti) {
      if (!this.seiceailBunfhoirm(mal.ainm, mal.ionad)) continue;
      if (this.cinealacha.has(mal.ainm)) { this.bail.cuir('E208', mal.ionad, mal.ainm); continue; }
      const tm = {
        k: 'malairt', ainm: mal.ainm, suim: m.ainm, contaeSuime: contae, reimsi: new Map(),
        inscne: this.inscneFhogartha(mal.ainm, mal.inscne),
      };
      this.cinealacha.set(mal.ainm, tm);
      t.malairti.set(mal.ainm, tm);
    }
  }

  /**
   * Variant field types, and the one new rule: no field may be `Iasacht`.
   * A sum enumerates exactly what a value may be; `Iasacht` is "unknown",
   * so it can't sit inside an enumeration of categories. Struct fields can
   * still be `Iasacht` — a record never claimed to enumerate anything.
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
      // `ó Dhuine` — the method belongs to a category, `ó` lenites it.
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

    // §8 — autonomous forms derived here, once, from the lemma.
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
    if (cineal.toradh.k === 'dochar') cineal.dochar = cineal.toradh.dochar;
  }

  corpBriathair(m) {
    const cineal = m.cineálSocraithe;
    if (!cineal) return;
    const scoip = new Scoip(this.domhanda);
    for (const p of m.params) {
      if (!this.seiceailBunfhoirm(p.ainm, p.ionad)) continue;
      p.ceangal = scoip.cuir(new Ceangal(p.ainm, p.cinealSocraithe || IASACHT, 'luach', !!p.sealadach));
      // A parameter with no adjective declares no gender: keeps whatever
      // the module already recorded, or masculine by default.
      p.ceangal.inscne = this.inscneCheangail(p.ainm, p.aidiacht)
        || (this.inscni.get(p.ainm) || {}).inscne || null;
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
    // The narrowed binding shadows the outer one for the branch.
    if (caolu) scoip.cuir(new Ceangal(caolu.lemma, caolu.cineal));
    for (const r of b.raitis) this.raiteas(r, scoip);
    if (!b.luach) return NEAMHNI;
    // An imperative body has no return value, so a trailing conditional
    // used as a statement gets demoted by the analyzer (the parser can't
    // know the mood).
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

  /** A verb standing alone was mentioned, not obeyed — E501, whether via a name or `a`+verbal noun. */
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
          if (!comhionann(dearbh, t)) this.mismeaitseail(r.luach.ionad, dearbh, t);
        }
        if (scoip.faighAitiuil(r.ainm)) { this.bail.cuir('E208', r.ionad, r.ainm); return; }
        r.ceangal = scoip.cuir(new Ceangal(r.ainm, dearbh, 'luach', !!r.sealadach));
        r.ceangal.inscne = this.inscneCheangail(r.ainm, r.aidiacht);
        return;
      }

      case 'Má': {
        this.coinniall(r, scoip);
        const caol = this.caolu(r, scoip);
        // A branch producing a value in statement position discards it,
        // which the indicative doesn't permit — same rule as E503.
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

      case 'Cuir': {
        if (this.ctx.modh === 'táscach') this.bail.cuir('E502', r.ionad, 'cuir');

        /*
         * §7.6 — `cuir duine i stór`, the write. Learns almost nothing:
         * mood already covered by E502 above; aspect already ongoing by
         * construction (E504); type check via `struchtúr`/`stór`; county
         * unchecked (passing an argument isn't a member read); government
         * routes through the same `reitighFoirm`. No bulk write — `déan V
         * ar Xs` wants a gníomh(T) and this is a frame, not a verb.
         */
        if (r.reamhfhocal === 'i') {
          r.leanunach = true;
          if (!this.ctx.leanunach) this.bail.cuir('E504', r.ionad);

          const tScriofa = this.luach(r.luach, scoip);
          if (tScriofa && tScriofa.k === 'struchtúr' && tScriofa.stor) r.cineálStoir = tScriofa;
          else this.bail.cuir('E611', r.luach.ionad, ainmCineail(tScriofa || IASACHT));

          // The destination is an argument, not a binding: named rather
          // than walked, no fréamhCheangal, no E510.
          if (r.stor.cineál !== 'Aitheantóir') {
            this.bail.cuir('E511', r.stor.ionad, 'i');
            return;
          }

          // The particle is chosen by the word it governs, so the lemma
          // must be recovered first (§5.2, mf.mirI).
          const lemma = this.lemmaCeangailte(r.stor.surface, (l) => !!scoip.faigh(l));
          const { mir, foirm } = mf.mirI(lemma || r.stor.surface);
          if (r.mirScriofa !== mir) {
            this.bail.cuir('E111', r.ionadMhir, r.mirScriofa, mir, lemma || r.stor.surface);
          }
          const tStor = this.luach(r.stor, scoip, foirm, mir);
          if (tStor && tStor.k !== 'iasacht') {
            this.bail.cuir('E201', r.stor.ionad, 'Iasacht', ainmCineail(tStor));
          }
          return;
        }

        const tLuach = this.luach(r.luach, scoip);
        const tSprioc = this.luach(r.sprioc, scoip, FOIRM.SEIMHITHE, 'ar');
        if (!['Aitheantóir', 'Sealbhach'].includes(r.sprioc.cineál)) {
          this.bail.cuir('E511', r.sprioc.ionad);
        } else {
          const fréamh = this.fréamhCheangal(r.sprioc);
          if (fréamh && !fréamh.sealadach) this.bail.cuir('E510', r.ionad, fréamh.lemma);
        }
        if (!comhionann(tSprioc, tLuach)) this.mismeaitseail(r.luach.ionad, tSprioc, tLuach);
        return;
      }

      case 'Briathar': {
        this.fogairBriathar(r); this.socraighSiniu(r); this.corpBriathair(r); return;
      }

      case 'Struchtúr': {
        this.fogairStruchtur(r); this.socraighReimsi(r); return;
      }

      case 'Ordú': {
        if (this.ctx.modh === 'táscach') this.bail.cuir('E502', r.ionad, r.ainm);
        // An autonomous form is resolved through its own table before the
        // ordinary identifier path can call it undefined.
        const saorAinm = this.saorFoirmeacha.get(r.ainm);
        const lorg = saorAinm ? saorAinm.lemma : r.ainm;
        const res = this.reitighFoirm(lorg, FOIRM.BUN, (l) => !!scoip.faigh(l), null);
        if (res.earraid) { this.teip(res, r.ionad); return; }
        const c = scoip.faigh(res.lemma);
        if (c.kind !== 'gníomh') {
          this.bail.cuir('E207', r.ionad, ainmCineail(c.cineal)); return;
        }
        // §8 — same shape as E512/E517: what was written vs what this position demands.
        if (c.cineal.saor && r.ainm !== c.cineal.saor) {
          if (r.ainm === res.lemma) this.bail.cuir('E518', r.ionad, res.lemma, c.cineal.saor);
          else this.bail.cuir('E519', r.ionad, r.ainm, c.cineal.saor, res.lemma);
          return;
        }
        r.ceangal = c;

        // Verb government of prepositions.
        const frama = c.cineal.frama || null;
        if (frama && !r.fras) { this.bail.cuir('E514', r.ionad, res.lemma, frama); return; }
        if (!frama && r.fras) { this.bail.cuir('E515', r.fras.ionad, res.lemma); return; }

        // A command to an ongoing imperative is implicitly completed, so
        // the caller must itself be ongoing.
        if (c.cineal.leanunach) {
          r.leanunach = true;
          if (!this.ctx.leanunach) this.bail.cuir('E504', r.ionad);
        }
        if (c.cineal.ionsuite === 'déan') { this.deanIteraid(r, scoip, res.lemma); return; }
        this.argointi(r, c.cineal, scoip, res.lemma);
        return;
      }

      case 'Slonn': {
        if (this.ctx.modh === 'táscach') this.bail.cuir('E503', r.ionad);
        this.seiceailLuaite(r.slonn, this.luach(r.slonn, scoip));
        return;
      }

      default:
        throw new Error(`ráiteas anaithnid: ${r.cineál}`);
    }
  }

  /**
   * The narrowing a condition licenses, or null. `má t is Ceart` says `t`
   * is a `Ceart` in the affirmative branch — the copula predicate, once
   * asked, holds for the branch's duration. Recognised in exactly one
   * shape (identifier, `is`, a variant of that identifier's sum) rather
   * than by inference.
   *
   * The complement only narrows when the sum has exactly two variants,
   * since "not Ceart" only names something real with one alternative. With
   * three or more the negative branch keeps the whole sum.
   *
   * Only a `seasmhach` binding narrows — a `sealadach` one could be
   * reassigned inside the branch, invalidating the narrowing.
   */
  caolu(r, scoip) {
    const c = r.coinniall;
    if (c && c.cineál === 'Dochar') return this.caoluDochair(r, c, scoip);
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

  /**
   * §5.11 — narrowing through `tá Earráid ar thoradh`. The second shape
   * `caolu` recognises. Both branches learn something here (an affliction
   * is binary, no complement to name). Only `seasmhach` narrows, same reason
   * as above.
   */
  caoluDochair(r, c, scoip) {
    if (c.abhar.cineál !== 'Aitheantóir') return null;
    const lemma = mf.lemmaTuairim(c.abhar.surface);
    const ceangal = scoip.faigh(lemma);
    if (!ceangal || ceangal.kind !== 'luach' || ceangal.sealadach) return null;
    const t = ceangal.cineal;
    if (!t || t.k !== 'dochar') return null;
    const dearfach = { lemma, cineal: t.dochar };
    const diultach = { lemma, cineal: t.toradh };
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
    this.copailMhir = r.copail
      ? { scriofa: r.copail, diultach: r.diultach, ionad: r.ionad }
      : null;
    const c = this.luach(r.coinniall, scoip);
    this.copailMhir = roimheC;
    this.rialuBriathair = roimhe;

    // A fused particle with nothing to classify: `más` in front of a
    // non-copular condition claims a classification that isn't there.
    const fusta = r.copail === 'más' || r.copail === 'murab';
    if (fusta && (!r.coinniall || r.coinniall.cineál !== 'Copail')) {
      this.bail.cuir('E517', r.ionad, r.copail, r.diultach ? 'mura' : 'má');
    }
    if (!comhionann(c, BOOL)) this.bail.cuir('E201', r.coinniall.ionad, 'Bool', ainmCineail(c));
  }

  /**
   * `déan <a bhriathar> ar <bailiúchán>` — the one place the language
   * infers anything: checks the verb's parameter against the collection's
   * element type, then runs it once per element.
   */
  deanIteraid(r, scoip, ainm) {
    if (r.argointi.length !== 1) {
      this.bail.cuir('E206', r.ionad, ainm, 1, r.argointi.length);
      for (const a of r.argointi) this.luach(a, scoip);
      this.luach(r.fras.abhar, scoip, FOIRM.SEIMHITHE, 'ar');
      return;
    }
    const tG = this.luach(r.argointi[0], scoip);
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
    // Commands are sequential, so an ongoing verb makes the whole loop ongoing.
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

  /**
   * §5.11 — the protection, always just a mismatch report with a better
   * message: a value that may be afflicted isn't its result type until
   * the affliction's ruled out, so every existing check already refuses it.
   */
  mismeaitseail(ionad, suil, fuarthas) {
    if (fuarthas && fuarthas.k === 'dochar' && comhionann(suil, fuarthas.toradh)) {
      this.bail.cuir('E523', ionad, ainmCineail(fuarthas.dochar), ainmCineail(fuarthas.toradh));
      return;
    }
    this.bail.cuir('E201', ionad, ainmCineail(suil), ainmCineail(fuarthas));
  }

  argointi(nód, cinealF, scoip, ainm) {
    for (const a of nód.argointi) this.luach(a, scoip);
    if (cinealF.params.length !== nód.argointi.length) {
      this.bail.cuir('E206', nód.ionad, ainm, cinealF.params.length, nód.argointi.length);
      return;
    }
    nód.argointi.forEach((a, i) => {
      if (!comhionann(cinealF.params[i], a.cineálSocraithe)) {
        this.mismeaitseail(a.ionad, cinealF.params[i], a.cineálSocraithe);
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
   * `foirm` is the grammatical form demanded of the head of this phrase.
   * It propagates to the head daughter only: in `ainm ó athair ó dhuine`
   * each `ó` lenites the initial word of its own complement.
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
        // Two variants of one sum meet at the sum; what has no meeting
        // point still widens to Liosta(Iasacht) — a driver's parameter list
        // is legitimately heterogeneous, so E211 stays reserved.
        let acc = ts[0];
        for (let i = 1; i < ts.length && acc; i++) acc = nasc(acc, ts[i], this.cinealacha);
        return liosta(acc || IASACHT);
      }

      // `Router ó "express"` / `ó "express"` — origin, same relation `ó`
      // always expresses, with a foreign module as possessor.
      case 'Bunús': {
        if (e.ball && e.ball.cineál !== 'Aitheantóir') {
          this.bail.cuir('E401', e.ball.ionad, '"slonn"', '"ball"');
          return IASACHT;
        }
        const siniu = this.modúil.get(e.foinse);
        if (siniu) {
          // A native origin — the member is an Irish lemma with a paradigm,
          // governed like any other head.
          if (!e.ball) return modul(e.foinse, siniu);
          const r = this.reitighFoirm(e.ball.surface, foirm, (l) => siniu.onnmhairi.has(l), oibreoir);
          if (r.earraid) { this.teip(r, e.ball.ionad, 'E203', e.foinse); return IASACHT; }
          e.ball.lemma = r.lemma;
          e.ball.foirm = foirm;
          const onn = siniu.onnmhairi.get(r.lemma);
          if (onn.kind === 'gníomh') { this.bail.cuir('E501', e.ball.ionad, r.lemma); return IASACHT; }
          return onn.cineal;
        }
        // A borrowed member keeps its exact spelling — you don't get to
        // rename someone else's API.
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
        // `ó` governs its complement.
        const tS = this.luach(e.sealbhoir, scoip, FOIRM.SEIMHITHE, 'ó');
        if (e.ball.cineál !== 'Aitheantóir') {
          this.bail.cuir('E401', e.ball.ionad, '"slonn"', '"ball"');
          return IASACHT;
        }
        // §5.11 — an unidentified afflicted value possesses nothing yet.
        if (tS && tS.k === 'dochar') {
          this.bail.cuir('E523', e.sealbhoir.ionad,
            ainmCineail(tS.dochar), ainmCineail(tS.toradh));
          return IASACHT;
        }
        // §7.2 — provenance, before agreement.
        this.seiceailDuchas(tS, e.ball);
        const socraigh = (lemma) => { e.ball.lemma = lemma; e.ball.foirm = foirm; };

        if (tS.k === 'iasacht') {
          const res = this.reitighFoirm(e.ball.surface, foirm, () => true, oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad); return IASACHT; }
          socraigh(res.lemma);
          return IASACHT;
        }

        if (tS.k === 'modúl') {
          const res = this.reitighFoirm(e.ball.surface, foirm,
            (l) => tS.siniu.onnmhairi.has(l), oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', tS.ainm); return IASACHT; }
          socraigh(res.lemma);
          const onn = tS.siniu.onnmhairi.get(res.lemma);
          // Mood survives the boundary — a cross-module gníomh is a command
          // given, not a value called and completed.
          if (onn.kind === 'gníomh') { this.bail.cuir('E501', e.ball.ionad, res.lemma); return IASACHT; }
          return onn.cineal;
        }

        if (tS.k === 'liosta') {
          // Built-in list members, reached the ordinary `ó` way.
          const ballaí = new Map([['fad', UIMHIR], ['folamh', BOOL], ['céad', tS.mir]]);
          const res = this.reitighFoirm(e.ball.surface, foirm, (l) => ballaí.has(l), oibreoir);
          if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', ainmCineail(tS)); return IASACHT; }
          socraigh(res.lemma);
          e.ionsuite = res.lemma;
          return ballaí.get(res.lemma);
        }

        // A narrowed variant opens like a struct. An un-narrowed sum is
        // E205: you can't open a box you haven't identified (ask the copula first).
        if (tS.k !== 'struchtúr' && tS.k !== 'malairt') {
          this.bail.cuir('E205', e.sealbhoir.ionad, ainmCineail(tS)); return IASACHT;
        }

        const res = this.reitighFoirm(e.ball.surface, foirm,
          (l) => tS.reimsi.has(l) || (tS.modhanna && tS.modhanna.has(l)), oibreoir);
        if (res.earraid) { this.teip(res, e.ball.ionad, 'E203', tS.ainm); return IASACHT; }
        socraigh(res.lemma);

        if (tS.reimsi.has(res.lemma)) return tS.reimsi.get(res.lemma);

        // A method: retrieved from the value, receiver drops out of arity.
        const md = tS.modhanna.get(res.lemma);
        if (md.modh === 'ordaitheach') { this.bail.cuir('E501', e.ball.ionad, res.lemma); return IASACHT; }
        e.modhR336 = md;
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
        // A variant literal is a struct literal, so all field checks reuse
        // the struct ones.
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

      // §5.5 — the copula: identification/classification, not `==` in Irish paint.
      case 'Copail': {
        // Taken and cleared before descending, so a nested copula isn't
        // checked against the outer particle.
        const mhir = this.copailMhir;
        this.copailMhir = null;
        const tA = this.luach(e.abhar, scoip);
        this.copailMhir = mhir;
        this.foirmChopaile(e, mhir);
        const tC = this.cinealacha.get(e.cineal.ainm);
        if (!tC) { this.bail.cuir('E202', e.cineal.ionad, e.cineal.ainm); return BOOL; }
        // A sum closes what a value may be, so a class that's impossible
        // can be caught statically.
        if (tA.k === 'suim' && tC.k === 'malairt' && !tA.malairti.has(tC.ainm)) {
          this.bail.cuir('E302', e.cineal.ionad, tA.ainm, tC.ainm);
        }
        return BOOL;
      }

      // §5.5 — the substantive verb: existence, never category. Its form
      // agrees with the governing particle; meaning never changes.
      case 'Substaint': {
        const ceart = mf.foirmBhriathartha(this.rialuBriathair);
        if (e.surface !== ceart) {
          this.bail.cuir('E512', e.ionad, e.surface, ceart, this.rialuBriathair);
        }
        this.luach(e.abhar, scoip, foirm, oibreoir);
        return BOOL;
      }

      // §5.11 — `tá Earráid ar thoradh`. Still `bí`, same form agreement.
      case 'Dochar': {
        const ceart = mf.foirmBhriathartha(this.rialuBriathair);
        if (e.surface !== ceart) {
          this.bail.cuir('E512', e.ionad, e.surface, ceart, this.rialuBriathair);
        }
        const res = this.reitighFoirm(e.cineal.surface, FOIRM.BUN,
          (l) => this.cinealacha.has(l), null);
        if (res.earraid) { this.teip(res, e.cineal.ionad, 'E202'); return BOOL; }
        const td = this.cinealacha.get(res.lemma);
        e.cineal.ainm = res.lemma;
        const t = this.luach(e.abhar, scoip, FOIRM.SEIMHITHE, 'ar');
        // Protective only where the verb declared it: asking about an
        // affliction nothing declared is meaningless, not false.
        if (t.k !== 'iasacht' && !(t.k === 'dochar' && comhionann(t.dochar, td))) {
          this.bail.cuir('E524', e.ionad, ainmCineail(td), ainmCineail(t));
        }
        return BOOL;
      }

      // `a` + lenited verb: the only licensed way to mention an imperative instead of obeying it.
      case 'Ainmniú': {
        const res = this.reitighFoirm(e.surface, FOIRM.SEIMHITHE,
          (l) => { const c = scoip.faigh(l); return !!c && c.kind !== 'luach'; }, 'a');
        if (res.earraid) { this.teip(res, e.ionad); return IASACHT; }
        const c = scoip.faigh(res.lemma);
        e.ceangal = c;
        return c.cineal;
      }

      /*
       * §7.6 — `faigh Duine as stór`. Adds no government (ordinary base-form
       * position), no aspect machinery (returns arSiúl, existing E504/E505/
       * E508 apply), no border check (construction, never checked), and
       * nothing to comhionann (a type with/without a table is the same type).
       */
      case 'Faigh': {
        const tF = this.luach(e.foinse, scoip);
        if (tF && tF.k !== 'iasacht') {
          this.bail.cuir('E201', e.foinse.ionad, 'Iasacht', ainmCineail(tF));
        }
        const t = this.tagairtCineail(e.cineal);
        if (!t || t.k !== 'struchtúr' || !t.stor) {
          // A refusal, not an empty list — same shape as E302/E524.
          this.bail.cuir('E611', e.ionad, ainmCineail(t || IASACHT));
          return arSiul(liosta(IASACHT));
        }
        e.cineálStoir = t;
        return arSiul(liosta(t));
      }

      // §5.4 — perfect aspect: an action under way becomes a value once complete.
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
        // Branches meet rather than match, same join as list literals.
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