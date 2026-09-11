'use strict';

/*
 * Cineálacha suime (§26). Organised by claim rather than by source file,
 * because the interesting failures are crossings between the type language
 * and the province rule.
 */

const assert = require('node:assert');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach } = require('../src/index');

const { it, rithSraith } = require('./creatlach');

/** Every diagnostic code a source raises, in order. */
function coid(src) {
  try { tiomsaigh(src, 'tástáil.r336'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    throw e;
  }
}

function earraidiDe(src) {
  try { tiomsaigh(src, 'tástáil.r336'); return []; }
  catch (e) { if (e instanceof Cnuasach) return e.earraidi; throw e; }
}

const jsDe = (src) => tiomsaigh(src, 'tástáil.r336').js;

/** Run a compiled program and collect what it wrote. */
async function rith(src) {
  const js = jsDe(src);
  const amach = [];
  const scriobh = console.log;
  console.log = (x) => amach.push(String(x));
  try {
    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
    if (typeof mod.exports.príomh === 'function') await mod.exports.príomh();
  } finally { console.log = scriobh; }
  return amach;
}

/** A project over an in-memory filesystem, for the module-boundary tests. */
function tionscadalBreige(comhaid) {
  const map = new Map(Object.entries(comhaid).map(([k, v]) => [path.resolve('/sb', k), v]));
  return new Tionscadal({ ann: (c) => map.has(c), léigh: (c) => map.get(c) });
}

function coidTionscadal(comhaid, príomh = 'príomh.r336') {
  try { tionscadalBreige(comhaid).tiomsaigh(path.resolve('/sb', príomh)); return []; }
  catch (e) { if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod); throw e; }
}

const TORADH = 'suim Toradh {\n    Ceart { duine: Duine }\n    Easpa { cúis: Teaghrán }\n}';
const DUINE = 'struchtúr Duine { ainm: Teaghrán }';

// ══ 1. Fógairt agus tógáil ═══════════════════════════════════════════
it('fógraítear suim, agus is cineál í gach malairt',
  'a sum is declared, and every variant is a type', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}`), []);
});

it('is déantús gnáthstruchtúir é déantús malairte',
  'constructing a variant is constructing an ordinary struct', () => {
  // Introduction needed no new syntax and got none (§26.1).
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 't seasmhach = Ceart { duine: Duine { ainm: "Cáit" } }'), []);
  // Ordinary field checks, unchanged.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nt seasmhach = Ceart { }`), ['E204']);
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nt seasmhach = Easpa { cúis: 3 }`), ['E201']);
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nt seasmhach = Easpa { fáth: "x" }`), ['E203', 'E204']);
});

it('is leathnú saor é an tabhairt isteach: is Toradh cheana é Ceart',
  'introduction is a free widening: a Ceart is already a Toradh', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 't seasmhach: Toradh = Easpa { cúis: "x" }'), []);
});

it('ní ionann malairt de shuim amháin agus malairt de cheann eile',
  'a variant of one sum is not a variant of another', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  assert.deepStrictEqual(coid(`${DUINE}\n${dhá}\n`
    + 't seasmhach: Toradh = Alt { x: 1 }'), ['E201']);
});

it('is E208 é ainm malairte a athúsáid — gan riail nua',
  'reusing a variant name is E208 — with no new rule', () => {
  // Variants live in the type namespace, so the ordinary collision check catches it.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nstruchtúr Ceart { x: Uimhir }`), ['E208']);
});

// ══ 2. Díothú: an chopail a chaolaíonn (§26.3) ═══════════════════════
it('caolaíonn `más Ceart x` an ceangal sa chraobh',
  '`más Ceart x` narrows the binding inside the branch', async () => {
  const src = `${DUINE}\n${TORADH}\n`
    + 'feidhm tuairisc(t: Toradh) -> Teaghrán {\n'
    + '    más Ceart t { ainm ó dhuine ó th } mura { cúis ó th }\n'
    + '}\n'
    + 'gníomh príomh() {\n'
    + '    scríobh tuairisc(Ceart { duine: Duine { ainm: "Cáit" } })\n'
    + '    scríobh tuairisc(Easpa { cúis: "Gan aimsiú" })\n'
    + '}';
  assert.deepStrictEqual(coid(src), []);
  assert.deepStrictEqual(await rith(src), ['Cáit', 'Gan aimsiú']);
});

