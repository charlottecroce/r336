'use strict';

/*
 * test/contae.js — tástálacha do chéim 0.6, céimeanna 1 agus 2.
 *
 * Ar leithligh ó run.js agus ó nua.js, ar an gcúis chéanna: níl aon rud anseo
 * a bhaineann le 0.4 ná le 0.5, agus is féidir na trí chomhad a rith le chéile
 * nó ina n-aonar.
 *
 *     node test/contae.js
 *
 * Ní chlúdaítear anseo ach an fhoirm agus an réiteach: `as` san fhoclóir agus
 * sa pharsálaí, an réimse `contae` ar an struchtúr, agus contae an mhodúil.
 * Níl an tseiceáil féin (E601) ná na comhaontuithe ann go fóill.
 */

const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach, Earraid, morphology: mf } = require('../src/index');
const ctae = require('../src/contaetha');

let pas = 0, teip = 0;
const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);

// ── áiseanna ──────────────────────────────────────────────────────────
function tionscadalBreige(comhaid) {
  const clar = new Map();
  for (const [k, v] of Object.entries(comhaid)) clar.set(path.resolve('/sb', k), v);
  return new Tionscadal({ ann: (c) => clar.has(c), léigh: (c) => clar.get(c) });
}

function coidTionscadal(comhaid, tosach = 'príomh.sb') {
  try { tionscadalBreige(comhaid).tiomsaigh(path.resolve('/sb', tosach)); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

async function rithTionscadal(comhaid, tosach = 'príomh.sb') {
  const t = tionscadalBreige(comhaid);
  const amach = [];
  const modúil = new Map();
  const bréagRequire = (conair) => {
    const abs = path.resolve('/sb', conair);
    if (modúil.has(abs)) return modúil.get(abs);
    const m = t.tiomsaigh(abs.replace(/\.js$/, '.sb'));
    const ctx = vm.createContext({
      console: { log: (x) => amach.push(String(x)) },
      module: { exports: {} },
      require: (c) => bréagRequire(path.join(path.dirname(conair), c)),
    });
    vm.runInContext(m.js, ctx);
    modúil.set(abs, ctx.module.exports);
    return ctx.module.exports;
  };
  const barr = bréagRequire(tosach.replace(/\.sb$/, '.js'));
  if (typeof barr.príomh === 'function') await barr.príomh();
  return amach;
}

function coid(src) {
  try { tiomsaigh(src, 'tástáil.sb'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

const jsDe = (src) => tiomsaigh(src, 'tástáil.sb').js;
const anailiseDe = (src) => tiomsaigh(src, 'tástáil.sb').anailiseoir;
const contaeStruchtuir = (src, ainm) => anailiseDe(src).cinealacha.get(ainm).contae;

// ══ 1. An tábla: stór focal, ní moirfeolaíocht ════════════════════════
it('tá 32 contae ann, agus níl aon ainm ina réamhrán d\'ainm eile', () => {
  assert.deepStrictEqual(ctae.seiceailTabla(), []);
});

it('ní contae í an deoraíocht', () => {
  assert.strictEqual(ctae.isContae(ctae.DEORAIOCHT), false);
  assert.strictEqual(ctae.CONTAETHA.has('deoraíocht'), false);
});

it('fanann an t-urú gan bhrí: ainm dílis atá i "nGall", ní foirm', () => {
  // `Dún na nGall` is in the table as a frozen proper name. Nothing produced
  // it and nothing demands it: the eclipsed slot is still empty (§12).
  assert.ok(ctae.isContae('Dún na nGall'));
  assert.throws(() => mf.foirmDe('gall', mf.FOIRM.URAITHE));
  // Nor did the article arrive with it.
  assert.strictEqual(ctae.isContae('na'), false);
  assert.strictEqual(ctae.isContae('An'), false);
});

// ══ 2. `as` san fhoclóir agus sa pharsálaí ════════════════════════════
it('fógraíonn modúl a chontae uair amháin', () => {
  assert.deepStrictEqual(coid('as Corcaigh\nseasmhach x = 1'), []);
  assert.strictEqual(anailiseDe('as Corcaigh\nseasmhach x = 1').contae, 'Corcaigh');
});

it('is deoraíocht an réamhshocrú', () => {
  assert.strictEqual(anailiseDe('seasmhach x = 1').contae, ctae.DEORAIOCHT);
  assert.strictEqual(contaeStruchtuir('struchtúr D { a: Uimhir }', 'D'), ctae.DEORAIOCHT);
});

it('iompraíonn an struchtúr a chontae', () => {
  const src = 'struchtúr Duine as Corcaigh { ainm: Teaghrán }';
  assert.deepStrictEqual(coid(src), []);
  assert.strictEqual(contaeStruchtuir(src, 'Duine'), 'Corcaigh');
});

it('léitear ainmneacha ilfhoclacha ina n-iomláine', () => {
  for (const c of ['Dún na nGall', 'Baile Átha Cliath', 'An Mhí', 'Uíbh Fhailí', 'Tiobraid Árann']) {
    const src = `struchtúr D as ${c} { a: Uimhir }`;
    assert.deepStrictEqual(coid(src), [], c);
    assert.strictEqual(contaeStruchtuir(src, 'D'), c);
  }
});

it('stopann an léamh santach ag deireadh an ainm', () => {
  // The only case where the greedy read could overrun is a county followed by
  // an identifier. `Corcaigh scríobh` begins no county, so the reader stops
  // and the next statement parses as itself.
  const src = 'as Corcaigh\nscríobh 1\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'seasmhach d = Duine { ainm: "Cáit" }\nscríobh ainm ó dh';
  assert.deepStrictEqual(coid(src), []);
  assert.strictEqual(anailiseDe(src).contae, 'Corcaigh');
});

it('fanann "as" ina eochairfhocal gan "asal" a bhriseadh', () => {
  // Identifiers are read maximally and *then* checked against the table, so a
  // word merely beginning with `as` is untouched (léacsóir.js).
  assert.deepStrictEqual(coid('seasmhach asal = 1\nscríobh asal'), []);
});

// ══ 3. Rialú: ní shéimhíonn `as`, agus sin an tseiceáil ═══════════════
it('is E103 é séimhiú gan údar i ndiaidh "as" — gan chód nua', () => {
  // The government table does not grow. `as` demands the base form, which is
  // what everything except ó/ar/a already demands, so unlicensed lenition is
  // caught by the mechanism that was already there.
  assert.deepStrictEqual(coid('as Chorcaigh\nseasmhach x = 1'), ['E103']);
  assert.deepStrictEqual(coid('struchtúr D as Chorcaigh { a: Uimhir }'), ['E103']);
  assert.deepStrictEqual(coid('struchtúr D as Dhún na nGall { a: Uimhir }'), ['E103']);
});

it('ní shéimhítear ach ceann an fhrása', () => {
  // Only the head of the phrase is governed, so the frozen `Fhailí` and
  // `nGall` inside a name are not the mechanism's business.
  assert.deepStrictEqual(coid('struchtúr D as Uíbh Fhailí { a: Uimhir }'), []);
});

// ══ 4. Stór focal iata: E602, E605 ═══════════════════════════════════
it('níl ann ach na 32 (E602)', () => {
  assert.deepStrictEqual(coid('as Corcaig\nseasmhach x = 1'), ['E602']);
  assert.deepStrictEqual(coid('struchtúr D as Yorkshire { a: Uimhir }'), ['E602']);
  // A real head word on its own is not a county either.
  assert.deepStrictEqual(coid('struchtúr D as Dún { a: Uimhir }'), ['E602']);
  // Wrong tail: the salvage read means the phrase is named whole rather than
  // truncated to "Dún na" and then failing as a syntax error.
  assert.deepStrictEqual(coid('struchtúr D as Dún na Sí { a: Uimhir }'), ['E602']);
});

it('ní féidir "as deoraíocht" a scríobh (E605)', () => {
  assert.deepStrictEqual(coid('as deoraíocht\nseasmhach x = 1'), ['E605']);
  assert.deepStrictEqual(coid('struchtúr D as deoraíocht { a: Uimhir }'), ['E605']);
});

// ══ 5. Contae amháin, struchtúr amháin: E603, E604 ═══════════════════
it('ní bhíonn ach struchtúr amháin ag contae (E603)', () => {
  assert.deepStrictEqual(
    coid('struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as Corcaigh { b: Uimhir }'),
    ['E603']);
  assert.deepStrictEqual(
    coid('struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as Ciarraí { b: Uimhir }'),
    []);
});

it('níl an deoraíocht eisiach', () => {
  // Otherwise a program could hold at most 32 struct types in total.
  assert.deepStrictEqual(
    coid('struchtúr A { a: Uimhir }\nstruchtúr B { b: Uimhir }\nstruchtúr C { c: Uimhir }'),
    []);
});

it('ní bhíonn téacs as dhá áit (E604)', () => {
  assert.deepStrictEqual(coid('as Corcaigh\nas Ciarraí\nseasmhach x = 1'), ['E604']);
});

// ══ 6. An teorainn idir modúil ═══════════════════════════════════════
it('maireann contae an struchtúir trasna na teorann', () => {
  const t = tionscadalBreige({ 'a.sb': 'struchtúr Duine as Corcaigh { ainm: Teaghrán }' });
  const { siniu, anailiseoir } = t.tiomsaigh('/sb/a.sb');
  assert.strictEqual(siniu.cinealacha.get('Duine').contae, 'Corcaigh');
  assert.strictEqual(anailiseoir.contae, ctae.DEORAIOCHT);
});

it('iompraíonn an síniú contae an mhodúil féin', () => {
  const t = tionscadalBreige({ 'a.sb': 'as Ciarraí\nseasmhach BEANNACHT = "Dia duit"' });
  assert.strictEqual(t.tiomsaigh('/sb/a.sb').siniu.contae, 'Ciarraí');
});

it('is domhanda an t-éileamh ar chontae (E603 trasna comhad)', () => {
  // The claim travels with the imported type, so two files cannot both take
  // Corcaigh. "One struct per county, globally" means the whole graph.
  assert.deepStrictEqual(
    coidTionscadal({
      'duine.sb': 'struchtúr Duine as Corcaigh { ainm: Teaghrán }',
      'príomh.sb': 'seasmhach d = ó "./duine.sb"\nstruchtúr Áit as Corcaigh { ainm: Teaghrán }',
    }),
    ['E603']);
});

it('ní théann contae an mhodúil trasna na teorann mar riail', () => {
  // The signature carries it so `--graf` can print it, but nothing consults
  // it from the far side: a county is a property of a place, and importing a
  // text is not moving house (§24.2).
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': 'as Gaillimh\nfeidhm beannaigh(a: Teaghrán) -> Teaghrán { "Dia duit, " + a }',
      'príomh.sb': 'as Corcaigh\nseasmhach f = ó "./foclóir.sb"\nscríobh beannaigh("Cáit")',
    }),
    []);
});

// ══ 7. Ní fheiceann an chúlchríoch aon rud de seo ════════════════════
it('ní shroicheann an dúchas an JavaScript', () => {
  // The same proof that applies to lenition and to tá/bhfuil (§28). Provenance
  // is checked entirely at compile time, so unlike mood and aspect it has no
  // runtime shadow at all — there is deliberately no `__contae`, because
  // nothing would ever read it and its presence would imply otherwise. The
  // multi-word county is the interesting one: its frozen `nGall` must not
  // appear either.
  const js = jsDe('as Dún na nGall\n'
    + 'struchtúr Duine as Dún na nGall { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }\n'
    + 'gníomh príomh() { fógair Duine { ainm: "Cáit" } }');
  for (const focal of ['Corcaigh', 'Dún na nGall', 'nGall', '__contae', 'contae']) {
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
  }
  // and the 0.5 proof still holds alongside it
  for (const focal of ['dhuine', 'fhógair']) assert.ok(!js.includes(focal), focal);
});

// ══ 8. Iompar 0.5 gan athrú ══════════════════════════════════════════
it('gineann clár gan "as" an cód céanna a ghin sé riamh', () => {
  const src = 'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm beannacht(duine: Duine) -> Teaghrán { "Dia duit, " + ainm ó dhuine }\n'
    + 'scríobh beannacht(Duine { ainm: "Cáit" })';
  assert.deepStrictEqual(coid(src), []);
  assert.ok(jsDe(src).includes('Duine$nua') || jsDe(src).includes('__cineál: "Duine"'));
});

// ══ 9. An tseiceáil féin: E601 (céim 3) ══════════════════════════════
it('osclaítear bosca sa bhaile', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), []);
});

