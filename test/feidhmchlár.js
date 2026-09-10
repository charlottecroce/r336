'use strict';

/*
 * test/feidhmchlár.js — an fheidhmchlár curtha (céim 0.7, cuid 5).
 *
 *     node test/feidhmchlár.js
 *
 * Tástáil ar leithligh arís, agus ar chúis nua: seo an t-aon tsraith a
 * léann comhaid fhíora ón diosca. Ní tástáil aonaid í. Is í an cheist atá á
 * cur ná an bhfanann an scaradh idir an bhlaosc agus an croí ina sheasamh
 * nuair a athraíonn duine an feidhmchlár, agus is é an chéad rud a
 * bhrisfidh ná go gcuirfear `ainm ó dhuine` i mbealaí.sb toisc gur fusa é.
 *
 * Trí chineál éilimh:
 *   1. Tiomsaíonn an feidhmchlár, agus tá an dúchas mar a bhíothas ag súil.
 *   2. Ní shroicheann an dúchas an JavaScript.
 *   3. Teipeann ar na botúin — is tástálacha diúltacha iad seo agus is iad
 *      an chuid is luachmhaire den chomhad. Gan iad níl anseo ach "thiomsaigh
 *      sé", agus thiomsaigh sé roimh 0.7 freisin.
 */

const assert = require('assert');
const path = require('path');
const { Tionscadal, Cnuasach, Earraid, duchasanna } = require('../src/index');
const ctae = require('../src/contaetha');

let pas = 0, teip = 0;
const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);

const FEIDHM = path.resolve(__dirname, '..', 'feidhmchlár');
const conair = (c) => path.join(FEIDHM, c);

/** Compile a real file through a fresh project each time. */
function tiomsaighComhad(c) {
  return new Tionscadal().tiomsaigh(conair(c));
}

/**
 * Compile the real graph with one file's source replaced, so a negative test
 * can ask "what if someone wrote this?" without touching the disk. The
 * project takes its filesystem by injection, which is what makes this
 * possible (§19.5).
 */