it('ní osclaítear suim gan í a aithint ar dtús (E205)',
  'a sum is not opened without being identified first (E205)', () => {
  // E205 already says this, and says it about the right type.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { cúis ó th }'), ['E205']);
});

it('caolaíonn an chraobh dhiúltach nuair atá dhá mhalairt ann',
  'the negative branch narrows when there are two variants', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { más Ceart t { "sea" } mura { cúis ó th } }'), []);
});

it('ní chaolaíonn sí nuair atá trí cinn ann — agus sin teorainn dhearbhaithe',
  'it does not narrow when there are three — and that is an asserted limit', () => {
  const trí = 'suim Trí {\n    A { x: Uimhir }\n    B { x: Uimhir }\n    C { x: Uimhir }\n}';
  // The affirmative branch narrows.
  assert.deepStrictEqual(coid(`${trí}\nfeidhm f(t: Trí) -> Uimhir { más A t { x ó th } mura { 0 } }`), []);
  // The negative one does not: "not A" names nothing when there are three (§26.3).
  assert.deepStrictEqual(coid(`${trí}\nfeidhm f(t: Trí) -> Uimhir { más A t { 0 } mura { x ó th } }`), ['E205']);
});

it('iompaíonn `mura` an dá chraobh',
  '`mura` turns the two branches around', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { mura Ceart t { cúis ó th } mura { "sea" } }'), []);
});

it('ní chaolaítear ceangal sealadach: ní fíor caolú a scriosann `cuir`',
  'a mutable binding is not narrowed: a narrowing `cuir` can destroy is not true', () => {
  // Essence narrows; accident does not (§26.3).
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 't sealadach: Toradh = Easpa { cúis: "x" }\n'
    + 'gníomh f() { más Ceart t { scríobh ainm ó dhuine ó th } }'), ['E205']);
});

it('buaileann craobhacha le chéile ag an tsuim seachas teip a thabhairt',
  'branches meet at the sum instead of failing', () => {
  // One arm `Ceart`, the other `Easpa`, and the value of the `má` is `Toradh`.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(b: Bool) -> Toradh {\n'
    + '    má b { Ceart { duine: Duine { ainm: "Cáit" } } } mura { Easpa { cúis: "x" } }\n'
    + '}'), []);
});

// ══ 3. E302: aicmiú nach féidir a bheith fíor (curtha in áirithe ó 0.4) ══
it('is E302 é malairt nach de chuid na suime seo í',
  'a variant that does not belong to this sum is E302', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  assert.deepStrictEqual(coid(`${DUINE}\n${dhá}\n`
    + 'feidhm f(t: Toradh) -> Bool { t is Alt }'), ['E302']);
});

it('ainmníonn E302 an tsuim agus an mhalairt',
  'E302 names the sum and the variant', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  const [e] = earraidiDe(`${DUINE}\n${dhá}\nfeidhm f(t: Toradh) -> Bool { t is Alt }`);
  assert.strictEqual(e.cod, 'E302');
  for (const cuid of ['Toradh', 'Alt']) assert.ok(e.teachtaireacht.includes(cuid), cuid);
});

// ══ 4. Liostaí: buaileann malairtí, agus fanann E211 gan sroicheadh ══
it('téann dhá mhalairt den tsuim chéanna le chéile i liosta',
  'two variants of the same sum meet in a list', () => {
  // A list of results is Liosta(Toradh), not Liosta(Iasacht), so it can be declared.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'xs seasmhach: Liosta(Toradh) = [Ceart { duine: Duine { ainm: "C" } }, Easpa { cúis: "x" }]'), []);
});

