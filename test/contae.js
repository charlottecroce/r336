'use strict';

/*
 * Stages 0.6 and 0.7.
 *
 * `Corcaigh`/`Ciarraí` is no longer the neutral "two different counties" pair.
 * They share a province and have a feud, so `Corcaigh`/`Gaillimh` is the
 * neutral pair now and `Corcaigh`/`Ciarraí` appears only where the feud itself
 * is what is being tested.
 */

const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach, Earraid, morphology: mf } = require('../src/index');
const ctae = require('../src/contaetha');

const { it, rithSraith } = require('./creatlach');

// ── áiseanna ──────────────────────────────────────────────────────────
function tionscadalBreige(comhaid) {
  const clar = new Map();
  for (const [k, v] of Object.entries(comhaid)) clar.set(path.resolve('/sb', k), v);
  return new Tionscadal({ ann: (c) => clar.has(c), léigh: (c) => clar.get(c) });
}

function coidTionscadal(comhaid, tosach = 'príomh.r336') {
  try { tionscadalBreige(comhaid).tiomsaigh(path.resolve('/sb', tosach)); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

async function rithTionscadal(comhaid, tosach = 'príomh.r336') {
  const t = tionscadalBreige(comhaid);
  const amach = [];
  const modúil = new Map();
  const bréagRequire = (conair) => {
    const abs = path.resolve('/sb', conair);
    if (modúil.has(abs)) return modúil.get(abs);
    const m = t.tiomsaigh(abs.replace(/\.js$/, '.r336'));
    const ctx = vm.createContext({
      console: { log: (x) => amach.push(String(x)) },
      module: { exports: {} },
      require: (c) => bréagRequire(path.join(path.dirname(conair), c)),
    });
    vm.runInContext(m.js, ctx);
    modúil.set(abs, ctx.module.exports);
    return ctx.module.exports;
  };
  const barr = bréagRequire(tosach.replace(/\.r336$/, '.js'));
  if (typeof barr.príomh === 'function') await barr.príomh();
  return amach;
}

function earraidiDe(src) {
  try { tiomsaigh(src, 'tástáil.r336'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi;
    if (e instanceof Earraid) return [e];
    throw e;
  }
}

const coid = (src) => earraidiDe(src).map((x) => x.cod);

const jsDe = (src) => tiomsaigh(src, 'tástáil.r336').js;
const anailiseDe = (src) => tiomsaigh(src, 'tástáil.r336').anailiseoir;
const contaeStruchtuir = (src, ainm) => anailiseDe(src).cinealacha.get(ainm).contae;

// ══ 1. An tábla: stór focal, ní moirfeolaíocht ════════════════════════
it('tá 32 contae ann, agus seasann gach ionvariant sa tábla',
  'there are 32 counties, and every invariant in the table holds', () => {
  assert.deepStrictEqual(ctae.seiceailTabla(), []);
});

it('ní contae í an deoraíocht',
  'exile is not a county', () => {
  assert.strictEqual(ctae.isContae(ctae.DEORAIOCHT), false);
  assert.strictEqual(ctae.CONTAETHA.has('deoraíocht'), false);
});

it('ní chuireann slot an uraithe isteach ar ainm dílis: "nGall" atá ann, ní foirm',
  'the eclipsis slot does not disturb a proper name: "nGall" is the name, not a form', () => {
  // `Dún na nGall` is in the table as a frozen proper name. The greedy reader
  // matches the head word, so `nGall` never reaches `reitighFoirm`.
  assert.ok(ctae.isContae('Dún na nGall'));
  assert.deepStrictEqual(coid('as Dún na nGall\nx seasmhach = 1'), []);
  assert.deepStrictEqual(coid('as Uíbh Fhailí\nx seasmhach = 1'), []);
  // A frozen string and not a form: `nDún na nGall` is not a county.
  assert.deepStrictEqual(coid('as nDún na nGall\nx seasmhach = 1'), ['E602']);
  assert.strictEqual(ctae.isContae('nDún na nGall'), false);
  // No article either. `i` eclipses on its own: *i mbaile*, never *i an mbaile*.
  assert.strictEqual(ctae.isContae('na'), false);
  assert.strictEqual(ctae.isContae('An'), false);
  assert.strictEqual(ctae.isContae('An Mhumhain'), false);
  assert.deepStrictEqual(coid('as An Mhumhain\nx seasmhach = 1'), ['E602']);
});

it('freagraíonn an deoraíocht mar chúige di féin',
  'exile answers as a province of its own', () => {
  // This keeps the border rule at four cases and one comparison (§25.3).
  assert.strictEqual(ctae.cuigeDe('Corcaigh'), ctae.CUIGI.MUMHAIN);
  assert.strictEqual(ctae.cuigeDe('Ciarraí'), ctae.CUIGI.MUMHAIN);
  assert.strictEqual(ctae.cuigeDe('Gaillimh'), ctae.CUIGI.CONNACHTA);
  assert.strictEqual(ctae.cuigeDe(ctae.DEORAIOCHT), ctae.DEORAIOCHT);
});

it('níl an deoraíocht ina hiomaitheoir ag aon duine',
  'exile is nobody\'s rival', () => {
  // Why no pre-0.7 program is touched by the veto: exile has no history.
  assert.strictEqual(ctae.isIomaiocht(ctae.DEORAIOCHT, 'Corcaigh'), false);
  assert.strictEqual(ctae.isIomaiocht('Corcaigh', ctae.DEORAIOCHT), false);
  assert.strictEqual(ctae.isIomaiocht(ctae.DEORAIOCHT, ctae.DEORAIOCHT), false);
});

it('tá an t-aighneas comhchineálach agus tá sé gearr',
  'the feud is symmetric, and it is short', () => {
  assert.strictEqual(ctae.isIomaiocht('Corcaigh', 'Ciarraí'), true);
  assert.strictEqual(ctae.isIomaiocht('Ciarraí', 'Corcaigh'), true);
  assert.strictEqual(ctae.isIomaiocht('Baile Átha Cliath', 'Ciarraí'), true);
  assert.strictEqual(ctae.isIomaiocht('Corcaigh', 'Liatroim'), false);
  // Short enough to stay true. Raising it means checking first that it is still
  // a list a reader recognises (§24.4, §25.4).
  assert.ok(ctae.IOMAIOCHT.length <= 12, `${ctae.IOMAIOCHT.length} péire`);
});

it('fágann gach aighneas éalú: níl aon dá chúige dúnta ar a chéile',
  'every feud leaves an escape: no two provinces are closed to each other', () => {
  // There is no ceasefire keyword because there is already an escape, and it
  // costs you the county you wanted.
  for (const p of ctae.CUIGI_UILE) {
    for (const q of ctae.CUIGI_UILE) {
      if (p === q) continue;
      const saor = ctae.contaethaCuige(p)
        .some((a) => ctae.contaethaCuige(q).some((b) => !ctae.isIomaiocht(a, b)));
      assert.ok(saor, `${p} / ${q}`);
    }
  }
});

// ══ 2. `as` san fhoclóir agus sa pharsálaí ════════════════════════════
it('fógraíonn modúl a chontae uair amháin',
  'a module declares its county once', () => {
  assert.deepStrictEqual(coid('as Corcaigh\nx seasmhach = 1'), []);
  assert.strictEqual(anailiseDe('as Corcaigh\nx seasmhach = 1').contae, 'Corcaigh');
});

it('is deoraíocht an réamhshocrú',
  'exile is the default', () => {
  assert.strictEqual(anailiseDe('x seasmhach = 1').contae, ctae.DEORAIOCHT);
  assert.strictEqual(contaeStruchtuir('struchtúr D { a: Uimhir }', 'D'), ctae.DEORAIOCHT);
});

it('iompraíonn an struchtúr a chontae',
  'a struct carries its county', () => {
  const src = 'struchtúr Duine as Corcaigh { ainm: Teaghrán }';
  assert.deepStrictEqual(coid(src), []);
  assert.strictEqual(contaeStruchtuir(src, 'Duine'), 'Corcaigh');
});

it('léitear ainmneacha ilfhoclacha ina n-iomláine',
  'multi-word names are read whole', () => {
  for (const c of ['Dún na nGall', 'Baile Átha Cliath', 'An Mhí', 'Uíbh Fhailí', 'Tiobraid Árann']) {
    const src = `struchtúr D as ${c} { a: Uimhir }`;
    assert.deepStrictEqual(coid(src), [], c);
    assert.strictEqual(contaeStruchtuir(src, 'D'), c);
  }
});

it('stopann an léamh santach ag deireadh an ainm',
  'the greedy read stops at the end of the name', () => {
  const src = 'as Corcaigh\nscríobh 1\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'd seasmhach = Duine { ainm: "Cáit" }\nscríobh ainm ó dh';
  assert.deepStrictEqual(coid(src), []);
  assert.strictEqual(anailiseDe(src).contae, 'Corcaigh');
});

it('fanann "as" ina eochairfhocal gan "asal" a bhriseadh',
  '"as" stays a keyword without breaking "asal"', () => {
  assert.deepStrictEqual(coid('asal seasmhach = 1\nscríobh asal'), []);
});

// ══ 3. Rialú: ní shéimhíonn `as`, agus sin an tseiceáil ═══════════════
it('is E103 é séimhiú gan údar i ndiaidh "as" — gan chód nua',
  'unwarranted lenition after "as" is E103 — with no new code', () => {
  assert.deepStrictEqual(coid('as Chorcaigh\nx seasmhach = 1'), ['E103']);
  assert.deepStrictEqual(coid('struchtúr D as Chorcaigh { a: Uimhir }'), ['E103']);
  assert.deepStrictEqual(coid('struchtúr D as Dhún na nGall { a: Uimhir }'), ['E103']);
});

it('ní shéimhítear ach ceann an fhrása',
  'only the head of the phrase is lenited', () => {
  assert.deepStrictEqual(coid('struchtúr D as Uíbh Fhailí { a: Uimhir }'), []);
});

// ══ 4. Stór focal iata: E602, E605 ═══════════════════════════════════
it('níl ann ach na 32 (E602)',
  'there are only the 32 (E602)', () => {
  assert.deepStrictEqual(coid('as Corcaig\nx seasmhach = 1'), ['E602']);
  assert.deepStrictEqual(coid('struchtúr D as Yorkshire { a: Uimhir }'), ['E602']);
  assert.deepStrictEqual(coid('struchtúr D as Dún { a: Uimhir }'), ['E602']);
  assert.deepStrictEqual(coid('struchtúr D as Dún na Sí { a: Uimhir }'), ['E602']);
});

it('ní féidir "as deoraíocht" a scríobh (E605)',
  '"as deoraíocht" cannot be written (E605)', () => {
  assert.deepStrictEqual(coid('as deoraíocht\nx seasmhach = 1'), ['E605']);
  assert.deepStrictEqual(coid('struchtúr D as deoraíocht { a: Uimhir }'), ['E605']);
});

// ══ 5. Cúige amháin, struchtúr amháin: E603, E604 (§25.2) ════════════
it('ní bhíonn ach struchtúr amháin ag cúige (E603)',
  'a province holds only one struct (E603)', () => {
  // The 0.6 rule was one per county and this pair was legal. It is not.
  assert.deepStrictEqual(
    coid('struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as Ciarraí { b: Uimhir }'),
    ['E603']);
  // The same county is still the same province, so 0.6's case still fires.
  assert.deepStrictEqual(
    coid('struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as Corcaigh { b: Uimhir }'),
    ['E603']);
  // Every county of a taken province is closed, not just the obvious neighbours.
  for (const c of ['Luimneach', 'An Clár', 'Port Láirge', 'Tiobraid Árann']) {
    assert.deepStrictEqual(
      coid(`struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as ${c} { b: Uimhir }`),
      ['E603'], c);
  }
});

it('ainmníonn E603 an cúige, an contae atá ann, agus an struchtúr',
  'E603 names the province, the county holding it, and the struct', () => {
  // Three jobs: what was taken, who is sitting in it, and under what name.
  // The thing taken is not the county that was written, which is what 0.6 got wrong.
  const [e] = earraidiDe(
    'struchtúr Duine as Corcaigh { a: Uimhir }\nstruchtúr Áit as Ciarraí { b: Uimhir }');
  assert.strictEqual(e.cod, 'E603');
  for (const cuid of [ctae.CUIGI.MUMHAIN, 'Corcaigh', 'Duine']) {
    assert.ok(e.teachtaireacht.includes(cuid), `${cuid} ar iarraidh: ${e.teachtaireacht}`);
  }
});

it('coinnítear na ceithre chúige ar fad, agus is E603 an cúigiú cineál',
  'all four provinces can be held, and the fifth type is E603', () => {
  const ceithre = 'struchtúr A as Corcaigh { a: Uimhir }\n'        // An Mhumhain
    + 'struchtúr B as Cill Dara { a: Uimhir }\n'                    // Laighin
    + 'struchtúr C as Sligeach { a: Uimhir }\n'                     // Connachta
    + 'struchtúr D as Muineachán { a: Uimhir }';                    // Ulaidh
  assert.deepStrictEqual(coid(ceithre), []);
  assert.deepStrictEqual(coid(`${ceithre}\nstruchtúr E as Liatroim { a: Uimhir }`), ['E603']);
});

it('níl an deoraíocht eisiach',
  'exile is not exclusive', () => {
  // Otherwise a program could hold four struct types in total.
  assert.deepStrictEqual(
    coid('struchtúr A { a: Uimhir }\nstruchtúr B { b: Uimhir }\nstruchtúr C { c: Uimhir }\n'
      + 'struchtúr D { d: Uimhir }\nstruchtúr E { e: Uimhir }'),
    []);
});

it('ní bhíonn téacs as dhá áit (E604)',
  'a text is not from two places (E604)', () => {
  assert.deepStrictEqual(coid('as Corcaigh\nas Ciarraí\nx seasmhach = 1'), ['E604']);
});

// ══ 6. An teorainn idir modúil ═══════════════════════════════════════
it('maireann contae an struchtúir trasna na teorann',
  'a struct\'s county survives across the border', () => {
  const t = tionscadalBreige({ 'a.r336': 'struchtúr Duine as Corcaigh { ainm: Teaghrán }' });
  const { siniu, anailiseoir } = t.tiomsaigh('/sb/a.r336');
  assert.strictEqual(siniu.cinealacha.get('Duine').contae, 'Corcaigh');
  assert.strictEqual(anailiseoir.contae, ctae.DEORAIOCHT);
});

it('iompraíonn an síniú contae an mhodúil féin',
  'a signature carries the module\'s own county', () => {
  const t = tionscadalBreige({ 'a.r336': 'as Ciarraí\nBEANNACHT seasmhach = "Dia duit"' });
  assert.strictEqual(t.tiomsaigh('/sb/a.r336').siniu.contae, 'Ciarraí');
});

it('is domhanda an t-éileamh ar chúige (E603 trasna comhad)',
  'the claim on a province is global (E603 across files)', () => {
  // Globally means the whole graph. The claim travels with the imported type,
  // so a second file cannot take another county of a spent province.
  assert.deepStrictEqual(
    coidTionscadal({
      'duine.r336': 'struchtúr Duine as Corcaigh { ainm: Teaghrán }',
      'príomh.r336': 'd seasmhach = ó "./duine.r336"\nstruchtúr Áit as Ciarraí { ainm: Teaghrán }',
    }),
    ['E603']);
  // And a free province across the graph is still free.
  assert.deepStrictEqual(
    coidTionscadal({
      'duine.r336': 'struchtúr Duine as Corcaigh { ainm: Teaghrán }',
      'príomh.r336': 'd seasmhach = ó "./duine.r336"\nstruchtúr Áit as Gaillimh { ainm: Teaghrán }',
    }),
    []);
});

it('ní théann contae an mhodúil trasna na teorann mar riail',
  'a module\'s county does not cross the border as a rule', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.r336': 'as Gaillimh\nfeidhm beannaigh(a: Teaghrán) -> Teaghrán { "Dia duit, " + a }',
      'príomh.r336': 'as Corcaigh\nf seasmhach = ó "./foclóir.r336"\nscríobh beannaigh("Cáit")',
    }),
    []);
});

