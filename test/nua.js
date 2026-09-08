'use strict';

/*
 * test/nua.js — tástálacha do chéim 0.5.
 *
 * Ar leithligh ó `run.js` d'aon ghnó: níl aon rud anseo a bhaineann le
 * 0.4, agus is féidir an dá chomhad a rith le chéile nó ina n-aonar.
 *
 *     node test/nua.js
 *
 * Úsáideann na tástálacha modúl comhadlann bhréige, mar sin níl aon
 * chomhad ar an diosca ag teastáil uathu.
 */

const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach, Earraid } = require('../src/index');

let pas = 0, teip = 0;
const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);

// ── áiseanna ──────────────────────────────────────────────────────────
/** A project over an in-memory file table, keyed by absolute path. */
function tionscadalBreige(comhaid) {
  const clar = new Map();
  for (const [k, v] of Object.entries(comhaid)) clar.set(path.resolve('/sb', k), v);
  return new Tionscadal({
    ann: (c) => clar.has(c),
    léigh: (c) => clar.get(c),
  });
}

/** Compile a module set and run the entry module's `príomh`. */
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

/** Error codes from compiling a module set. */
function coidTionscadal(comhaid, tosach = 'príomh.sb') {
  try { tionscadalBreige(comhaid).tiomsaigh(path.resolve('/sb', tosach)); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

/** Single-source helpers, unchanged in behaviour from 0.4. */
async function rith(src) {
  const { js } = tiomsaigh(src, 'tástáil.sb');
  const amach = [];
  const ctx = vm.createContext({
    console: { log: (x) => amach.push(String(x)) },
    module: { exports: {} },
    require,
  });
  vm.runInContext(js, ctx);
  if (typeof ctx.module.exports.príomh === 'function') await ctx.module.exports.príomh();
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

const FOCLOIR = `seasmhach BEANNACHT = "Dia duit"
feidhm beannaigh(ainm: Teaghrán) -> Teaghrán { BEANNACHT + ", " + ainm }
gníomh fáiltigh(ainm: Teaghrán) { scríobh beannaigh(ainm) }
`;

// ══ 15. An teorainn idir modúil (DEARADH.md §19) ═════════════════════════════════
it('maireann cineál, modh agus aspect trasna na teorann', () => {
  const t = tionscadalBreige({ 'a.sb': FOCLOIR });
  const { siniu } = t.tiomsaigh('/sb/a.sb');
  assert.strictEqual(siniu.onnmhairi.get('beannaigh').kind, 'feidhm');
  assert.strictEqual(siniu.onnmhairi.get('fáiltigh').kind, 'gníomh');
  assert.strictEqual(siniu.onnmhairi.get('BEANNACHT').kind, 'luach');
  assert.deepStrictEqual([...siniu.gniomhartha], ['fáiltigh']);
});

it('is ordú é ordú iasachta, gan cháiliú', async () => {
  assert.deepStrictEqual(
    await rithTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach f = ó "./foclóir.sb"\ngníomh príomh() { fáiltigh "Cáit" }',
    }),
    ['Dia duit, Cáit']);
});

it('rialaíonn `ó` sealbhóir modúil fós', async () => {
  const comhaid = {
    'foclóir.sb': FOCLOIR,
    'príomh.sb': 'seasmhach foclóir = ó "./foclóir.sb"\n'
      + 'gníomh príomh() { scríobh BEANNACHT ó fhoclóir  scríobh beannaigh ó fhoclóir("Oisín") }',
  };
  assert.deepStrictEqual(await rithTionscadal(comhaid), ['Dia duit', 'Dia duit, Oisín']);
  const olc = { ...comhaid, 'príomh.sb': comhaid['príomh.sb'].replace(/ó fhoclóir/g, 'ó foclóir') };
  assert.deepStrictEqual(coidTionscadal(olc), ['E102', 'E102']);
});

it('ní ainmní é ordú iasachta ach oiread (E501)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach foclóir = ó "./foclóir.sb"\n'
        + 'gníomh príomh() { seasmhach g = fáiltigh ó fhoclóir  scríobh g }',
    }),
    ['E501']);
});