it('leathnaíonn liosta nach mbuaileann in aon áit fós — agus is gá sin',
  'a list that meets nowhere still widens — and it has to', () => {
  // §26.7. `[ainm, aois]` is a driver's parameter list, legitimately
  // heterogeneous, so E211 stays reserved.
  assert.deepStrictEqual(coid('xs seasmhach = [1, "a"]'), []);
  assert.deepStrictEqual(
    coid('xs seasmhach: Liosta(Iasacht) = [1, "a"]'), []);
});

it('fanann liosta aonchineálach agus liosta folamh mar a bhí',
  'a homogeneous list and an empty list stay as they were', () => {
  assert.deepStrictEqual(coid('xs seasmhach = [1, 2, 3]'), []);
  assert.deepStrictEqual(coid('xs seasmhach = []'), []);
});

// ══ 5. E213: ní catagóir í an Iasacht (§26.4) ════════════════════════
it('ní féidir le réimse malairte a bheith ina Iasacht',
  'a variant field cannot be an Iasacht', () => {
  assert.deepStrictEqual(coid('suim T {\n    A { x: Iasacht }\n    B { y: Uimhir }\n}'), ['E213']);
  assert.deepStrictEqual(coid('suim T {\n    A { x: Liosta(Iasacht) }\n    B { y: Uimhir }\n}'), ['E213']);
});

it('ceadaítear Iasacht i réimse struchtúir fós — comhoiriúnacht siar',
  'Iasacht is still allowed in a struct field — backwards compatibility', () => {
  // Deliberate asymmetry: a record is a bag of fields, a sum claims to enumerate.
  assert.deepStrictEqual(coid('struchtúr Amharc { sonraí: Iasacht }'), []);
});

