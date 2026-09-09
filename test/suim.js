'use strict';

/*
 * test/suim.js — cineálacha suime (§26).
 *
 * The suite is organised by the claim it is checking rather than by the file
 * the code lives in, because the interesting failures in 0.8 are all crossings
 * between the type language and the province rule.
 */

const assert = require('node:assert');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach } = require('../src/index');

const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);
let pas = 0, teip = 0;

/** Every diagnostic code a source raises, in order. */
function coid(src) {
  try { tiomsaigh(src, 'tástáil.sb'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    throw e;
  }
}

function earraidiDe(src) {
  try { tiomsaigh(src, 'tástáil.sb'); return []; }
  catch (e) { if (e instanceof Cnuasach) return e.earraidi; throw e; }
}

const jsDe = (src) => tiomsaigh(src, 'tástáil.sb').js;

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

function coidTionscadal(comhaid, príomh = 'príomh.sb') {
  try { tionscadalBreige(comhaid).tiomsaigh(path.resolve('/sb', príomh)); return []; }
  catch (e) { if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod); throw e; }
}

const TORADH = 'suim Toradh {\n    Ceart { duine: Duine }\n    Easpa { cúis: Teaghrán }\n}';
const DUINE = 'struchtúr Duine { ainm: Teaghrán }';

// ══ 1. Fógairt agus tógáil ═══════════════════════════════════════════
it('fógraítear suim, agus is cineál í gach malairt', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}`), []);
});

it('is déantús gnáthstruchtúir é déantús malairte', () => {
  // Introduction needed no new syntax and got none (§26.1).
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'seasmhach t = Ceart { duine: Duine { ainm: "Cáit" } }'), []);
  // …with the ordinary field checks, unchanged.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nseasmhach t = Ceart { }`), ['E204']);
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nseasmhach t = Easpa { cúis: 3 }`), ['E201']);
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nseasmhach t = Easpa { fáth: "x" }`), ['E203', 'E204']);
});

it('is leathnú saor é an tabhairt isteach: is Toradh cheana é Ceart', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'seasmhach t: Toradh = Easpa { cúis: "x" }'), []);
});

it('ní ionann malairt de shuim amháin agus malairt de cheann eile', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  assert.deepStrictEqual(coid(`${DUINE}\n${dhá}\n`
    + 'seasmhach t: Toradh = Alt { x: 1 }'), ['E201']);
});

it('is E208 é ainm malairte a athúsáid — gan riail nua', () => {
  // Variants live in the type namespace, so the ordinary collision check
  // catches this with nothing written to make it happen.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\nstruchtúr Ceart { x: Uimhir }`), ['E208']);
});

// ══ 2. Díothú: an chopail a chaolaíonn (§26.3) ═══════════════════════
it('caolaíonn `má x is Ceart` an ceangal sa chraobh', async () => {
  const src = `${DUINE}\n${TORADH}\n`
    + 'feidhm tuairisc(t: Toradh) -> Teaghrán {\n'
    + '    má t is Ceart { ainm ó dhuine ó th } mura { cúis ó th }\n'
    + '}\n'
    + 'gníomh príomh() {\n'
    + '    scríobh tuairisc(Ceart { duine: Duine { ainm: "Cáit" } })\n'
    + '    scríobh tuairisc(Easpa { cúis: "Gan aimsiú" })\n'
    + '}';
  assert.deepStrictEqual(coid(src), []);
  assert.deepStrictEqual(await rith(src), ['Cáit', 'Gan aimsiú']);
});

it('ní osclaítear suim gan í a aithint ar dtús (E205)', () => {
  // You cannot open a box you have not identified. No new code: E205 already
  // says exactly this, and says it about the right type.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { cúis ó th }'), ['E205']);
});

it('caolaíonn an chraobh dhiúltach nuair atá dhá mhalairt ann', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { má t is Ceart { "sea" } mura { cúis ó th } }'), []);
});