function coidLeMalairt(comhadMalairt, foinseNua, tosach = 'bealaí.sb') {
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
it('tiomsaíonn an feidhmchlár ar fad', () => {
  for (const c of ['duine.sb', 'sonraí.sb', 'bealaí.sb']) {
    assert.doesNotThrow(() => tiomsaighComhad(c), c);
  }
});

it('tá an croí curtha, agus tá dhá chúige caite anois', () => {
  // Bhí an tástáil seo ag dearbhú go raibh cúige amháin caite, agus ba é sin
  // an teip a taifeadadh i §25.9: níor tháinig an brú i bhfeidhm riamh. Chaith
  // `Aimsiú` an dara ceann i gcéim 0.8, mar níorbh fhéidir leis an tsuim a
  // bheith i gcontae ar bith de chuid na Mumhan (§26.6).
  const d = duchasanna(tiomsaighComhad('duine.sb').anailiseoir);
  assert.strictEqual(d.contae, 'Corcaigh');
  const cuirthe = d.cinealacha.filter((t) => t.contae !== ctae.DEORAIOCHT);
  assert.deepStrictEqual(cuirthe, [
    { ainm: 'Duine', contae: 'Corcaigh' },
    { ainm: 'Aimsiú', contae: 'Gaillimh' },
  ]);
  const gafa = new Set(cuirthe.map((t) => ctae.cuigeDe(t.contae)));
  assert.deepStrictEqual([...gafa], [ctae.CUIGI.MUMHAIN, ctae.CUIGI.CONNACHTA]);
});

it('ní fhéadfadh an tsuim a bheith san Mhumhain — sin an rogha a chosain rud', () => {
  const olc = foinseDe('duine.sb').replace('suim Aimsiú as Gaillimh', 'suim Aimsiú as Ciarraí');
  assert.notStrictEqual(olc, foinseDe('duine.sb'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('duine.sb', olc, 'duine.sb').includes('E603'));
});

it('is E213 é an rón a chur isteach sa tsuim gan é a thiontú', () => {
  // The rule that keeps the conversion on the boundary where it belongs.
  const olc = foinseDe('duine.sb').replace('Aimsithe { duine: Duine }', 'Aimsithe { rón: Iasacht }');
  assert.notStrictEqual(olc, foinseDe('duine.sb'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('duine.sb', olc, 'duine.sb').includes('E213'));
});

it('fanann an bhlaosc ar deoraíocht', () => {
  for (const c of ['bealaí.sb', 'sonraí.sb']) {
    assert.strictEqual(duchasanna(tiomsaighComhad(c).anailiseoir).contae,
      ctae.DEORAIOCHT, c);
  }
});

it('ní bhaineann an croí leis an JavaScript ar chor ar bith', () => {
  // Ask the compiler, not the text. The file is mostly prose about not
  // importing anything, and a substring check cannot tell the difference
  // between an import and a sentence saying there is none.
  const { js, ast } = tiomsaighComhad('duine.sb');
  assert.strictEqual((ast.ailiasanna || new Map()).size, 0, 'tá modúl iompórtáilte sa chroí');
  assert.ok(!js.includes('require('), 'tá require sa JS');
});

// ══ 2. Ní shroicheann an dúchas an chúlchríoch ═══════════════════════
it('níl contae, cúige ná comhaontú sa JavaScript', () => {
  for (const c of ['duine.sb', 'bealaí.sb']) {
    const { js } = tiomsaighComhad(c);
    for (const focal of ['Corcaigh', 'An Mhumhain', 'cúige', 'contae',
      '__contae', '__cúige', 'deoraíocht', 'comhaontú']) {
      assert.ok(!js.includes(focal), `${focal} i ${c}`);
    }
  }
});

it('maireann an cruthú 0.5: ní fheictear séimhiú ná modh sa JS ach oiread', () => {
  const { js } = tiomsaighComhad('bealaí.sb');
  for (const focal of ['dhuine', 'dhaoine', 'chéim', 'chuirSíol', 'bhfuil']) {
    assert.ok(!js.includes(focal), `${focal} sa JS`);
  }
});

// ══ 3. Na botúin — an chuid is tábhachtaí ════════════════════════════
it('is E601 é an bhlaosc ag oscailt an bhosca', () => {
  // The thing someone will actually do: skip the accessor because `ainm ó
  // dhuine` is shorter. If this ever stops being an error the separation is
  // gone and the suite should say so loudly.
  const olc = foinseDe('bealaí.sb')
    .replace('cuirDuine stór, ainmDe(duine), aoisDe(duine)',
      'cuirDuine stór, ainm ó dhuine, aois ó dhuine');
  assert.notStrictEqual(olc, foinseDe('bealaí.sb'), 'níor éirigh leis an ionadú');
  assert.deepStrictEqual(coidLeMalairt('bealaí.sb', olc), ['E601', 'E601']);
});

it('is E601 é an croí ag lorg an JavaScript', () => {
  // Placing a module severs it from JavaScript permanently. This is the
  // pressure the whole feature exists to apply (§24.3).
  const olc = foinseDe('duine.sb').replace('as Corcaigh\n',
    'as Corcaigh\nseasmhach bun = ó "../rt/bunúsach.js"\n');
  assert.deepStrictEqual(
    coidLeMalairt('duine.sb', `${olc}\nfeidhm f() -> Teaghrán { uimhir ó bhun }`,
      'duine.sb'),
    ['E601']);
});

it('is E603 é an dara cineál san Mhumhain', () => {
  // Declaring `Duine as Corcaigh` closed Ciarraí, Luimneach, An Clár, Port
  // Láirge and Tiobraid Árann for the whole graph, including this file.
  const olc = `${foinseDe('duine.sb')}\nstruchtúr Áit as Ciarraí {\n    ainm: Teaghrán\n}`;
  assert.deepStrictEqual(coidLeMalairt('duine.sb', olc, 'duine.sb'), ['E603']);
});

it('tá an t-éileamh domhanda: ní féidir leis an mblaosc An Mhumhain a thógáil', () => {
  const olc = `${foinseDe('bealaí.sb')}\nstruchtúr Áit as Luimneach {\n    ainm: Teaghrán\n}`;
  assert.deepStrictEqual(coidLeMalairt('bealaí.sb', olc), ['E603']);
});

it('is E609 é an cineál a chur i gcontae le seanaighneas', () => {
  // The file can no longer open its own type, in its own province, with no
  // remedy. Only `duine.sb` has an `ó` on a `Duine` at all — the shell
  // constructs and calls, which is why the veto has nothing to bite there.
  const bun = foinseDe('duine.sb');
  const olc = bun.replace('struchtúr Duine as Corcaigh', 'struchtúr Duine as Ciarraí');
  assert.notStrictEqual(olc, bun, 'níor éirigh leis an ionadú');
  const coid = coidLeMalairt('duine.sb', olc, 'duine.sb');
  assert.ok(coid.length >= 4, JSON.stringify(coid));
  assert.ok(coid.every((c) => c === 'E609'), JSON.stringify(coid));
});


// ══ §37 — na lámhálaithe mar bhriathra saora ══════════════════════════

it('is briathra saora iad an dá bhealach', () => {
  const src = foinseDe('bealaí.sb');
  assert.ok(src.includes('ag saor liostaigh('), 'liostaigh');
  assert.ok(src.includes('ag saor taispeáin('), 'taispeáin');
  // Agus cláraítear fós iad ar an tslí chéanna: is é an t-ainmniú an t-aon
  // rud a bhí riamh ann, agus níor athraigh sé.
  assert.ok(src.includes('a liostaigh'));
  assert.ok(src.includes('a thaispeáin'));
});

it('ní féidir lámhálaí a ordú sa mhodúl a fhógraíonn é (E518)', () => {
  const olc = foinseDe('bealaí.sb')
    .replace('bealach ó fhreastal(app, "/", a liostaigh)', 'liostaigh app, app');
  assert.notStrictEqual(olc, foinseDe('bealaí.sb'), 'níor éirigh leis an ionadú');
  assert.ok(coidLeMalairt('bealaí.sb', olc, 'bealaí.sb').includes('E518'));
});

it('ní shroicheann an modh saor an JavaScript', () => {
  const { js } = tiomsaighComhad('bealaí.sb');
  for (const f of ['saor', 'liostaítear', 'taispeántar', 'liostaíodh']) {
    assert.ok(!js.includes(f), `${f} sa JavaScript`);
  }
  // Agus tá na feidhmeanna féin ann, faoina lemma, mar a bhí riamh.
  assert.ok(/function liostaigh\(/.test(js) || /liostaigh\s*=/.test(js));
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n    ${e.message}`); }
  }
  console.log(`\nfeidhmchlár: ${pas} pas, ${teip} teip`);
  if (teip) process.exit(1);
})();
