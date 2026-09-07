'use strict';

const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { tiomsaigh, Cnuasach, Earraid } = require('../src/index');
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
seasmhach duine = Duine { ainm: "Cáit", aois: 20 }
`;

it('glacann `ó` leis an bhfoirm shéimhithe', async () => {
  assert.deepStrictEqual(await rith(DUINE + 'scríobh ainm ó dhuine'), ['Cáit']);
});

it('diúltaíonn `ó` don bhunfhoirm nuair is féidir séimhiú (E102)', () => {
  assert.deepStrictEqual(coid(DUINE + 'scríobh ainm ó duine'), ['E102']);
});

it('glactar leis an mbunfhoirm nuair nach féidir séimhiú', async () => {
  assert.deepStrictEqual(
    await rith('struchtúr S { ainm: Teaghrán }\nseasmhach áit = S { ainm: "Gaillimh" }\nscríobh ainm ó áit'),
    ['Gaillimh']);
  assert.deepStrictEqual(
    await rith('struchtúr S { ainm: Teaghrán }\nseasmhach stór = S { ainm: "Corcaigh" }\nscríobh ainm ó stór'),
    ['Corcaigh']);
});

it('diúltaítear do shéimhiú lasmuigh de shuíomh rialaithe (E103)', () => {
  assert.deepStrictEqual(coid(DUINE + 'seasmhach x = dhuine'), ['E103']);
});

it('diúltaítear do shéimhiú bréige (E104)', () => {
  assert.deepStrictEqual(
    coid('struchtúr S { ainm: Teaghrán }\nseasmhach stór = S { ainm: "x" }\nscríobh ainm ó shtór'),
    ['E104']);
});

it('ní mór ceangail a fhógairt sa bhunfhoirm (E107)', () => {
  assert.deepStrictEqual(coid('seasmhach dhuine = 3'), ['E107']);
});

it('is aon siombail amháin iad duine/dhuine', () => {
  const js = jsDe(DUINE + 'scríobh ainm ó dhuine\nscríobh aois ó dhuine');
  assert.ok(!js.includes('dhuine'), 'níor cheart go bhfeicfeadh an chúlchríoch foirm shéimhithe riamh');
  assert.ok(js.includes('duine.ainm') && js.includes('duine.aois'));
});

it('rialaíonn gach `ó` tús a chomhlánaithe féin', async () => {
  const src = `struchtúr Seoladh { baile: Teaghrán }
