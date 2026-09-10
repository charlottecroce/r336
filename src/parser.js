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
const ctae = require('./contaetha');
const mf = require('./morphology');

/**
 * §40 — the adjectives, written form → base form.
 *
 * `bhfuil` is normalised to `bí` and its written surface handed on to be
 * checked; so are `más` and `murab`; so are these. The parser's job is to know
 * that `sheasmhach` is `seasmhach`. Whether the noun in front of it licensed
 * the séimhiú is agreement, and agreement is the analyzer's.
 */
const AIDIACHTAI_STAIDE = new Map([
  ['seasmhach', 'seasmhach'], ['sheasmhach', 'seasmhach'],
  ['sealadach', 'sealadach'], ['shealadach', 'sealadach'],
]);
const AIDIACHTAI_INSCNE = new Map([
  ['firinscneach', 'firinscneach'], ['fhirinscneach', 'firinscneach'],
  ['baininscneach', 'baininscneach'], ['bhaininscneach', 'baininscneach'],
]);
const isAidiachtStaide = (t) => t.cinéal === 'KW' && AIDIACHTAI_STAIDE.has(t.luach);
const isAidiachtInscne = (t) => t.cinéal === 'KW' && AIDIACHTAI_INSCNE.has(t.luach);
/** `{ scriofa, bun }` — what was written, and the adjective it is a form of. */
const aidiacht = (t, tabla) => ({ scriofa: t.luach, bun: tabla.get(t.luach), ionad: t.ionad });

/**
 * Tokens that can begin an expression, for deciding a command's arity.
 *
 * `ó` is deliberately absent and handled by the caller: bare `ó` begins an
 * expression only before a string (`ó "express"`, the elliptical prepositional
 * phrase). Before anything else it is the infix of possession and needs a left
 * operand, so it cannot start one.
 */