// ══ 7. Ní fheiceann an chúlchríoch aon rud de seo ════════════════════
it('ní shroicheann an dúchas an JavaScript',
  'provenance never reaches the JavaScript', () => {
  // Provenance is checked entirely at compile time, so unlike mood and aspect
  // it has no runtime shadow. The multi-word county is the interesting one:
  // its frozen `nGall` must not appear.
  const js = jsDe('as Dún na nGall\n'
    + 'struchtúr Duine as Dún na nGall { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }\n'
    + 'gníomh príomh() { fógair Duine { ainm: "Cáit" } }');
  for (const focal of ['Corcaigh', 'Dún na nGall', 'nGall', '__contae', 'contae',
    'cúige', 'Ulaidh', '__cúige']) {
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
  }
  for (const focal of ['dhuine', 'fhógair']) assert.ok(!js.includes(focal), focal);
});

// ══ 8. Iompar 0.5 gan athrú ══════════════════════════════════════════
it('gineann clár gan "as" an cód céanna a ghin sé riamh',
  'a program with no "as" emits the code it always did', () => {
  const src = 'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm beannacht(duine: Duine) -> Teaghrán { "Dia duit, " + ainm ó dhuine }\n'
    + 'scríobh beannacht(Duine { ainm: "Cáit" })';
  assert.deepStrictEqual(coid(src), []);
  assert.ok(jsDe(src).includes('Duine$nua') || jsDe(src).includes('__cineál: "Duine"'));
});