it('ní ghlacann ordú le sealbhóir (E516)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach foclóir = ó "./foclóir.sb"\ngníomh príomh() { fáiltigh ó fhoclóir("Cáit") }',
    }),
    ['E516']);
});

it('tagann struchtúir iasachta isteach mar chineálacha', async () => {
  assert.deepStrictEqual(
    await rithTionscadal({
      'cineál.sb': 'struchtúr Duine { ainm: Teaghrán }\nfeidhm nua(a: Teaghrán) -> Duine { Duine { ainm: a } }',
      'príomh.sb': 'seasmhach c = ó "./cineál.sb"\n'
        + 'feidhm ainmDe(d: Duine) -> Teaghrán { ainm ó dh }\n'
        + 'gníomh príomh() { scríobh ainmDe(nua("Cáit")) }',
    }),
    ['Cáit']);
});

it('téann ball dúchasach trí chomhaontú, murab ionann agus ball iasachta', () => {
  // A foreign name has no mutation slot at all — you do not get to rename
  // someone else's API. A native member is an Irish lemma and is governed.
  assert.deepStrictEqual(coid('seasmhach R = Router ó "express"'), []);
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach x = bheannaigh ó "./foclóir.sb"',
    }),
    ['E103']);
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach x = nachAnn ó "./foclóir.sb"',
    }),
    ['E203']);
});

it('is E208 é ceangal áitiúil a bhuaileann le hiompórtáil', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'seasmhach foclóir = ó "./foclóir.sb"\ngníomh fáiltigh(x: Teaghrán) { scríobh x }',
    }),
    ['E208']);
});

it('dhá mhodúl, an lemma céanna (E106)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'a.sb': 'gníomh fógair(t: Teaghrán) { scríobh t }',
      'b.sb': 'gníomh fógair(t: Teaghrán) { scríobh t }',
      'príomh.sb': 'seasmhach a = ó "./a.sb"\nseasmhach b = ó "./b.sb"',
    }),
    ['E106']);
});

it('modúl ar iarraidh (E109) agus timthriall (E110)', () => {
  assert.deepStrictEqual(
    coidTionscadal({ 'príomh.sb': 'seasmhach x = ó "./níl-ann.sb"' }),
    ['E109']);
  assert.deepStrictEqual(
    coidTionscadal({
      'a.sb': 'seasmhach b = ó "./b.sb"\nfeidhm f() -> Uimhir { 1 }',
      'b.sb': 'seasmhach a = ó "./a.sb"\nfeidhm g() -> Uimhir { 2 }',
      'príomh.sb': 'seasmhach a = ó "./a.sb"',
    }),
    ['E110']);
});

it('is Iasacht fós é modúl JavaScript', () => {
  // Nothing about the graph reaches a foreign origin: `ó "express"` is
  // unchanged, and a .js path is not a Spicebag module.
  const js = jsDe('seasmhach e = ó "express"\nseasmhach R = Router ó "express"');
  assert.ok(js.includes('require("express").Router'));
  assert.deepStrictEqual(coid('seasmhach p = ó "node:path"\nscríobh basename ó ph("/a/b.txt")'), []);
});

it('gan tionscadal, is Iasacht gach iompórtáil — iompar 0.4', () => {
  // The single-source entry point is unchanged, which is why the 0.4 suite
  // still passes without touching a line of it.
  assert.deepStrictEqual(coid('seasmhach s = ó "./sonraí.sb"\nscríobh aonrud ó s'), []);
});

// ══ 16. Cineál an bhriathair (DEARADH.md §20) ════════════════════════════════════
it('is féidir cineál briathair a scríobh, agus tá an modh ann', () => {
  assert.deepStrictEqual(coid('gníomh g(f: feidhm(Uimhir) -> Uimhir) { scríobh f(1) }'), []);
  assert.deepStrictEqual(coid('gníomh g(x: gníomh(Uimhir), xs: Liosta(Uimhir)) { déan x ar xs }'), []);
  assert.deepStrictEqual(coid('feidhm f(g: ag gníomh(Uimhir)) -> Uimhir { 1 }'), []);
});

