'use strict';

// contaetha.js — na 32 contae, na ceithre chúige, agus an deoraíocht.
//
// Vocabulary, not grammar — same status as `Iasacht` in analyzer.js. `as`
// itself is real Irish (unclaimed keyword, takes no initial mutation since
// it's not in the leniting set), so it routes through the ordinary
// FOIRM.BUN government with no new machinery. The *list of 32 names* is a
// fixed table the compiler ships and is a deliberate bit, not a grammar
// feature — don't let `as` being well-motivated launder the table.
//
// Notes:
//  1. Closed at 32 — makes an unrecognised name a real diagnostic (E602).
//  2. The definite article is NOT implemented. County/province names with
//     "An"/"na" (An Mhí, Dún na nGall) are opaque strings in a lookup table.
//  3. `nGall`/`Fhailí` inside proper names are frozen mutations, not produced
//     by morphology.js and demanded by nothing. `i`'s eclipsis slot (§5.2)
//     doesn't touch this — these are still opaque strings to the reader.

/**
 * `deoraíocht` — "exile". Where a value is when from nowhere: primitives,
 * `Iasacht`, any `struchtúr` with no `as`. Deliberately asymmetric to a real
 * county: non-exclusive (any number of things can be exiled), can't sign a
 * treaty (not a party), and is nobody's rival (no history). Not writable —
 * `as deoraíocht` is E605.
 */
const DEORAIOCHT = 'deoraíocht';

const CUIGI = Object.freeze({
  LAIGHIN: 'Laighin',
  MUMHAIN: 'An Mhumhain',
  CONNACHTA: 'Connachta',
  ULAIDH: 'Ulaidh',
});

/** The four, in order, for the invariant check and for `--graf`. */
const CUIGI_UILE = Object.freeze([
  CUIGI.LAIGHIN, CUIGI.MUMHAIN, CUIGI.CONNACHTA, CUIGI.ULAIDH,
]);

// `cúige` is load-bearing (province exclusivity, border check); `cósta` is
// still inert, kept for a future rule restricting `ó "…"` on foreign modules
// to coastal counties.
const TABLA = [
  // ainm                  cúige              cósta
  ['Baile Átha Cliath',    CUIGI.LAIGHIN,     true],
  ['An Mhí',               CUIGI.LAIGHIN,     true],
  ['Lú',                   CUIGI.LAIGHIN,     true],
  ['Cill Mhantáin',        CUIGI.LAIGHIN,     true],
  ['Loch Garman',          CUIGI.LAIGHIN,     true],
  ['Cill Dara',            CUIGI.LAIGHIN,     false],
  ['Ceatharlach',          CUIGI.LAIGHIN,     false],
  ['Cill Chainnigh',       CUIGI.LAIGHIN,     false],
  ['Laois',                CUIGI.LAIGHIN,     false],
  ['Uíbh Fhailí',          CUIGI.LAIGHIN,     false],
  ['An Iarmhí',            CUIGI.LAIGHIN,     false],
  ['An Longfort',          CUIGI.LAIGHIN,     false],

  ['Corcaigh',             CUIGI.MUMHAIN,     true],
  ['Ciarraí',              CUIGI.MUMHAIN,     true],
  ['Luimneach',            CUIGI.MUMHAIN,     true],
  ['An Clár',              CUIGI.MUMHAIN,     true],
  ['Port Láirge',          CUIGI.MUMHAIN,     true],
  ['Tiobraid Árann',       CUIGI.MUMHAIN,     false],

  ['Gaillimh',             CUIGI.CONNACHTA,   true],
  ['Maigh Eo',             CUIGI.CONNACHTA,   true],
  ['Sligeach',             CUIGI.CONNACHTA,   true],
  ['Liatroim',             CUIGI.CONNACHTA,   true],
  ['Ros Comáin',           CUIGI.CONNACHTA,   false],

  ['Dún na nGall',         CUIGI.ULAIDH,      true],
  ['Doire',                CUIGI.ULAIDH,      true],
  ['Aontroim',             CUIGI.ULAIDH,      true],
  ['An Dún',               CUIGI.ULAIDH,      true],
  ['Ard Mhacha',           CUIGI.ULAIDH,      false],
  ['Tír Eoghain',          CUIGI.ULAIDH,      false],
  ['Fear Manach',          CUIGI.ULAIDH,      false],
  ['Muineachán',           CUIGI.ULAIDH,      false],
  ['An Cabhán',            CUIGI.ULAIDH,      false],
];

/** ainm → { ainm, cúige, cósta, focail }. Insertion order is table order. */
const CONTAETHA = new Map(TABLA.map(([ainm, cuige, costa]) => [ainm, Object.freeze({
  ainm, cuige, costa, focail: Object.freeze(ainm.split(' ')),
})]));

/** Every word that begins some county name — what `as` resolves against. */
const CEANNFHOCAIL = new Set([...CONTAETHA.values()].map((c) => c.focail[0]));

/** Every word-prefix of every name, joined, for the greedy read. */
const REAMHRAIN = new Set();
for (const c of CONTAETHA.values()) {
  for (let n = 1; n <= c.focail.length; n++) REAMHRAIN.add(c.focail.slice(0, n).join(' '));
}