it('ní chaolaíonn sí nuair atá trí cinn ann — agus sin teorainn dhearbhaithe', () => {
  const trí = 'suim Trí {\n    A { x: Uimhir }\n    B { x: Uimhir }\n    C { x: Uimhir }\n}';
  // The affirmative branch still narrows…
  assert.deepStrictEqual(coid(`${trí}\nfeidhm f(t: Trí) -> Uimhir { má t is A { x ó th } mura { 0 } }`), []);
  // …and the negative one does not, because "not A" is not the name of
  // anything when there are three (§26.3).
  assert.deepStrictEqual(coid(`${trí}\nfeidhm f(t: Trí) -> Uimhir { má t is A { 0 } mura { x ó th } }`), ['E205']);
});

it('iompaíonn `mura` an dá chraobh', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(t: Toradh) -> Teaghrán { mura t is Ceart { cúis ó th } mura { "sea" } }'), []);
});

it('ní chaolaítear ceangal sealadach: ní fíor caolú a scriosann `cuir`', () => {
  // Essence narrows; accident does not (§26.3).
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'sealadach t: Toradh = Easpa { cúis: "x" }\n'
    + 'gníomh f() { má t is Ceart { scríobh ainm ó dhuine ó th } }'), ['E205']);
});

it('buaileann craobhacha le chéile ag an tsuim seachas teip a thabhairt', () => {
  // One arm `Ceart`, the other `Easpa`, and the value of the `má` is `Toradh`.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'feidhm f(b: Bool) -> Toradh {\n'
    + '    má b { Ceart { duine: Duine { ainm: "Cáit" } } } mura { Easpa { cúis: "x" } }\n'
    + '}'), []);
});

// ══ 3. E302: aicmiú nach féidir a bheith fíor (curtha in áirithe ó 0.4) ══
it('is E302 é malairt nach de chuid na suime seo í', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  assert.deepStrictEqual(coid(`${DUINE}\n${dhá}\n`
    + 'feidhm f(t: Toradh) -> Bool { t is Alt }'), ['E302']);
});

it('ainmníonn E302 an tsuim agus an mhalairt', () => {
  const dhá = `${TORADH}\nsuim Eile {\n    Alt { x: Uimhir }\n    Beart { y: Uimhir }\n}`;
  const [e] = earraidiDe(`${DUINE}\n${dhá}\nfeidhm f(t: Toradh) -> Bool { t is Alt }`);
  assert.strictEqual(e.cod, 'E302');
  for (const cuid of ['Toradh', 'Alt']) assert.ok(e.teachtaireacht.includes(cuid), cuid);
});

// ══ 4. Liostaí: buaileann malairtí, agus fanann E211 gan sroicheadh ══
it('téann dhá mhalairt den tsuim chéanna le chéile i liosta', () => {
  // The improvement that did arrive: a list of results is `Liosta(Toradh)`
  // and not `Liosta(Iasacht)`, so it can be declared and checked.
  assert.deepStrictEqual(coid(`${DUINE}\n${TORADH}\n`
    + 'seasmhach xs: Liosta(Toradh) = [Ceart { duine: Duine { ainm: "C" } }, Easpa { cúis: "x" }]'), []);
});

it('leathnaíonn liosta nach mbuaileann in aon áit fós — agus is gá sin', () => {
  // The reversal, §26.7. `[ainm, aois]` in sonraí.sb is a driver's parameter
  // list: legitimately heterogeneous, and no sum can or should cover it. So
  // E211 stays reserved and the 0.8 brief's prediction was wrong.
  assert.deepStrictEqual(coid('seasmhach xs = [1, "a"]'), []);
  assert.deepStrictEqual(
    coid('seasmhach xs: Liosta(Iasacht) = [1, "a"]'), []);
});

it('fanann liosta aonchineálach agus liosta folamh mar a bhí', () => {
  assert.deepStrictEqual(coid('seasmhach xs = [1, 2, 3]'), []);
  assert.deepStrictEqual(coid('seasmhach xs = []'), []);
});

// ══ 5. E213: ní catagóir í an Iasacht (§26.4) ════════════════════════
it('ní féidir le réimse malairte a bheith ina Iasacht', () => {
  assert.deepStrictEqual(coid('suim T {\n    A { x: Iasacht }\n    B { y: Uimhir }\n}'), ['E213']);
  assert.deepStrictEqual(coid('suim T {\n    A { x: Liosta(Iasacht) }\n    B { y: Uimhir }\n}'), ['E213']);
});

