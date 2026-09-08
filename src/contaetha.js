'use strict';

/*
 * contaetha.js — na 32 contae, agus an rud a bhíonn ann nuair nach bhfuil áit
 * ar bith ann.
 *
 * Vocabulary, not grammar. This is the same status `Iasacht` has in
 * analyzer.js, and it is stated here for the same reason: so that nobody
 * later mistakes it for something that came out of the language.
 *
 * `as` itself is real Irish. It is the preposition of provenance and
 * belonging — *is as Corcaigh mé*, *fear as Doire*, *as Gaillimh* — it is
 * unclaimed in EOCHAIRFHOCAIL, it does not collide with `ó`, and it takes no
 * initial mutation, because the leniting set is `ar de do faoi ó roimh trí um
 * mar gan` and `as` is not in it. So `as` demands FOIRM.BUN, which is what
 * every operator except `ó`, `ar` and `a` already demands, and the government
 * table does not grow. `as Chorcaigh` is E103 with no new code: the mechanism
 * polices `as` correctly by doing nothing.
 *
 * The *list*, though, is a fixed table of proper names the compiler happens to
 * ship. No Irish grammatical phenomenon produces it. The county system is a
 * bit — deliberate, rigorously enforced, and not claimed to have passed the
 * six questions (DEARADH.md §24). Do not let the fact that `as` is well
 * motivated launder the table into a grammar feature.
 *
 * Three consequences worth writing down where someone will read them:
 *
 *  1. The set is closed at 32. That is the point, and it is what makes an
 *     unrecognised name a real diagnostic (E602) instead of a free-form tag.
 *
 *  2. Six names carry the definite article — *An Mhí*, *An Clár*, *An Dún* —
 *     and one carries the genitive plural article, *Dún na nGall*. The
 *     definite article is NOT implemented and nothing here implements it
 *     (§21 stands, and Part 4 of the 0.6 brief stands). These are opaque
 *     word sequences in a lookup table. No rule about `an` or `na` is stated,
 *     derived, or reachable from this file.
 *
 *  3. `nGall` in *Dún na nGall* is an eclipsed form, and so is `Fhailí` in
 *     *Uíbh Fhailí* a lenited one. Both are frozen inside proper names. They
 *     are not produced by morphology.js and they demand nothing:
 *     `foirmDe(lemma, FOIRM.URAITHE)` still throws, because there is still no
 *     syntactic slot that asks for eclipsis (§12). The temptation to reach
 *     for `as an mbaile` is explicitly refused: that eclipsis belongs to the
 *     article, which is future research.
 *
 * All of the Irish here needs a fluent reader. The county names are standard
 * and I am confident in them; `deoraíocht` in this position is the thing to
 * check.
 */

/**
 * `deoraíocht` — "exile". Where a value is when it is from nowhere:
 * primitives, `Iasacht`, and any `struchtúr` declared without `as`.
 *
 * Two asymmetries against a real county, both deliberate (§24.3):
 *
 *   - It is non-exclusive. A county holds one struct; exile holds any number,
 *     because exile is not a place and so has no single occupant. Without
 *     this a program could hold at most 32 struct types in total.
 *
 *   - It cannot sign a treaty. An agreement is between two parties and exile
 *     is not a party. So exile trades with nobody, and no `comhaontú` can
 *     rescue it. What is *not* forbidden is exile↔exile, because that is not
 *     trade: there is no border between two things that are from nowhere.
 *
 * It is not writable. You do not declare yourself from exile; exile is what
 * you are when you declare nothing. `as deoraíocht` is E605.
 */
const DEORAIOCHT = 'deoraíocht';

const CUIGI = Object.freeze({
  LAIGHIN: 'Laighin',
  MUMHAIN: 'An Mhumhain',
  CONNACHTA: 'Connachta',
  ULAIDH: 'Ulaidh',
});

/*
 * Two orthogonal axes are carried and nothing reads them yet.
 *
 * They are here so that §24.4 — county personality — has real, checkable
 * properties to be derived from, rather than 32 hand-authored behaviours that
 * rot into "why does Liatroim do *that*". The one candidate worth building
 * first is restricting `ó "…"` on foreign modules to coastal counties: ports
 * import goods, ports import modules. That is deferred out of 0.6 and this
 * data is inert until it lands.
 *
 * `cósta` is sea coast, so Liatroim is coastal on the strength of about four
 * kilometres at Tullaghan, and Ard Mhacha is not coastal despite Loch nEathach.
 */
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

/**
 * Every word that begins some county name. This is what `as` resolves its
 * complement against, so that the ordinary agreement check has something to
 * ask about — exactly as `ó` asks the symbol table.
 */
const CEANNFHOCAIL = new Set([...CONTAETHA.values()].map((c) => c.focail[0]));

/** Every word-prefix of every name, joined, for the greedy read. */
const REAMHRAIN = new Set();
for (const c of CONTAETHA.values()) {
  for (let n = 1; n <= c.focail.length; n++) REAMHRAIN.add(c.focail.slice(0, n).join(' '));
}

/** Could `focail` still be the start of some county name? */
const isReamhran = (focail) => REAMHRAIN.has(focail.join(' '));

/** Does some county name begin with this word? The predicate `as` governs. */
const isCeannAinm = (focal) => CEANNFHOCAIL.has(focal);

const isContae = (ainm) => CONTAETHA.has(ainm);

/**
 * Traditional rivalries. Read by `--graf` and by nothing else, ever.
 *
 * Refusing a treaty between these outright was considered and rejected
 * (§24.5): it is a hard-coded exception in a system whose only claim to
 * seriousness is uniformity, and it would make one 6xx code mean two unrelated
 * things. Here the joke cannot rot, because it is presentation and the
 * compiler never consults it. A treaty between rivals is perfectly legal and
 * behaves exactly like any other; it just gets a mark in the graph.
 */
const IOMAIOCHT = [
  ['Corcaigh', 'Ciarraí'],
  ['Baile Átha Cliath', 'An Mhí'],
  ['Gaillimh', 'Maigh Eo'],
  ['Aontroim', 'An Dún'],
  ['Cill Chainnigh', 'Loch Garman'],
];

const isIomaiocht = (a, b) =>
  IOMAIOCHT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * The invariants the greedy read depends on, checked by the test suite rather
 * than thrown at require time.
 *
 * The second one is the load-bearing one: no county name is a proper prefix
 * of another, so reading identifiers greedily while the phrase remains a
 * prefix is unambiguous, and the parser never has to backtrack. If a name is
 * ever added that breaks it, the reader stops being able to tell where a
 * county ends and the next statement begins.
 */
function seiceailTabla() {
  const fadhbanna = [];
  if (CONTAETHA.size !== 32) fadhbanna.push(`${CONTAETHA.size} contae, ní 32`);
  if (CONTAETHA.has(DEORAIOCHT)) fadhbanna.push('tá an deoraíocht sa tábla');
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
  return fadhbanna;
}

module.exports = {
  DEORAIOCHT, CUIGI, CONTAETHA, CEANNFHOCAIL, IOMAIOCHT,
  isReamhran, isCeannAinm, isContae, isIomaiocht, seiceailTabla,
};