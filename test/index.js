'use strict';

/*
 * Runs every suite in this folder.
 *
 *   node test/index.js               gach rud
 *   node test/index.js inscne stór   the files whose names match
 *   node test/index.js -v            flags are handed down to each suite
 *
 * No file list is kept here. Any `.js` that is not this file or `creatlach.js`
 * and does not start with `_` is a suite, so adding one needs no change to
 * package.json. Helpers go in `test/cabhair/` or start with `_`.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FILLTEAN = __dirname;
const NACH_SRAITH = new Set(['index.js', 'creatlach.js']);

const DATH = process.stdout.isTTY && !process.env.NO_COLOR;
const uaine = (s) => (DATH ? `\u001b[32m${s}\u001b[0m` : s);
const dearg = (s) => (DATH ? `\u001b[31m${s}\u001b[0m` : s);
const liath = (s) => (DATH ? `\u001b[90m${s}\u001b[0m` : s);

/** Every suite file, sorted, `run.js` first because it is the oldest. */
function sraitheanna() {
  const amach = fs.readdirSync(FILLTEAN)
    .filter((c) => c.endsWith('.js'))
    .filter((c) => !NACH_SRAITH.has(c) && !c.startsWith('_'))
    .sort();
  const i = amach.indexOf('run.js');
  if (i > 0) amach.unshift(...amach.splice(i, 1));
  return amach;
}

/** Argv split into name filters and flags to hand down. */
function deighilt(argv) {
  const scagairi = [];
  const bratacha = [];
  for (const a of argv) (a.startsWith('-') ? bratacha : scagairi).push(a);
  return { scagairi, bratacha };
}

const { scagairi, bratacha } = deighilt(process.argv.slice(2));
const comhaid = sraitheanna()
  .filter((c) => !scagairi.length || scagairi.some((s) => c.includes(s)));

if (!comhaid.length) {
  process.stdout.write(`níl sraith ar bith ann a mheaitseálann: ${scagairi.join(', ')}\n`);
  process.exit(1);
}

const tuairisc = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'r336-')), 'tuairisc.jsonl');

let pas = 0;
let teip = 0;
let liostaithe = 0;
const briste = [];

// A process each. `run.js` and `suim.js` replace `console.log`, `run.js` runs
// code in a `vm`, and several read projects off disk, so the boundary keeps one
// suite from spoiling another. Each file still runs alone: `node test/suim.js`.
for (const c of comhaid) {
  const toradh = spawnSync(process.execPath, [path.join(FILLTEAN, c), ...bratacha], {
    stdio: 'inherit',
    env: { ...process.env, R336_TUAIRISC: tuairisc },
  });

  const linte = fs.existsSync(tuairisc)
    ? fs.readFileSync(tuairisc, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  const ceann = linte.length ? JSON.parse(linte[linte.length - 1]) : null;
  fs.writeFileSync(tuairisc, '');

  if (ceann) {
    pas += ceann.pas;
    teip += ceann.teip;
    liostaithe += ceann.liostaithe || 0;
  } else {
    // Parse error, missing module, `rithSraith` never called. A failure, not a zero.
    teip += 1;
    briste.push(c);
    process.stdout.write(`${dearg('✗')} ${c}\n`
      + `      ga: thit an tsraith gan achoimre (stádas ${toradh.status})\n`
      + `      en: the suite died before it could report (status ${toradh.status})\n`);
  }
}

fs.rmSync(path.dirname(tuairisc), { recursive: true, force: true });

const marc = teip ? dearg('✗') : uaine('✓');
process.stdout.write(`${liath('─'.repeat(46))}\n`);
process.stdout.write(liostaithe && !pas && !teip
  ? `${marc} iomlán/total: ${liostaithe} tástáil / tests\n`
  : `${marc} iomlán/total: ${pas} pas, ${teip} teip`
    + `${briste.length ? liath(`  (${briste.length} sraith briste/broken)`) : ''}\n`);

process.exit(teip ? 1 : 0);