struchtúr Duine { seoladh: Seoladh }
seasmhach duine = Duine { seoladh: Seoladh { baile: "Corcaigh" } }
scríobh baile ó sheoladh ó dhuine`;
  assert.deepStrictEqual(await rith(src), ['Corcaigh']);
  assert.ok(jsDe(src).includes('duine.seoladh.baile'));
  assert.deepStrictEqual(coid(src.replace('ó sheoladh', 'ó seoladh')), ['E102']);
});

it('teastaíonn sealbhóir inséalbhaithe ó `ó` (E205)', () => {
  assert.deepStrictEqual(coid('seasmhach x = fíor\nscríobh ainm ó x'), ['E205']);
});

// ══ 3. Cineálacha ═════════════════════════════════════════════════════
it('seiceáiltear argóintí agus torthaí', () => {
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Uimhir { x + x }\nseasmhach a = f("x")'), ['E201']);
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Teaghrán { x + x }'), ['E209']);
  assert.deepStrictEqual(coid('feidhm f(x: Uimhir) -> Uimhir { x }\nseasmhach a = f(1, 2)'), ['E206']);
});

it('seiceáiltear réimsí struchtúir', () => {
  assert.deepStrictEqual(coid('struchtúr D { ainm: Teaghrán }\nseasmhach d = D { }'), ['E204']);
  assert.deepStrictEqual(coid('struchtúr D { ainm: Teaghrán }\nseasmhach d = D { ainm: 3 }'), ['E201']);
});

it('ní mheasctar Teaghrán agus Uimhir le "+" (E210)', () => {
  assert.deepStrictEqual(coid('seasmhach x = "a" + 1'), ['E210']);
});

it('caithfidh Bool a bheith ag "má"', () => {
  assert.deepStrictEqual(coid('seasmhach x = 1\nmá x { }'), ['E201']);
});

// ══ 4. Copail agus briathar substaintigh ══════════════════════════════
it('is aicmiú é `is`, ní comparáid', async () => {
  const src = 'struchtúr D { }\nseasmhach d = D { }\nmá d is D { scríobh "sea" }';
  assert.ok(jsDe(src).includes('__is(d, "D")'));
  assert.ok(!jsDe(src).includes('=== D'));
  assert.deepStrictEqual(await rith(src), ['sea']);
});

it('is ceist bheithe é `bí`', async () => {
  const src = 'seasmhach x = 1\nmá tá x { scríobh "ann" }';
  assert.ok(jsDe(src).includes('__bí(x)'));
  assert.deepStrictEqual(await rith(src), ['ann']);
});

it('freagraíonn foirm an bhriathair shubstaintigh don cháithnín', async () => {
  assert.deepStrictEqual(coid('seasmhach x = 1\nmá tá x { }'), []);
  assert.deepStrictEqual(coid('seasmhach x = 1\nmura bhfuil x { }'), []);
  assert.deepStrictEqual(coid('seasmhach x = 1\nmá bhfuil x { }'), ['E512']);
  assert.deepStrictEqual(coid('seasmhach x = 1\nmura tá x { }'), ['E512']);
  assert.deepStrictEqual(coid('seasmhach x = 1\nmá bí x { }'), ['E512']);
  // The alternation is agreement, not meaning: both emit the same call.
  const a = jsDe('seasmhach x = 1\nmá tá x { scríobh "a" }');
  const b = jsDe('seasmhach x = 1\nmura bhfuil x { scríobh "a" }');
  assert.ok(a.includes('__bí(x)') && b.includes('__bí(x)'));
  assert.ok(!b.includes('bhfuil'));
});

it('is é "neamhní" an easpa a thuairiscíonn "bí"', async () => {
  assert.deepStrictEqual(
    await rith('sealadach x: Iasacht = neamhní\ngníomh príomh() { scríobh tá x  cuir 3 ar x  scríobh tá x }'),
    ['false', 'true']);
});

it('scarann `is` agus `bí` ó chéile', () => {
  const js = jsDe('struchtúr D { }\nseasmhach d = D { }\nseasmhach a = d is D\nseasmhach b = tá d');
  assert.ok(js.includes('__is(') && js.includes('__bí('));
});

it('ní uimhir é NaN don chopail', async () => {
  const src = 'feidhm f(x: Iasacht) -> Teaghrán { má x is Uimhir { "uimhir" } mura { "níl" } }\n'
    + 'scríobh f(0 / 0)\nscríobh f(3)';
  assert.deepStrictEqual(await rith(src), ['níl', 'uimhir']);
});

it('caithfidh cineál aitheanta a bheith ar dheis na copaile (E202)', () => {
  assert.deepStrictEqual(coid('seasmhach x = 1\nseasmhach y = x is Rud'), ['E202']);
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
seasmhach duine = Duine { ainm: "Cáit", aois: 20 }
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
  assert.deepStrictEqual(coid('gníomh cláraigh(x: Teaghrán) { scríobh x }\nseasmhach g = cláraigh'), ['E501']);
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
      + 'ag feidhm f(x: Iasacht) -> Teaghrán { seasmhach a = g(x)  a }'),
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
  const js = jsDe('seasmhach e = ó "express"\nseasmhach R = Router ó "express"');
  assert.ok(js.includes('require("express")'));
  assert.ok(js.includes('require("express").Router'));
});

it('athscríobhtar .sb go .js i gconairí', () => {
  assert.ok(jsDe('seasmhach s = ó "./sonraí.sb"').includes('require("./sonraí.js")'));
});

it('is Iasacht gach rud a thagann trasna na teorann', async () => {
  const src = 'seasmhach p = ó "node:path"\nscríobh basename ó ph("/a/b/c.txt")';
  assert.deepStrictEqual(await rith(src), ['c.txt']);
});

it('tá tiontuithe sa leabharlann, ní sa teanga', async () => {
  const src = 'seasmhach bun = ó "../rt/bunúsach.js"\n'
    + 'feidhm cad(x: Iasacht) -> Teaghrán { má x is Uimhir { "uimhir" } mura { "níl" } }\n'
    + 'scríobh cad(uimhir ó bhun("42"))\nscríobh cad(uimhir ó bhun("abc"))';
  assert.deepStrictEqual(await rith(src), ['uimhir', 'níl']);
});

// ══ 9. Liostaí agus má-mar-shlonn ═════════════════════════════════════
it('fad, folamh, céad tríd an ngaol `ó`', async () => {
  const src = 'seasmhach xs = [3, 1, 4]\nscríobh fad ó xs\nscríobh céad ó xs\nseasmhach ys: Liosta(Uimhir) = []\nscríobh folamh ó ys';
  assert.deepStrictEqual(await rith(src), ['3', '3', 'true']);
});

it('leathnaítear liosta ilchineálach go Liosta(Iasacht)', () => {
  assert.deepStrictEqual(coid('seasmhach xs = [1, "a"]'), []);
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
    await rith('seasmhach xs: Liosta(Uimhir) = []\nmura folamh ó xs { scríobh "lán" }\nmura bhfuil xs { scríobh "as" }'),
    []);
});

it('ardaítear craobhacha ilráiteacha isteach i sealadach', async () => {
  const src = `feidhm f(u: Uimhir) -> Teaghrán {
    má u > 0 { seasmhach t = "dear" + "fach"  t } mura { seasmhach t = "diúl"  t + "tach" }
  }
  scríobh f(1)
  scríobh f(0)`;
  assert.deepStrictEqual(await rith(src), ['dearfach', 'diúltach']);
  assert.ok(/let __t0;/.test(jsDe(src)), jsDe(src));
});

it('ní ardaítear má nuair is simplí é', () => {
  const js = jsDe('feidhm f(u: Uimhir) -> Uimhir { má u > 0 { 1 } mura { 2 } }');
  assert.ok(js.includes('?') && !js.includes('__t0'));
});

it('teastaíonn craobh "mura" lom ó "má" mar shlonn (E507)', () => {
  assert.deepStrictEqual(coid('seasmhach x = má fíor { 1 }'), ['E507']);
  assert.deepStrictEqual(coid('feidhm f(u: Uimhir) -> Teaghrán { má u > 0 { "a" } }'), ['E503', 'E209']);
});

// ══ 13. Staid: seasmhach i gcoinne sealadach ══════════════════════════
it('ní athraítear rud seasmhach (E510)', () => {
  assert.deepStrictEqual(coid('seasmhach x = 0\ngníomh g() { cuir 1 ar x }'), ['E510']);
  assert.deepStrictEqual(coid('sealadach x = 0\ngníomh g() { cuir 1 ar x }'), []);
});

it('is ordú é an t-athrú, mar sin tá sé faoi na rialacha modha (E502)', () => {
  assert.deepStrictEqual(coid('sealadach x = 0\nfeidhm f() -> Uimhir { cuir 1 ar x  x }'), ['E502']);
});

it('séimhíonn "ar" a chomhlánú, mar a dhéanann "ó"', () => {
  assert.deepStrictEqual(coid('sealadach duine = 0\ngníomh g() { cuir 1 ar dhuine }'), []);
  assert.deepStrictEqual(coid('sealadach duine = 0\ngníomh g() { cuir 1 ar duine }'), ['E102']);
});

it('athraítear réimse trí cheangal sealadach', async () => {
  const src = `struchtúr C { luach: Uimhir }