// ══ 9. An teorainn: cúige in aghaidh cúige (E601, §25.3) ═════════════
it('osclaítear bosca sa bhaile',
  'a box opens at home', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), []);
});

it('is é an cúige an teorainn, ní an contae',
  'the province is the border, not the county', () => {
  // The 0.7 headline. A Limerick text opens the Munster type without a treaty,
  // because there is one Munster type. In 0.6 this was E601.
  assert.deepStrictEqual(coid('as Luimneach\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), []);
  for (const c of ['An Clár', 'Port Láirge', 'Tiobraid Árann']) {
    assert.deepStrictEqual(coid(`as ${c}\n`
      + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
      + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), [], c);
  }
});

it('ní osclaítear bosca as cúige eile (E601)',
  'a box from another province does not open (E601)', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E601']);
});

it('ainmníonn E601 an dá chúige',
  'E601 names both provinces', () => {
  const [e] = earraidiDe('as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }');
  assert.strictEqual(e.cod, 'E601');
  for (const cuid of [ctae.CUIGI.MUMHAIN, ctae.CUIGI.CONNACHTA]) {
    assert.ok(e.teachtaireacht.includes(cuid), `${cuid} ar iarraidh: ${e.teachtaireacht}`);
  }
});

it('ná ó dheoraíocht ach oiread — níl leigheas air',
  'nor from exile either — there is no remedy', () => {
  assert.deepStrictEqual(coid(
    'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E601']);
});

it('ní trádáil í deoraíocht ar dheoraíocht',
  'exile upon exile is not a trade', () => {
  // Why every 0.4–0.6 program still compiles: `cuigeDe` of exile is exile, so
  // two things from nowhere pass through the same equality as same-province.
  assert.deepStrictEqual(coid(
    'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), []);
});

it('is deoraí é an luach ar iasacht, agus mar sin scarann cúige ón JavaScript',
  'a borrowed value is an exile, so province stands clear of the JavaScript', () => {
  assert.deepStrictEqual(
    coid('as Corcaigh\ngníomh g(x: Iasacht) { scríobh fad ó x }'), ['E601']);
  assert.deepStrictEqual(
    coid('as Corcaigh\np seasmhach = ó "node:path"\nscríobh basename ó ph("/a/b.txt")'), ['E601']);
  assert.deepStrictEqual(coid('gníomh g(x: Iasacht) { scríobh fad ó x }'), []);
});

it('níl an modúl R336 ina rud a shealbhaítear',
  'an R336 module is not a thing that is possessed', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.r336': 'as Gaillimh\nBEANNACHT seasmhach = "Dia duit"',
      'príomh.r336': 'as Corcaigh\nfoclóir seasmhach = ó "./foclóir.r336"\n'
        + 'gníomh príomh() { scríobh BEANNACHT ó fhoclóir }',
    }), []);
});

