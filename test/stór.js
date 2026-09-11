'use strict';

/*
 * test/stór.js — §41: tábla ag cineál.
 *
 * Hand-rolled micro-runner, like every other suite here. Not Jest.
 *
 * Six things this suite is for, in the order they matter:
 *
 *   1. The marker's word order is fixed and checked, not discovered.
 *   2. E610 and E611 fire, and fire alone.
 *   3. The aspect system was not taught anything: `faigh` is ongoing and the
 *      existing E504/E505 do all the work.
 *   4. The county system was not taught anything: a row read out of a table
 *      crosses a border exactly as any other member read does.
 *   5. The backend never sees the marker — the erasure proof, in the same
 *      shape as the gender and county ones in `test/inscne.js`.
 *   6. The ceiling is four, not thirty-two, and it is asserted so that it
 *      stops being true loudly.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { tiomsaigh, Earraid, Cnuasach } = require('../src/index.js');
const tbl = require('../src/táblaí.js');

// ── áiseanna ──────────────────────────────────────────────────────────

/**
 * `tiomsaigh` is the single-file pipeline. It returns the emitted JavaScript;
 * older revisions returned a record around it, so both shapes are accepted
 * here rather than pinning this suite to one of them.
 */
function jsDe(foinse) {
  const t = tiomsaigh(foinse, 'tástáil.r336', {});
  return typeof t === 'string' ? t : t.js;
}

/**
 * Every diagnostic code one source produces, sorted.
 *
 * Catches both shapes on purpose: most faults are collected into a `Cnuasach`
 * and a few are thrown as a bare `Earraid` because the parser cannot carry on
 * past them (§11.4).
 */
function coid(foinse) {
  try {
    jsDe(foinse);
    return [];
  } catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod).sort();
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

/** Run a body with console.log captured. */
async function scriofa(fn) {
  const bunúsach = console.log;
  const línte = [];
  console.log = (...a) => línte.push(a.map(String).join(' '));
  try { await fn(); } finally { console.log = bunúsach; }
  return línte;
}

const TASCANNA = [];
const it = (ainm, fn) => TASCANNA.push([ainm, fn]);

// ══ 1. An marc: ord na mionathruithe ══════════════════════════════════

it('glacann an dearbhú leis an ord: ainm, aidiacht, stór, tionscnamh', () => {
  assert.deepStrictEqual(
    coid('struchtúr Duine firinscneach stór as Corcaigh { ainm: Teaghrán }'), []);
  // The gender adjective is optional, as it is everywhere else.
  assert.deepStrictEqual(
    coid('struchtúr Duine stór as Corcaigh { ainm: Teaghrán }'), []);
  // And it still checks itself: E526 is unaffected by the marker sitting
  // after it.
  assert.deepStrictEqual(
    coid('struchtúr Aois baininscneach stór as Corcaigh { luach: Uimhir }'), ['E526']);
});

it('is E401 é an marc as ord', () => {
  // `stór` before the adjective is not a word order this language has.
  assert.deepStrictEqual(
    coid('struchtúr Duine stór firinscneach as Corcaigh { ainm: Teaghrán }'), ['E401']);
  // And after the provenance is not one either.
  assert.deepStrictEqual(
    coid('struchtúr Duine as Corcaigh stór { ainm: Teaghrán }'), ['E401']);
});

it('níl slot ag "stór" ar shuim ná ar mhalairt', () => {
  // No code of its own: the grammar simply has no place to write it, which is
  // the same answer §10 gives the definite article.
  assert.deepStrictEqual(
    coid('suim T stór as Corcaigh { A { x: Uimhir } B { y: Uimhir } }'), ['E401']);
});

// ══ 2. E610: tábla gan áit ════════════════════════════════════════════

it('teastaíonn contae ó thábla (E610)', () => {
  assert.deepStrictEqual(coid('struchtúr Duine stór { ainm: Teaghrán }'), ['E610']);
  assert.deepStrictEqual(
    coid('struchtúr Duine firinscneach stór { ainm: Teaghrán }'), ['E610']);
  // Without the marker the same declaration is ordinary and legal.
  assert.deepStrictEqual(coid('struchtúr Duine { ainm: Teaghrán }'), []);
});

