'use strict';

/*
 * parsálaí.js — recursive descent.
 *
 * The AST keeps grammatical categories rather than machine operations.
 * `ainm ó dhuine` becomes a Sealbhach with a `ball` (member) and a
 * `sealbhóir` (possessor), not a MemberAccess; `scríobh x` becomes an Ordú
 * (command), not a call. Lowering happens in the backend and nowhere earlier.
 *
 * Precedence, loosest to tightest:
 *   is                        copula, non-associative, type on the right
 *   == != < > <= >=
 *   + -
 *   * / %
 *   bí  -  tar éis  ó"…"      unary
 *   call
 *   ó                         right-associative possession
 *   primary
 *
 * `ó` binds tighter than call, which is the one precedence choice that is
 * argued rather than assumed: in Irish `ó dhuine` is a constituent of the
 * noun phrase, so `beannacht ó dhuine(x)` applies the argument to the whole
 * phrase — a method call. The cost is that `ainm ó faigh(id)` needs parens
 * around the call. See DEARADH.md §3.2.
 */

const { earraid } = require('./diagnostics');

/** Tokens that can begin an expression, for deciding a command's arity. */
function tosachSloinn(t) {
  if (t.cinéal === 'NUM' || t.cinéal === 'STR' || t.cinéal === 'IDENT') return true;
  if (t.cinéal === 'KW') {
    return ['fíor', 'bréagach', 'neamhní', 'bí', 'tá', 'bhfuil', 'ó', 'tar éis', 'má'].includes(t.luach);
  }
  if (t.cinéal === 'OP') return t.luach === '-';
  if (t.cinéal === 'NOD') return t.luach === '(' || t.luach === '[';
  return false;
}

/**
 * A trailing `má` is the block's value when every branch produces one, and the
 * chain is closed by a bare `mura`. Branches may contain statements: the
 * backend hoists them into a temporary.
 */
function slonnAbalta(m) {
  const craobh = (b) => !!b && b.luach !== null;
  if (!m.eile) return false;
  if (!craobh(m.ansin)) return false;
  return m.eile.cineál === 'Má' ? slonnAbalta(m.eile) : craobh(m.eile);
}

class Parsalai {
  constructor(toks, lexeain = {}) {
    this.toks = toks;
    this.i = 0;
    this.gniomhartha = lexeain.gniomhartha || new Set();
    this.briathra = lexeain.briathra || new Set();
    this.ganDeantus = 0; // suppress struct literals in condition position
  }

  peek(k = 0) { return this.toks[Math.min(this.i + k, this.toks.length - 1)]; }

  seiceail(cinéal, luach) {
    const t = this.peek();
    return t.cinéal === cinéal && (luach === undefined || t.luach === luach);
  }
  meaitseail(cinéal, luach) { return this.seiceail(cinéal, luach) ? this.toks[this.i++] : null; }
  suil(cinéal, luach) {
    const t = this.meaitseail(cinéal, luach);
    if (t) return t;
    const f = this.peek();
    throw earraid('E401', f.ionad, JSON.stringify(String(f.luach ?? 'deireadh')), JSON.stringify(luach ?? cinéal));
  }

  // ── clár ──────────────────────────────────────────────────────────────
  parsailClar() {
    const mireanna = [];
    while (!this.seiceail('EOF')) mireanna.push(this.parsailRaiteas());
    return { cineál: 'Clár', mireanna };
  }

  /** `Teaghrán`, `Liosta(Duine)`. */
  parsailTagairtCineail() {
    const t = this.suil('IDENT');
    const ref = { ainm: t.luach, ionad: t.ionad, argointi: [] };
    if (this.meaitseail('NOD', '(')) {
      while (!this.seiceail('NOD', ')')) {
        ref.argointi.push(this.parsailTagairtCineail());
        if (!this.meaitseail('NOD', ',')) break;
      }
      this.suil('NOD', ')');
    }
    return ref;
  }

  parsailStruchtur() {
    this.suil('KW', 'struchtúr');
    const ainm = this.suil('IDENT');
    this.suil('NOD', '{');
    const reimsi = [];
    while (!this.seiceail('NOD', '}')) {
      const r = this.suil('IDENT');
      this.suil('NOD', ':');
      reimsi.push({ ainm: r.luach, cineal: this.parsailTagairtCineail(), ionad: r.ionad });
      this.meaitseail('NOD', ',');
    }
    this.suil('NOD', '}');
    return { cineál: 'Struchtúr', ainm: ainm.luach, ionad: ainm.ionad, reimsi };
  }