it('ní sheiceáiltear baill liosta ná bunchineálacha',
  'list members and base types are not checked', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'xs seasmhach: Liosta(Uimhir) = [1, 2]\nscríobh fad ó xs\nscríobh céad ó xs'), []);
});

it('is glas ar an mbosca é an cúige, ní teorainn ar an mbóthar',
  'a province is a lock on the box, not a barrier on the road', () => {
  assert.deepStrictEqual(coid(
    'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'd seasmhach = Duine { ainm: "Cáit" }'), []);
});

it('feidhmíonn an patrún: blaosc ar deoraíocht, croí curtha',
  'the pattern works: shell in exile, core planted', () => {
  const comhaid = {
    'duine.r336': 'as Corcaigh\nstruchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
      + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }',
    'príomh.r336': 'd seasmhach = ó "./duine.r336"\n'
      + 'gníomh príomh() { scríobh ainmDe(Duine { ainm: "Cáit" }) }',
  };
  assert.deepStrictEqual(coidTionscadal(comhaid), []);
  return rithTionscadal(comhaid).then((amach) => assert.deepStrictEqual(amach, ['Cáit']));
});

it('seiceáiltear glao modha, ach ní fhógra modha',
  'a method call is checked, a method declaration is not', () => {
  const coidi = coid('as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm beannacht ó Dhuine(féin) -> Teaghrán { ainm ó fhéin }\n'
    + 'd seasmhach = Duine { ainm: "Cáit" }\nscríobh beannacht ó dh()');
  assert.strictEqual(coidi.length, 2, JSON.stringify(coidi));
  assert.ok(coidi.every((c) => c === 'E601'), JSON.stringify(coidi));
});

it('seiceáiltear gach nasc de shlabhra sealbhaigh ar leith',
  'every link of a possessive chain is checked separately', () => {
  // Each `ó` opens its own box. The inner link is Munster on Munster and
  // passes, the outer one is Connacht.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Áit as Gaillimh { ainm: Teaghrán }\n'
    + 'struchtúr Duine as Corcaigh { áit: Áit }\n'
    + 'feidhm cá(duine: Duine) -> Teaghrán { ainm ó áit ó dhuine }'), ['E601']);
});