// ══ 3. E611: níl tábla ag an gcineál ══════════════════════════════════

it('ní léitear as cineál nach bhfuil tábla aige (E611)', () => {
  const src = `struchtúr Duine { ainm: Teaghrán }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }`;
  assert.deepStrictEqual(coid(src), ['E611']);
});

it('ní léitear as cineál nach cineál curtha é ar chor ar bith (E611)', () => {
  assert.deepStrictEqual(
    coid('ag feidhm gach(stór: Iasacht) -> Liosta(Iasacht) { tar éis faigh Uimhir as stór }'),
    ['E611']);
  assert.deepStrictEqual(
    coid('ag feidhm gach(stór: Iasacht) -> Liosta(Iasacht) { tar éis faigh Iasacht as stór }'),
    ['E611']);
});

it('ní chuireann E611 earráid chineáil ina dhiaidh', () => {
  // A refused `faigh` yields `Liosta(Iasacht)` so that the declared type of
  // the binding does not produce a second, misleading E201.
  const src = `struchtúr Duine { ainm: Teaghrán }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) {
    rónna seasmhach: Liosta(Duine) = tar éis faigh Duine as stór
    rónna
}`;
  assert.deepStrictEqual(coid(src), ['E611']);
});

// ══ 4. Aiseacht: níor fhoghlaim an córas rud ar bith ══════════════════

it('tá "faigh" ar siúl, mar sin teastaíonn "tar éis" (E505)', () => {
  const src = `struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
as Corcaigh
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { faigh Duine as stór }`;
  assert.ok(coid(src).includes('E505'));
});

it('ní chríochnaítear rud nach bhfuil ar siúl timpeall air (E504)', () => {
  const src = `as Corcaigh
struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }`;
  assert.ok(coid(src).includes('E504'));
});

it('tugann "faigh" Liosta(T) ar ais, agus ní Liosta(Iasacht)', () => {
  const src = `as Corcaigh
struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }`;
  assert.deepStrictEqual(coid(src), []);
  const olc = src.replace('-> Liosta(Duine)', '-> Liosta(Teaghrán)');
  assert.deepStrictEqual(coid(olc), ['E209']);
});

// ══ 5. Rialú: ní shéimhíonn "as", agus sin an tseiceáil ═══════════════

it('éilíonn "as" an bhunfhoirm, gan chód nua', () => {
  const src = `as Corcaigh
struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }`;
  // `stór` begins st-, which cannot bear a séimhiú at all, so the wrong form
  // is caught as a structural impossibility rather than as a licensing fault.
  assert.deepStrictEqual(coid(src.replace('as stór', 'as shtór')), ['E104']);
});

// ══ 6. Contaetha: níor fhoghlaim an córas sin rud ar bith ach oiread ══

it('fanann teorainn na gcontae mar atá — ar léamh ball amháin', () => {
  // Exiled file, table in An Mhumhain. Naming the type to read the table is
  // construction and passes; reading a field off the row is a border crossing
  // and does not.
  const src = `struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }
feidhm céadAinm(d: Duine) -> Teaghrán { ainm ó dh }`;
  assert.deepStrictEqual(coid(src), ['E601']);
});

// ══ 6b. Dá chlárlann, dá mhínghranúláideacht ════════════════════

it('éilíonn tábla contae, agus ní cúige', () => {
  // Two tables in one province is legal, because a table claims a county.
  // This is the whole difference from an ordinary placed type.
  assert.deepStrictEqual(
    coid(`struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
struchtúr Áit stór as Ciarraí { ainm: Teaghrán }`), []);
  // A whole province's worth of them, to make the point flatly.
  assert.deepStrictEqual(
    coid(`struchtúr A stór as Corcaigh { x: Uimhir }
struchtúr B stór as Ciarraí { x: Uimhir }
struchtúr C stór as Luimneach { x: Uimhir }
struchtúr D stór as An Clár { x: Uimhir }
struchtúr E stór as Port Láirge { x: Uimhir }
struchtúr F stór as Tiobraid Árann { x: Uimhir }`), []);
});

it('ní bhíonn ach tábla amháin ag contae (E612)', () => {
  assert.deepStrictEqual(
    coid(`struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
struchtúr Áit stór as Corcaigh { ainm: Teaghrán }`), ['E612']);
});