it('is Neamhní an easpa anois, agus tá sí ann cheana',
  'absence is Neamhní now, and it is already there', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n`
    + 'suim Aimsiú {\n    Aimsithe { duine: Duine }\n    Beag { luach: Neamhní }\n}'), []);
});

// ══ 6. Dúchas: aon chúige amháin ag suim (§26.2) ═════════════════════
it('éilíonn suim cúige mar a éilíonn struchtúr',
  'a sum claims a province as a struct does', () => {
  assert.deepStrictEqual(coid('suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}'), []);
});

it('tá suim agus struchtúr san iomaíocht ar na ceithre shliotán chéanna',
  'sums and structs compete for the same four slots', () => {
  assert.deepStrictEqual(
    coid('struchtúr D as Corcaigh { a: Uimhir }\n'
      + 'suim T as Ciarraí {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}'),
    ['E603']);
});

it('ní éilíonn malairt cúige di féin — dá n-éileodh, d\'íosfadh suim dhá shliotán',
  'a variant claims no province of its own — if it did, a sum would eat two slots', () => {
  // §26.2 in one assertion: four provinces are four types, whatever the variant count.
  assert.deepStrictEqual(
    coid('suim A as Corcaigh {\n    P { x: Uimhir }\n    Q { x: Uimhir }\n}\n'
      + 'suim B as Cill Dara {\n    R { x: Uimhir }\n    S { x: Uimhir }\n}\n'
      + 'suim C as Sligeach {\n    T { x: Uimhir }\n    U { x: Uimhir }\n}\n'
      + 'suim D as Muineachán {\n    V { x: Uimhir }\n    W { x: Uimhir }\n}'),
    []);
});

it('freagraíonn malairt le contae na suime ag an teorainn',
  'a variant answers with the sum\'s county at the border', () => {
  // The sum is placed, so opening a variant from the wrong province is E601.
  assert.deepStrictEqual(coid('as Gaillimh\n'
    + 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { x: Uimhir }\n}\n'
    + 'feidhm f(t: T) -> Uimhir { más A t { x ó th } mura { 0 } }'), ['E601']);
  // And a treaty opens it, through machinery that was already there.
  assert.deepStrictEqual(coid('as Gaillimh\ncomhaontú Gaillimh Corcaigh\n'
    + 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { x: Uimhir }\n}\n'
    + 'feidhm f(t: T) -> Uimhir { más A t { x ó th } mura { 0 } }'), []);
});

it('coinníonn ualach a chontae féin taobh istigh de shuim eile',
  'a payload keeps its own county inside another sum', () => {
  // Construction crosses freely (§24.3), then the payload is checked on its own terms.
  const src = 'as Gaillimh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'suim T as Gaillimh {\n    A { duine: Duine }\n    B { cúis: Teaghrán }\n}\n';
  // Building one is fine from anywhere.
  assert.deepStrictEqual(coid(`${src}t seasmhach: T = A { duine: Duine { ainm: "C" } }`), []);
  // Opening the payload is not: it is still from Cork.
  assert.deepStrictEqual(
    coid(`${src}feidhm f(t: T) -> Teaghrán { más A t { ainm ó dhuine ó th } mura { cúis ó th } }`),
    ['E601']);
});

it('is E609 é ualach i gcontae a bhfuil seanaighneas leis',
  'a payload in a county with an old feud is E609', () => {
  const src = 'as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'suim T as Gaillimh {\n    A { duine: Duine }\n    B { cúis: Teaghrán }\n}\n'
    + 'feidhm f(t: T) -> Teaghrán { más A t { ainm ó dhuine ó th } mura { cúis ó th } }';
  assert.ok(coid(src).includes('E609'), JSON.stringify(coid(src)));
});

// ══ 7. An teorainn idir modúil ═══════════════════════════════════════
it('trasnaíonn suim agus a malairtí an teorainn',
  'a sum and its variants cross the border', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.r336': 'suim T {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.r336': 'm seasmhach = ó "./toradh.r336"\n'
        + 'feidhm f(t: T) -> Uimhir { más A t { x ó th } mura { 0 } }',
    }),
    []);
});

it('taistealaíonn éileamh cúige na suime leis an iompórtáil (E603)',
  'the sum\'s claim on a province travels with the import (E603)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.r336': 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.r336': 'm seasmhach = ó "./toradh.r336"\nstruchtúr Áit as Ciarraí { ainm: Teaghrán }',
    }),
    ['E603']);
});

it('ní éilíonn malairt iompórtáilte cúige di féin',
  'an imported variant claims no province of its own', () => {
  // A variant carrying its own county would report E603 against itself on import.
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.r336': 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.r336': 'as Corcaigh\nm seasmhach = ó "./toradh.r336"\n'
        + 'feidhm f(t: T) -> Uimhir { más A t { x ó th } mura { 0 } }',
    }),
    []);
});

// ══ 8. Ní fheiceann an chúlchríoch aon rud de seo ════════════════════
it('ní shroicheann an tsuim an JavaScript',
  'the sum never reaches the JavaScript', () => {
  const js = jsDe('as Corcaigh\n'
    + 'suim Toradh as Corcaigh {\n    Ceart { x: Uimhir }\n    Easpa { cúis: Teaghrán }\n}\n'
    + 'feidhm f(toradh: Toradh) -> Uimhir { más Ceart toradh { x ó thoradh } mura { 0 } }');
  // A statement about which tags are possible has no run-time shadow.
  for (const focal of ['Toradh', '__suim', '__malairt', 'Corcaigh', 'An Mhumhain',
    '__contae', '__cúige', 'thoradh']) {
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
  }
  // The `__is` tag and a struct constructor. No new backend concept.
  assert.ok(js.includes('__is(toradh, "Ceart")'));
  assert.ok(js.includes('Ceart$nua'));
});

it('níor chuir an tsuim cás nua le `__is`',
  'the sum added no new case to `__is`', () => {
  const js = jsDe('suim T {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}');
  assert.ok(!js.includes('case "A"'));
  assert.ok(js.includes('luach.__cineál === cineál'));
});

// ══ 9. Iompar roimh 0.8 gan athrú ════════════════════════════════════
it('gineann clár 0.7 an cód céanna a ghin sé riamh',
  'a 0.7 program emits the code it always did', async () => {
  const src = 'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm beannacht(duine: Duine) -> Teaghrán { "Dia duit, " + ainm ó dhuine }\n'
    + 'gníomh príomh() { scríobh beannacht(Duine { ainm: "Cáit" }) }';
  assert.deepStrictEqual(coid(src), []);
  assert.deepStrictEqual(await rith(src), ['Dia duit, Cáit']);
});

it('fanann `suimiú` ag obair: níor ghoid an eochairfhocal an t-oibreoir',
  '`suimiú` keeps working: the keyword did not steal the operator', async () => {
  // `suim` and `suimiú` shared a parser method name until 0.8. This is the rename.
  assert.deepStrictEqual(await rith('gníomh príomh() { scríobh 2 + 3 - 1 }'), ['4']);
});

it('is aitheantóir fós é "suim" mar chuid d\'fhocal',
  '"suim" inside a word is still an identifier', () => {
  assert.deepStrictEqual(coid('suimeanna seasmhach = 3'), []);
});


// ══ E214 — ní suim í suim gan rogha (§26.8) ═══════════════════════════

it('is E214 í suim fholamh',
  'an empty sum is E214', () => {
  assert.deepStrictEqual(coid('suim T as Corcaigh { }'), ['E214']);
});

it('is E214 í suim aonair',
  'a single-variant sum is E214', () => {
  assert.deepStrictEqual(coid('suim T as Corcaigh { A { u: Uimhir } }'), ['E214']);
});

it('luaitear cé mhéad malairt a fuarthas, mar is é sin an rud atá le ceartú',
  'how many variants were found is stated, because that is the thing to fix', () => {
  const [folamh] = earraidiDe('suim T { }');
  const [aonair] = earraidiDe('suim T { A { u: Uimhir } }');
  assert.ok(/malairt ar bith/.test(folamh.teachtaireacht), folamh.teachtaireacht);
  assert.ok(/malairt amháin/.test(aonair.teachtaireacht), aonair.teachtaireacht);
});

it('is leor dhá mhalairt',
  'two variants are enough', () => {
  assert.deepStrictEqual(
    coid('suim T { A { u: Uimhir } B { c: Teaghrán } }'), []);
});

it('ní chuireann E214 cosc ar an gcuid eile den chomhad a sheiceáil',
  'E214 does not stop the rest of the file being checked', () => {
  // Checking continues past E214 on purpose, or the first fault hides the rest.
  const es = coid('suim T { A { u: Uimhir } }\nx seasmhach: Rud = 1');
  assert.deepStrictEqual(es, ['E214', 'E202']);
});

// ══ Dhá iompar a thit amach, agus atá anois luaite (§26.2, §26.9) ═════

it('ainmníonn malairt cruth, agus mar sin is cineál fógartha í (§26.2)',
  'a variant names a shape, and so it is a declared type (§26.2)', () => {
  // A variant names a shape. The sum is what holds the province.
  assert.deepStrictEqual(coid(
    'suim T { A { u: Uimhir } B { c: Teaghrán } }\n'
    + 'feidhm f(a: A) -> Uimhir { u ó a }\n'
    + 'scríobh f(A { u: 1 })'), []);
});

it('ní ghlacann suim ná malairt le modh (E509, §26.9)',
  'neither a sum nor a variant takes a method (E509, §26.9)', () => {
  // A method is possession, and an unidentified value possesses nothing.
  assert.deepStrictEqual(coid(
    'suim Toradh { Ceart { u: Uimhir } Easpa { c: Teaghrán } }\n'
    + 'feidhm cuntas ó Thoradh(féin) -> Uimhir { 1 }'), ['E509']);
  assert.deepStrictEqual(coid(
    'suim Toradh { Ceart { u: Uimhir } Easpa { c: Teaghrán } }\n'
    + 'feidhm cuntas ó Cheart(féin) -> Uimhir { 1 }'), ['E509']);
});

// ── rith ──────────────────────────────────────────────────────────────
rithSraith('suim');