function tosachSloinn(t, aran = null) {
  if (t.cinéal === 'KW' && t.luach === 'ó') return !!aran && aran.cinéal === 'STR';
  if (t.cinéal === 'NUM' || t.cinéal === 'STR' || t.cinéal === 'IDENT') return true;
  if (t.cinéal === 'KW') {
    return ['fíor', 'bréagach', 'neamhní', 'bí', 'tá', 'bhfuil', 'tar éis', 'má', 'más'].includes(t.luach);
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

  /**
   * `Teaghrán`, `Liosta(Duine)`, and the type of a verb.
   *
   * A verb's type is its declaration with the name abstracted away, which is
   * what a type is. Mood is a lexical property of the verb (§4), so it is
   * part of what the verb *is* and therefore part of its type: `feidhm(T) -> U`
   * and `gníomh(T)` are different types, not one type with a flag. `ag` sits
   * where it sits in a declaration, because aspect marks the verb too.
   *
   *   feidhm(Uimhir) -> Uimhir      an indicative of one argument
   *   gníomh(Teaghrán)              an imperative; no toradh, as in §E404
   *   ag feidhm(Iasacht) -> Bool    ongoing
   */
  parsailTagairtCineail() {
    let leanunach = false;
    if (this.seiceail('KW', 'ag') && this.peek(1).cinéal === 'KW'
      && ['feidhm', 'gníomh'].includes(this.peek(1).luach)) { this.i++; leanunach = true; }
    if (this.seiceail('KW', 'feidhm') || this.seiceail('KW', 'gníomh')) {
      const kw = this.toks[this.i++];
      const modh = kw.luach === 'gníomh' ? 'ordaitheach' : 'táscach';
      this.suil('NOD', '(');
      const params = [];
      while (!this.seiceail('NOD', ')')) {
        params.push(this.parsailTagairtCineail());
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
        k: 'briathar', ainm: kw.luach, modh, leanunach, params, toradh,
        ionad: kw.ionad, argointi: [],
      };
    }
    const t = this.suil('IDENT');
    const ref = { ainm: t.luach, ionad: t.ionad, argointi: [] };
    if (this.meaitseail('NOD', '(')) {
      while (!this.seiceail('NOD', ')')) {
        ref.argointi.push(this.parsailTagairtCineail());
        if (!this.meaitseail('NOD', ',')) break;
      }
      this.suil('NOD', ')');
    }
    // §39 — `Uimhir ar Earráid`. The affliction belongs to the type reference
    // rather than to the signature, so it is written wherever a type is
    // written: a return, a parameter, a declared binding, a list element. A
    // verb that takes an afflicted argument is opting in to receive one, and
    // that is the whole of what "protective only where the verb declared it"
    // has to mean on the receiving side.
    if (this.seiceail('KW', 'ar')) {
      this.i++;
      ref.dochar = this.parsailTagairtCineail();
    }
    return ref;
  }

  /**
   * `as Corcaigh`, `as Dún na nGall` — a county name after the preposition.
   *
   * Several county names are more than one word, and that is a fact about the
   * table rather than about the tokenizer, so it is handled here instead of by
   * a compound-keyword rule like `tar éis`. Identifiers are read greedily
   * while the phrase so far still begins some county name. No name is a proper
   * prefix of another (contaetha.js checks that), so the longest read is
   * unambiguous and the parser never backtracks.
   *
   * Nothing here parses `an` or `na`. The article is not implemented and is
   * not being implemented; *An Mhí* and *Dún na nGall* are opaque sequences in
   * a lookup table (§21, and Part 4 of the 0.6 brief).
   *
   * Resolution belongs to the analyzer, which owns government and agreement.
   * The parser only collects the words.
   */
  /**
   * A bare county name. `slánú` is the error-path salvage: if the phrase read
   * is not a whole name, keep taking identifiers so the diagnostic can report
   * what was actually written — `as Dún na Sí` should name the phrase rather
   * than stop at "Dún na" and then die on a stray word with a syntax error.
   * A complete name never enters it, so it cannot swallow the statement after
   * a good one.
   *
   * It is switched off for the first name of a `comhaontú`, where another name
   * follows and swallowing it would turn a collected E602 into a thrown E401.
   */
  parsailAinmContae(slánú = true) {
    const tus = this.suil('IDENT');
    const focail = [tus.luach];
    while (this.seiceail('IDENT') && ctae.isReamhran([...focail, this.peek().luach])) {
      focail.push(this.toks[this.i++].luach);
    }
    // Recovery, so that an unknown name is reported whole rather than one
    // word at a time. It must not run past the start of the next statement —
    // and since §40 a statement can begin with a bare identifier, which is
    // exactly what this loop eats. `IDENT` followed by a state adjective is a
    // declaration and nothing else (§40.2), so that is where it stops. This
    // is the ambiguity §24.4 warned about arriving from the other direction:
    // the county reader was safe only while every statement began with a
    // keyword.
    while (slánú && !ctae.isContae(focail.join(' ')) && this.seiceail('IDENT')
      && !isAidiachtStaide(this.peek(1))) {
      focail.push(this.toks[this.i++].luach);
    }
    return { focail, ionad: tus.ionad };
  }

  parsailAsFrasa() {
    this.suil('KW', 'as');
    return this.parsailAinmContae();
  }

  /** `comhaontú Corcaigh Ciarraí` — two counties, no separator, file scope. */
  parsailComhaontu() {
    const kw = this.toks[this.i++];
    const a = this.parsailAinmContae(false);
    const b = this.parsailAinmContae();
    return { cineál: 'Comhaontú', a, b, ionad: kw.ionad };
  }

  /** `as Corcaigh` at file scope: the module says where it is from. */
  parsailContaeModuil() {
    const frasa = this.parsailAsFrasa();
    return { cineál: 'Contae', focail: frasa.focail, ionad: frasa.ionad };
  }

  parsailStruchtur() {
    this.suil('KW', 'struchtúr');
    const ainm = this.suil('IDENT');
    // §40 — `struchtúr Duine firinscneach as Corcaigh`. A type's name is an
    // ordinary Irish noun and has a gender like any other, but nothing in the
    // language puts an adjective after it, so the gender has to be stated. It
    // is stated by an adjective, which then agrees with the noun it declares:
    // `Duine firinscneach`, `Aois bhaininscneach`. The declaration checks
    // itself, and E526 is what happens when it does not.
    const inscne = isAidiachtInscne(this.peek())
      ? aidiacht(this.toks[this.i++], AIDIACHTAI_INSCNE) : null;
    const contae = this.seiceail('KW', 'as') ? this.parsailAsFrasa() : null;
    const reimsi = this.parsailReimsi();
    return { cineál: 'Struchtúr', ainm: ainm.luach, ionad: ainm.ionad, reimsi, contae, inscne };
  }

  /**
   * `suim Toradh firinscneach as Corcaigh { Ceart { duine: Duine } Earráid { … } }`
   *
   * A variant is a name with fields, and the fields are parsed by exactly the
   * loop `struchtúr` uses — a variant body *is* a struct body, so there is no
   * second record syntax in the language and nothing here to keep in step.
   *
   * Payloads are named rather than positional (`Ceart { duine: Duine }`, not
   * `Ceart(Duine)`). R336's only accessor is `ó` plus a member name and
   * there is no tuple type, so a positional payload would have to invent a
   * field name at the point of use; writing it is better than inventing it.
   *
   * `as` sits on the sum and never on a variant. The sum is the identity that
   * claims a province; a variant is a name that identity goes by (§26.2).
   */
  parsailSuim() {
    this.suil('KW', 'suim');
    const ainm = this.suil('IDENT');
    const inscne = isAidiachtInscne(this.peek())
      ? aidiacht(this.toks[this.i++], AIDIACHTAI_INSCNE) : null;
    const contae = this.seiceail('KW', 'as') ? this.parsailAsFrasa() : null;
    this.suil('NOD', '{');
    const malairti = [];
    while (!this.seiceail('NOD', '}')) {
      const m = this.suil('IDENT');
      // A variant declares its own gender: it is its own noun in the type
      // namespace (§26.9), and `Easpa` is feminine whatever `Toradh` is.
      const mInscne = isAidiachtInscne(this.peek())
        ? aidiacht(this.toks[this.i++], AIDIACHTAI_INSCNE) : null;
      malairti.push({ ainm: m.luach, ionad: m.ionad, inscne: mInscne, reimsi: this.parsailReimsi() });
      this.meaitseail('NOD', ',');
    }
    this.suil('NOD', '}');
    return { cineál: 'Suim', ainm: ainm.luach, ionad: ainm.ionad, malairti, contae, inscne };
  }

  /** `{ ainm: Cineál, … }` — the record body, shared by struct and variant. */
  parsailReimsi() {
    this.suil('NOD', '{');
    const reimsi = [];
    while (!this.seiceail('NOD', '}')) {
      const r = this.suil('IDENT');
      this.suil('NOD', ':');
      reimsi.push({ ainm: r.luach, cineal: this.parsailTagairtCineail(), ionad: r.ionad });
      this.meaitseail('NOD', ',');
    }
    this.suil('NOD', '}');
    return reimsi;
  }

  /**
   * `feidhm f(x: T) -> U { … }`      an indicative: produces a nominal
   * `gníomh g(x: T) { … }`           an imperative: performs, returns nothing
   * `feidhm m ó Dhuine(féin) -> U`   a method: belongs to a category
   * `ag feidhm …` / `ag gníomh …`    ongoing: the action is under way
   */
  parsailBriathar(leanunach) {
    const modh = this.seiceail('KW', 'gníomh') ? 'ordaitheach'
      : this.seiceail('KW', 'saor') ? 'saor' : 'táscach';
    this.toks[this.i++]; // feidhm | gníomh | saor
    const ainm = this.suil('IDENT');

    let faighteoir = null;
    // An autonomous verb has no agent, and a receiver is an agent: `féin` is
    // exactly the thing the form refuses to express. So it takes no `ó`
    // phrase, and this is a grammatical refusal rather than a restriction.
    if (modh === 'saor' && this.seiceail('KW', 'ó')) {
      throw earraid('E520', this.peek().ionad, ainm.luach);
    }
    if (this.meaitseail('KW', 'ó')) {
      const t = this.suil('IDENT');
      faighteoir = { surface: t.luach, ionad: t.ionad };
    }

    this.suil('NOD', '(');
    const params = [];
    while (!this.seiceail('NOD', ')')) {
      // `sealadach` on a parameter is permission, not storage: it says the
      // callee may change what the caller passed. It follows its noun for the
      // same reason every other attributive adjective now does (§40).
      const p = this.suil('IDENT');
      const aid = isAidiachtStaide(this.peek()) ? aidiacht(this.toks[this.i++], AIDIACHTAI_STAIDE) : null;
      const sealadach = !!aid && aid.bun === 'sealadach';
      // The receiver of a method carries its type in the `ó` phrase, so it is
      // the one parameter written bare: `feidhm beannacht ó Dhuine(féin)`.
      let cineal = null;
      if (this.meaitseail('NOD', ':')) cineal = this.parsailTagairtCineail();
      else if (!(faighteoir && params.length === 0)) this.suil('NOD', ':');
      params.push({ ainm: p.luach, cineal, ionad: p.ionad, sealadach, aidiacht: aid, faighteoir: cineal === null });
      if (!this.meaitseail('NOD', ',')) break;
    }
    this.suil('NOD', ')');

    let toradh = null;
    if (this.seiceail('OP', '->')) {
      const op = this.toks[this.i++];
      if (modh !== 'táscach') throw earraid('E404', op.ionad);
      toradh = this.parsailTagairtCineail();
    }

    // §39 — an `ar` phrase here has already been swallowed by the return type
    // if there was one. What is left is `gníomh f(…) ar Earráid`: an
    // affliction with nothing to sit on.
    if (this.seiceail('KW', 'ar')) throw earraid('E522', this.peek().ionad, ainm.luach);

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
    if (this.seiceail('KW', 'as')) return this.parsailContaeModuil();
    if (this.seiceail('KW', 'comhaontú')) return this.parsailComhaontu();
    if (this.seiceail('KW', 'struchtúr')) return this.parsailStruchtur();
    if (this.seiceail('KW', 'suim')) return this.parsailSuim();
    if (this.seiceail('KW', 'feidhm') || this.seiceail('KW', 'gníomh')
      || this.seiceail('KW', 'saor')) return this.parsailBriathar(false);
    if (this.seiceail('KW', 'ag') && this.peek(1).cinéal === 'KW'
      && ['feidhm', 'gníomh', 'saor'].includes(this.peek(1).luach)) {
      this.i++;
      return this.parsailBriathar(true);
    }
    // A declaration is `IDENT` followed by a state adjective, and nothing else
    // in the language produces that shape — two identifiers side by side are
    // not a legal expression (§38.2), and a state adjective is a keyword. So
    // this is settled by shape, and it is settled *before* the VSO test,
    // because a declaration is not a command however the noun is spelled.
    if (this.seiceail('IDENT') && isAidiachtStaide(this.peek(1))) return this.parsailCeangal();
    if (this.seiceail('KW', 'cuir')) return this.parsailCuir();
    if (this.seiceail('KW', 'má') || this.seiceail('KW', 'más')
      || this.seiceail('KW', 'mura') || this.seiceail('KW', 'murab')) {
      const m = this.parsailMa(); m.slonn = false; return m;
    }

    // VSO: a statement beginning with a known imperative verb is a command.
    if (this.seiceail('IDENT') && this.gniomhartha.has(this.peek().luach)) return this.parsailOrdu();

    const slonn = this.parsailSlonn();
    return { cineál: 'Slonn', slonn, ionad: slonn.ionad };
  }

  /**
   * A command, optionally with the prepositional phrase its verb governs.
   *
   * Irish verbs select a preposition lexically — *déan scrúdú **ar***, *cuir
   * uisce **ar***, *éist **le***. `cuir … ar …` was already that pattern with
   * its own parse rule; this generalises it, so the frame is a property of the
   * verb in the lexicon rather than a one-off in the grammar. The parser
   * collects the phrase; the analyzer asks the verb whether it wanted one.
   */
  parsailOrdu() {
    const ainm = this.toks[this.i++];
    const argointi = [];
    if (tosachSloinn(this.peek(), this.peek(1))) {
      do { argointi.push(this.parsailSlonn()); } while (this.meaitseail('NOD', ','));
    }
    // `cuirDuine ó shonraí …`. An imported verb joins the lexicon unqualified,
    // because `ó` builds noun phrases and E501 says an imperative is not one.
    if (this.seiceail('KW', 'ó')) throw earraid('E516', this.peek().ionad, ainm.luach);
    let fras = null;
    const kwAr = this.meaitseail('KW', 'ar');
    if (kwAr) fras = { reamhfhocal: 'ar', abhar: this.parsailSlonn(), ionad: kwAr.ionad };
    return { cineál: 'Ordú', ainm: ainm.luach, ionad: ainm.ionad, argointi, fras };
  }

  /**
   * §40 — `duine seasmhach = …`, `aois sheasmhach = 20`.
   *
   * The noun comes first because Irish puts an attributive adjective after
   * its noun, and `seasmhach` and `sealadach` are attributive adjectives:
   * they say what kind of thing this binding is, not what to do with it. The
   * pre-0.11 order wrote English word order in Irish words, which is the same
   * fault §31.4 corrected in the copula and it is corrected the same way.
   */
  parsailCeangal() {
    const ainm = this.suil('IDENT');
    const aid = aidiacht(this.toks[this.i++], AIDIACHTAI_STAIDE);
    let cineal = null;
    if (this.meaitseail('NOD', ':')) cineal = this.parsailTagairtCineail();
    this.suil('OP', '=');
    return {
      cineál: 'Ceangal', ainm: ainm.luach, ionad: ainm.ionad, cineal, aidiacht: aid,
      sealadach: aid.bun === 'sealadach',
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
    const kw = this.toks[this.i++];               // má | más | mura | murab
    const diultach = kw.luach === 'mura' || kw.luach === 'murab';
    // The written form of the copula, kept for the analyzer. The particle is
    // normalised here because `más` *is* `má` syntactically — it is one word
    // only because Irish writes the fusion — so nothing downstream should
    // have to know which of the two was on the page. That is the same split
    // `bhfuil` gets: the parser sees the particle, the analyzer checks the
    // form (§31).
    const copail = kw.luach;
    let coinniall = null;
    if (!this.seiceail('NOD', '{')) {
      this.ganDeantus++;
      coinniall = this.copailFaoiMhir()
        ? this.parsailCopailMhir(kw)
        : this.parsailSlonn();
      this.ganDeantus--;
    } else if (!diultach) {
      throw earraid('E401', kw.ionad, '"{"', '"coinníoll"');
    } else if (kw.luach === 'murab') {
      // A bare `mura` is the elided second clause and is good Irish. A bare
      // `murab` is not: the -b exists only to meet a following vowel, so
      // there has to be something following.
      throw earraid('E401', kw.ionad, '"{"', '"coinníoll"');
    }
    const ansin = this.parsailBloc();
    let eile = null;
    if (this.seiceail('KW', 'mura') || this.seiceail('KW', 'murab')) {
      const nód = this.parsailMa();
      eile = nód.coinniall === null ? nód.ansin : nód;
    }
    return { cineál: 'Má', diultach, copail, coinniall, ansin, eile, slonn: true, ionad: kw.ionad };
  }

  /**
   * Is the condition a copular clause rather than an ordinary expression?
   *
   * Irish word order answers this without a symbol table. A copular clause is
   * PARTICLE + PREDICATE + SUBJECT and contains no verb, so two juxtaposed
   * expressions follow the particle; every other condition is a single
   * expression, and juxtaposition is not otherwise legal here. Two tokens are
   * enough:
   *
   *   más Ceart toradh     IDENT IDENT   → copular
   *   más Ceart cuardaigh(20)  IDENT IDENT → copular; the subject is a call
   *   mura aois > 17       IDENT OP      → ordinary
   *   mura duine {         IDENT NOD     → ordinary
   *   má tá duine          KW            → ordinary
   *   má óg(duine) {       IDENT NOD "(" → ordinary; this is one call, not two
   *   má aosta ó dhuine()  IDENT KW      → ordinary
   *
   * The second token has to *open* a subject, which means an identifier, a
   * number or a string. Anything else — an operator, a bracket, a keyword —
   * means the two words were one expression all along. `(` is the case worth
   * naming: `f(x)` is a call and reads as juxtaposition if you only count
   * tokens, so it is excluded by shape rather than by knowing what `f` is.
   *
   * Note what this does *not* do: it never asks whether the first identifier
   * names a type. Deciding by shape rather than by lookup is what keeps this
   * agreement rather than inference (§26.3).
   */
  copailFaoiMhir() {
    if (!this.seiceail('IDENT')) return false;
    const ar_aghaidh = this.toks[this.i + 1];
    return !!ar_aghaidh && ['IDENT', 'NUM', 'STR'].includes(ar_aghaidh.cinéal);
  }

  /** `<Cineál> <slonn>` — the predicate first, as the copula puts it. */
  parsailCopailMhir(kw) {
    const cineal = this.parsailTagairtCineail();
    const abhar = this.parsailSlonn();
    return { cineál: 'Copail', abhar, cineal, faoiMhir: true, ionad: kw.ionad };
  }

  // ── sloinn ────────────────────────────────────────────────────────────
  parsailSlonn() { return this.parsailCopail(); }

  /** `x is Cineál` — the right operand is a *type*, not an expression (§13). */
  parsailCopail() {
    const clé = this.parsailComparaid();
    const kw = this.meaitseail('KW', 'is');
    if (!kw) return clé;
    if (!this.seiceail('IDENT')) throw earraid('E301', this.peek().ionad);
    return {
      cineál: 'Copail', abhar: clé, cineal: this.parsailTagairtCineail(),
      faoiMhir: false, ionad: kw.ionad,
    };
  }

  denartha(fo, oibreoiri) {
    let clé = fo.call(this);
    while (this.peek().cinéal === 'OP' && oibreoiri.includes(this.peek().luach)) {
      const op = this.toks[this.i++];
      clé = { cineál: 'Dénártha', op: op.luach, clé, deas: fo.call(this), ionad: op.ionad };
    }
    return clé;
  }

  parsailComparaid() { return this.denartha(this.parsailSuimiu, ['==', '!=', '<', '>', '<=', '>=']); }
  // `suimiú` is the operation; `suim` is the type (§26). They were the same
  // word here until 0.8, when the keyword arrived and took the plain name.
  parsailSuimiu() { return this.denartha(this.parsailIolrach, ['+', '-']); }
  parsailIolrach() { return this.denartha(this.parsailAonartha, ['*', '/', '%']); }

  parsailAonartha() {
    if (this.seiceail('KW', 'bí') || this.seiceail('KW', 'tá') || this.seiceail('KW', 'bhfuil')) {
      const kw = this.toks[this.i++];
      // §39 — `tá Earráid ar thoradh`. Decided by shape, never by lookup, on
      // the §31.4 pattern: an identifier followed by `ar` can only be this,
      // because `tá <slonn>` takes one operand and `ar` cannot continue it.
      // Asking whether the identifier names a type would make the predication
      // inference rather than agreement, which §26.3 refused.
      if (this.seiceail('IDENT') && this.peek(1).cinéal === 'KW' && this.peek(1).luach === 'ar') {
        const t = this.toks[this.i++];
        this.i++;                                     // ar
        return {
          cineál: 'Dochar', surface: kw.luach,
          cineal: { surface: t.luach, ionad: t.ionad },
          abhar: this.parsailAonartha(), ionad: kw.ionad,
        };
      }
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
    if (t.cinéal === 'KW' && (t.luach === 'má' || t.luach === 'más')) return this.parsailMa();
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
      // Not a verb. `a` falls back to being an ordinary identifier — which is
      // why `a seasmhach = 3` still works — but two identifiers side by side
      // are not a legal expression here, so the only reading left is a
      // particle in front of something that cannot be named. Decided by shape
      // rather than by lookup, as the copular clause is (§31.4).
      throw earraid('E513', this.peek(1).ionad, iarrtha);
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
