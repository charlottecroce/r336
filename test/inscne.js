'use strict';

/*
 * §39 (`ar` as an adverse condition) and §40 (gender), together because both
 * ask the same question: does the grammar stay at the front?
 *
 * Section 3 is the important one. It is the erasure proof §28 has run since
 * 0.5, extended to the two things 0.11 added.
 */

const assert = require('node:assert');
const { tiomsaigh, Cnuasach, Earraid } = require('../src/index');
const mf = require('../src/morphology');

const { it, rithSraith } = require('./creatlach');

function coid(src) {
  try { tiomsaigh(src, 'tástáil.r336'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return [...new Set(e.earraidi.map((x) => x.cod))];
    // Some faults are thrown rather than collected, so catch both shapes.
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}
const jsDe = (src) => tiomsaigh(src, 'tástáil.r336').js;

const EARRAID = 'struchtúr Earráid {\n    cúis: Teaghrán\n}\n';
const ROINN = `${EARRAID}feidhm roinn(a: Uimhir, b: Uimhir) -> Uimhir ar Earráid {\n`
  + '    má b == 0 { Earráid { cúis: "nialas" } } mura { a / b }\n}\n';

// ══ 1. §39 — an staid dhochrach ══════════════════════════════════════

it('tógann feidhm frása "ar", agus buaileann an dá chraobh le chéile ann',
  'a function takes an "ar" phrase, and the two branches meet in it', () => {
  assert.deepStrictEqual(coid(ROINN), []);
});

it('ní chuirtear dochar ar ghníomh: níl aon rud ann le bualadh (E522)',
  'an action carries no adverse condition: there is nothing there to meet (E522)', () => {
  assert.deepStrictEqual(coid(`${EARRAID}gníomh f(x: Uimhir) ar Earráid { scríobh x }`), ['E522']);
});

it('ní Uimhir é go dtí go bhfuil an dochar as an áireamh (E523)',
  'it is not a Number until the adverse condition is ruled out (E523)', () => {
  assert.deepStrictEqual(coid(`${ROINN}leath seasmhach: Uimhir = roinn(10, 2)`), ['E523']);
  // The same boundary at every site: argument, member, binding.
  assert.deepStrictEqual(
    coid(`${ROINN}feidhm dúbail(x: Uimhir) -> Uimhir { x * 2 }\n`
      + 'gníomh p() { scríobh dúbail(roinn(4, 2)) }'), ['E523'],
  );
  assert.deepStrictEqual(
    coid(`${ROINN}gníomh p() {\n    t seasmhach = roinn(1, 2)\n    scríobh cúis ó th\n}`), ['E523'],
  );
});

it('caolaíonn an cheist an dá chraobh',
  'the question narrows both branches', () => {
  assert.deepStrictEqual(coid(`${ROINN}gníomh p() {
    t seasmhach = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th } mura { scríobh t + 1 }
}`), []);
});

it('ní chaolaíonn ceangal sealadach — an riail chéanna le §26.3',
  'a mutable binding does not narrow — the same rule as §26.3', () => {
  // A `cuir` in the branch could invalidate it. Essence narrows, accident does not.
  assert.deepStrictEqual(coid(`${ROINN}ag gníomh p() {
    t sealadach: Uimhir ar Earráid = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th }
}`), ['E523']);
});

it('leanann an fhoirm spleách an mhír, mar a rinne sí riamh (E512)',
  'the dependent form follows the particle, as it always did (E512)', () => {
  const ceart = `${ROINN}feidhm slán(t: Uimhir ar Earráid) -> Bool {\n`
    + '    mura bhfuil Earráid ar th { fíor } mura { bréagach }\n}';
  assert.deepStrictEqual(coid(ceart), []);
  assert.deepStrictEqual(coid(ceart.replace('mura bhfuil Earráid', 'mura tá Earráid')), ['E512']);
});

it('ní cheistítear dochar nár fógraíodh (E524)',
  'an adverse condition that was never declared cannot be questioned (E524)', () => {
  assert.deepStrictEqual(coid(`${EARRAID}c seasmhach = 3
gníomh p() { má tá Earráid ar ch { scríobh 1 } }`), ['E524']);
});

it('ní dochar é bunchineál (E525)',
  'a base type is not an adverse condition (E525)', () => {
  assert.deepStrictEqual(
    coid('feidhm f(a: Uimhir) -> Teaghrán ar Teaghrán { "x" }'), ['E525'],
  );
  assert.deepStrictEqual(
    coid('feidhm f(a: Uimhir) -> Uimhir ar Iasacht { a }'), ['E525'],
  );
});

it('séimhíonn "ar" a chuid féin — an mheicníocht chéanna, gan chód nua',
  '"ar" lenites its own complement — the same mechanism, no new code', () => {
  // `ar` has lenited since 0.4 and routes through `reitighFoirm`. No new table.
  assert.deepStrictEqual(coid(`${ROINN}gníomh p() {
    toradh seasmhach = roinn(1, 2)
    má tá Earráid ar toradh { scríobh 1 } mura { scríobh 2 }
}`), ['E102']);
});

// ══ 2. §40 — an inscne ═══════════════════════════════════════════════

it('is é foirmDe a dhéanann réiteach na haidiachta, gan aon rud nua',
  'foirmDe is what resolves the adjective, with nothing new', () => {
  assert.strictEqual(mf.foirmAidiachta('seasmhach', mf.INSCNE.FIR), 'seasmhach');
  assert.strictEqual(mf.foirmAidiachta('seasmhach', mf.INSCNE.BAIN), 'sheasmhach');
  assert.strictEqual(mf.foirmAidiachta('mór', mf.INSCNE.BAIN), 'mhór');
  // Empty slot: the rule applied to a word that has none, not an exception (§5).
  assert.strictEqual(mf.foirmAidiachta('óg', mf.INSCNE.BAIN), 'óg');
  assert.strictEqual(mf.foirmAidiachta('luath', mf.INSCNE.BAIN), 'luath');
});

it('leanann an aidiacht a hainmfhocal',
  'the adjective follows its noun', () => {
  assert.deepStrictEqual(coid('duine seasmhach = 3'), []);
  assert.deepStrictEqual(coid('aois sheasmhach = 3'), []);
  assert.deepStrictEqual(coid('c sealadach: Uimhir = 0'), []);
});

it('fógraíonn foirm na haidiachta an inscne, gan eochairfhocal nua',
  'the form of the adjective declares the gender, with no new keyword', () => {
  const { anailiseoir } = tiomsaigh('duine seasmhach = 3\naois sheasmhach = 4', 'tástáil.r336');
  assert.strictEqual(anailiseoir.inscni.get('duine').inscne, mf.INSCNE.FIR);
  assert.strictEqual(anailiseoir.inscni.get('aois').inscne, mf.INSCNE.BAIN);
});

it('seiceálann fógra inscne cineáil é féin (E526)',
  'a type\'s gender declaration checks itself (E526)', () => {
  assert.deepStrictEqual(coid('struchtúr Aois bhaininscneach { luach: Uimhir }'), []);
  assert.deepStrictEqual(coid('struchtúr Duine firinscneach { ainm: Teaghrán }'), []);
  assert.deepStrictEqual(coid('struchtúr Aois baininscneach { luach: Uimhir }'), ['E526']);
  assert.deepStrictEqual(coid('struchtúr Duine fhirinscneach { ainm: Teaghrán }'), ['E526']);
});

it('tá an fógra inscne roghnach ar chineál, agus firinscneach mura bhfuil (§40.7)',
  'the gender declaration is optional on a type, and masculine when absent (§40.7)', () => {
  const { anailiseoir } = tiomsaigh('struchtúr Duine { ainm: Teaghrán }', 'tástáil.r336');
  assert.strictEqual(anailiseoir.cinealacha.get('Duine').inscne, mf.INSCNE.FIR);
});

it('coinníonn an modúl inscne amháin in aghaidh an fhocail (E527)',
  'a module holds one gender per word (E527)', () => {
  assert.deepStrictEqual(
    coid('aois sheasmhach = 20\ngníomh p(aois seasmhach: Uimhir) { scríobh aois }'), ['E527'],
  );
  // A parameter with no adjective declares nothing.
  assert.deepStrictEqual(
    coid('aois sheasmhach = 20\ngníomh p(aois: Uimhir) { scríobh aois }'), [],
  );
});

it('fanann "a" ina cháithnín ainmnithe: níor thóg an inscne an slot sin',
  '"a" stays a naming particle: gender did not take that slot', () => {
  // §40 declined the possessive determiner and 0.13 does not restore it. The
  // slot eclipsis got is the preposition `i` (§5.2), which governs a noun
  // rather than selecting a referent.
  assert.deepStrictEqual(coid('struchtúr D { cóta: Teaghrán }\n'
    + 'cóta seasmhach = "glas"\ngníomh p() { scríobh a chóta }'), ['E513']);
  assert.strictEqual(mf.foirmDe('cóta', mf.FOIRM.URAITHE), 'gcóta');
  assert.deepStrictEqual(coid('cóta seasmhach = "glas"\ngníomh p() { scríobh gcóta }'), ['E113']);
});

// ══ 3. Ní shroicheann ceachtar acu an chúlchríoch ════════════════════

it('níl aon fhocal dochair sa JavaScript',
  'there is no word of adversity in the JavaScript', () => {
  const js = jsDe(`${ROINN}gníomh p() {
    t seasmhach = roinn(10, 2)
    má tá Earráid ar th { scríobh cúis ó th } mura { scríobh t + 1 }
}`);
  for (const focal of ['dochar', 'dochrach', ' ar ', '__dochar', 'Uimhir ar']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
  // `__is` asks the question, the same tag the copula already reads.
  assert.ok(js.includes('__is(t, "Earráid")'), js);
});

it('níl aon fhocal inscne sa JavaScript, ná aon aidiacht shéimhithe',
  'there is no word of gender in the JavaScript, nor any lenited adjective', () => {
  const js = jsDe(`struchtúr Aois bhaininscneach { luach: Uimhir }
aois sheasmhach = Aois { luach: 20 }
tuairisc shealadach: Teaghrán = ""
gníomh p() { scríobh luach ó aois }`);
  for (const focal of ['inscne', 'firinscneach', 'baininscneach', 'bhaininscneach',
    'sheasmhach', 'shealadach', 'fir', 'bain']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
  // The binding is there under its lemma.
  assert.ok(/const aois = /.test(js), js);
  assert.ok(/let tuairisc = /.test(js), js);
});

it('ní athraíonn an t-ord nua an cód a ghintear ar chor ar bith',
  'the new word order does not change the emitted code at all', () => {
  // Word order is the whole change. Both orders emit the same JavaScript.
  const js = jsDe('duine seasmhach = 3\nc sealadach: Uimhir = 0');
  assert.ok(js.includes('const duine = 3;'), js);
  assert.ok(js.includes('let c = 0;'), js);
});

// ── rith ──────────────────────────────────────────────────────────────
rithSraith('inscne');