it('ní doras cúil é an marc: buaileann an dá éileamh faoi chéile', () => {
  // A table in Corcaigh blocks any ordinary type from claiming An Mhumhain,
  // and an ordinary type in An Mhumhain blocks a table anywhere in Munster.
  // Both directions, because declaration order must not decide it.
  assert.deepStrictEqual(
    coid(`struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
struchtúr Áit as Ciarraí { ainm: Teaghrán }`), ['E603']);
  assert.deepStrictEqual(
    coid(`struchtúr Áit as Ciarraí { ainm: Teaghrán }
struchtúr Duine stór as Corcaigh { ainm: Teaghrán }`), ['E603']);
  // A sum claims a province like any other ordinary placed type.
  assert.deepStrictEqual(
    coid(`suim T as Corcaigh { A { x: Uimhir } B { y: Uimhir } }
struchtúr Áit stór as Ciarraí { ainm: Teaghrán }`), ['E603']);
  // Different provinces: no collision at all.
  assert.deepStrictEqual(
    coid(`struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
struchtúr Áit as Gaillimh { ainm: Teaghrán }`), []);
});

it('bhí an t-iomaitheoir gan bhaint go dtí seo, agus níl a thuilleadh', () => {
  // §25.4 recorded that `Corcaigh`/`Ciarraí` was reachable "only in the
  // direction nobody was looking", because two counties of one province could
  // never both hold a type. At county granularity they can both hold a TABLE
  // — and then no file anywhere can read both of them.
  const dha = `struchtúr Duine stór as Corcaigh { ainm: Teaghrán }
struchtúr Áit stór as Ciarraí { ainm: Teaghrán }`;
  assert.deepStrictEqual(coid(dha), []);
  // From one of the two: the rivalry veto, which no treaty can lift.
  assert.deepStrictEqual(
    coid(`as Corcaigh\n${dha}\nfeidhm f(x: Áit) -> Teaghrán { ainm ó x }`), ['E609']);
  // From anywhere else: an ordinary border violation.
  assert.deepStrictEqual(
    coid(`as Gaillimh\n${dha}\nfeidhm f(x: Áit) -> Teaghrán { ainm ó x }`), ['E601']);
});

// ══ 7. An cúlchríoch: ní fheiceann sé an marc ═════════════════════════

it('ní ghineann an marc cód ar bith — an cruthúnas scriosta', () => {
  const gan = jsDe('struchtúr Duine as Corcaigh { ainm: Teaghrán }');
  const le = jsDe('struchtúr Duine firinscneach stór as Corcaigh { ainm: Teaghrán }');
  assert.strictEqual(le, gan);
});

it('níl focal ar bith faoi thábla sa JS gan "faigh"', () => {
  const js = jsDe('struchtúr Duine stór as Corcaigh { ainm: Teaghrán }');
  for (const focal of ['stór', 'tábla', 'contae', 'Corcaigh', '__tábla', 'firinscneach']) {
    assert.ok(!js.includes(focal), `${focal}: ${js}`);
  }
});

it('gineann "faigh" glaoch amháin ar an teibíocht', () => {
  const js = jsDe(`as Corcaigh
struchtúr Duine stór as Corcaigh { ainm: Teaghrán aois: Uimhir }
ag feidhm gach(stór: Iasacht) -> Liosta(Duine) { tar éis faigh Duine as stór }`);
  // A tag and not a constructor: an imported type's `$nua` is not in scope in
  // the file doing the reading, and the tag is all `__is` ever wanted.
  assert.ok(js.includes('stór.faigh("duine", ["ainm", "aois"], "Duine")'), js);
});

it('níl stór focal tiománaí i src/táblaí.js ach oiread', () => {
  const téacs = fs.readFileSync(path.join(__dirname, '../src/táblaí.js'), 'utf8');
  for (const focal of ['prisma', 'sqlite', 'sql']) {
    assert.ok(!new RegExp(focal, 'i').test(téacs), focal);
  }
});

// ══ 8. An t-ainm: gan uimhir iolra ════════════════════════════════════

