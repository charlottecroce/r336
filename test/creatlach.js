'use strict';

/*
 * The shared runner. Every suite had its own copy of the same twelve lines and
 * they had already drifted, so there is one now.
 *
 *     const { it, rithSraith } = require('./creatlach');
 *     it('ainm na tástála', 'the name of the test', () => { ... });
 *     rithSraith('inscne');
 *
 * Quiet by default: one line, `inscne: 19 pas, 0 teip`. A failure prints both
 * names and the reason in both languages.
 *
 *   -v, --foclach, --verbose        [VERBOSE=1]    a line per test, in English
 *   --scag=PATRÚN, --filter=PATRÚN  [SCAG=PATRÚN]  run only what matches
 *   -l, --liosta, --list            [LIOSTA=1]     list without running
 */

const util = require('node:util');
const fs = require('node:fs');

// Bound at load time. `run.js` and `suim.js` replace `console.log` to capture
// output from compiled programs, and a failure report must not land in that.
const scriobhAmach = process.stdout.write.bind(process.stdout);
const lin = (s = '') => scriobhAmach(`${s}\n`);

const DATH = process.stdout.isTTY && !process.env.NO_COLOR;
const uaine = (s) => (DATH ? `\u001b[32m${s}\u001b[0m` : s);
const dearg = (s) => (DATH ? `\u001b[31m${s}\u001b[0m` : s);
const liath = (s) => (DATH ? `\u001b[90m${s}\u001b[0m` : s);

/** Flags from argv and the environment together. */
function roghannaDe(argv, timpeall) {
  const r = { foclach: false, scag: null, liosta: false };
  for (const a of argv) {
    if (a === '-v' || a === '--verbose' || a === '--foclach') r.foclach = true;
    else if (a === '-l' || a === '--list' || a === '--liosta') r.liosta = true;
    else if (a.startsWith('--scag=')) r.scag = a.slice('--scag='.length);
    else if (a.startsWith('--filter=')) r.scag = a.slice('--filter='.length);
  }
  if (timpeall.VERBOSE && timpeall.VERBOSE !== '0') r.foclach = true;
  if (timpeall.LIOSTA && timpeall.LIOSTA !== '0') r.liosta = true;
  if (timpeall.SCAG) r.scag = timpeall.SCAG;
  return r;
}

const ROGHANNA = roghannaDe(process.argv.slice(2), process.env);
const SCAG = ROGHANNA.scag ? new RegExp(ROGHANNA.scag, 'i') : null;

const TASTAIL = [];

/**
 * Register one test. The English name is a gloss, not a second test: verbose
 * mode reads the gloss and a failure prints both. The two-argument form still
 * works, so an unglossed suite runs rather than throwing.
 */
function it(ainm, bearla, fn) {
  if (typeof bearla === 'function') { fn = bearla; bearla = ainm; }
  TASTAIL.push({ ainm, bearla, fn });
}

/** Node's own wording for an assertion carrying no message of its own. */
const REAMHSHOCRAITHE = new Set([
  'Missing expected exception.',
  'Got unwanted exception.',
  'Failed',
]);

