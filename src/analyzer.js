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
    case 'feidhm': {
      // Render a verb type the way it is written, so a mismatch reads as the
      // declaration the caller should have made.
      const ceann = (t.leanunach ? 'ag ' : '') + (t.modh === 'ordaitheach' ? 'gníomh' : 'feidhm');
      const ps = (t.params || []).map(ainmCineail).join(', ');
      return t.modh === 'ordaitheach'
        ? `${ceann}(${ps})`
        : `${ceann}(${ps}) -> ${ainmCineail(t.toradh)}`;
    }
    default: return t.ainm || '?';
  }
}

function comhionann(a, b) {
  if (!a || !b) return false;
  if (a.k === 'iasacht' || b.k === 'iasacht') return true;
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
    // A module body is a sequence of commands, so top level is imperative.
    // It is not ongoing, so `tar éis` at top level is an error.
    this.ctx = { modh: 'ordaitheach', leanunach: false, ainm: '<barr>' };
    // Which form of the substantive verb the surrounding clause selects.
    // Independent unless a particle governs the clause.
    this.rialuBriathair = mf.RIALU_BRIATHAIR.NEAMHSPLEACH;
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
     * Nothing new in the grammar. `déan` is a bare imperative root (§17);
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
      }

      for (const [lemma, onn] of siniu.onnmhairi) {
        if (onn.kind === 'luach') continue;              // a possession, not a word
        const ann = this.domhanda.faighAitiuil(lemma);
        if (ann) { this.bail.cuir('E106', siniu.ionad, lemma, [ann.foinse || '<áitiúil>', foinse]); continue; }
        const c = new Ceangal(lemma, onn.cineal, onn.kind);
        c.jsAinm = `${ailias}.${onn.jsAinm || lemma}`;
        c.foinse = foinse;
        this.domhanda.cuir(c);
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
      if (t.k === 'struchtúr') cinealacha.set(ainm, t);
    }
    const gniomhartha = new Set();
    const briathra = new Set();
    for (const [lemma, onn] of onnmhairi) {
      if (onn.kind === 'gníomh') { gniomhartha.add(lemma); briathra.add(lemma); }
      else if (onn.kind === 'feidhm') briathra.add(lemma);
    }
    return { onnmhairi, cinealacha, gniomhartha, briathra, ionad };
  }

  // ---- government + agreement ---------------------------------------
  /**
   * The single agreement check. Given what the programmer wrote (`surface`),
   * the form the slot demands (`foirm`), and a way to ask whether a lemma is
   * known here, either return the lemma or file a precise diagnostic.
   */
  reitighFoirm(surface, foirm, lemmaAnn, oibreoir) {
    const lemma = mf.lemmaTuairim(surface);
    if (!lemmaAnn(lemma)) return { earraid: ['E101', lemma] };

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

  /** File a resolution failure, remapping "unbound" to the caller's code. */
  teip(res, ionad, codGanSainmhiniu, ...breise) {
    const cod = res.earraid[0] === 'E101' && codGanSainmhiniu ? codGanSainmhiniu : res.earraid[0];
    const args = cod === codGanSainmhiniu ? [res.earraid[1], ...breise] : res.earraid.slice(1);
    this.bail.cuir(cod, ionad, ...args);
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

    // Pass A — hoist type and verb declarations.
    for (const m of ast.mireanna) {
      if (m.cineál === 'Struchtúr') this.fogairStruchtur(m);
      else if (m.cineál === 'Briathar') briathra.push(m);
      else raitis.push(m);
    }
    // Pass A2 — field types, then signatures, so a call may precede its verb.
    for (const m of ast.mireanna) if (m.cineál === 'Struchtúr') this.socraighReimsi(m);
    for (const b of briathra) this.fogairBriathar(b);
    for (const b of briathra) this.socraighSiniu(b);

    // Pass B — top-level statements, in order.
    for (const r of raitis) this.raiteas(r, this.domhanda);

    // Pass C — verb bodies, with the whole global scope visible.
    for (const b of briathra) this.corpBriathair(b);

    this.bail.caith();
    return ast;
  }

  fogairStruchtur(m) {
    if (!this.seiceailBunfhoirm(m.ainm, m.ionad)) return;
    if (this.cinealacha.has(m.ainm)) { this.bail.cuir('E208', m.ionad, m.ainm); return; }
    this.cinealacha.set(m.ainm, {
      k: 'struchtúr', ainm: m.ainm, reimsi: new Map(), modhanna: new Map(),
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
    m.jsAinm = jsAinm(m.ainm);
    this.domhanda.cuir(new Ceangal(m.ainm, cineal, m.modh === 'ordaitheach' ? 'gníomh' : 'feidhm'));
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
  bloc(b, tuisScoip) {
    const scoip = new Scoip(tuisScoip);
    b.scoip = scoip;
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
        // A branch that produces a value in statement position is discarding
        // it, which the indicative does not permit — same rule as E503.
        const craobh = (b) => {
          if (b.cineál === 'Má') { this.raiteas(b, scoip); return; }
          const t = this.bloc(b, scoip);
          if (b.luach && this.ctx.modh === 'táscach' && !comhionann(t, NEAMHNI)) {
            this.bail.cuir('E503', b.luach.ionad);
          }
        };
        craobh(r.ansin);
        if (r.eile) craobh(r.eile);
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
        const res = this.reitighFoirm(r.ainm, FOIRM.BUN, (l) => !!scoip.faigh(l), null);
        if (res.earraid) { this.teip(res, r.ionad); return; }
        const c = scoip.faigh(res.lemma);
        if (c.kind !== 'gníomh') {
          this.bail.cuir('E207', r.ionad, ainmCineail(c.cineal)); return;
        }
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

  /** Analyse a condition under the particle that governs its verb. */
  coinniall(r, scoip) {
    if (!r.coinniall) return;
    const roimhe = this.rialuBriathair;
    this.rialuBriathair = r.diultach
      ? mf.RIALU_BRIATHAIR.SPLEACH
      : mf.RIALU_BRIATHAIR.NEAMHSPLEACH;
    const c = this.luach(r.coinniall, scoip);
    this.rialuBriathair = roimhe;
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
        const ceann = ts.find((t) => t.k !== 'iasacht') || ts[0];
        // A heterogeneous literal is a container of things whose types the
        // compiler is not tracking, which is what Iasacht means. The honest
        // fix is sum types; until then, widening beats a false error.
        return liosta(ts.every((t) => comhionann(ceann, t)) ? ceann : IASACHT);
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

        if (tS.k !== 'struchtúr') { this.bail.cuir('E205', e.sealbhoir.ionad, ainmCineail(tS)); return IASACHT; }

        const res = this.reitighFoirm(e.ball.surface, foirm,
          (l) => tS.reimsi.has(l) || tS.modhanna.has(l), oibreoir);
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
        if (t.k !== 'struchtúr') {
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
        this.luach(e.abhar, scoip);
        if (!this.cinealacha.has(e.cineal.ainm)) {
          this.bail.cuir('E202', e.cineal.ionad, e.cineal.ainm);
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
        if (!e.eile) { this.bail.cuir('E507', e.ionad); this.bloc(e.ansin, scoip); return IASACHT; }
        const a = this.bloc(e.ansin, scoip);
        const b = e.eile.cineál === 'Má'
          ? this.slonn(e.eile, scoip)
          : this.bloc(e.eile, scoip);
        if (!comhionann(a, b)) this.bail.cuir('E201', e.eile.ionad, ainmCineail(a), ainmCineail(b));
        return a.k === 'iasacht' ? b : a;
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