it('ní fhágann an tseiceáil rian ar bith sa JavaScript',
  'the check leaves no trace at all in the JavaScript', () => {
  const js = jsDe('as Corcaigh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }\n'
    + 'gníomh príomh() { fógair Duine { ainm: "Cáit" } }');
  for (const focal of ['Corcaigh', '__contae', 'contae', 'cúige', 'An Mhumhain', 'deoraíocht', 'dhuine'])
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
});

// ══ 9b. An seanaighneas: E608, E609 (§25.4) ══════════════════════════
it('sáraíonn an t-aighneas an cúige céanna (E609)',
  'a feud overrides even the same province (E609)', () => {
  // Exclusivity constrains which counties may hold a type. It does not
  // constrain the county on a file, so any number of texts may be from Ciarraí
  // and none of them may open Corcaigh's box.
  assert.deepStrictEqual(coid('as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E609']);
  // And the other way round, because a rivalry is symmetric.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }'), ['E609']);
});

it('sáraíonn an t-aighneas an teorainn idir cúigí freisin (E609)',
  'a feud overrides the border between provinces too (E609)', () => {
  assert.deepStrictEqual(coid('as Ciarraí\n'
    + 'struchtúr Foireann as Baile Átha Cliath { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(f: Foireann) -> Teaghrán { ainm ó fh }'), ['E609']);
});