it('ní osclaítear bosca as contae eile (E601)', () => {
  assert.deepStrictEqual(coid('as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E601']);
});

it('ná ó dheoraíocht ach oiread — níl leigheas air', () => {
  // No `comhaontú` will ever fix this one: exile is not a party to an
  // agreement. The only remedy is to place the accessing text.
  assert.deepStrictEqual(coid(
    'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E601']);
});

it('ní trádáil í deoraíocht ar dheoraíocht', () => {
  // The reason every 0.4 and 0.5 program still compiles: there is no border
  // between two things that are from nowhere.
  assert.deepStrictEqual(coid(
    'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), []);
});

it('is deoraí é an luach ar iasacht, agus mar sin scarann contae ón JavaScript', () => {
  // A placed text cannot reach `Iasacht` at all. This is the pressure the
  // feature exists to apply (§24.3).
  assert.deepStrictEqual(
    coid('as Corcaigh\ngníomh g(x: Iasacht) { scríobh fad ó x }'), ['E601']);
  assert.deepStrictEqual(
    coid('as Corcaigh\nseasmhach p = ó "node:path"\nscríobh basename ó ph("/a/b.txt")'), ['E601']);
  // …and in exile the same two lines are ordinary.
  assert.deepStrictEqual(coid('gníomh g(x: Iasacht) { scríobh fad ó x }'), []);
});

it('níl an modúl Spicebag ina rud a shealbhaítear', () => {
  // `ó "./foclóir.sb"` is a text this compiler has read, not a thing owned,
  // so its members are exempt even across a county line.
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': 'as Gaillimh\nseasmhach BEANNACHT = "Dia duit"',
      'príomh.sb': 'as Corcaigh\nseasmhach foclóir = ó "./foclóir.sb"\n'
        + 'gníomh príomh() { scríobh BEANNACHT ó fhoclóir }',
    }), []);
});

