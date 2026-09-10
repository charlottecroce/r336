'use strict';

/*
 * test/inscne.js — §39 (`ar` mar staid dhochrach) agus §40 (inscne).
 *
 *     node test/inscne.js
 *
 * Dhá ghné in aon chomhad amháin mar go bhfuil an cheist chéanna á cur faoin
 * dá cheann acu: an bhfanann an ghramadach sa tosach?
 *
 * Tá an tríú rannóg ar an gceann is tábhachtaí. Ó chéim 0.5 tá tástáil ann a
 * dhearbhaíonn nach bhfeictear séimhiú ná modh sa JavaScript, agus is é an
 * cruthú sin an t-aon fháth le creidiúint gur ciseal fíor í an ghramadach
 * seachas ionadú téacs (§28). Cuireann 0.11 dhá rud nua leis an gciseal sin
 * agus caithfidh an dá cheann an cruthú céanna a shásamh: níl aon fhocal
 * dochair agus níl aon fhocal inscne sa chód a ghintear.
 */

const assert = require('node:assert');
const { tiomsaigh, Cnuasach, Earraid } = require('../src/index');
const mf = require('../src/morphology');

let pas = 0; let teip = 0;
const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);

function coid(src) {
  try { tiomsaigh(src, 'tástáil.sb'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return [...new Set(e.earraidi.map((x) => x.cod))];
    // Some faults are thrown rather than collected — the parser cannot carry
    // on past them — so both shapes have to be caught here.
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}
const jsDe = (src) => tiomsaigh(src, 'tástáil.sb').js;

const EARRAID = 'struchtúr Earráid {\n    cúis: Teaghrán\n}\n';
const ROINN = `${EARRAID}feidhm roinn(a: Uimhir, b: Uimhir) -> Uimhir ar Earráid {\n`
  + '    má b == 0 { Earráid { cúis: "nialas" } } mura { a / b }\n}\n';

// ══ 1. §39 — an staid dhochrach ══════════════════════════════════════

it('tógann feidhm frása "ar", agus buaileann an dá chraobh le chéile ann', () => {
  assert.deepStrictEqual(coid(ROINN), []);
});

it('ní chuirtear dochar ar ghníomh: níl aon rud ann le bualadh (E522)', () => {
  assert.deepStrictEqual(coid(`${EARRAID}gníomh f(x: Uimhir) ar Earráid { scríobh x }`), ['E522']);
});

it('ní Uimhir é go dtí go bhfuil an dochar as an áireamh (E523)', () => {
  assert.deepStrictEqual(coid(`${ROINN}leath seasmhach: Uimhir = roinn(10, 2)`), ['E523']);
  // Agus ar an teorainn chéanna ag gach suíomh: argóint, ball, ceangal.
  assert.deepStrictEqual(
    coid(`${ROINN}feidhm dúbail(x: Uimhir) -> Uimhir { x * 2 }\n`
      + 'gníomh p() { scríobh dúbail(roinn(4, 2)) }'), ['E523'],
  );
  assert.deepStrictEqual(
    coid(`${ROINN}gníomh p() {\n    t seasmhach = roinn(1, 2)\n    scríobh cúis ó th\n}`), ['E523'],
  );
});

it('caolaíonn an cheist an dá chraobh', () => {
  assert.deepStrictEqual(coid(`${ROINN}gníomh p() {
    t seasmhach = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th } mura { scríobh t + 1 }
}`), []);
});

it('ní chaolaíonn ceangal sealadach — an riail chéanna le §26.3', () => {
  // A `cuir` inside the branch could invalidate it, so the narrowing would
  // not be true. Essence narrows; accident does not.
  assert.deepStrictEqual(coid(`${ROINN}ag gníomh p() {
    t sealadach: Uimhir ar Earráid = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th }
}`), ['E523']);
});

it('leanann an fhoirm spleách an mhír, mar a rinne sí riamh (E512)', () => {
  const ceart = `${ROINN}feidhm slán(t: Uimhir ar Earráid) -> Bool {\n`
    + '    mura bhfuil Earráid ar th { fíor } mura { bréagach }\n}';
  assert.deepStrictEqual(coid(ceart), []);
  assert.deepStrictEqual(coid(ceart.replace('mura bhfuil Earráid', 'mura tá Earráid')), ['E512']);
});

it('ní cheistítear dochar nár fógraíodh (E524)', () => {
  assert.deepStrictEqual(coid(`${EARRAID}c seasmhach = 3
gníomh p() { má tá Earráid ar ch { scríobh 1 } }`), ['E524']);
});

it('ní dochar é bunchineál (E525)', () => {
  assert.deepStrictEqual(
    coid('feidhm f(a: Uimhir) -> Teaghrán ar Teaghrán { "x" }'), ['E525'],
  );
  assert.deepStrictEqual(
    coid('feidhm f(a: Uimhir) -> Uimhir ar Iasacht { a }'), ['E525'],
  );
});

it('séimhíonn "ar" a chuid féin — an mheicníocht chéanna, gan chód nua', () => {
  // `ar` has lenited since 0.4 and routes through `reitighFoirm`. The adverse
  // predication added no government table and no fifth mechanism.
  assert.deepStrictEqual(coid(`${ROINN}gníomh p() {
    toradh seasmhach = roinn(1, 2)
    má tá Earráid ar toradh { scríobh 1 } mura { scríobh 2 }
}`), ['E102']);
});

// ══ 2. §40 — an inscne ═══════════════════════════════════════════════

it('is é foirmDe a dhéanann réiteach na haidiachta, gan aon rud nua', () => {
  assert.strictEqual(mf.foirmAidiachta('seasmhach', mf.INSCNE.FIR), 'seasmhach');
  assert.strictEqual(mf.foirmAidiachta('seasmhach', mf.INSCNE.BAIN), 'sheasmhach');
  assert.strictEqual(mf.foirmAidiachta('mór', mf.INSCNE.BAIN), 'mhór');
  // Slot folamh: ní eisceacht í an aidiacht nach féidir a shéimhiú, ach an
  // riail curtha i bhfeidhm ar fhocal nach bhfuil aon slot aige (§5).
  assert.strictEqual(mf.foirmAidiachta('óg', mf.INSCNE.BAIN), 'óg');
  assert.strictEqual(mf.foirmAidiachta('luath', mf.INSCNE.BAIN), 'luath');
});

it('leanann an aidiacht a hainmfhocal', () => {
  assert.deepStrictEqual(coid('duine seasmhach = 3'), []);
  assert.deepStrictEqual(coid('aois sheasmhach = 3'), []);
  assert.deepStrictEqual(coid('c sealadach: Uimhir = 0'), []);
});

it('fógraíonn foirm na haidiachta an inscne, gan eochairfhocal nua', () => {
  const { anailiseoir } = tiomsaigh('duine seasmhach = 3\naois sheasmhach = 4', 'tástáil.sb');
  assert.strictEqual(anailiseoir.inscni.get('duine').inscne, mf.INSCNE.FIR);
  assert.strictEqual(anailiseoir.inscni.get('aois').inscne, mf.INSCNE.BAIN);
});

it('seiceálann fógra inscne cineáil é féin (E526)', () => {
  assert.deepStrictEqual(coid('struchtúr Aois bhaininscneach { luach: Uimhir }'), []);
  assert.deepStrictEqual(coid('struchtúr Duine firinscneach { ainm: Teaghrán }'), []);
  assert.deepStrictEqual(coid('struchtúr Aois baininscneach { luach: Uimhir }'), ['E526']);
  assert.deepStrictEqual(coid('struchtúr Duine fhirinscneach { ainm: Teaghrán }'), ['E526']);
});

it('tá an fógra inscne roghnach ar chineál, agus firinscneach mura bhfuil (§40.7)', () => {
  const { anailiseoir } = tiomsaigh('struchtúr Duine { ainm: Teaghrán }', 'tástáil.sb');
  assert.strictEqual(anailiseoir.cinealacha.get('Duine').inscne, mf.INSCNE.FIR);
});

it('coinníonn an modúl inscne amháin in aghaidh an fhocail (E527)', () => {
  assert.deepStrictEqual(
    coid('aois sheasmhach = 20\ngníomh p(aois seasmhach: Uimhir) { scríobh aois }'), ['E527'],
  );
  // Agus ní fhógraíonn paraiméadar gan aidiacht rud ar bith: fanann sé ciúin.
  assert.deepStrictEqual(
    coid('aois sheasmhach = 20\ngníomh p(aois: Uimhir) { scríobh aois }'), [],
  );
});

it('fanann "a" ina cháithnín ainmnithe: níor thóg an inscne an slot sin', () => {
  // §40 declined the possessive determiner, so `a` before a noun is still
  // E513 and eclipsis is still *gan bhrí* (§12). The eclipsed slot is empty.
  assert.deepStrictEqual(coid('struchtúr D { cóta: Teaghrán }\n'
    + 'cóta seasmhach = "glas"\ngníomh p() { scríobh a chóta }'), ['E513']);
  assert.throws(() => mf.foirmDe('cóta', mf.FOIRM.URAITHE));
});

// ══ 3. Ní shroicheann ceachtar acu an chúlchríoch ════════════════════

it('níl aon fhocal dochair sa JavaScript', () => {
  const js = jsDe(`${ROINN}gníomh p() {
    t seasmhach = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th } mura { scríobh t + 1 }
}`);
  for (const focal of ['dochar', 'dochrach', ' ar ', '__dochar', 'Uimhir ar']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
  // Agus is é `__is` a dhéanann an cheist — an tagra céanna a léann an
  // chopail cheana. Níor fhoghlaim an chúlchríoch aon choincheap nua.
  assert.ok(js.includes('__is(t, "Earráid")'), js);
});

it('níl aon fhocal inscne sa JavaScript, ná aon aidiacht shéimhithe', () => {
  const js = jsDe(`struchtúr Aois bhaininscneach { luach: Uimhir }
aois sheasmhach = Aois { luach: 20 }
tuairisc shealadach: Teaghrán = ""
gníomh p() { scríobh luach ó aois }`);
  for (const focal of ['inscne', 'firinscneach', 'baininscneach', 'bhaininscneach',
    'sheasmhach', 'shealadach', 'fir', 'bain']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
  // Agus tá an ceangal ann faoina lemma, mar a bhí riamh.
  assert.ok(/const aois = /.test(js), js);
  assert.ok(/let tuairisc = /.test(js), js);
});

it('ní athraíonn an t-ord nua an cód a ghintear ar chor ar bith', () => {
  // The word order is the whole of the change on this side. The same program
  // in the two orders would emit the same JavaScript — which is the point,
  // and is also §31.7 again: nothing new can be written.
  const js = jsDe('duine seasmhach = 3\nc sealadach: Uimhir = 0');
  assert.ok(js.includes('const duine = 3;'), js);
  assert.ok(js.includes('let c = 0;'), js);
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n    ${e.message}`); }
  }
  console.log(`\ninscne: ${pas} pas, ${teip} teip`);
  if (teip) process.exit(1);
})();