  /**
   * `feidhm f(x: T) -> U { … }`      an indicative: produces a nominal
   * `gníomh g(x: T) { … }`           an imperative: performs, returns nothing
   * `feidhm m ó Dhuine(féin) -> U`   a method: belongs to a category
   * `ag feidhm …` / `ag gníomh …`    ongoing: the action is under way
   */
  parsailBriathar(leanunach) {
    const modh = this.seiceail('KW', 'gníomh') ? 'ordaitheach' : 'táscach';
    this.toks[this.i++]; // feidhm | gníomh
    const ainm = this.suil('IDENT');

    let faighteoir = null;
    if (this.meaitseail('KW', 'ó')) {
      const t = this.suil('IDENT');
      faighteoir = { surface: t.luach, ionad: t.ionad };
    }

    this.suil('NOD', '(');
    const params = [];
    while (!this.seiceail('NOD', ')')) {
      // `sealadach` on a parameter is permission, not storage: it says the
      // callee may change what the caller passed.
      const sealadach = !!this.meaitseail('KW', 'sealadach');
      const p = this.suil('IDENT');
      // The receiver of a method carries its type in the `ó` phrase, so it is
      // the one parameter written bare: `feidhm beannacht ó Dhuine(féin)`.
      let cineal = null;
      if (this.meaitseail('NOD', ':')) cineal = this.parsailTagairtCineail();
      else if (!(faighteoir && params.length === 0)) this.suil('NOD', ':');
      params.push({ ainm: p.luach, cineal, ionad: p.ionad, sealadach, faighteoir: cineal === null });
      if (!this.meaitseail('NOD', ',')) break;
    }
    this.suil('NOD', ')');

    let toradh = null;
    if (this.seiceail('OP', '->')) {
      const op = this.toks[this.i++];
      if (modh === 'ordaitheach') throw earraid('E404', op.ionad);
      toradh = this.parsailTagairtCineail();
    }

    return {
      cineál: 'Briathar', modh, leanunach, faighteoir,
      ainm: ainm.luach, ionad: ainm.ionad, params, toradh,
      corp: this.parsailBloc(),
    };
  }

  // ── ráitis ────────────────────────────────────────────────────────────
  parsailBloc() {
    const tus = this.suil('NOD', '{').ionad;
    const raitis = [];
    while (!this.seiceail('NOD', '}') && !this.seiceail('EOF')) raitis.push(this.parsailRaiteas());
    this.suil('NOD', '}');
    // Rust-style: a trailing expression statement is the value of the block.
    let luach = null;
    const deireanach = raitis[raitis.length - 1];
    if (deireanach && deireanach.cineál === 'Slonn') { luach = deireanach.slonn; raitis.pop(); }
    else if (deireanach && deireanach.cineál === 'Má' && slonnAbalta(deireanach)) {
      deireanach.slonn = true; luach = deireanach; raitis.pop();
    }
    return { cineál: 'Bloc', raitis, luach, ionad: tus };
  }

  parsailRaiteas() {
    if (this.seiceail('KW', 'struchtúr')) return this.parsailStruchtur();
    if (this.seiceail('KW', 'feidhm') || this.seiceail('KW', 'gníomh')) return this.parsailBriathar(false);
    if (this.seiceail('KW', 'ag') && this.peek(1).cinéal === 'KW'
      && ['feidhm', 'gníomh'].includes(this.peek(1).luach)) {
      this.i++;
      return this.parsailBriathar(true);
    }
    if (this.seiceail('KW', 'seasmhach') || this.seiceail('KW', 'sealadach')) return this.parsailCeangal();
    if (this.seiceail('KW', 'cuir')) return this.parsailCuir();
    if (this.seiceail('KW', 'má') || this.seiceail('KW', 'mura')) {
      const m = this.parsailMa(); m.slonn = false; return m;
    }

    // VSO: a statement beginning with a known imperative verb is a command.
    if (this.seiceail('IDENT') && this.gniomhartha.has(this.peek().luach)) return this.parsailOrdu();

    const slonn = this.parsailSlonn();
    return { cineál: 'Slonn', slonn, ionad: slonn.ionad };
  }

  parsailOrdu() {
    const ainm = this.toks[this.i++];
    const argointi = [];
    if (tosachSloinn(this.peek())) {
      do { argointi.push(this.parsailSlonn()); } while (this.meaitseail('NOD', ','));
    }
    return { cineál: 'Ordú', ainm: ainm.luach, ionad: ainm.ionad, argointi };
  }