it('ní sheiceáiltear baill liosta ná bunchineálacha', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'seasmhach xs: Liosta(Uimhir) = [1, 2]\nscríobh fad ó xs\nscríobh céad ó xs'), []);
});

it('is glas ar an mbosca é an contae, ní teorainn ar an mbóthar', () => {
  // Construction, argument passing and returning are all unchecked, on
  // purpose. An exile shell builds placed values and hands them on; only the
  // opening is placed.
  assert.deepStrictEqual(coid(
    'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'seasmhach d = Duine { ainm: "Cáit" }'), []);
});

it('feidhmíonn an patrún: blaosc ar deoraíocht, croí curtha', async () => {
  // The flagship shape. `príomh.sb` is in exile, so it may touch the outside
  // world; it constructs a Corcaigh value and hands it to Corcaigh code, which
  // is the only place that value can be opened.
  const comhaid = {
    'duine.sb': 'as Corcaigh\nstruchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
      + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }',
    'príomh.sb': 'seasmhach d = ó "./duine.sb"\n'
      + 'gníomh príomh() { scríobh ainmDe(Duine { ainm: "Cáit" }) }',
  };
  assert.deepStrictEqual(coidTionscadal(comhaid), []);
  assert.deepStrictEqual(await rithTionscadal(comhaid), ['Cáit']);
});

it('seiceáiltear glao modha, ach ní fhógra modha', () => {
  // Declaring `ó Dhuine` names a category; it opens nothing. Calling
  // `beannacht ó dh` opens the value, and so does `ainm ó fhéin` in the body.
  const coidi = coid('as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm beannacht ó Dhuine(féin) -> Teaghrán { ainm ó fhéin }\n'
    + 'seasmhach d = Duine { ainm: "Cáit" }\nscríobh beannacht ó dh()');
  assert.strictEqual(coidi.length, 2, JSON.stringify(coidi));
  assert.ok(coidi.every((c) => c === 'E601'), JSON.stringify(coidi));
});

it('seiceáiltear gach nasc de shlabhra sealbhaigh ar leith', () => {
  // The same shape as lenition: each `ó` governs its own complement, and each
  // `ó` opens its own box.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Áit as Ciarraí { ainm: Teaghrán }\n'
    + 'struchtúr Duine as Corcaigh { áit: Áit }\n'
    + 'feidhm cá(duine: Duine) -> Teaghrán { ainm ó áit ó dhuine }'), ['E601']);
});