it('is é lemma an chineáil an t-ainm, gan iolrú', () => {
  assert.strictEqual(tbl.ainmTabla('Duine'), 'duine');
  assert.notStrictEqual(tbl.ainmTabla('Duine'), 'daoine');
  assert.strictEqual(tbl.ainmTabla('Aois'), 'aois');
  assert.strictEqual(tbl.ainmTabla('Cluiche'), 'cluiche');
});

// ══ 9. An uasteorainn: a ceathair, ní a dó dhéag is fiche ═════════════

it('is é a dó dhéag is tríocha an uasteorainn, ó riail na gcontaetha', () => {
  const { CONTAETHA } = require('../src/contaetha.js');
  assert.strictEqual(tbl.UASMHEID, 32);
  assert.strictEqual(tbl.UASMHEID, CONTAETHA.size);
});

it('is uasteorainn í agus ní bhuiséad: cosnaíonn gnáthchineál cúige iomlán', () => {
  // One ordinary placed type in Connacht costs all five Connacht counties.
  const g = coid(`struchtúr Lár as Gaillimh { x: Uimhir }
struchtúr A stór as Maigh Eo { x: Uimhir }`);
  assert.deepStrictEqual(g, ['E603']);
  // The same table is fine once the ordinary type is somewhere else.
  assert.deepStrictEqual(
    coid(`struchtúr Lár as Corcaigh { x: Uimhir }
struchtúr A stór as Maigh Eo { x: Uimhir }`), []);
});

it('coinníonn an chlárlann taifead in-léite', () => {
  const c = new tbl.ClarlannTablai();
  assert.strictEqual(c.faigh('Duine'), null);
  c.cuir('Duine', 'Corcaigh', ['ainm', 'aois'], { line: 1 });
  assert.strictEqual(c.ann('Duine'), true);
  assert.strictEqual(c.faigh('Duine').tabla, 'duine');
  assert.deepStrictEqual(c.faigh('Duine').reimsi, ['ainm', 'aois']);
  assert.strictEqual(c.lion, 1);
});

// ══ 10. Turas iomlán trí rt/stór.js ═══════════════════════════════════

it('tugann "faigh" na rónna ar ais clibeáilte', async () => {
  const { oscail } = require('../rt/stór.js');
  const stór = await oscail(':memory:');
  await stór.scéim('CREATE TABLE duine (id INTEGER PRIMARY KEY, ainm TEXT, aois INTEGER)');
  await stór.feidhmigh('INSERT INTO duine (ainm, aois) VALUES (?, ?), (?, ?)',
    ['Cáit', 20, 'Oisín', 34]);

  const daoine = await stór.faigh('duine', ['ainm', 'aois'], 'Duine');
  assert.strictEqual(daoine.length, 2);
  // The declared columns and no others: `id` is in the table and is not in
  // the type, so it is not in the value.
  assert.deepStrictEqual(Object.keys(daoine[0]).sort(), ['__cineál', 'ainm', 'aois']);
  assert.strictEqual(daoine[0].__cineál, 'Duine');
  assert.strictEqual(Object.getPrototypeOf(daoine[0]), Object.prototype);

  const línte = await scriofa(async () => {
    for (const d of daoine) console.log('Dia duit, ' + d.ainm);
  });
  assert.deepStrictEqual(línte, ['Dia duit, Cáit', 'Dia duit, Oisín']);

  await stór.dún();
});

it('luaitear aitheantóirí, mar nach í seo an léacsóir', async () => {
  const { oscail } = require('../rt/stór.js');
  const stór = await oscail(':memory:');
  await stór.scéim('CREATE TABLE "select" ("from" TEXT)');
  await stór.feidhmigh('INSERT INTO "select" ("from") VALUES (?)', ['x']);
  const r = await stór.faigh('select', ['from'], 'Rud');
  assert.deepStrictEqual(r, [{ __cineál: 'Rud', from: 'x' }]);
  await stór.dún();
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  let teip = 0;
  for (const [ainm, fn] of TASCANNA) {
    try {
      await fn();
      console.log(`  ✓ ${ainm}`);
    } catch (e) {
      teip += 1;
      console.log(`  ✗ ${ainm}`);
      console.log(`    ${e && e.message}`);
    }
  }
  console.log(`\n${TASCANNA.length - teip}/${TASCANNA.length} — test/stór.js`);
  if (teip) process.exit(1);
})();