it('ceadaítear Iasacht i réimse struchtúir fós — comhoiriúnacht siar', () => {
  // The asymmetry is deliberate: a record is a bag of fields, a sum claims to
  // enumerate. Every 0.4–0.7 program keeps compiling.
  assert.deepStrictEqual(coid('struchtúr Amharc { sonraí: Iasacht }'), []);
});

it('is Neamhní an easpa anois, agus tá sí ann cheana', () => {
  assert.deepStrictEqual(coid(`${DUINE}\n`
    + 'suim Aimsiú {\n    Fuarthas { duine: Duine }\n    Beag { luach: Neamhní }\n}'), []);
});

// ══ 6. Dúchas: aon chúige amháin ag suim (§26.2) ═════════════════════
it('éilíonn suim cúige mar a éilíonn struchtúr', () => {
  assert.deepStrictEqual(coid('suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}'), []);
});

it('tá suim agus struchtúr san iomaíocht ar na ceithre shliotán chéanna', () => {
  assert.deepStrictEqual(
    coid('struchtúr D as Corcaigh { a: Uimhir }\n'
      + 'suim T as Ciarraí {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}'),
    ['E603']);
});

it('ní éilíonn malairt cúige di féin — dá n-éileodh, d\'íosfadh suim dhá shliotán', () => {
  // The load-bearing decision of §26.2 in one assertion: four provinces are
  // still four types, however many variants those types have.
  assert.deepStrictEqual(
    coid('suim A as Corcaigh {\n    P { x: Uimhir }\n    Q { x: Uimhir }\n}\n'
      + 'suim B as Cill Dara {\n    R { x: Uimhir }\n    S { x: Uimhir }\n}\n'
      + 'suim C as Sligeach {\n    T { x: Uimhir }\n    U { x: Uimhir }\n}\n'
      + 'suim D as Muineachán {\n    V { x: Uimhir }\n    W { x: Uimhir }\n}'),
    []);
});

it('freagraíonn malairt le contae na suime ag an teorainn', () => {
  // The sum is placed, so opening a variant from the wrong province is E601
  // exactly as opening a struct field would be.
  assert.deepStrictEqual(coid('as Gaillimh\n'
    + 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { x: Uimhir }\n}\n'
    + 'feidhm f(t: T) -> Uimhir { má t is A { x ó th } mura { 0 } }'), ['E601']);
  // …and a treaty opens it, through the machinery that was already there.
  assert.deepStrictEqual(coid('as Gaillimh\ncomhaontú Gaillimh Corcaigh\n'
    + 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { x: Uimhir }\n}\n'
    + 'feidhm f(t: T) -> Uimhir { má t is A { x ó th } mura { 0 } }'), []);
});

it('coinníonn ualach a chontae féin taobh istigh de shuim eile', () => {
  // Construction crosses freely — a county is a lock on the box, not a border
  // on the road (§24.3) — and then the payload is checked on its own terms.
  const src = 'as Gaillimh\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'suim T as Gaillimh {\n    A { duine: Duine }\n    B { cúis: Teaghrán }\n}\n';
  // Building one is fine from anywhere.
  assert.deepStrictEqual(coid(`${src}seasmhach t: T = A { duine: Duine { ainm: "C" } }`), []);
  // Opening the payload is not, because the payload is still from Cork.
  assert.deepStrictEqual(
    coid(`${src}feidhm f(t: T) -> Teaghrán { má t is A { ainm ó dhuine ó th } mura { cúis ó th } }`),
    ['E601']);
});

it('is E609 é ualach i gcontae a bhfuil seanaighneas leis', () => {
  const src = 'as Ciarraí\n'
    + 'struchtúr Duine as Corcaigh { ainm: Teaghrán }\n'
    + 'suim T as Gaillimh {\n    A { duine: Duine }\n    B { cúis: Teaghrán }\n}\n'
    + 'feidhm f(t: T) -> Teaghrán { má t is A { ainm ó dhuine ó th } mura { cúis ó th } }';
  assert.ok(coid(src).includes('E609'), JSON.stringify(coid(src)));
});