gníomh ardaigh(sealadach c: C) { cuir luach ó ch + 1 ar luach ó ch }
gníomh príomh() { sealadach c = C { luach: 0 }  ardaigh c  ardaigh c  scríobh luach ó ch }`;
  assert.deepStrictEqual(await rith(src), ['2']);
  assert.deepStrictEqual(coid(src.replace('sealadach c: C', 'c: C')), ['E510']);
});

it('gineann sealadach let, agus seasmhach const', () => {
  const js = jsDe('seasmhach a = 1\nsealadach b = 2');
  assert.ok(js.includes('const a = 1;') && js.includes('let b = 2;'));
  assert.ok(js.includes('Object.defineProperty(module.exports, "b"'), js);
});

// ══ 14. Ainmniú: a + briathar ═════════════════════════════════════════
it('ainmníonn "a" briathar, agus séimhíonn sé é', async () => {
  const src = `gníomh fógair(x: Iasacht) { scríobh x }
gníomh príomh() { seasmhach xs: Iasacht = ["a", "b"]  forEach ó xs(a fhógair) }`;
  assert.deepStrictEqual(await rith(src), ['a', 'b']);
  assert.deepStrictEqual(coid(src.replace('a fhógair', 'a fógair')), ['E102']);
});

it('gan "a", is E501 fós é', () => {
  assert.deepStrictEqual(coid('gníomh cláraigh(x: Iasacht) { scríobh x }\nseasmhach f = cláraigh'), ['E501']);
});

it('fanann "a" ina aitheantóir gnáth', async () => {
  assert.deepStrictEqual(await rith('seasmhach a = 3\nscríobh a'), ['3']);
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
seasmhach duine = Duine { ainm: "Charlotte", aois: 20 }
seasmhach teachtaireacht = beannacht(duine)
scríobh teachtaireacht`;
  assert.deepStrictEqual(await rith(src), ['Dia duit, Charlotte']);
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