/** Could `focail` still be the start of some county name? */
const isReamhran = (focail) => REAMHRAIN.has(focail.join(' '));

/** Does some county name begin with this word? */
const isCeannAinm = (focal) => CEANNFHOCAIL.has(focal);

const isContae = (ainm) => CONTAETHA.has(ainm);

/**
 * The province of a county, `deoraíocht` for exile. Exile answering as its
 * own province is what keeps the border rule at four cases and one
 * comparison — same-province and both-exile collapse into a single equality.
 */
const cuigeDe = (ainm) => {
  const c = CONTAETHA.get(ainm);
  return c ? c.cuige : DEORAIOCHT;
};

/** The counties of a province, in table order. Used by `--graf`. */
const contaethaCuige = (cuige) =>
  [...CONTAETHA.values()].filter((c) => c.cuige === cuige).map((c) => c.ainm);

/**
 * Traditional rivalries — football and hurling pairs, not defended on the
 * merits. The veto sits *above* the border rule, not inside it: no treaty
 * between rivals can exist (E608), whether the pair is same-province or
 * cross-province. Both kinds bite: same-province blocks a file from opening
 * its own province's type; cross-province blocks the treaty itself.
 */
const IOMAIOCHT = [
  // laistigh de chúige
  ['Corcaigh', 'Ciarraí'],                    // An Mhumhain
  ['Baile Átha Cliath', 'An Mhí'],            // Laighin
  ['Gaillimh', 'Maigh Eo'],                   // Connachta
  ['Aontroim', 'An Dún'],                     // Ulaidh
  ['Cill Chainnigh', 'Loch Garman'],          // Laighin
  ['Dún na nGall', 'Tír Eoghain'],            // Ulaidh

  // trasna cúigí
  ['Baile Átha Cliath', 'Ciarraí'],           // Laighin ↔ An Mhumhain
  ['Baile Átha Cliath', 'Maigh Eo'],          // Laighin ↔ Connachta
  ['Ciarraí', 'Tír Eoghain'],                 // An Mhumhain ↔ Ulaidh
  ['Cill Chainnigh', 'Tiobraid Árann'],       // Laighin ↔ An Mhumhain
  ['Cill Chainnigh', 'Corcaigh'],             // Laighin ↔ An Mhumhain
];

/** False the moment either side is exiled (exile is nobody's rival). */
const isIomaiocht = (a, b) =>
  IOMAIOCHT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Every county this one refuses to deal with. For `--graf`. */
const iomaitheoiri = (ainm) => IOMAIOCHT
  .filter(([x, y]) => x === ainm || y === ainm)
  .map(([x, y]) => (x === ainm ? y : x));

/**
 * Invariants checked by the test suite. The prefix check keeps the parser's
 * greedy county reader unambiguous. The rivalry checks keep the list sane and
 * guarantee an escape: every pair of provinces must keep at least one legal
 * county pairing, or a rivalry could seal two provinces off entirely.
 */
function seiceailTabla() {
  const fadhbanna = [];
  if (CONTAETHA.size !== 32) fadhbanna.push(`${CONTAETHA.size} contae, ní 32`);
  if (CONTAETHA.has(DEORAIOCHT)) fadhbanna.push('tá an deoraíocht sa tábla');
  if (CUIGI_UILE.length !== 4) fadhbanna.push(`${CUIGI_UILE.length} cúige, ní 4`);

  const ainmneacha = [...CONTAETHA.keys()];
  for (const a of ainmneacha) {
    for (const b of ainmneacha) {
      if (a === b) continue;
      const fa = CONTAETHA.get(a).focail;
      const fb = CONTAETHA.get(b).focail;
      if (fb.length > fa.length && fa.every((w, i) => w === fb[i])) {
        fadhbanna.push(`is réamhrán é "${a}" de "${b}"`);
      }
    }
  }

  for (const c of CUIGI_UILE) {
    if (!contaethaCuige(c).length) fadhbanna.push(`níl aon chontae i g${c}`);
  }

  const feicthe = new Set();
  for (const [a, b] of IOMAIOCHT) {
    if (!isContae(a)) fadhbanna.push(`ní contae é "${a}" san iomaíocht`);
    if (!isContae(b)) fadhbanna.push(`ní contae é "${b}" san iomaíocht`);
    if (a === b) fadhbanna.push(`iomaíocht le duine féin: "${a}"`);
    const eochair = [a, b].sort().join('\u0000');
    if (feicthe.has(eochair)) fadhbanna.push(`iomaíocht faoi dhó: ${a} / ${b}`);
    feicthe.add(eochair);
  }

  for (const p of CUIGI_UILE) {
    for (const q of CUIGI_UILE) {
      if (p === q) continue;
      const saor = contaethaCuige(p)
        .some((a) => contaethaCuige(q).some((b) => !isIomaiocht(a, b)));
      if (!saor) fadhbanna.push(`níl aon phéire dleathach idir ${p} agus ${q}`);
    }
  }

  return fadhbanna;
}

module.exports = {
  DEORAIOCHT, CUIGI, CUIGI_UILE, CONTAETHA, CEANNFHOCAIL, IOMAIOCHT,
  isReamhran, isCeannAinm, isContae, isIomaiocht, iomaitheoiri,
  cuigeDe, contaethaCuige, seiceailTabla,
};