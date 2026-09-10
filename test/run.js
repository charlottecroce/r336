'use strict';

const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { tiomsaigh, Tionscadal, Cnuasach, Earraid } = require('../src/index');
const mf = require('../src/morphology');

let pas = 0, teip = 0;
const tastail = [];
const it = (ainm, fn) => tastail.push([ainm, fn]);

/** Compile + run, capturing scríobh output. Awaits `príomh` if exported. */
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

/** Compile and return the set of error codes raised. */
function coid(src) {
  try { tiomsaigh(src, 'tástáil.sb'); return []; }
  catch (e) {
    if (e instanceof Cnuasach) return e.earraidi.map((x) => x.cod);
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

const jsDe = (src) => tiomsaigh(src, 'tástáil.sb').js;

// ══ 1. Moirfeolaíocht ═════════════════════════════════════════════════
it('séimhiú ar na naoi gconsan', () => {
  for (const [a, b] of [['bord', 'bhord'], ['cat', 'chat'], ['duine', 'dhuine'],
    ['fear', 'fhear'], ['gorm', 'ghorm'], ['máthair', 'mháthair'],
    ['post', 'phost'], ['sráid', 'shráid'], ['teach', 'theach']]) {
    assert.strictEqual(mf.inSeimhithe(a).ok, true, a);
    assert.strictEqual(mf.seimhigh(a), b);
  }
});

it('ní shéimhítear gutaí, l, n, r, h', () => {
  for (const w of ['ainm', 'éan', 'oíche', 'litir', 'nead', 'rud', 'halla']) {
    assert.strictEqual(mf.inSeimhithe(w).ok, false, w);
    assert.strictEqual(mf.foirmDe(w, mf.FOIRM.SEIMHITHE), w, w);
  }
});

it('ní shéimhítear sc-, sf-, sm-, sp-, st-', () => {
  for (const w of ['scoil', 'sféar', 'smaoineamh', 'spéir', 'stór', 's']) {
    assert.strictEqual(mf.inSeimhithe(w).ok, false, w);
    assert.strictEqual(mf.inSeimhithe(w).cuis, 'cnuasach-s');
  }
  for (const w of ['sláinte', 'snámh', 'sráid', 'súil', 'sonraí']) {
    assert.strictEqual(mf.inSeimhithe(w).ok, true, w);
  }
});

it('coinnítear an cás: Duine -> Dhuine', () => {
  assert.strictEqual(mf.seimhigh('Duine'), 'Dhuine');
  assert.strictEqual(mf.lemmaTuairim('Dhuine'), 'Duine');
});

it('ní shéimhítear rud atá séimhithe cheana', () => {
  assert.strictEqual(mf.inSeimhithe('dhuine').ok, false);
  assert.strictEqual(mf.inSeimhithe('dhuine').cuis, 'seimhithe-cheana');
});

it('níl brí ríomhchláraithe ag an urú (§12)', () => {
  // The morphology exists; no syntactic slot ever demands it of an identifier.
  assert.throws(() => mf.foirmDe('duine', mf.FOIRM.URAITHE), /§12/);
  assert.strictEqual(mf.paraidim('duine').uruFéideartha, 'nduine');
});

it('urú ceart ar na consain agus ar na gutaí', () => {
  for (const [a, b] of [['bord', 'mbord'], ['cat', 'gcat'], ['duine', 'nduine'],
    ['fuil', 'bhfuil'], ['gorm', 'ngorm'], ['post', 'bpost'], ['teach', 'dteach'],
    ['áit', 'n-áit'], ['Éire', 'nÉire'], ['Baile', 'mBaile']]) {
    assert.strictEqual(mf.uraigh(a), b, a);
  }
  for (const w of ['máthair', 'litir', 'nead', 'rud', 'sráid', 'halla']) {
    assert.strictEqual(mf.inUraithe(w).ok, false, w);
  }
});

// ══ 2. Comhaontú: ó agus séimhiú ══════════════════════════════════════
const DUINE = `struchtúr Duine { ainm: Teaghrán aois: Uimhir }
duine seasmhach = Duine { ainm: "Cáit", aois: 20 }
`;

it('glacann `ó` leis an bhfoirm shéimhithe', async () => {
  assert.deepStrictEqual(await rith(DUINE + 'scríobh ainm ó dhuine'), ['Cáit']);
});

it('diúltaíonn `ó` don bhunfhoirm nuair is féidir séimhiú (E102)', () => {
  assert.deepStrictEqual(coid(DUINE + 'scríobh ainm ó duine'), ['E102']);
});

it('glactar leis an mbunfhoirm nuair nach féidir séimhiú', async () => {
  assert.deepStrictEqual(
    await rith('struchtúr S { ainm: Teaghrán }\náit seasmhach = S { ainm: "Gaillimh" }\nscríobh ainm ó áit'),
    ['Gaillimh']);
  assert.deepStrictEqual(
    await rith('struchtúr S { ainm: Teaghrán }\nstór seasmhach = S { ainm: "Corcaigh" }\nscríobh ainm ó stór'),
    ['Corcaigh']);
});

it('diúltaítear do shéimhiú lasmuigh de shuíomh rialaithe (E103)', () => {
  assert.deepStrictEqual(coid(DUINE + 'x seasmhach = dhuine'), ['E103']);
});

it('diúltaítear do shéimhiú bréige (E104)', () => {
  assert.deepStrictEqual(
    coid('struchtúr S { ainm: Teaghrán }\nstór seasmhach = S { ainm: "x" }\nscríobh ainm ó shtór'),
    ['E104']);
});

it('ní mór ceangail a fhógairt sa bhunfhoirm (E107)', () => {
  assert.deepStrictEqual(coid('dhuine seasmhach = 3'), ['E107']);
});

it('is aon siombail amháin iad duine/dhuine', () => {
  const js = jsDe(DUINE + 'scríobh ainm ó dhuine\nscríobh aois ó dhuine');
  assert.ok(!js.includes('dhuine'), 'níor cheart go bhfeicfeadh an chúlchríoch foirm shéimhithe riamh');
  assert.ok(js.includes('duine.ainm') && js.includes('duine.aois'));
});

it('rialaíonn gach `ó` tús a chomhlánaithe féin', async () => {
  const src = `struchtúr Seoladh { baile: Teaghrán }
struchtúr Duine { seoladh: Seoladh }
duine seasmhach = Duine { seoladh: Seoladh { baile: "Corcaigh" } }
scríobh baile ó sheoladh ó dhuine`;
  assert.deepStrictEqual(await rith(src), ['Corcaigh']);
  assert.ok(jsDe(src).includes('duine.seoladh.baile'));
  assert.deepStrictEqual(coid(src.replace('ó sheoladh', 'ó seoladh')), ['E102']);
});

it('teastaíonn sealbhóir inséalbhaithe ó `ó` (E205)', () => {
  assert.deepStrictEqual(coid('x seasmhach = fíor\nscríobh ainm ó x'), ['E205']);
});

// ══ 3. Cineálacha ═════════════════════════════════════════════════════
it('seiceáiltear argóintí agus torthaí', () => {
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Uimhir { x + x }\na seasmhach = f("x")'), ['E201']);
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Teaghrán { x + x }'), ['E209']);
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Uimhir { x }\na seasmhach = f(1, 2)'), ['E206']);
});

it('seiceáiltear réimsí struchtúir', () => {
  assert.deepStrictEqual(coid('struchtúr D { ainm: Teaghrán }\nd seasmhach = D { }'), ['E204']);
  assert.deepStrictEqual(coid('struchtúr D { ainm: Teaghrán }\nd seasmhach = D { ainm: 3 }'), ['E201']);
});

it('ní mheasctar Teaghrán agus Uimhir le "+" (E210)', () => {
  assert.deepStrictEqual(coid('x seasmhach = "a" + 1'), ['E210']);
});

it('caithfidh Bool a bheith ag "má"', () => {
  assert.deepStrictEqual(coid('x seasmhach = 1\nmá x { }'), ['E201']);
});

// ══ 4. Copail agus briathar substaintigh ══════════════════════════════
it('is aicmiú é `is`, ní comparáid', async () => {
  const src = 'struchtúr D { }\nd seasmhach = D { }\nmás D d { scríobh "sea" }';
  assert.ok(jsDe(src).includes('__is(d, "D")'));
  assert.ok(!jsDe(src).includes('=== D'));
  assert.deepStrictEqual(await rith(src), ['sea']);
});

it('is ceist bheithe é `bí`', async () => {
  const src = 'x seasmhach = 1\nmá tá x { scríobh "ann" }';
  assert.ok(jsDe(src).includes('__bí(x)'));
  assert.deepStrictEqual(await rith(src), ['ann']);
});

it('freagraíonn foirm an bhriathair shubstaintigh don cháithnín', async () => {
  assert.deepStrictEqual(coid('x seasmhach = 1\nmá tá x { }'), []);
  assert.deepStrictEqual(coid('x seasmhach = 1\nmura bhfuil x { }'), []);
  assert.deepStrictEqual(coid('x seasmhach = 1\nmá bhfuil x { }'), ['E512']);
  assert.deepStrictEqual(coid('x seasmhach = 1\nmura tá x { }'), ['E512']);
  assert.deepStrictEqual(coid('x seasmhach = 1\nmá bí x { }'), ['E512']);
  // The alternation is agreement, not meaning: both emit the same call.
  const a = jsDe('x seasmhach = 1\nmá tá x { scríobh "a" }');
  const b = jsDe('x seasmhach = 1\nmura bhfuil x { scríobh "a" }');
  assert.ok(a.includes('__bí(x)') && b.includes('__bí(x)'));
  assert.ok(!b.includes('bhfuil'));
});

it('is é "neamhní" an easpa a thuairiscíonn "bí"', async () => {
  assert.deepStrictEqual(
    await rith('x sealadach: Iasacht = neamhní\ngníomh príomh() { scríobh tá x  cuir 3 ar x  scríobh tá x }'),
    ['false', 'true']);
});

it('scarann `is` agus `bí` ó chéile', () => {
  const js = jsDe('struchtúr D { }\nd seasmhach = D { }\na seasmhach = d is D\nb seasmhach = tá d');
  assert.ok(js.includes('__is(') && js.includes('__bí('));
});

it('ní uimhir é NaN don chopail', async () => {
  const src = 'feidhm f(x: Iasacht) -> Teaghrán { más Uimhir x { "uimhir" } mura { "níl" } }\n'
    + 'scríobh f(0 / 0)\nscríobh f(3)';
  assert.deepStrictEqual(await rith(src), ['níl', 'uimhir']);
});

it('caithfidh cineál aitheanta a bheith ar dheis na copaile (E202)', () => {
  assert.deepStrictEqual(coid('x seasmhach = 1\ny seasmhach = x is Rud'), ['E202']);
});

// ══ 5. Modhanna (§5, ceartaithe) ══════════════════════════════════════
it('séimhíonn `ó` an chatagóir i bhfógra modha', () => {
  const src = 'struchtúr Duine { ainm: Teaghrán }\nfeidhm beannacht ó Dhuine(féin) -> Teaghrán { ainm ó fhéin }';
  assert.deepStrictEqual(coid(src), []);
  assert.deepStrictEqual(coid(src.replace('ó Dhuine', 'ó Duine')), ['E102']);
});

it('seoltar modhanna go statach', async () => {
  const src = `struchtúr Duine { ainm: Teaghrán aois: Uimhir }
feidhm beannacht ó Dhuine(féin) -> Teaghrán { "Dia duit, " + ainm ó fhéin }
feidhm móide ó Dhuine(féin, n: Uimhir) -> Uimhir { aois ó fhéin + n }
duine seasmhach = Duine { ainm: "Cáit", aois: 20 }
scríobh beannacht ó dhuine()
scríobh móide ó dhuine(5)`;
  assert.deepStrictEqual(await rith(src), ['Dia duit, Cáit', '25']);
  assert.ok(jsDe(src).includes('Duine$beannacht(duine)'));
});

it('ní féidir modh a fhógairt ar rud nach struchtúr é (E509)', () => {
  assert.deepStrictEqual(coid('feidhm f ó Theaghrán(féin) -> Teaghrán { féin }'), ['E509']);
});

// ══ 6. Modh: ordaitheach i gcoinne táscaigh (§17) ═════════════════════
it('ní ainmní é ordú (E501)', () => {
  assert.deepStrictEqual(coid('gníomh cláraigh(x: Teaghrán) { scríobh x }\ng seasmhach = cláraigh'), ['E501']);
});

it('ní dhéanann feidhm gníomh (E502)', () => {
  assert.deepStrictEqual(
    coid('gníomh cláraigh(x: Teaghrán) { scríobh x }\nfeidhm f(x: Teaghrán) -> Teaghrán { cláraigh x  x }'),
    ['E502']);
});

it('ní chaitear luach i dtraipisí i bhfeidhm (E503)', () => {
  assert.deepStrictEqual(coid('feidhm f(x: Teaghrán) -> Teaghrán { x + "!"  x }'), ['E503']);
});

it('ní ghlacann gníomh le cineál toraidh (E404)', () => {
  assert.deepStrictEqual(coid('gníomh g() -> Uimhir { }'), ['E404']);
});

it('tugtar ordú gan lúibíní, VSO', async () => {
  const src = 'gníomh fógair(t: Teaghrán, u: Uimhir) { scríobh t + ": " + "x" }\nfógair "a", 1\nfógair "b", 2';
  assert.deepStrictEqual(await rith(src), ['a: x', 'b: x']);
});

// ══ 7. Aspect: ag / tar éis (§18) ═════════════════════════════════════
it('`ag` a ghineann async, `tar éis` a ghineann await', () => {
  const js = jsDe('ag feidhm f(comhad: Iasacht) -> Iasacht { tar éis léigh ó chomhad() }');
  assert.ok(js.includes('async function f'), js);
  assert.ok(js.includes('(await comhad.léigh())'), js);
});

it('teastaíonn "ag" ó "tar éis" (E504)', () => {
  assert.deepStrictEqual(
    coid('ag feidhm g(x: Iasacht) -> Iasacht { tar éis x() }\nfeidhm f(x: Iasacht) -> Iasacht { tar éis g(x) }'),
    ['E504']);
});

it('ní luach é gníomh atá ar siúl (E505)', () => {
  assert.deepStrictEqual(
    coid('ag feidhm g(x: Iasacht) -> Teaghrán { tar éis x() }\n'
      + 'ag feidhm f(x: Iasacht) -> Teaghrán { a seasmhach = g(x)  a }'),
    ['E505']);
});

it('críochnaíonn "tar éis" gníomh ar siúl', () => {
  assert.deepStrictEqual(
    coid('ag feidhm g(x: Iasacht) -> Teaghrán { tar éis x() }\n'
      + 'ag feidhm f(x: Iasacht) -> Teaghrán { tar éis g(x) }'),
    []);
});

it('níl aon rud le críochnú i luach socair (E508)', () => {
  assert.deepStrictEqual(coid('ag feidhm f() -> Uimhir { tar éis 3 }'), ['E508']);
});

it('críochnaítear ordú leanúnach go huathoibríoch', () => {
  const js = jsDe('ag gníomh a(x: Iasacht) { tar éis x() }\nag gníomh b(x: Iasacht) { a x }');
  assert.ok(/await a\(x\)/.test(js), js);
  assert.deepStrictEqual(coid('ag gníomh a(x: Iasacht) { tar éis x() }\ngníomh b(x: Iasacht) { a x }'), ['E504']);
});

// ══ 8. Bunús: modúil mar shealbhóirí (Céim 4) ═════════════════════════
it('`ó "modúl"` a ghineann require', () => {
  const js = jsDe('e seasmhach = ó "express"\nR seasmhach = Router ó "express"');
  assert.ok(js.includes('require("express")'));
  assert.ok(js.includes('require("express").Router'));
});

it('athscríobhtar .sb go .js i gconairí', () => {
  assert.ok(jsDe('s seasmhach = ó "./sonraí.sb"').includes('require("./sonraí.js")'));
});

it('is Iasacht gach rud a thagann trasna na teorann', async () => {
  const src = 'p seasmhach = ó "node:path"\nscríobh basename ó ph("/a/b/c.txt")';
  assert.deepStrictEqual(await rith(src), ['c.txt']);
});

it('tá tiontuithe sa leabharlann, ní sa teanga', async () => {
  const src = 'bun seasmhach = ó "../rt/bunúsach.js"\n'
    + 'feidhm cad(x: Iasacht) -> Teaghrán { más Uimhir x { "uimhir" } mura { "níl" } }\n'
    + 'scríobh cad(uimhir ó bhun("42"))\nscríobh cad(uimhir ó bhun("abc"))';
  assert.deepStrictEqual(await rith(src), ['uimhir', 'níl']);
});

// ══ 9. Liostaí agus má-mar-shlonn ═════════════════════════════════════
it('fad, folamh, céad tríd an ngaol `ó`', async () => {
  const src = 'xs seasmhach = [3, 1, 4]\nscríobh fad ó xs\nscríobh céad ó xs\nys seasmhach: Liosta(Uimhir) = []\nscríobh folamh ó ys';
  assert.deepStrictEqual(await rith(src), ['3', '3', 'true']);
});

it('leathnaítear liosta ilchineálach go Liosta(Iasacht)', () => {
  assert.deepStrictEqual(coid('xs seasmhach = [1, "a"]'), []);
});

it('is slonn é "má" nuair a thugann gach craobh luach', async () => {
  const src = 'feidhm f(u: Uimhir) -> Teaghrán { má u > 0 { "dearfach" } mura { "eile" } }\nscríobh f(1)\nscríobh f(0)';
  assert.ok(jsDe(src).includes('?'));
  assert.deepStrictEqual(await rith(src), ['dearfach', 'eile']);
});

it('is "mura" an diúltach, ní "eile if"', async () => {
  const src = 'feidhm f(u: Uimhir) -> Teaghrán { má u == 1 { "a" } mura u == 2 { "b" } mura { "c" } }\n'
    + 'scríobh f(1)\nscríobh f(2)\nscríobh f(3)';
  assert.deepStrictEqual(await rith(src), ['a', 'c', 'b']);
  assert.ok(jsDe(src).includes('!('));
});

it('is ráiteas é "mura" ina aonar', async () => {
  assert.deepStrictEqual(
    await rith('xs seasmhach: Liosta(Uimhir) = []\nmura folamh ó xs { scríobh "lán" }\nmura bhfuil xs { scríobh "as" }'),
    []);
});

it('ardaítear craobhacha ilráiteacha isteach i sealadach', async () => {
  const src = `feidhm f(u: Uimhir) -> Teaghrán {
    má u > 0 { t seasmhach = "dear" + "fach"  t } mura { t seasmhach = "diúl"  t + "tach" }
  }
  scríobh f(1)
  scríobh f(0)`;
  assert.deepStrictEqual(await rith(src), ['dearfach', 'diúltach']);
  assert.ok(/let __t0;/.test(jsDe(src)), jsDe(src));
});

it('ní ardaítear más simplí nuair é', () => {
  const js = jsDe('feidhm f(u: Uimhir) -> Uimhir { má u > 0 { 1 } mura { 2 } }');
  assert.ok(js.includes('?') && !js.includes('__t0'));
});

it('teastaíonn craobh "mura" lom ó "má" mar shlonn (E507)', () => {
  assert.deepStrictEqual(coid('x seasmhach = má fíor { 1 }'), ['E507']);
  assert.deepStrictEqual(coid('feidhm f(u: Uimhir) -> Teaghrán { má u > 0 { "a" } }'), ['E503', 'E209']);
});

// ══ 13. Staid: seasmhach i gcoinne sealadach ══════════════════════════
it('ní athraítear rud seasmhach (E510)', () => {
  assert.deepStrictEqual(coid('x seasmhach = 0\ngníomh g() { cuir 1 ar x }'), ['E510']);
  assert.deepStrictEqual(coid('x sealadach = 0\ngníomh g() { cuir 1 ar x }'), []);
});

it('is ordú é an t-athrú, mar sin tá sé faoi na rialacha modha (E502)', () => {
  assert.deepStrictEqual(coid('x sealadach = 0\nfeidhm f() -> Uimhir { cuir 1 ar x  x }'), ['E502']);
});

it('séimhíonn "ar" a chomhlánú, mar a dhéanann "ó"', () => {
  assert.deepStrictEqual(coid('duine sealadach = 0\ngníomh g() { cuir 1 ar dhuine }'), []);
  assert.deepStrictEqual(coid('duine sealadach = 0\ngníomh g() { cuir 1 ar duine }'), ['E102']);
});

it('athraítear réimse trí cheangal sealadach', async () => {
  const src = `struchtúr C { luach: Uimhir }
gníomh ardaigh(c sealadach: C) { cuir luach ó ch + 1 ar luach ó ch }
gníomh príomh() { c sealadach = C { luach: 0 }  ardaigh c  ardaigh c  scríobh luach ó ch }`;
  assert.deepStrictEqual(await rith(src), ['2']);
  assert.deepStrictEqual(coid(src.replace('c sealadach: C', 'c: C')), ['E510']);
});

it('gineann let sealadach, agus const seasmhach', () => {
  const js = jsDe('a seasmhach = 1\nb sealadach = 2');
  assert.ok(js.includes('const a = 1;') && js.includes('let b = 2;'));
  assert.ok(js.includes('Object.defineProperty(module.exports, "b"'), js);
});

// ══ 14. Ainmniú: a + briathar ═════════════════════════════════════════
it('ainmníonn "a" briathar, agus séimhíonn sé é', async () => {
  const src = `gníomh fógair(x: Iasacht) { scríobh x }
gníomh príomh() { xs seasmhach: Iasacht = ["a", "b"]  forEach ó xs(a fhógair) }`;
  assert.deepStrictEqual(await rith(src), ['a', 'b']);
  assert.deepStrictEqual(coid(src.replace('a fhógair', 'a fógair')), ['E102']);
});

it('gan "a", is E501 fós é', () => {
  assert.deepStrictEqual(coid('gníomh cláraigh(x: Iasacht) { scríobh x }\nf seasmhach = cláraigh'), ['E501']);
});

it('fanann "a" ina aitheantóir gnáth', async () => {
  assert.deepStrictEqual(await rith('a seasmhach = 3\nscríobh a'), ['3']);
});

// ══ 10. Céim 6: teibíocht an stóir ════════════════════════════════════
it('tugann teibíocht an stóir turas iomlán', async () => {
  const { oscail } = require('../rt/stór.js');
  const stór = await oscail(':memory:');
  await stór.scéim('CREATE TABLE daoine (id INTEGER PRIMARY KEY, ainm TEXT, aois INTEGER)');
  await stór.feidhmigh('INSERT INTO daoine (ainm, aois) VALUES (?, ?)', ['Cáit', 20]);
  const rónna = await stór.ceistigh('SELECT ainm, aois FROM daoine', []);
  assert.deepStrictEqual(rónna, [{ ainm: 'Cáit', aois: 20 }]);
  assert.strictEqual(Object.getPrototypeOf(rónna[0]), Object.prototype);
  await stór.dún();
});

it('níl aon ghné teanga a bhaineann le tiománaí ar leith (Céim 6)', () => {
  const fs = require('fs');
  for (const c of ['../src/lexer.js', '../src/parser.js', '../src/analyzer.js', '../src/codegen.js']) {
    const téacs = fs.readFileSync(path.join(__dirname, c), 'utf8');
    for (const focal of ['prisma', 'sqlite', 'sql']) {
      assert.ok(!new RegExp(focal, 'i').test(téacs), `${c}: ${focal}`);
    }
  }
  // Is ag an teibíocht amháin atá eolas ar thiománaithe.
  assert.deepStrictEqual(Object.keys(require('../rt/stór.js').TIOMANAITHE), ['sqlite']);
});

// ══ 11. Céim 4/5: an feidhmchlár ══════════════════════════════════════
it('freastalaíonn an feidhmchlár ar bhealaí Spicebag', async function () {
  let tóg;
  try { tóg = require('../feidhmchlár/freastalaí.js').tóg; }
  catch { console.log('    (ar lár: npm install san fheidhmchlár)'); return; }
  const { app } = await tóg(':memory:');
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  const port = srv.address().port;
  const liosta = await (await fetch(`http://localhost:${port}/`)).text();
  assert.ok(liosta.includes('Charlotte') && liosta.includes('3 duine'));
  const duine = await (await fetch(`http://localhost:${port}/duine/1`)).text();
  assert.ok(duine.includes('Charlotte'));
  const olc = await fetch(`http://localhost:${port}/duine/abc`);
  assert.strictEqual(olc.status, 400);
  srv.close();
});

// ══ 12. An clár samplach ó §24 ════════════════════════════════════════
it('cuirtear an clár samplach ó §24 i gcrích', async () => {
  const src = `struchtúr Duine { ainm: Teaghrán aois: Uimhir }
feidhm beannacht(duine: Duine) -> Teaghrán { "Dia duit, " + ainm ó dhuine }
duine seasmhach = Duine { ainm: "Charlotte", aois: 20 }
teachtaireacht seasmhach = beannacht(duine)
scríobh teachtaireacht`;
  assert.deepStrictEqual(await rith(src), ['Dia duit, Charlotte']);
});


// ── áiseanna do thionscadail ilmhodúlacha ─────────────────────────────
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

const FOCLOIR = `BEANNACHT seasmhach = "Dia duit"
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
      'príomh.sb': 'f seasmhach = ó "./foclóir.sb"\ngníomh príomh() { fáiltigh "Cáit" }',
    }),
    ['Dia duit, Cáit']);
});

it('rialaíonn `ó` sealbhóir modúil fós', async () => {
  const comhaid = {
    'foclóir.sb': FOCLOIR,
    'príomh.sb': 'foclóir seasmhach = ó "./foclóir.sb"\n'
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
      'príomh.sb': 'foclóir seasmhach = ó "./foclóir.sb"\n'
        + 'gníomh príomh() { g seasmhach = fáiltigh ó fhoclóir  scríobh g }',
    }),
    ['E501']);
});

it('ní ghlacann ordú le sealbhóir (E516)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'foclóir seasmhach = ó "./foclóir.sb"\ngníomh príomh() { fáiltigh ó fhoclóir("Cáit") }',
    }),
    ['E516']);
});

it('tagann struchtúir iasachta isteach mar chineálacha', async () => {
  assert.deepStrictEqual(
    await rithTionscadal({
      'cineál.sb': 'struchtúr Duine { ainm: Teaghrán }\nfeidhm nua(a: Teaghrán) -> Duine { Duine { ainm: a } }',
      'príomh.sb': 'c seasmhach = ó "./cineál.sb"\n'
        + 'feidhm ainmDe(d: Duine) -> Teaghrán { ainm ó dh }\n'
        + 'gníomh príomh() { scríobh ainmDe(nua("Cáit")) }',
    }),
    ['Cáit']);
});

it('téann ball dúchasach trí chomhaontú, murab ionann agus ball iasachta', () => {
  // A foreign name has no mutation slot at all — you do not get to rename
  // someone else's API. A native member is an Irish lemma and is governed.
  assert.deepStrictEqual(coid('R seasmhach = Router ó "express"'), []);
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'x seasmhach = bheannaigh ó "./foclóir.sb"',
    }),
    ['E103']);
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'x seasmhach = nachAnn ó "./foclóir.sb"',
    }),
    ['E203']);
});

it('is E208 é ceangal áitiúil a bhuaileann le hiompórtáil', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'foclóir.sb': FOCLOIR,
      'príomh.sb': 'foclóir seasmhach = ó "./foclóir.sb"\ngníomh fáiltigh(x: Teaghrán) { scríobh x }',
    }),
    ['E208']);
});

it('dhá mhodúl, an lemma céanna (E106)', () => {
  assert.deepStrictEqual(
    coidTionscadal({
      'a.sb': 'gníomh fógair(t: Teaghrán) { scríobh t }',
      'b.sb': 'gníomh fógair(t: Teaghrán) { scríobh t }',
      'príomh.sb': 'a seasmhach = ó "./a.sb"\nb seasmhach = ó "./b.sb"',
    }),
    ['E106']);
});

it('modúl ar iarraidh (E109) agus timthriall (E110)', () => {
  assert.deepStrictEqual(
    coidTionscadal({ 'príomh.sb': 'x seasmhach = ó "./níl-ann.sb"' }),
    ['E109']);
  assert.deepStrictEqual(
    coidTionscadal({
      'a.sb': 'b seasmhach = ó "./b.sb"\nfeidhm f() -> Uimhir { 1 }',
      'b.sb': 'a seasmhach = ó "./a.sb"\nfeidhm g() -> Uimhir { 2 }',
      'príomh.sb': 'a seasmhach = ó "./a.sb"',
    }),
    ['E110']);
});

it('is Iasacht fós é modúl JavaScript', () => {
  // Nothing about the graph reaches a foreign origin: `ó "express"` is
  // unchanged, and a .js path is not a Spicebag module.
  const js = jsDe('e seasmhach = ó "express"\nR seasmhach = Router ó "express"');
  assert.ok(js.includes('require("express").Router'));
  assert.deepStrictEqual(coid('p seasmhach = ó "node:path"\nscríobh basename ó ph("/a/b.txt")'), []);
});

it('gan tionscadal, is Iasacht gach iompórtáil — iompar 0.4', () => {
  // The single-source entry point is unchanged, which is why the 0.4 suite
  // still passes without touching a line of it.
  assert.deepStrictEqual(coid('s seasmhach = ó "./sonraí.sb"\nscríobh aonrud ó s'), []);
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
      + 'gníomh príomh() { xs seasmhach: Liosta(Uimhir) = [1]  g a dhúbail, xs }'),
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
gníomh príomh() { xs seasmhach: Liosta(Teaghrán) = ["a", "b", "c"]  déan a fhógair ar xs }`;
  assert.deepStrictEqual(await rith(src), ['a', 'b', 'c']);
});

