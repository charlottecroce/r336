'use strict';

/*
 * test/earraidi.js — an corpas earráidí.
 *
 * Riail an tionscadail ó thús: faigheann gach diagnóis cód, agus faigheann
 * gach cód comhad in `examples/earraidi/` a theipeann d'aon ghnó. Bhí an
 * riail ann agus ní raibh sí á forfheidhmiú — 23 as 60 a bhí clúdaithe nuair
 * a comhaireadh iad den chéad uair i gcéim 0.10.
 *
 * Déanann an comhad seo an dá threo:
 *
 *   1. Teipeann gach cás leis an gcód atá ina ainm, agus leis sin amháin.
 *   2. Tá cás ag gach cód in `diagnostics.js` nach bhfuil curtha in áirithe.
 *
 * Aithnítear cás óna chéad líne: `// E### — …`. Comhad cabhrach — ceann a
 * iompórtáiltear agus a thiomsaíonn go glan — ní thosaíonn sé mar sin, agus
 * mar sin ní chuirtear san áireamh é gan liosta eisceachtaí a choinneáil.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Tionscadal, Earraid, Cnuasach } = require('../src/index');

const FILL = path.resolve(__dirname, '..', 'examples', 'earraidi');
const tastail = [];
let pas = 0, teip = 0;
const it = (ainm, fn) => tastail.push([ainm, fn]);

/** Codes with a message and deliberately no way to fire. Each needs a reason. */
const INAIRITHE = {
  E211: 'curtha in áirithe: rinneadh fíor é i gcéim 0.8 agus díshealbhaíodh '
      + 'arís é sa chéim chéanna (§26.7)',
  E506: 'curtha in áirithe: ardaíonn an chúlchríoch craobhacha ilráiteacha '
      + 'anois, mar sin ní theipeann "má" mar shlonn ar an gcúis seo a thuilleadh',
};

/** Every code the diagnostics table defines, in order. */
function coidUile() {
  const téacs = fs.readFileSync(path.join(__dirname, '..', 'src', 'diagnostics.js'), 'utf8');
  return [...téacs.matchAll(/^ {2}(E\d{3}):/gm)].map((m) => m[1]);
}

/** Every case file, as { cod, comhad }. Helper files are not cases. */
function casanna() {
  const amach = [];
  for (const ainm of fs.readdirSync(FILL).sort()) {
    if (!ainm.endsWith('.r336')) continue;
    const céad = fs.readFileSync(path.join(FILL, ainm), 'utf8').split('\n')[0];
    const m = /^\/\/ (E\d{3}) —/.exec(céad);
    if (m) amach.push({ cod: m[1], comhad: ainm });
  }
  return amach;
}

/** Compile one case and return the distinct codes it produced. */
function coidDe(ainm) {
  try {
    new Tionscadal().tiomsaigh(path.join(FILL, ainm));
    return [];
  } catch (e) {
    if (e instanceof Cnuasach) return [...new Set(e.earraidi.map((x) => x.cod))];
    if (e instanceof Earraid) return [e.cod];
    throw e;
  }
}

// ── 1. gach cás, agus an cód atá ina ainm amháin ──────────────────────

for (const { cod, comhad } of casanna()) {
  it(`teipeann ${comhad} le ${cod}, agus leis sin amháin`, () => {
    const fuarthas = coidDe(comhad);
    assert.notDeepStrictEqual(fuarthas, [], `níor theip ${comhad} ar chor ar bith`);
    assert.deepStrictEqual(fuarthas, [cod],
      `${comhad}: bhíothas ag súil le ${cod}, fuarthas ${fuarthas.join(', ')}`);
  });
}

// ── 2. gach cód, agus cás aige ────────────────────────────────────────

it('tá cás ag gach cód nach bhfuil curtha in áirithe', () => {
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  const gan = coidUile().filter((c) => !clúdaithe.has(c) && !INAIRITHE[c]);
  assert.deepStrictEqual(gan, [],
    `cóid gan chás: ${gan.join(', ')} — cuir comhad in examples/earraidi/ leo, `
    + 'nó cuir in áirithe iad le cúis in INAIRITHE');
});

it('níl aon chód curtha in áirithe gan chúis, agus ní theipeann ceann acu', () => {
  for (const [cod, cuis] of Object.entries(INAIRITHE)) {
    assert.ok(cuis && cuis.length > 20, `${cod}: teastaíonn cúis uaidh`);
    assert.ok(coidUile().includes(cod), `${cod}: níl sé sa tábla ar chor ar bith`);
  }
  // Agus níl cás ag ceann ar bith acu: dá mbeadh, ní bheadh sé in áirithe.
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  for (const cod of Object.keys(INAIRITHE)) {
    assert.ok(!clúdaithe.has(cod), `${cod}: tá cás aige, mar sin bain as INAIRITHE é`);
  }
});

it('clúdaítear gach raon', () => {
  // Ní fhágtar raon iomlán gan chás: bheadh sin ina chomhartha go bhfuil
  // fo-chóras iomlán gan tástáil seachas cód aonair ar iarraidh.
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  for (const raon of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) {
    assert.ok([...clúdaithe].some((c) => c.startsWith(raon)), `raon ${raon}`);
  }
});

// ── rith ──────────────────────────────────────────────────────────────
(async () => {
  for (const [ainm, fn] of tastail) {
    try { await fn(); pas++; }
    catch (e) { teip++; console.log(`  ✗ ${ainm}\n    ${e.message}`); }
  }
  console.log(`\nearraidi: ${pas} pas, ${teip} teip`);
  if (teip) process.exit(1);
})();