it('ní ghlacann cineál gnímh le toradh (E404)', () => {
  assert.deepStrictEqual(coid('gníomh g(x: gníomh(Uimhir) -> Uimhir) { }'), ['E404']);
});

it('is cuid den chineál é an modh (E201)', () => {
  assert.deepStrictEqual(
    coid('feidhm dúbail(u: Uimhir) -> Uimhir { u + u }\n'
      + 'gníomh g(x: gníomh(Uimhir), xs: Liosta(Uimhir)) { déan x ar xs }\n'
      + 'gníomh príomh() { seasmhach xs: Liosta(Uimhir) = [1]  g a dhúbail, xs }'),
    ['E201']);
});

it('seiceáiltear paraiméadair agus toradh an bhriathair-chineáil', () => {
  const bun = 'feidhm dúbail(u: Uimhir) -> Uimhir { u + u }\n';
  assert.deepStrictEqual(
    coid(bun + 'feidhm cur(f: feidhm(Uimhir) -> Uimhir) -> Uimhir { f(1) }\n'
      + 'scríobh cur(a dhúbail)'), []);
  assert.deepStrictEqual(
    coid(bun + 'feidhm cur(f: feidhm(Teaghrán) -> Uimhir) -> Uimhir { f("a") }\n'
      + 'scríobh cur(a dhúbail)'), ['E201']);
});

it('feidhmíonn briathar mar luach sa dá mhodh', async () => {
  const src = `gníomh fógair(t: Teaghrán) { scríobh t }
gníomh faoiDhó(g: gníomh(Teaghrán), xs: Liosta(Teaghrán)) { déan g ar xs  déan g ar xs }
feidhm dúbail(u: Uimhir) -> Uimhir { u + u }
feidhm cur(f: feidhm(Uimhir) -> Uimhir, u: Uimhir) -> Uimhir { f(u) }
gníomh príomh() { faoiDhó a fhógair, ["a"]  scríobh cur(a dhúbail, 21) }`;
  assert.deepStrictEqual(await rith(src), ['a', 'a', '42']);
});

it('is E501 é briathar a luaitear gan é a chomhlíonadh', () => {
  assert.deepStrictEqual(coid('gníomh f(g: gníomh(Uimhir)) { g }'), ['E501']);
  assert.deepStrictEqual(coid('gníomh fógair(u: Uimhir) { scríobh u }\ngníomh f() { a fhógair }'), ['E501']);
});

// ══ 17. Atriall: déan … ar … (DEARADH.md §21) ════════════════════════════════════
it('dáileann `déan` an gníomh ar bhaill an bhailiúcháin', async () => {
  const src = `gníomh fógair(t: Teaghrán) { scríobh t }
gníomh príomh() { seasmhach xs: Liosta(Teaghrán) = ["a", "b", "c"]  déan a fhógair ar xs }`;
  assert.deepStrictEqual(await rith(src), ['a', 'b', 'c']);
});

it('séimhíonn "ar" agus "a" san atriall, tríd an gcód céanna', () => {
  const bun = 'gníomh fógair(u: Uimhir) { scríobh u }\n'
    + 'gníomh príomh() { seasmhach daoine: Liosta(Uimhir) = [1]  déan a fhógair ar dhaoine }';
  assert.deepStrictEqual(coid(bun), []);
  assert.deepStrictEqual(coid(bun.replace('ar dhaoine', 'ar daoine')), ['E102']);
  assert.deepStrictEqual(coid(bun.replace('a fhógair', 'a fógair')), ['E102']);
});

it('roghnaíonn an briathar a réamhfhocal (E514, E515)', () => {
  assert.deepStrictEqual(
    coid('gníomh fógair(u: Uimhir) { scríobh u }\ngníomh príomh() { déan a fhógair }'), ['E514']);
  assert.deepStrictEqual(
    coid('gníomh fógair(u: Uimhir) { scríobh u }\ngníomh príomh() { fógair 1 ar 2 }'), ['E515']);
});