const gearr = (s, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const luaigh = (v) => gearr(util.inspect(v, {
  depth: 4, breakLength: Infinity, maxArrayLength: 16, maxStringLength: 140, colors: false,
}));

/**
 * Say what went wrong, twice. The sentences are built from the operator and
 * the values rather than translated from node's message, which is what keeps
 * them parallel. `nota` is the author's own message and is quoted rather than
 * restated, so it stays in whichever language they wrote it in.
 */
function cursios(e) {
  if (!e || e.code !== 'ERR_ASSERTION') {
    const ainm = (e && e.name) || 'Earráid';
    const teachtaireacht = gearr(String((e && e.message) || e));
    return {
      ga: `caitheadh ${ainm}: ${teachtaireacht}`,
      en: `threw ${ainm}: ${teachtaireacht}`,
      nota: null,
      cruach: (e && e.stack) || null,
    };
  }

  const nota = e.generatedMessage === false && !REAMHSHOCRAITHE.has(e.message)
    ? gearr(String(e.message).split('\n')[0])
    : null;
  const cuid = { nota, cruach: e.stack || null };

  switch (e.operator) {
    case 'strictEqual':
    case 'deepStrictEqual':
    case 'equal':
    case 'deepEqual':
      return {
        ga: `bhíothas ag súil le ${luaigh(e.expected)}, fuarthas ${luaigh(e.actual)}`,
        en: `expected ${luaigh(e.expected)}, got ${luaigh(e.actual)}`,
        ...cuid,
      };
    case 'notStrictEqual':
    case 'notDeepStrictEqual':
    case 'notEqual':
    case 'notDeepEqual':
      return {
        ga: `bhíothas ag súil le rud éigin seachas ${luaigh(e.expected)}`,
        en: `expected anything other than ${luaigh(e.expected)}`,
        ...cuid,
      };
    case '==': // `assert.ok`
      return {
        ga: `bhíothas ag súil le luach fíor, fuarthas ${luaigh(e.actual)}`,
        en: `expected a truthy value, got ${luaigh(e.actual)}`,
        ...cuid,
      };
    case 'throws':
      return {
        ga: 'bhíothas ag súil le hearráid ón nglao, agus níor caitheadh ceann',
        en: 'expected the call to throw, and it did not',
        ...cuid,
      };
    case 'doesNotThrow':
      return {
        ga: `caitheadh earráid nár cheart a bheith ann: ${gearr(String(e.actual))}`,
        en: `an unwanted error was thrown: ${gearr(String(e.actual))}`,
        ...cuid,
      };
    case 'rejects':
    case 'doesNotReject':
      return {
        ga: `níor fhreagair an gealltanas mar a bhíothas ag súil (${e.operator})`,
        en: `the promise did not settle as expected (${e.operator})`,
        ...cuid,
      };
    case 'fail':
      return { ga: 'teip dhearbhaithe', en: 'an explicit failure', ...cuid };
    default:
      return {
        ga: `theip ar an dearbhú (${e.operator})`,
        en: `assertion failed (${e.operator})`,
        ...cuid,
      };
  }
}

/** First frame inside a test file. A generated message puts its diff in the stack. */
function ceadFrama(cruach) {
  if (!cruach) return null;
  for (const l of String(cruach).split('\n')) {
    if (!/^\s*at /.test(l)) continue;
    if (l.includes('node:') || l.includes('creatlach.js')) continue;
    return l.trim();
  }
  return null;
}

let rithte = false;

/**
 * Leave a report for `index.js`. A file rather than stdout, so the runner
 * never has to parse its own output back: a test name can contain anything.
 */
function tuairiscigh(toradh) {
  if (!process.env.R336_TUAIRISC) return;
  try {
    fs.appendFileSync(process.env.R336_TUAIRISC, `${JSON.stringify(toradh)}\n`);
  } catch { /* ní teip tástála í tuairisc nach féidir a scríobh */ }
}

/**
 * Run everything registered here. `process.exitCode` rather than
 * `process.exit`, which can cut the last line when stdout is a pipe.
 */
async function rithSraith(ainm) {
  rithte = true;
  const roghnaithe = SCAG
    ? TASTAIL.filter((t) => SCAG.test(t.ainm) || SCAG.test(t.bearla))
    : TASTAIL;

  if (ROGHANNA.liosta) {
    for (const t of roghnaithe) lin(`  ${t.bearla}\n    ${liath(t.ainm)}`);
    lin(`${ainm}: ${roghnaithe.length} tástáil / tests`);
    const toradh = { ainm, pas: 0, teip: 0, liostaithe: roghnaithe.length, teipeanna: [] };
    tuairiscigh(toradh);
    return toradh;
  }

  let pas = 0;
  let teip = 0;
  const teipeanna = [];

  for (const t of roghnaithe) {
    const tus = Date.now();
    try {
      await t.fn();
      pas += 1;
      if (ROGHANNA.foclach) {
        lin(`  ${uaine('✓')} ${t.bearla} ${liath(`${Date.now() - tus}ms`)}`);
      }
    } catch (e) {
      teip += 1;
      const c = cursios(e);
      teipeanna.push({ ainm: t.ainm, bearla: t.bearla, ga: c.ga, en: c.en, nota: c.nota });
      lin(`  ${dearg('✗')} ${t.ainm}`);
      lin(`      ${liath(t.bearla)}`);
      lin(`      ga: ${c.ga}`);
      lin(`      en: ${c.en}`);
      if (c.nota) lin(`      nóta/note: ${c.nota}`);
      const frama = ceadFrama(c.cruach);
      if (frama && ROGHANNA.foclach) lin(`      ${liath(frama)}`);
    }
  }

  if (SCAG) lin(liath(`  (scagaire /${ROGHANNA.scag}/: ${roghnaithe.length}/${TASTAIL.length})`));
  lin(`${ainm}: ${pas} pas, ${teip} teip`);

  const toradh = { ainm, pas, teip, teipeanna };
  tuairiscigh(toradh);
  if (teip) process.exitCode = 1;
  return toradh;
}

// A suite that registers tests and never calls `rithSraith` would be a silent
// pass, which is the worst kind.
process.on('beforeExit', () => {
  if (!rithte && TASTAIL.length) {
    lin(dearg(`níor glaodh rithSraith(): ${TASTAIL.length} tástáil gan rith / never run`));
    process.exitCode = 1;
  }
});

module.exports = { it, rithSraith, roghanna: ROGHANNA, cursios, roghannaDe };