it('séimhíonn "ar" agus "a" san atriall, tríd an gcód céanna', () => {
  const bun = 'gníomh fógair(u: Uimhir) { scríobh u }\n'
    + 'gníomh príomh() { daoine seasmhach: Liosta(Uimhir) = [1]  déan a fhógair ar dhaoine }';
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
      + 'gníomh príomh() { xs seasmhach: Liosta(Teaghrán) = ["a"]  déan a fhógair ar xs }'),
    ['E201']);
});

it('ní ghlacann `déan` le feidhm: caitear a toradh i dtraipisí', () => {
  assert.deepStrictEqual(
    coid('feidhm dúbail(u: Uimhir) -> Uimhir { u + u }\n'
      + 'gníomh príomh() { xs seasmhach: Liosta(Uimhir) = [1]  déan a dhúbail ar xs }'),
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
  const js = jsDe(bun + 'ag gníomh príomh() { xs seasmhach: Liosta(Uimhir) = [1]  déan a shábháil ar xs }');
  assert.ok(/for \(const __t\d+ of xs\) await sábháil\(__t\d+\)/.test(js), js);
  assert.deepStrictEqual(
    coid(bun + 'gníomh príomh() { xs seasmhach: Liosta(Uimhir) = [1]  déan a shábháil ar xs }'),
    ['E504']);
});

it('atriallann `déan` ar Iasacht freisin', async () => {
  assert.deepStrictEqual(
    await rith('gníomh fógair(x: Iasacht) { scríobh x }\n'
      + 'gníomh príomh() { xs seasmhach: Iasacht = ["a", "b"]  déan a fhógair ar xs }'),
    ['a', 'b']);
});

// ══ 18. Ní fheiceann an chúlchríoch gramadach ═════════════════════════
it('ní shroicheann foirm ghramadaí an t-aschur, fiú trasna modúl', async () => {
  const t = tionscadalBreige({
    'foclóir.sb': 'gníomh fógair(duine: Teaghrán) { scríobh duine }',
    'príomh.sb': 'foclóir seasmhach = ó "./foclóir.sb"\n'
      + 'gníomh príomh() { daoine seasmhach: Liosta(Teaghrán) = ["a"]\n'
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


// ══ 12. Céim 0.9: paraidím na copaile (§31) ═══════════════════════════
//
// Déantar tástáil ar an moirfeolaíocht ar leithligh ón teanga, mar a
// dhéantar ar an séimhiú: níl aon eolas ag `morphology.js` ar an gcomhréir,
// agus ní mór dó na foirmeacha a thabhairt gan cheist a chur.

it('tugann an chopail na trí fhoirm bheo', () => {
  const R = mf.RIALU_COPAIL;
  assert.strictEqual(mf.foirmChopail(R.BUN, 'Duine'), 'is');
  assert.strictEqual(mf.foirmChopail(R.MA, 'Duine'), 'más');
  assert.strictEqual(mf.foirmChopail(R.MA, 'Easpa'), 'más');
});

it('roghnaíonn tús an fhocail ina diaidh idir "mura" agus "murab"', () => {
  const R = mf.RIALU_COPAIL;
  for (const c of ['Duine', 'Ceart', 'Bua', 'Teaghrán']) {
    assert.strictEqual(mf.foirmChopail(R.MURA, c), 'mura', c);
  }
  for (const g of ['Easpa', 'Áit', 'Uimhir', 'Iasacht', 'Imreoir', 'Ann']) {
    assert.strictEqual(mf.foirmChopail(R.MURA, g), 'murab', g);
  }
});

it('caitheann na cealla nach bhfuil brí acu, mar a chaitheann an t-urú (§12, §31)', () => {
  const R = mf.RIALU_COPAIL;
  for (const r of [R.DIULTACH, R.CEISTEACH, R.CEISTEACH_DIULTACH, R.FAISNEISEACH]) {
    assert.throws(() => mf.foirmChopail(r, 'Duine'), /§31/, r);
  }
  // Agus fós taispeántar iad: sin an difríocht idir diúltú agus dearmad.
  const p = mf.paraidimChopail('Easpa');
  assert.strictEqual(p.length, 7);
  assert.strictEqual(p.filter((x) => x.beo).length, 3);
  assert.deepStrictEqual(p.filter((x) => !x.beo).map((x) => x.frasa),
    ['ní hEaspa', 'an Easpa', 'nach Easpa', 'gur Easpa']);
});

it('cuireann "ní" h roimh ghuta, an riail chéanna atá ag "le" in E201', () => {
  const frasa = (c, r) => mf.paraidimChopail(c).find((x) => x.rialu === r).frasa;
  assert.strictEqual(frasa('Easpa', mf.RIALU_COPAIL.DIULTACH), 'ní hEaspa');
  assert.strictEqual(frasa('Duine', mf.RIALU_COPAIL.DIULTACH), 'ní Duine');
});

// ── an chomhréir ──────────────────────────────────────────────────────
const SUIM = 'suim T { Ceart { u: Uimhir } Easpa { c: Teaghrán } }\n'
  + 'tor seasmhach: T = Ceart { u: 1 }\n';

it('ritheann "más" agus caolaíonn sé, mar a rinne an seanord', async () => {
  assert.deepStrictEqual(
    await rith(SUIM + 'feidhm f() -> Uimhir { más Ceart tor { u ó thor } mura { 0 } }\n'
      + 'scríobh f()'), ['1']);
});

it('caolaíonn "murab" an chraobh eile', async () => {
  assert.deepStrictEqual(
    await rith(SUIM + 'feidhm f() -> Uimhir { murab Easpa tor { u ó thor } mura { 0 } }\n'
      + 'scríobh f()'), ['1']);
});

it('is E517 é an seanord focal, agus insítear an fhoirm cheart', () => {
  const es = coid(SUIM + 'feidhm f() -> Uimhir { má tor is Ceart { 1 } mura { 0 } }');
  assert.deepStrictEqual(es, ['E517']);
});

it('is E517 é an t-allamorf mícheart, sa dá threo', () => {
  assert.deepStrictEqual(
    coid(SUIM + 'feidhm f() -> Uimhir { mura Easpa tor { 1 } mura { 0 } }'), ['E517']);
  assert.deepStrictEqual(
    coid(SUIM + 'feidhm f() -> Uimhir { murab Ceart tor { 1 } mura { 0 } }'), ['E517']);
});

it('is E517 é mír cheangailte gan aicmiú', () => {
  assert.deepStrictEqual(coid('feidhm f() -> Uimhir { más 1 > 0 { 1 } mura { 0 } }'), ['E517']);
});

it('fanann an fhoirm neamhspleách gan mhír', () => {
  assert.deepStrictEqual(coid('struchtúr D { }\nd seasmhach = D { }\na seasmhach = d is D'), []);
});

it('ní shroicheann foirm na copaile an JavaScript', () => {
  const js = jsDe(SUIM + 'feidhm f() -> Uimhir { más Ceart tor { 1 } mura { 0 } }\n'
    + 'feidhm g() -> Uimhir { murab Easpa tor { 1 } mura { 0 } }');
  for (const foirm of ['más', 'murab', 'mura', 'copail']) {
    assert.ok(!js.includes(foirm), `${foirm} sa JavaScript`);
  }
  assert.ok(js.includes('__is(tor, "Ceart")'));
  assert.ok(js.includes('__is(tor, "Easpa")'));
});

it('ní mheascann an mhír chopaileach glao le hainmní (an chuardach dhá chomhartha)', async () => {
  // `má óg(duine)` — dhá chomhartha IDENT NOD, ní dhá shlonn. Bhris an
  // chéad leagan den chuardach seo an feidhmchlár, agus is í an tástáil seo
  // an chosaint air.
  const src = 'struchtúr D { aois: Uimhir }\nd seasmhach = D { aois: 9 }\n'
    + 'feidhm óg(x: D) -> Bool { aois ó x < 18 }\n'
    + 'feidhm f() -> Teaghrán { má óg(d) { "óg" } mura { "aosta" } }\nscríobh f()';
  assert.deepStrictEqual(await rith(src), ['óg']);
});

it('fanann dealú ina dhealú i ndiaidh na míre', async () => {
  assert.deepStrictEqual(
    await rith('x seasmhach = 5\ny seasmhach = 3\n'
      + 'feidhm f() -> Teaghrán { má x - y > 1 { "mór" } mura { "beag" } }\nscríobh f()'),
    ['mór']);
});


// ══ 13. Céim 0.10: an briathar saor (§37) ═════════════════════════════
//
// An chéad phéire tástálacha ar mhoirfeolaíocht tháirgiúil. Ní tábla é seo a
// bhfuiltear ag cuardach ann — is riail réimnithe í a chuirtear i bhfeidhm ar
// fhréamh ar bith a fhógraíonn an t-údar.

it('réimníonn an chéad réimniú, leathan agus caol', () => {
  const c = [['scríobh', 'scríobhtar'], ['mol', 'moltar'], ['déan', 'déantar'],
    ['dún', 'dúntar'], ['fág', 'fágtar'], ['ól', 'óltar'],
    ['cuir', 'cuirtear'], ['bris', 'bristear']];
  for (const [a, b] of c) assert.strictEqual(mf.foirmShaor(a), b, a);
});

it('slogtar -th agus -gh sa deireadh', () => {
  for (const [a, b] of [['caith', 'caitear'], ['ith', 'itear'],
    ['léigh', 'léitear'], ['nigh', 'nitear'], ['suigh', 'suitear']]) {
    assert.strictEqual(mf.foirmShaor(a), b, a);
  }
});

it('réimníonn an dara réimniú, agus titeann -(a)igh', () => {
  for (const [a, b] of [['ceannaigh', 'ceannaítear'], ['bailigh', 'bailítear'],
    ['imigh', 'imítear'], ['liostaigh', 'liostaítear'],
    ['aimsigh', 'aimsítear'], ['críochnaigh', 'críochnaítear']]) {
    assert.strictEqual(mf.foirmShaor(a), b, a);
  }
});

it('coimrítear na fréamhacha in -il, -in, -ir, -is', () => {
  // Seo an chuid is deacra den riail, agus an chuid a chruthaíonn gur riail í:
  // athraíonn an coimriú leithne na fréimhe, agus leanann an deireadh an
  // fhréamh nua. Tá `fógair` caol agus tá `fógr-` leathan.
  for (const [a, b] of [['fógair', 'fógraítear'], ['oscail', 'osclaítear'],
    ['imir', 'imrítear'], ['inis', 'insítear'],
    ['ceangail', 'ceanglaítear'], ['codail', 'codlaítear'],
    ['freagair', 'freagraítear']]) {
    assert.strictEqual(mf.foirmShaor(a), b, a);
  }
});

it('fanann iasachtaí in -áil sa chéad réimniú', () => {
  assert.strictEqual(mf.foirmShaor('sábháil'), 'sábháiltear');
  assert.strictEqual(mf.isDaraReimniu('sábháil'), false);
  assert.strictEqual(mf.isDaraReimniu('fógair'), true);
});

it('tá tábla ann do na mírialta, mar atá i ngach gramadach', () => {
  for (const [a, b] of [['faigh', 'faightear'], ['tabhair', 'tugtar'],
    ['abair', 'deirtear'], ['bí', 'táthar'], ['taispeáin', 'taispeántar']]) {
    assert.strictEqual(mf.foirmShaor(a), b, a);
  }
});

it('ríomhtar an aimsir chaite, agus ní éilítear riamh í (§37.5)', () => {
  assert.strictEqual(mf.foirmShaorChaite('liostaigh'), 'liostaíodh');
  assert.strictEqual(mf.foirmShaorChaite('cuir'), 'cuireadh');
  // An fhoirm a rinne ainm malairte mí-ábhartha de `Fuarthas` roimh 0.9.
  assert.strictEqual(mf.foirmShaorChaite('faigh'), 'fuarthas');
  const p = mf.paraidimShaor('liostaigh');
  assert.deepStrictEqual(p.map((x) => x.beo), [true, false]);
});

it('diúltaítear d\'fhocal nach féidir a réimniú', () => {
  assert.strictEqual(mf.inShaor('xyz').ok, false);
  assert.throws(() => mf.foirmShaor('xyz'));
});

// ── an teanga ─────────────────────────────────────────────────────────
const SAOR = 'saor liostaigh(m: Teaghrán) { scríobh m }\n';

it('is í an fhoirm shaor a scríobhtar i suíomh ráitis', async () => {
  assert.deepStrictEqual(
    await rith(SAOR + 'gníomh príomh() { liostaítear "a" }'), ['a']);
});

it('is E518 é an fhréamh mar ordú', () => {
  assert.deepStrictEqual(coid(SAOR + 'gníomh príomh() { liostaigh "a" }'), ['E518']);
});

it('is E519 í an aimsir chaite: aithnítear í chun í a dhiúltú', () => {
  assert.deepStrictEqual(coid(SAOR + 'gníomh príomh() { liostaíodh "a" }'), ['E519']);
});

it('is E520 é faighteoir ar bhriathar saor', () => {
  assert.deepStrictEqual(coid('struchtúr D { }\nsaor f ó D(féin) { }'), ['E520']);
});

it('is E521 é fréamh nach féidir a réimniú', () => {
  assert.deepStrictEqual(coid('saor xyz(m: Teaghrán) { scríobh m }'), ['E521']);
});

it('ní ghlacann briathar saor le cineál toraidh (E404)', () => {
  assert.deepStrictEqual(coid('saor f(x: Uimhir) -> Uimhir { x }'), ['E404']);
});

it('is féidir briathar saor a ainmniú le "a"', () => {
  // Sin an t-aon slí a bhaintear amach é: cuirtear in aithne don saol
  // lasmuigh é, agus déanann sin é.
  assert.deepStrictEqual(coid(
    SAOR + 'freastal seasmhach = ó "../rt/freastal.js"\n'
    + 'gníomh cláraigh(app: Iasacht) { bealach ó fhreastal(app, "/", a liostaigh) }'), []);
});

it('ní féidir briathar saor a thabhairt do bhriathar Spicebag', () => {
  // An toradh is tábhachtaí sa ghné. Dá nglacfadh gníomh leis, d\'fhéadfadh
  // sé glaoch air — agus dhéanfadh sin déantóir de rud nach bhfuil déantóir
  // aige. Níl fágtha mar cheann scríbe ach `Iasacht`, agus is í an teorainn í.
  assert.deepStrictEqual(coid(
    SAOR + 'gníomh cláraigh(g: gníomh(Teaghrán)) { }\n'
    + 'gníomh príomh() { cláraigh a liostaigh }'), ['E201']);
});

it('ní shroicheann an fhoirm shaor an JavaScript', () => {
  const js = jsDe(SAOR + 'gníomh príomh() { liostaítear "a" }');
  for (const f of ['liostaítear', 'liostaíodh', 'saor']) {
    assert.ok(!js.includes(f), `${f} sa JavaScript`);
  }
  assert.ok(js.includes('function liostaigh(m)'));
});


// ══ 14. Dhá chód a bhí marbh, agus atá beo anois (§38) ════════════════

it('aithnítear foirm uraithe chun í a dhiúltú faoina hainm (E108, §12)', () => {
  // Bhí E108 sa tábla ó 0.4 agus ní raibh aon áit á chur i bhfeidhm. Thit
  // foirm uraithe trí na scoilteanna go E101 — "aitheantóir gan sainmhíniú"
  // mar fhreagra ar Ghaeilge cheart.
  assert.deepStrictEqual(coid('baile seasmhach = 3\ngníomh p() { scríobh mbaile }'), ['E108']);
  assert.deepStrictEqual(coid('cat seasmhach = 3\ngníomh p() { scríobh gcat }'), ['E108']);
  assert.deepStrictEqual(coid('duine seasmhach = 3\ngníomh p() { scríobh nduine }'), ['E108']);
  // Agus fanann E101 mar atá nuair nach bhfuil lemma ar bith taobh thiar de.
  assert.deepStrictEqual(coid('gníomh p() { scríobh mbaile }'), ['E101']);
});

it('inbhéartaítear an t-urú go tacar, mar nach mapáil aonair é', () => {
  assert.deepStrictEqual(mf.lemmaiFaoiUru('mbaile'), ['baile']);
  assert.deepStrictEqual(mf.lemmaiFaoiUru('gcat'), ['cat']);
  assert.deepStrictEqual(mf.lemmaiFaoiUru('bhfuil'), ['fuil']);
  assert.deepStrictEqual(mf.lemmaiFaoiUru('n-áit'), ['áit']);
  assert.deepStrictEqual(mf.lemmaiFaoiUru('baile'), []);
});

it('is E513 é "a" roimh rud nach briathar é', () => {
  assert.deepStrictEqual(coid('uimhir seasmhach = 3\ngníomh p() { scríobh a uimhir }'), ['E513']);
});

it('fanann "a" ina aitheantóir dlisteanach', () => {
  // An chúis nár eochairfhocal riamh é. Is é an cruth a chinneann — dhá
  // aitheantóir taobh le taobh — agus ní tábla.
  assert.deepStrictEqual(coid('a seasmhach = 3\ngníomh p() { scríobh a }'), []);
  assert.deepStrictEqual(coid('a seasmhach = 3\nb seasmhach = a + 1'), []);
});

it('fanann "a" roimh bhriathar ina ainmniú', () => {
  assert.deepStrictEqual(coid(
    'gníomh fógair(t: Teaghrán) { scríobh t }\n'
    + 'gníomh p() { déan a fhógair ar ["a", "b"] }'), []);
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