// ══ 7. An teorainn idir modúil ═══════════════════════════════════════
it('trasnaíonn suim agus a malairtí an teorainn', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.sb': 'suim T {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.sb': 'seasmhach m = ó "./toradh.sb"\n'
        + 'feidhm f(t: T) -> Uimhir { má t is A { x ó th } mura { 0 } }',
    }),
    []);
});

it('taistealaíonn éileamh cúige na suime leis an iompórtáil (E603)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.sb': 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.sb': 'seasmhach m = ó "./toradh.sb"\nstruchtúr Áit as Ciarraí { ainm: Teaghrán }',
    }),
    ['E603']);
});

it('ní éilíonn malairt iompórtáilte cúige di féin', () => {
  // If a variant carried its own county, importing a two-variant sum would
  // report E603 against itself. It does not.
  assert.deepStrictEqual(
    coidTionscadal({
      'toradh.sb': 'suim T as Corcaigh {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}',
      'príomh.sb': 'as Corcaigh\nseasmhach m = ó "./toradh.sb"\n'
        + 'feidhm f(t: T) -> Uimhir { má t is A { x ó th } mura { 0 } }',
    }),
    []);
});

// ══ 8. Ní fheiceann an chúlchríoch aon rud de seo ════════════════════
it('ní shroicheann an tsuim an JavaScript', () => {
  const js = jsDe('as Corcaigh\n'
    + 'suim Toradh as Corcaigh {\n    Ceart { x: Uimhir }\n    Easpa { cúis: Teaghrán }\n}\n'
    + 'feidhm f(toradh: Toradh) -> Uimhir { má toradh is Ceart { x ó thoradh } mura { 0 } }');
  // The sum is a statement about which tags are possible, and a statement
  // about possibility has no run-time shadow: the *name* never appears.
  for (const focal of ['Toradh', '__suim', '__malairt', 'Corcaigh', 'An Mhumhain',
    '__contae', '__cúige', 'thoradh']) {
    assert.ok(!js.includes(focal), `${focal} sa JS:\n${js}`);
  }
  // What is there is the tag `__is` already read, and the constructor a
  // struct already got. No new backend concept.
  assert.ok(js.includes('__is(toradh, "Ceart")'));
  assert.ok(js.includes('Ceart$nua'));
});

it('níor chuir an tsuim cás nua le `__is`', () => {
  const js = jsDe('suim T {\n    A { x: Uimhir }\n    B { y: Uimhir }\n}');
  assert.ok(!js.includes('case "A"'));
  assert.ok(js.includes('luach.__cineál === cineál'));
});

// ══ 9. Iompar roimh 0.8 gan athrú ════════════════════════════════════
it('gineann clár 0.7 an cód céanna a ghin sé riamh', async () => {
  const src = 'struchtúr Duine { ainm: Teaghrán }\n'
    + 'feidhm beannacht(duine: Duine) -> Teaghrán { "Dia duit, " + ainm ó dhuine }\n'
    + 'gníomh príomh() { scríobh beannacht(Duine { ainm: "Cáit" }) }';
  assert.deepStrictEqual(coid(src), []);
  assert.deepStrictEqual(await rith(src), ['Dia duit, Cáit']);
});

it('fanann `suimiú` ag obair: níor ghoid an eochairfhocal an t-oibreoir', async () => {
  // `suim` the keyword and `suimiú` the operation shared a parser method name
  // until 0.8. This is the assertion that the rename did not break arithmetic.
  assert.deepStrictEqual(await rith('gníomh príomh() { scríobh 2 + 3 - 1 }'), ['4']);
});

it('is aitheantóir fós é "suim" mar chuid d\'fhocal', () => {
  assert.deepStrictEqual(coid('seasmhach suimeanna = 3'), []);
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n    ${e.message}`); }
  }
  console.log(`\nsuim: ${pas} pas, ${teip} teip`);
  if (teip) process.exit(1);
})();