  parsailCeangal() {
    const kw = this.toks[this.i++];               // seasmhach | sealadach
    const ainm = this.suil('IDENT');
    let cineal = null;
    if (this.meaitseail('NOD', ':')) cineal = this.parsailTagairtCineail();
    this.suil('OP', '=');
    return {
      cineál: 'Ceangal', ainm: ainm.luach, ionad: ainm.ionad, cineal,
      sealadach: kw.luach === 'sealadach',
      luach: this.parsailSlonn(),
    };
  }

  /**
   * `cuir <luach> ar <sprioc>` — "put this on that". Irish expresses a state
   * an entity is in with `ar` (tá ocras orm), and `cuir X ar Y` is the
   * ordinary way to give something a state. It is an imperative, so mutation
   * is a command and the existing mood rules confine it to `gníomh`.
   */
  parsailCuir() {
    const kw = this.suil('KW', 'cuir');
    const luach = this.parsailSlonn();
    this.suil('KW', 'ar');
    return { cineál: 'Cuir', luach, sprioc: this.parsailSeilbh(), ionad: kw.ionad };
  }

  /**
   * `má <c> { }` / `mura <c> { }` / a chain closed by a bare `mura { }`.
   *
   * Irish has no word for "else". It has `má` (if) and `mura` (if…not), and
   * writes the second clause with its predicate elided: "Má tá sé fuar, dún
   * an doras. Mura bhfuil, fág oscailte é." A bare `mura` is that ellipsis.
   */
  parsailMa() {
    const kw = this.toks[this.i++];               // má | mura
    const diultach = kw.luach === 'mura';
    let coinniall = null;
    if (!this.seiceail('NOD', '{')) {
      this.ganDeantus++;
      coinniall = this.parsailSlonn();
      this.ganDeantus--;
    } else if (!diultach) {
      throw earraid('E401', kw.ionad, '"{"', '"coinníoll"');
    }
    const ansin = this.parsailBloc();
    let eile = null;
    if (this.seiceail('KW', 'mura')) {
      const nód = this.parsailMa();
      eile = nód.coinniall === null ? nód.ansin : nód;
    }
    return { cineál: 'Má', diultach, coinniall, ansin, eile, slonn: true, ionad: kw.ionad };
  }

  // ── sloinn ────────────────────────────────────────────────────────────
  parsailSlonn() { return this.parsailCopail(); }

  /** `x is Cineál` — the right operand is a *type*, not an expression (§13). */
  parsailCopail() {
    const clé = this.parsailComparaid();
    const kw = this.meaitseail('KW', 'is');
    if (!kw) return clé;
    if (!this.seiceail('IDENT')) throw earraid('E301', this.peek().ionad);
    return { cineál: 'Copail', abhar: clé, cineal: this.parsailTagairtCineail(), ionad: kw.ionad };
  }

  denartha(fo, oibreoiri) {
    let clé = fo.call(this);
    while (this.peek().cinéal === 'OP' && oibreoiri.includes(this.peek().luach)) {
      const op = this.toks[this.i++];
      clé = { cineál: 'Dénártha', op: op.luach, clé, deas: fo.call(this), ionad: op.ionad };
    }
    return clé;
  }

  parsailComparaid() { return this.denartha(this.parsailSuim, ['==', '!=', '<', '>', '<=', '>=']); }
  parsailSuim() { return this.denartha(this.parsailIolrach, ['+', '-']); }
  parsailIolrach() { return this.denartha(this.parsailAonartha, ['*', '/', '%']); }

  parsailAonartha() {
    if (this.seiceail('KW', 'bí') || this.seiceail('KW', 'tá') || this.seiceail('KW', 'bhfuil')) {
      const kw = this.toks[this.i++];
      return {
        cineál: 'Substaint', surface: kw.luach,
        abhar: this.parsailAonartha(), ionad: kw.ionad,
      };
    }
    if (this.seiceail('KW', 'tar éis')) {
      const kw = this.toks[this.i++];
      return { cineál: 'Críoch', abhar: this.parsailAonartha(), ionad: kw.ionad };
    }
    // A bare prepositional phrase: `ó "express"` — the whole foreign origin.
    if (this.seiceail('KW', 'ó')) {
      const kw = this.toks[this.i++];
      const s = this.suil('STR');
      return { cineál: 'Bunús', foinse: s.luach, ball: null, ionad: kw.ionad };
    }
    if (this.seiceail('OP', '-')) {
      const op = this.toks[this.i++];
      return { cineál: 'Aonártha', op: '-', abhar: this.parsailAonartha(), ionad: op.ionad };
    }
    return this.parsailIarmhir();
  }

