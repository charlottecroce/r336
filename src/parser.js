'use strict';

// parsálaí.js — recursive descent.
//
// The AST keeps grammatical categories, not machine operations: `ainm ó
// dhuine` is a Sealbhach with `ball`/`sealbhóir`, not a MemberAccess;
// `scríobh x` is an Ordú, not a call. Lowering happens only in codegen.
//
// Precedence, loosest to tightest:
//   is                        copula, non-associative, type on the right
//   == != < > <= >=
//   + -
//   * / %
//   bí  -  tar éis  ó"…"      unary
//   call
//   ó                         right-associative possession
//   primary
//
// `ó` binds tighter than call: in Irish `ó dhuine` is a constituent of the
// noun phrase, so `beannacht ó dhuine(x)` applies the argument to the whole
// phrase (a method call). Cost: a call inside a possessive chain needs
// parens — `ainm ó faigh(id)`.

const { earraid } = require('./diagnostics');
const ctae = require('./contaetha');
const mf = require('./morphology');

/** §5.10 — the adjectives, written form → base form. */
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
/** `{ scriofa, bun }` — what was written, and the adjective it's a form of. */
const aidiacht = (t, tabla) => ({ scriofa: t.luach, bun: tabla.get(t.luach), ionad: t.ionad });

/**
 * §7.6 — the `stór` marker, contextual rather than reserved: it's bound as
 * an ordinary identifier in several files, so reserving it would break them.
 * Read as IDENT only in the struct-declaration slot.
 */
const MARC_STOIR = 'stór';
const marcStoir = (t) => t.cinéal === 'IDENT' && t.luach === MARC_STOIR;

/**
 * Tokens that can begin an expression. `ó` is deliberately absent: bare `ó`
 * starts an expression only before a string (`ó "express"`); anywhere else
 * it's the infix of possession and needs a left operand.
 */
function tosachSloinn(t, aran = null) {
  if (t.cinéal === 'KW' && t.luach === 'ó') return !!aran && aran.cinéal === 'STR';
  if (t.cinéal === 'NUM' || t.cinéal === 'STR' || t.cinéal === 'IDENT') return true;
  if (t.cinéal === 'KW') {
    return ['fíor', 'bréagach', 'neamhní', 'bí', 'tá', 'bhfuil', 'tar éis', 'má', 'más', 'faigh'].includes(t.luach);
  }
  if (t.cinéal === 'OP') return t.luach === '-';
  if (t.cinéal === 'NOD') return t.luach === '(' || t.luach === '[';
  return false;
}