it('ní fhágann an tseiceáil rian ar bith sa JavaScript', () => {
  const js = jsDe('as Corcaigh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }\n'
    + 'gníomh príomh() { fógair Duine { ainm: "Cáit" } }');
  for (const focal of ['Corcaigh', '__contae', 'contae', 'deoraíocht', 'dhuine'])
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
});

// ══ 10. Comhaontuithe (céim 4) ═══════════════════════════════════════
it('osclaíonn comhaontú an bosca', () => {
  const bun = 'as Corcaigh\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }';
  assert.deepStrictEqual(coid(bun), ['E601']);
  assert.deepStrictEqual(coid('comhaontú Corcaigh Ciarraí\n' + bun), []);
});

it('is comhaontú é ón dá thaobh', () => {
  const bun = 'as Corcaigh\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }';
  assert.deepStrictEqual(coid('comhaontú Ciarraí Corcaigh\n' + bun), []);
});

it('níl comhaontú tarchurthach — sin an rud a dhéanann comhaontú de', () => {
  // Corcaigh–Ciarraí plus Ciarraí–Gaillimh does not give Corcaigh–Gaillimh.
  // A transitive treaty would be a partition of the 32 into blocs, which is
  // the thing a treaty exists instead of.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'comhaontú Corcaigh Ciarraí\ncomhaontú Ciarraí Gaillimh\n'
    + 'struchtúr Áit as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm cá(áit: Áit) -> Teaghrán { ainm ó áit }'), ['E601']);
});