it('ní dhéantar comhaontú idir iomaitheoirí (E608)',
  'no treaty is made between rivals (E608)', () => {
  assert.deepStrictEqual(coid('as Ciarraí\ncomhaontú Ciarraí Baile Átha Cliath'), ['E608']);
  assert.deepStrictEqual(coid('as Ciarraí\ncomhaontú Baile Átha Cliath Ciarraí'), ['E608']);
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí'), ['E608']);
});

it('níl aon leigheas ar an aighneas: teipeann ar an gcomhaontú agus ar an oscailt',
  'there is no remedy for a feud: both the treaty and the opening fail', () => {
  // Both codes, in pass order: the treaty is refused in 0c and the access in C.
  // E608 fires where the author still thinks there is a remedy.
  assert.deepStrictEqual(coid('as Ciarraí\n'
    + 'comhaontú Ciarraí Baile Átha Cliath\n'
    + 'struchtúr Foireann as Baile Átha Cliath { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(f: Foireann) -> Teaghrán { ainm ó fh }'), ['E608', 'E609']);
});

it('ainmníonn E609 an dá chontae agus deir sé nach gcabhraíonn an cúige',
  'E609 names both counties and says the province does not help', () => {
  const [e] = earraidiDe('as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }');
  assert.strictEqual(e.cod, 'E609');
  for (const cuid of ['Ciarraí', 'Corcaigh', 'E608']) {
    assert.ok(e.teachtaireacht.includes(cuid), `${cuid} ar iarraidh: ${e.teachtaireacht}`);
  }
});