/**
 * A trailing `má` is the block's value when every branch produces one, and
 * the chain ends in a bare `mura`. Branches may contain statements; the
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
   * `Teaghrán`, `Liosta(Duine)`, and verb types. A verb's type is its
   * declaration with the name abstracted away.
   *
   *   feidhm(Uimhir) -> Uimhir      indicative, one Uimhir param
   *   gníomh(Teaghrán)              imperative; no toradh (E404)
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
    // §5.11 — `Uimhir ar Earráid`, written wherever a type is written.
    if (this.seiceail('KW', 'ar')) {
      this.i++;
      ref.dochar = this.parsailTagairtCineail();
    }
    return ref;
  }

  /**
   * `as Corcaigh`, `as Dún na nGall` — a possibly-multi-word county name.
   * Identifiers are read greedily while the phrase remains a prefix of some
   * name (safe since no name is a proper prefix of another). Resolution
   * belongs to the analyzer; the parser only collects the words.
   */
  /**
   * `slánú` is error-path salvage: if the phrase read isn't a whole name,
   * keep taking identifiers so the diagnostic reports what was actually
   * written, instead of dying on a stray word after a partial match. A
   * complete name never enters it. Off for the first name of `comhaontú`,
   * where swallowing the second name would turn E602 into a parse error.
   */
  parsailAinmContae(slánú = true) {
    const tus = this.suil('IDENT');
    const focail = [tus.luach];
    while (this.seiceail('IDENT') && ctae.isReamhran([...focail, this.peek().luach])) {
      focail.push(this.toks[this.i++].luach);
    }
    // Stops at a state adjective, since IDENT + adjective is always a
    // declaration (§5.10) and never part of a county name.
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
    // §5.10 — `struchtúr Duine firinscneach as Corcaigh`: type names carry
    // gender too, but nothing else in the grammar puts an adjective after a
    // type name, so it's stated explicitly and checks itself (E526).
    const inscne = isAidiachtInscne(this.peek())
      ? aidiacht(this.toks[this.i++], AIDIACHTAI_INSCNE) : null;
    // §7.6 — `stór`, struct only (no slot on suim/malairt: a sum doesn't
    // enumerate rows, same reason it can't carry a method — E509).
    const stor = marcStoir(this.peek()) ? this.toks[this.i++].ionad : null;
    const contae = this.seiceail('KW', 'as') ? this.parsailAsFrasa() : null;
    const reimsi = this.parsailReimsi();
    return { cineál: 'Struchtúr', ainm: ainm.luach, ionad: ainm.ionad, reimsi, contae, inscne, stor };
  }

  /**
   * `suim Toradh firinscneach as Corcaigh { Ceart { duine: Duine } Easpa { … } }`
   *
   * A variant body is parsed by the same field-loop struct uses — no second
   * record syntax. Payloads are named, not positional: `ó` + field name is
   * the only accessor and there's no tuple type. `as` sits on the sum only,
   * never a variant (the sum claims the province).
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
      // A variant declares its own gender — it's its own noun in the type namespace.
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
   * `feidhm f(x: T) -> U { … }`      indicative: produces a nominal
   * `gníomh g(x: T) { … }`           imperative: performs, returns nothing
   * `feidhm m ó Dhuine(féin) -> U`   a method
   * `ag feidhm …` / `ag gníomh …`    ongoing
   */
  parsailBriathar(leanunach) {
    const modh = this.seiceail('KW', 'gníomh') ? 'ordaitheach'
      : this.seiceail('KW', 'saor') ? 'saor' : 'táscach';
    this.toks[this.i++]; // feidhm | gníomh | saor
    const ainm = this.suil('IDENT');

    let faighteoir = null;
    // The autonomous has no agent, and a receiver is an agent — refused
    // grammatically, not as a policy restriction.
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
      // `sealadach` on a parameter: permission for the callee to mutate
      // what the caller passed, not storage.
      const p = this.suil('IDENT');
      const aid = isAidiachtStaide(this.peek()) ? aidiacht(this.toks[this.i++], AIDIACHTAI_STAIDE) : null;
      const sealadach = !!aid && aid.bun === 'sealadach';
      // A method's receiver carries its type via the `ó` phrase, so it's
      // written bare: `feidhm beannacht ó Dhuine(féin)`.
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

    // Any `ar` phrase here has already been swallowed by the return type,
    // if any — what's left has nothing to be afflicted (E522).
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
    // Rust-style: a trailing expression statement is the block's value.
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
    // IDENT + state adjective is always a declaration, decided by shape
    // before the VSO check, since it's never a command.
    if (this.seiceail('IDENT') && isAidiachtStaide(this.peek(1))) return this.parsailCeangal();
    if (this.seiceail('KW', 'cuir')) return this.parsailCuir();
    if (this.seiceail('KW', 'má') || this.seiceail('KW', 'más')
      || this.seiceail('KW', 'mura') || this.seiceail('KW', 'murab')) {
      const m = this.parsailMa(); m.slonn = false; return m;
    }

    // VSO: a statement beginning with a known imperative is a command.
    if (this.seiceail('IDENT') && this.gniomhartha.has(this.peek().luach)) return this.parsailOrdu();

    const slonn = this.parsailSlonn();
    return { cineál: 'Slonn', slonn, ionad: slonn.ionad };
  }

  /**
   * A command, optionally with the prepositional phrase its verb governs
   * (Irish verbs select a preposition lexically — the parser collects the
   * phrase, the analyzer asks the verb whether it wanted one).
   */
  parsailOrdu() {
    const ainm = this.toks[this.i++];
    const argointi = [];
    if (tosachSloinn(this.peek(), this.peek(1))) {
      do { argointi.push(this.parsailSlonn()); } while (this.meaitseail('NOD', ','));
    }
    // Imported verbs join unqualified — `ó` builds noun phrases, and E501
    // says an imperative isn't one.
    if (this.seiceail('KW', 'ó')) throw earraid('E516', this.peek().ionad, ainm.luach);
    let fras = null;
    const kwAr = this.meaitseail('KW', 'ar');
    if (kwAr) fras = { reamhfhocal: 'ar', abhar: this.parsailSlonn(), ionad: kwAr.ionad };
    return { cineál: 'Ordú', ainm: ainm.luach, ionad: ainm.ionad, argointi, fras };
  }

  /**
   * §5.10 — `duine seasmhach = …`, `aois sheasmhach = 20`. The noun comes
   * first since Irish puts attributive adjectives after their noun.
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
   * `cuir <luach> ar <sprioc>` — a state change as a command. `cuir <luach>
   * i <stór>` (0.13) is the store write: same verb, second preposition/frame
   * ("cuir i dtaisce" is the idiom). The preposition decides what follows:
   * `ar` takes a possessive chain (mutation target), `i` takes an ordinary
   * expression (argument). `in` is normalised to `i`, written form carried
   * for the analyzer to check, same as `bhfuil`/`más`.
   */
  parsailCuir() {
    const kw = this.suil('KW', 'cuir');
    const luach = this.parsailSlonn();
    const mir = this.meaitseail('KW', 'i') || this.meaitseail('KW', 'in');
    if (mir) {
      return {
        cineál: 'Cuir', reamhfhocal: 'i', luach,
        stor: this.parsailSlonn(), mirScriofa: mir.luach,
        ionadMhir: mir.ionad, ionad: kw.ionad,
      };
    }
    this.suil('KW', 'ar');
    return {
      cineál: 'Cuir', reamhfhocal: 'ar', luach,
      sprioc: this.parsailSeilbh(), ionad: kw.ionad,
    };
  }

  /**
   * `má <c> { }` / `mura <c> { }` / a chain closed by a bare `mura { }`.
   * Irish has no word for "else" — `mura` on its own is the elided negative clause.
   */
  parsailMa() {
    const kw = this.toks[this.i++];               // má | más | mura | murab
    const diultach = kw.luach === 'mura' || kw.luach === 'murab';
    // Normalised here; the analyzer checks the written form (§5.5).
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
      // `murab` is not — the -b exists only to meet a following vowel.
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
   * Is the condition a copular clause? Decided by shape, not lookup: a
   * copular clause is PARTICLE + PREDICATE + SUBJECT with no verb, so two
   * juxtaposed expressions follow the particle — juxtaposition is otherwise
   * illegal here. `(` is excluded explicitly: `f(x)` looks like two tokens
   * but is one call.
   *
   *   más Ceart toradh     IDENT IDENT   → copular
   *   mura aois > 17       IDENT OP      → ordinary
   *   má óg(duine) {       IDENT NOD "(" → ordinary (one call)
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

  /** `x is Cineál` — the right operand is a type, not an expression. */
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
  parsailSuimiu() { return this.denartha(this.parsailIolrach, ['+', '-']); }
  parsailIolrach() { return this.denartha(this.parsailAonartha, ['*', '/', '%']); }

  parsailAonartha() {
    if (this.seiceail('KW', 'bí') || this.seiceail('KW', 'tá') || this.seiceail('KW', 'bhfuil')) {
      const kw = this.toks[this.i++];
      // §5.11 — `tá Earráid ar thoradh`, decided by shape: IDENT then `ar`
      // can only be this, since `tá <slonn>` takes one operand.
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
    if (this.seiceail('KW', 'faigh')) return this.parsailFaigh();
    // A bare prepositional phrase: `ó "express"` — foreign origin.
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

  /**
   * §7.6 — `faigh Duine as stór`. Type name read first, which is why
   * `faigh` had to be a real keyword: nothing else can disambiguate a
   * lookahead here. `as` (not `ó`, which would read as possession; not
   * `ar`, reserved for verb frames) demands the base form.
   */
  parsailFaigh() {
    const kw = this.suil('KW', 'faigh');
    const cineal = this.parsailTagairtCineail();
    this.suil('KW', 'as');
    const foinse = this.parsailSeilbh();
    return {
      cineál: 'Faigh', cineal, foinse, ionad: kw.ionad,
      leanunach: true, // every store op is ongoing; existing E504/E505 apply
    };
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
    // `a` + lenited verb: turns a verb into a noun.
    if (t.cinéal === 'IDENT' && t.luach === 'a' && this.peek(1).cinéal === 'IDENT') {
      const iarrtha = this.peek(1).luach;
      const lemma = iarrtha.length > 1 && iarrtha[1] === 'h' ? iarrtha[0] + iarrtha.slice(2) : iarrtha;
      if (this.briathra.has(lemma) || this.briathra.has(iarrtha)) {
        const ionadV = this.peek(1).ionad;
        this.i += 2;
        return { cineál: 'Ainmniú', surface: iarrtha, ionad: ionadV };
      }
      // Not a verb: `a` falls back to an ordinary identifier (`a seasmhach
      // = 3` still works), but two bare identifiers side by side aren't a
      // legal expression otherwise, so this is E513.
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