it('is cuma cá bhfuil an comhaontú sa chomhad', () => {
  // File scope, not lexical order: a treaty at the bottom licenses an access
  // at the top, because it describes the place rather than a point in it.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }\n'
    + 'comhaontú Corcaigh Ciarraí'), []);
});

it('ní dhéantar comhaontú le duine féin (E606)', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Corcaigh'), ['E606']);
});

it('ní hionann ord agus comhaontú nua (E607)', () => {
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí\ncomhaontú Ciarraí Corcaigh'), ['E607']);
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí\ncomhaontú Corcaigh Gaillimh'), []);
});

it('ní páirtí í an deoraíocht (E605), agus níl leigheas uirthi', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh deoraíocht'), ['E605']);
  // Even with every treaty a file could write, `Iasacht` stays out of reach.
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí\ngníomh g(x: Iasacht) { scríobh fad ó x }'),
    ['E601']);
});

it('seiceáiltear ainmneacha comhaontaithe mar aon ainm eile', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Yorkshire'), ['E602']);
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Chorcaigh Ciarraí'), ['E103']);
  // Two multi-word names in a row, no separator between them.
  assert.deepStrictEqual(coid('as Dún na nGall\ncomhaontú Dún na nGall Baile Átha Cliath'), []);
  // A truncated first name does not swallow the second: E602, not a parse error.
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Dún Ciarraí'), ['E602']);
});

it('ní thaistealaíonn comhaontú trasna na teorann', () => {
  // A treaty is a property of a place, not of a value, so it stays in the file
  // that declared it. "Declared elsewhere, silently applies here" would make
  // E601 undiagnosable from the file in front of you.
  const bun = {
    'duine.sb': 'as Corcaigh\ncomhaontú Corcaigh Ciarraí\n'
      + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
      + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }',
  };
  assert.deepStrictEqual(coidTionscadal({ ...bun, 'príomh.sb': 'seasmhach d = ó "./duine.sb"' }), []);
  const olc = { ...bun, 'príomh.sb': 'as Corcaigh\nseasmhach d = ó "./duine.sb"\n'
    + 'feidhm f(duine: Duine) -> Teaghrán { ainm ó dhuine }' };
  assert.deepStrictEqual(coidTionscadal(olc), ['E601']);
  const ceart = { ...olc, 'príomh.sb': 'comhaontú Corcaigh Ciarraí\n' + olc['príomh.sb'] };
  assert.deepStrictEqual(coidTionscadal(ceart), []);
});

it('ní fhágann comhaontú rian ar bith sa JavaScript ach oiread', () => {
  const js = jsDe('as Corcaigh\ncomhaontú Corcaigh Ciarraí\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }');
  for (const focal of ['comhaontú', 'Corcaigh', 'Ciarraí', 'contae'])
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
});

// ══ 11. --graf (céim 5) ══════════════════════════════════════════════
it('tuairiscíonn --graf dúchas gach cineáil', () => {
  const { duchasanna } = require('../src/index');
  const d = duchasanna(anailiseDe('as Corcaigh\ncomhaontú Corcaigh Ciarraí\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'struchtúr Nóta { téacs: Teaghrán }'));
  assert.strictEqual(d.contae, 'Corcaigh');
  assert.deepStrictEqual(d.cinealacha, [
    { ainm: 'Duine', contae: 'Ciarraí' },
    { ainm: 'Nóta', contae: ctae.DEORAIOCHT },
  ]);
  assert.deepStrictEqual(d.comhaontuithe, [{ a: 'Ciarraí', b: 'Corcaigh', iomaíocht: true }]);
});

it('is scéal a insíonn --graf, ní riail a chuireann sé i bhfeidhm', () => {
  // The rivalry mark is presentation. A treaty between rivals is legal and
  // behaves like any other; refusing it would be a hard-coded exception in the
  // one place the system claims to be uniform (§24.5).
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí'), []);
  assert.strictEqual(ctae.isIomaiocht('Corcaigh', 'Ciarraí'), true);
  assert.strictEqual(ctae.isIomaiocht('Ciarraí', 'Corcaigh'), true);
  assert.strictEqual(ctae.isIomaiocht('Corcaigh', 'Liatroim'), false);
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n    ${e.message}`); }
  }
  console.log(`\ncontae: ${pas} pas, ${teip} teip`);
  if (teip) process.exit(1);
})();