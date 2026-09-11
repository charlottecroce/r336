'use strict';

/*
 * The only suite that reads real files from disk. It asks whether the split
 * between shell and core survives someone editing the application.
 *
 * Section 3 is the valuable part. Without the negative tests this file only
 * says "it compiled", which was true before 0.7 as well.
 */

const assert = require('assert');
const path = require('path');
const { Tionscadal, Cnuasach, Earraid, duchasanna } = require('../src/index');
const ctae = require('../src/contaetha');

const { it, rithSraith } = require('./creatlach');

const FEIDHM = path.resolve(__dirname, '..', 'feidhmchlár');
const conair = (c) => path.join(FEIDHM, c);

/** Compile a real file through a fresh project each time. */
function tiomsaighComhad(c) {
  return new Tionscadal().tiomsaigh(conair(c));
}

/**
 * Compile the real graph with one file's source replaced, so a negative test
 * can ask "what if someone wrote this?" without touching the disk (§19.5).
 */
function coidLeMalairt(comhadMalairt, foinseNua, tosach = 'bealaí.r336') {
  const fs = require('fs');
  const abs = conair(comhadMalairt);
  const t = new Tionscadal({
    ann: (c) => fs.existsSync(c),
    léigh: (c) => (c === abs ? foinseNua : fs.readFileSync(c, 'utf8')),
  });
  try { t.tiomsaigh(conair(tosach)); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

const foinseDe = (c) => require('fs').readFileSync(conair(c), 'utf8');

// ══ 1. Tiomsaíonn sé, agus tá an dúchas mar a bhíothas ag súil ═══════
it('tiomsaíonn an feidhmchlár ar fad',
  'the whole application compiles', () => {
  for (const c of ['duine.r336', 'sonraí.r336', 'bealaí.r336']) {
    assert.doesNotThrow(() => tiomsaighComhad(c), c);
  }
});

it('tá an croí curtha, agus tá dhá chúige caite anois',
  'the core is planted, and two provinces are spent now', () => {
  // §25.9 recorded one province spent and the pressure never arriving.
  // `Aimsiú` spent the second in 0.8, because the sum cannot be in Munster (§26.6).
  const d = duchasanna(tiomsaighComhad('duine.r336').anailiseoir);
  assert.strictEqual(d.contae, 'Corcaigh');
  const cuirthe = d.cinealacha.filter((t) => t.contae !== ctae.DEORAIOCHT);
  assert.deepStrictEqual(cuirthe, [
    { ainm: 'Duine', contae: 'Corcaigh' },
    { ainm: 'Aimsiú', contae: 'Gaillimh' },
  ]);
  const gafa = new Set(cuirthe.map((t) => ctae.cuigeDe(t.contae)));
  assert.deepStrictEqual([...gafa], [ctae.CUIGI.MUMHAIN, ctae.CUIGI.CONNACHTA]);
});

it('ní fhéadfadh an tsuim a bheith san Mhumhain — sin an rogha a chosain rud',
  'the sum could not have lived in Munster — that is the choice that cost something', () => {
  const olc = foinseDe('duine.r336').replace('suim Aimsiú as Gaillimh', 'suim Aimsiú as Ciarraí');
  assert.notStrictEqual(olc, foinseDe('duine.r336'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('duine.r336', olc, 'duine.r336').includes('E603'));
});

it('is E213 é an rón a chur isteach sa tsuim gan é a thiontú',
  'putting a row into the sum without converting it is E213', () => {
  // The rule that keeps the conversion on the boundary where it belongs.
  const olc = foinseDe('duine.r336').replace('Aimsithe { duine: Duine }', 'Aimsithe { rón: Iasacht }');
  assert.notStrictEqual(olc, foinseDe('duine.r336'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('duine.r336', olc, 'duine.r336').includes('E213'));
});

it('fanann an bhlaosc ar deoraíocht',
  'the shell stays in exile', () => {
  for (const c of ['bealaí.r336', 'sonraí.r336']) {
    assert.strictEqual(duchasanna(tiomsaighComhad(c).anailiseoir).contae,
      ctae.DEORAIOCHT, c);
  }
});

it('ní bhaineann an croí leis an JavaScript ar chor ar bith',
  'the core has nothing to do with the JavaScript at all', () => {
  // Ask the compiler, not the text: the file is mostly prose about not importing.
  const { js, ast } = tiomsaighComhad('duine.r336');
  assert.strictEqual((ast.ailiasanna || new Map()).size, 0, 'tá modúl iompórtáilte sa chroí');
  assert.ok(!js.includes('require('), 'tá require sa JS');
});

// ══ 2. Ní shroicheann an dúchas an chúlchríoch ═══════════════════════
it('níl contae, cúige ná comhaontú sa JavaScript',
  'there is no county, province or treaty in the JavaScript', () => {
  for (const c of ['duine.r336', 'bealaí.r336']) {
    const { js } = tiomsaighComhad(c);
    for (const focal of ['Corcaigh', 'An Mhumhain', 'cúige', 'contae',
      '__contae', '__cúige', 'deoraíocht', 'comhaontú']) {
      assert.ok(!js.includes(focal), `${focal} i ${c}`);
    }
  }
});

it('maireann an cruthú 0.5: ní fheictear séimhiú ná modh sa JS ach oiread',
  'the 0.5 proof survives: no lenition or mood is visible in the JS either', () => {
  const { js } = tiomsaighComhad('bealaí.r336');
  for (const focal of ['dhuine', 'dhaoine', 'chéim', 'chuirSíol', 'bhfuil']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
});

// ══ 3. Na botúin — an chuid is tábhachtaí ════════════════════════════
it('is E601 é an bhlaosc ag oscailt an bhosca',
  'the shell opening the box is E601', () => {
  // What someone will actually do: skip the accessor because `ainm ó dhuine` is shorter.
  const olc = foinseDe('bealaí.r336')
    .replace('cuirDuine stór, ainmDe(duine), aoisDe(duine)',
      'cuirDuine stór, ainm ó dhuine, aois ó dhuine');
  assert.notStrictEqual(olc, foinseDe('bealaí.r336'), 'níor éirigh leis an ionadú');
  assert.deepStrictEqual(coidLeMalairt('bealaí.r336', olc), ['E601', 'E601']);
});

it('is E601 é an croí ag lorg an JavaScript',
  'the core reaching for the JavaScript is E601', () => {
  // Placing a module severs it from JavaScript permanently (§24.3).
  const olc = foinseDe('duine.r336').replace('as Corcaigh\n',
    'as Corcaigh\nbun seasmhach = ó "../rt/bunúsach.js"\n');
  assert.deepStrictEqual(
    coidLeMalairt('duine.r336', `${olc}\nfeidhm f() -> Teaghrán { uimhir ó bhun }`,
      'duine.r336'),
    ['E601']);
});

it('is E603 é an dara cineál san Mhumhain',
  'a second type in Munster is E603', () => {
  // `Duine as Corcaigh` closed all five Munster counties for the whole graph.
  const olc = `${foinseDe('duine.r336')}\nstruchtúr Áit as Ciarraí {\n    ainm: Teaghrán\n}`;
  assert.deepStrictEqual(coidLeMalairt('duine.r336', olc, 'duine.r336'), ['E603']);
});

it('tá an t-éileamh domhanda: ní féidir leis an mblaosc An Mhumhain a thógáil',
  'the claim is global: the shell cannot take Munster', () => {
  const olc = `${foinseDe('bealaí.r336')}\nstruchtúr Áit as Luimneach {\n    ainm: Teaghrán\n}`;
  assert.deepStrictEqual(coidLeMalairt('bealaí.r336', olc), ['E603']);
});

it('is E609 é an cineál a chur i gcontae le seanaighneas',
  'planting the type in a county with an old feud is E609', () => {
  // Only `duine.r336` has an `ó` on a `Duine`. The shell constructs and calls,
  // so the veto has nothing to bite there.
  const bun = foinseDe('duine.r336');
  const olc = bun.replace('struchtúr Duine as Corcaigh', 'struchtúr Duine as Ciarraí');
  assert.notStrictEqual(olc, bun, 'níor éirigh leis an ionadú');
  const coid = coidLeMalairt('duine.r336', olc, 'duine.r336');
  assert.ok(coid.length >= 4, JSON.stringify(coid));
  assert.ok(coid.every((c) => c === 'E609'), JSON.stringify(coid));
});


// ══ §37 — na lámhálaithe mar bhriathra saora ══════════════════════════

it('is briathra saora iad an dá bhealach',
  'both routes are autonomous verbs', () => {
  const src = foinseDe('bealaí.r336');
  assert.ok(src.includes('ag saor liostaigh('), 'liostaigh');
  assert.ok(src.includes('ag saor taispeáin('), 'taispeáin');
  // Registration is unchanged: naming was always the whole of it.
  assert.ok(src.includes('a liostaigh'));
  assert.ok(src.includes('a thaispeáin'));
});

it('ní féidir lámhálaí a ordú sa mhodúl a fhógraíonn é (E518)',
  'a handler cannot be commanded in the module that declares it (E518)', () => {
  const olc = foinseDe('bealaí.r336')
    .replace('bealach ó fhreastal(app, "/", a liostaigh)', 'liostaigh app, app');
  assert.notStrictEqual(olc, foinseDe('bealaí.r336'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('bealaí.r336', olc, 'bealaí.r336').includes('E518'));
});

it('ní shroicheann an modh saor an JavaScript',
  'the autonomous mood never reaches the JavaScript', () => {
  const { js } = tiomsaighComhad('bealaí.r336');
  for (const f of ['saor', 'liostaítear', 'taispeántar', 'liostaíodh']) {
    assert.ok(!js.includes(f), `${f} sa JavaScript`);
  }
  // The functions are there under their lemma.
  assert.ok(/function liostaigh\(/.test(js) || /liostaigh\s*=/.test(js));
});

// ── rith ──────────────────────────────────────────────────────────────
rithSraith('feidhmchlár');
