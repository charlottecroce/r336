'use strict';

/*
 * Every diagnostic code gets a case file in `examples/earraidi/` that fails on
 * purpose, and every case file fails with exactly the code in its name.
 *
 * A case is recognised by its first line: `// E### — …`. Helper files do not
 * start that way, so they need no exception list.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Tionscadal, Earraid, Cnuasach } = require('../src/index');

const { it, rithSraith } = require('./creatlach');

const FILL = path.resolve(__dirname, '..', 'examples', 'earraidi');

/** Codes with a message and deliberately no way to fire. Each needs a reason. */
const INAIRITHE = {
  E108: 'curtha in áirithe ó 0.13: ba é seo an diúltú don urú. Ó tá slot ag an '
      + 'urú (§5.2) is é E113 an locht anois, agus d\'athródh athúsáid E108 a bhrí',
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
  it(`teipeann ${comhad} le ${cod}, agus leis sin amháin`,
    `${comhad} fails with ${cod}, and with that alone`, () => {
    const fuarthas = coidDe(comhad);
    assert.notDeepStrictEqual(fuarthas, [], `níor theip ${comhad} ar chor ar bith`);
    assert.deepStrictEqual(fuarthas, [cod],
      `${comhad}: bhíothas ag súil le ${cod}, fuarthas ${fuarthas.join(', ')}`);
  });
}

// ── 2. gach cód, agus cás aige ────────────────────────────────────────

it('tá cás ag gach cód nach bhfuil curtha in áirithe',
  'every code that is not reserved has a case', () => {
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  const gan = coidUile().filter((c) => !clúdaithe.has(c) && !INAIRITHE[c]);
  assert.deepStrictEqual(gan, [],
    `cóid gan chás: ${gan.join(', ')} — cuir comhad in examples/earraidi/ leo, `
    + 'nó cuir in áirithe iad le cúis in INAIRITHE');
});

it('níl aon chód curtha in áirithe gan chúis, agus ní theipeann ceann acu',
  'no code is reserved without a reason, and none of them fires', () => {
  for (const [cod, cuis] of Object.entries(INAIRITHE)) {
    assert.ok(cuis && cuis.length > 20, `${cod}: teastaíonn cúis uaidh`);
    assert.ok(coidUile().includes(cod), `${cod}: níl sé sa tábla ar chor ar bith`);
  }
  // A reserved code with a case is not reserved.
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  for (const cod of Object.keys(INAIRITHE)) {
    assert.ok(!clúdaithe.has(cod), `${cod}: tá cás aige, mar sin bain as INAIRITHE é`);
  }
});

it('clúdaítear gach raon',
  'every range is covered', () => {
  // An empty range means a whole subsystem is untested, not one missing code.
  const clúdaithe = new Set(casanna().map((c) => c.cod));
  for (const raon of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']) {
    assert.ok([...clúdaithe].some((c) => c.startsWith(raon)), `raon ${raon}`);
  }
});

// ── rith ──────────────────────────────────────────────────────────────
rithSraith('earraidi');