it('ní mór don bhriathar a bheith ag teacht le mír an liosta (E201)', () => {
  assert.deepStrictEqual(
    coid('gníomh fógair(u: Uimhir) { scríobh u }\n'
      + 'gníomh príomh() { seasmhach xs: Liosta(Teaghrán) = ["a"]  déan a fhógair ar xs }'),
    ['E201']);
});

it('ní ghlacann `déan` le feidhm: caitear a toradh i dtraipisí', () => {
  assert.deepStrictEqual(
    coid('feidhm dúbail(u: Uimhir) -> Uimhir { u + u }\n'
      + 'gníomh príomh() { seasmhach xs: Liosta(Uimhir) = [1]  déan a dhúbail ar xs }'),
    ['E201']);
});

it('is ordú é an t-atriall, mar sin tá sé faoi na rialacha modha (E502)', () => {
  assert.deepStrictEqual(
    coid('gníomh fógair(u: Uimhir) { scríobh u }\n'
      + 'feidhm f(xs: Liosta(Uimhir)) -> Uimhir { déan a fhógair ar xs  1 }'),
    ['E502']);
});

it('is é aspect an bhriathair aspect na lúibe (E504)', () => {
  const bun = 'ag gníomh sábháil(u: Uimhir) { tar éis moill(u) }\n'
    + 'ag feidhm moill(u: Uimhir) -> Uimhir { u }\n';
  const js = jsDe(bun + 'ag gníomh príomh() { seasmhach xs: Liosta(Uimhir) = [1]  déan a shábháil ar xs }');
  assert.ok(/for \(const __t\d+ of xs\) await sábháil\(__t\d+\)/.test(js), js);
  assert.deepStrictEqual(
    coid(bun + 'gníomh príomh() { seasmhach xs: Liosta(Uimhir) = [1]  déan a shábháil ar xs }'),
    ['E504']);
});

it('atriallann `déan` ar Iasacht freisin', async () => {
  assert.deepStrictEqual(
    await rith('gníomh fógair(x: Iasacht) { scríobh x }\n'
      + 'gníomh príomh() { seasmhach xs: Iasacht = ["a", "b"]  déan a fhógair ar xs }'),
    ['a', 'b']);
});

// ══ 18. Ní fheiceann an chúlchríoch gramadach ═════════════════════════
it('ní shroicheann foirm ghramadaí an t-aschur, fiú trasna modúl', async () => {
  const t = tionscadalBreige({
    'foclóir.sb': 'gníomh fógair(duine: Teaghrán) { scríobh duine }',
    'príomh.sb': 'seasmhach foclóir = ó "./foclóir.sb"\n'
      + 'gníomh príomh() { seasmhach daoine: Liosta(Teaghrán) = ["a"]\n'
      + '  scríobh fad ó dhaoine\n  déan a fhógair ar dhaoine }',
  });
  const { js } = t.tiomsaigh('/sb/príomh.sb');
  for (const foirm of ['dhaoine', 'fhoclóir', 'fhógair', 'bhfuil']) {
    assert.ok(!js.includes(foirm), `${foirm} sa JavaScript`);
  }
});

it('níl aon eolas ar thiománaí sa ghraf modúl ach oiread (Céim 6)', () => {
  // src/modúil.js is a compiler file and belongs under the same rule as the
  // other four: nothing above rt/stór.js knows what a driver is.
  const fs = require('fs');
  const téacs = fs.readFileSync(path.join(__dirname, '../src/modúil.js'), 'utf8');
  for (const focal of ['prisma', 'sqlite', 'sql']) {
    assert.ok(!new RegExp(focal, 'i').test(téacs), focal);
  }
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; console.log(`  ✓ ${ainm}`); }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n      ${e.message.split('\n')[0]}`); }
  }
  console.log(`\n${pas} rite, ${teip} teipthe`);
  process.exit(teip ? 1 : 0);
})();