it('is é an t-éalú an contae a athrú, agus sin an chúis nach bhfuil sos cogaidh ann',
  'the escape is to change county, which is why there is no ceasefire', () => {
  // Ciarraí cannot reach Dublin and no keyword is coming. What exists is the
  // decision: be from somewhere else, and pay the county you wanted.
  const olc = 'as Ciarraí\n'
    + 'struchtúr Foireann as Baile Átha Cliath { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(f: Foireann) -> Teaghrán { ainm ó fh }';
  assert.deepStrictEqual(coid(olc), ['E609']);
  const ceart = olc.replace('as Ciarraí', 'as Luimneach\ncomhaontú Luimneach Baile Átha Cliath');
  assert.deepStrictEqual(coid(ceart), []);
});

it('ní chuireann an t-aighneas cosc ar aon rud eile',
  'a feud blocks nothing else', () => {
  // Two rivals may exist in one program in different provinces. They cannot
  // agree, and declaring is not opening (§24.3), so this compiles.
  assert.deepStrictEqual(coid('as Gaillimh\n'
    + 'struchtúr Foireann as Baile Átha Cliath { ainm: Teaghrán }\n'
    + 'struchtúr Duine as Ciarraí { ainm: Teaghrán }'), []);
  // And construction still crosses freely.
  assert.deepStrictEqual(coid('as Ciarraí\n'
    + 'struchtúr Foireann as Baile Átha Cliath { ainm: Teaghrán }\n'
    + 'f seasmhach = Foireann { ainm: "Áth Cliath" }'), []);
});

// ══ 10. Comhaontuithe ════════════════════════════════════════════════
it('osclaíonn comhaontú an bosca',
  'a treaty opens the box', () => {
  const bun = 'as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }';
  assert.deepStrictEqual(coid(bun), ['E601']);
  assert.deepStrictEqual(coid('comhaontú Corcaigh Gaillimh\n' + bun), []);
});

it('is comhaontú é ón dá thaobh',
  'a treaty holds from both sides', () => {
  const bun = 'as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }';
  assert.deepStrictEqual(coid('comhaontú Gaillimh Corcaigh\n' + bun), []);
});

it('níl comhaontú tarchurthach — sin an rud a dhéanann comhaontú de',
  'a treaty is not transitive — that is what makes it a treaty', () => {
  // A transitive treaty would partition the four into blocs, which is the thing
  // a treaty exists instead of.
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'comhaontú Corcaigh Gaillimh\ncomhaontú Gaillimh Aontroim\n'
    + 'struchtúr Áit as Aontroim { ainm: Teaghrán }\n'
    + 'feidhm cá(áit: Áit) -> Teaghrán { ainm ó áit }'), ['E601']);
});

it('is cuma cá bhfuil an comhaontú sa chomhad',
  'where the treaty sits in the file does not matter', () => {
  assert.deepStrictEqual(coid('as Corcaigh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }\n'
    + 'comhaontú Corcaigh Gaillimh'), []);
});

it('ní dhéantar comhaontú le duine féin (E606)',
  'no treaty is made with oneself (E606)', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Corcaigh'), ['E606']);
});

it('ní hionann ord agus comhaontú nua (E607)',
  'order is not a new treaty (E607)', () => {
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Gaillimh\ncomhaontú Gaillimh Corcaigh'), ['E607']);
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Gaillimh\ncomhaontú Corcaigh Aontroim'), []);
});

it('ní páirtí í an deoraíocht (E605), agus níl leigheas uirthi',
  'exile is not a party (E605), and has no remedy', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh deoraíocht'), ['E605']);
  assert.deepStrictEqual(
    coid('as Corcaigh\ncomhaontú Corcaigh Gaillimh\ngníomh g(x: Iasacht) { scríobh fad ó x }'),
    ['E601']);
});

it('seiceáiltear ainmneacha comhaontaithe mar aon ainm eile',
  'treaty names are checked like any other name', () => {
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Yorkshire'), ['E602']);
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Chorcaigh Gaillimh'), ['E103']);
  assert.deepStrictEqual(coid('as Dún na nGall\ncomhaontú Dún na nGall Baile Átha Cliath'), []);
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Dún Gaillimh'), ['E602']);
});