  parsailIarmhir() {
    let e = this.parsailSeilbh();
    while (this.seiceail('NOD', '(')) {
      const oscail = this.toks[this.i++];
      const argointi = [];
      const save = this.ganDeantus; this.ganDeantus = 0;
      while (!this.seiceail('NOD', ')')) {
        argointi.push(this.parsailSlonn());
        if (!this.meaitseail('NOD', ',')) break;
      }
      this.ganDeantus = save;
      this.suil('NOD', ')');
      e = { cineál: 'Glao', feidhm: e, argointi, ionad: oscail.ionad };
    }
    return e;
  }

  /** Right-associative: `c ó b ó a` is a.b.c, each `ó` governing its own complement. */
  parsailSeilbh() {
    const clé = this.parsailBunuil();
    const kw = this.meaitseail('KW', 'ó');
    if (!kw) return clé;
    // `Router ó "express"` — a member taken from a foreign origin.
    if (this.seiceail('STR')) {
      const s = this.toks[this.i++];
      return { cineál: 'Bunús', foinse: s.luach, ball: clé, ionad: kw.ionad };
    }
    return { cineál: 'Sealbhach', ball: clé, sealbhoir: this.parsailSeilbh(), ionad: kw.ionad };
  }

  parsailBunuil() {
    const t = this.peek();
    if (t.cinéal === 'NUM') { this.i++; return { cineál: 'Uimhir', luach: t.luach, ionad: t.ionad }; }
    if (t.cinéal === 'STR') { this.i++; return { cineál: 'Teaghrán', luach: t.luach, ionad: t.ionad }; }
    if (t.cinéal === 'KW' && (t.luach === 'fíor' || t.luach === 'bréagach')) {
      this.i++; return { cineál: 'Bool', luach: t.luach === 'fíor', ionad: t.ionad };
    }
    if (t.cinéal === 'KW' && t.luach === 'neamhní') {
      this.i++; return { cineál: 'Neamhní', ionad: t.ionad };
    }
    if (t.cinéal === 'KW' && t.luach === 'má') return this.parsailMa();
    if (t.cinéal === 'NOD' && t.luach === '[') {
      this.i++;
      const mireanna = [];
      const save = this.ganDeantus; this.ganDeantus = 0;
      while (!this.seiceail('NOD', ']')) {
        mireanna.push(this.parsailSlonn());
        if (!this.meaitseail('NOD', ',')) break;
      }
      this.ganDeantus = save;
      this.suil('NOD', ']');
      return { cineál: 'Liosta', mireanna, ionad: t.ionad };
    }
    if (t.cinéal === 'NOD' && t.luach === '(') {
      this.i++;
      const save = this.ganDeantus; this.ganDeantus = 0;
      const e = this.parsailSlonn();
      this.ganDeantus = save;
      this.suil('NOD', ')');
      return e;
    }
    // `a` + lenited verb: the particle that turns a verb into a noun.
    if (t.cinéal === 'IDENT' && t.luach === 'a' && this.peek(1).cinéal === 'IDENT') {
      const iarrtha = this.peek(1).luach;
      const lemma = iarrtha.length > 1 && iarrtha[1] === 'h' ? iarrtha[0] + iarrtha.slice(2) : iarrtha;
      if (this.briathra.has(lemma) || this.briathra.has(iarrtha)) {
        const ionadV = this.peek(1).ionad;
        this.i += 2;
        return { cineál: 'Ainmniú', surface: iarrtha, ionad: ionadV };
      }
    }
    if (t.cinéal === 'IDENT') {
      this.i++;
      if (/\p{Lu}/u.test(t.luach[0]) && this.seiceail('NOD', '{') && this.ganDeantus === 0) {
        return this.parsailDeantus(t);
      }
      return { cineál: 'Aitheantóir', surface: t.luach, ionad: t.ionad };
    }
    throw earraid('E401', t.ionad, JSON.stringify(String(t.luach ?? 'deireadh')), '"slonn"');
  }

  parsailDeantus(ainmTok) {
    this.suil('NOD', '{');
    const reimsi = [];
    const save = this.ganDeantus; this.ganDeantus = 0;
    while (!this.seiceail('NOD', '}')) {
      const r = this.suil('IDENT');
      this.suil('NOD', ':');
      reimsi.push({ ainm: r.luach, luach: this.parsailSlonn(), ionad: r.ionad });
      if (!this.meaitseail('NOD', ',')) break;
    }
    this.ganDeantus = save;
    this.suil('NOD', '}');
    return {
      cineál: 'Déantús',
      cineal: { ainm: ainmTok.luach, ionad: ainmTok.ionad, argointi: [] },
      reimsi, ionad: ainmTok.ionad,
    };
  }
}

function parsail(toks, lexeain) { return new Parsalai(toks, lexeain).parsailClar(); }

module.exports = { parsail, Parsalai };