it('ní thaistealaíonn comhaontú trasna na teorann',
  'a treaty does not travel across the border', () => {
  const bun = {
    'duine.r336': 'as Corcaigh\ncomhaontú Corcaigh Gaillimh\n'
      + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
      + 'feidhm ainmDe(duine: Duine) -> Teaghrán { ainm ó dhuine }',
  };
  assert.deepStrictEqual(coidTionscadal({ ...bun, 'príomh.r336': 'd seasmhach = ó "./duine.r336"' }), []);
  const olc = { ...bun, 'príomh.r336': 'as Corcaigh\nd seasmhach = ó "./duine.r336"\n'
    + 'feidhm f(duine: Duine) -> Teaghrán { ainm ó dhuine }' };
  assert.deepStrictEqual(coidTionscadal(olc), ['E601']);
  const ceart = { ...olc, 'príomh.r336': 'comhaontú Corcaigh Gaillimh\n' + olc['príomh.r336'] };
  assert.deepStrictEqual(coidTionscadal(ceart), []);
});

it('ní fhágann comhaontú rian ar bith sa JavaScript ach oiread',
  'a treaty leaves no trace in the JavaScript either', () => {
  const js = jsDe('as Corcaigh\ncomhaontú Corcaigh Gaillimh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'gníomh fógair(duine: Duine) { scríobh ainm ó dhuine }');
  for (const focal of ['comhaontú', 'Corcaigh', 'Gaillimh', 'contae', 'cúige'])
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
});

// ══ 11. --graf ═══════════════════════════════════════════════════════
it('tuairiscíonn --graf dúchas gach cineáil',
  '--graf reports the provenance of every type', () => {
  const { duchasanna } = require('../src/index');
  const d = duchasanna(anailiseDe('as Corcaigh\ncomhaontú Corcaigh Gaillimh\n'
    + 'struchtúr Duine as Gaillimh { ainm: Teaghrán }\n'
    + 'struchtúr Nóta { téacs: Teaghrán }'));
  assert.strictEqual(d.contae, 'Corcaigh');
  assert.deepStrictEqual(d.cinealacha, [
    { ainm: 'Duine', contae: 'Gaillimh' },
    { ainm: 'Nóta', contae: ctae.DEORAIOCHT },
  ]);
  assert.strictEqual(d.comhaontuithe.length, 1);
  assert.strictEqual(d.comhaontuithe[0].a, 'Corcaigh');
  assert.strictEqual(d.comhaontuithe[0].b, 'Gaillimh');
});

it('ní scéal a insíonn --graf faoin aighneas a thuilleadh, ach riail',
  '--graf no longer tells a story about the feud, but a rule', () => {
  // The inversion of 0.6. §24.5 kept the rivalry as presentation, on the
  // grounds that a hard-coded refusal would be an exception. §25.4 makes it a
  // precondition on all four cases of the border rule instead, so the treaty
  // this test used to assert legal is now a compile error.
  assert.deepStrictEqual(coid('as Corcaigh\ncomhaontú Corcaigh Ciarraí'), ['E608']);
  const { duchasanna } = require('../src/index');
  const d = duchasanna(anailiseDe('as Corcaigh\ncomhaontú Corcaigh Gaillimh'));
  for (const t of d.comhaontuithe) {
    assert.strictEqual(ctae.isIomaiocht(t.a, t.b), false);
  }
});

it('is féidir le --graf a rá cé nach n-osclófar go deo',
  '--graf can say who will never be opened', () => {
  // What the flag can say now: this text is from Ciarraí, Corcaigh holds An
  // Mhumhain, and no treaty will ever open it.
  const d = require('../src/index').duchasanna(anailiseDe('as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }'));
  const cuirthe = d.cinealacha.filter((t) => t.contae !== ctae.DEORAIOCHT);
  assert.strictEqual(cuirthe.length, 1);
  assert.strictEqual(ctae.cuigeDe(cuirthe[0].contae), ctae.CUIGI.MUMHAIN);
  assert.strictEqual(ctae.isIomaiocht(cuirthe[0].contae, d.contae), true);
  assert.ok(ctae.iomaitheoiri('Ciarraí').includes('Corcaigh'));
});

// ── rith ──────────────────────────────────────────────────────────────
rithSraith('contae');
